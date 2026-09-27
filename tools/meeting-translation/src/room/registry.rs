use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use base64::Engine;
use sha2::{Digest, Sha256};
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

use crate::recognizer::SpeechRecognizer;
use crate::translator::Translator;

use super::actor::{RoomCommand, spawn_room};

const RECONNECT_GRACE: Duration = Duration::from_secs(5);
const RATE_LIMIT_WINDOW: Duration = Duration::from_secs(10 * 60);
const RATE_LIMIT_MAX: usize = 5;

struct RoomEntry {
    sender: mpsc::Sender<RoomCommand>,
    // Retaining the handle keeps the actor task observable until its room entry is removed.
    #[allow(dead_code)]
    handle: tokio::task::JoinHandle<()>,
    pending_expiry: Option<oneshot::Sender<()>>,
}

pub struct RoomRegistry {
    translator: Arc<dyn Translator>,
    recognizer: Arc<dyn SpeechRecognizer>,
    glossary: Vec<String>,
    rooms: Mutex<HashMap<String, RoomEntry>>,
    became_empty_tx: mpsc::UnboundedSender<String>,
    // The receiver guard spans recv().await, so it must use an async-aware mutex.
    became_empty_rx: tokio::sync::Mutex<mpsc::UnboundedReceiver<String>>,
    creation_times_by_ip: Mutex<HashMap<IpAddr, Vec<Instant>>>,
}

impl RoomRegistry {
    pub fn new(
        translator: Arc<dyn Translator>,
        recognizer: Arc<dyn SpeechRecognizer>,
        glossary: Vec<String>,
    ) -> Arc<Self> {
        let (became_empty_tx, became_empty_rx) = mpsc::unbounded_channel();
        Arc::new(Self {
            translator,
            recognizer,
            glossary,
            rooms: Mutex::new(HashMap::new()),
            became_empty_tx,
            became_empty_rx: tokio::sync::Mutex::new(became_empty_rx),
            creation_times_by_ip: Mutex::new(HashMap::new()),
        })
    }

    pub async fn run_lifecycle_loop(self: Arc<Self>) {
        loop {
            let room_id = {
                let mut rx = self.became_empty_rx.lock().await;
                match rx.recv().await {
                    Some(id) => id,
                    None => return,
                }
            };
            self.schedule_expiry(room_id);
        }
    }

    pub fn create(&self) -> (String, String) {
        let room_id = Uuid::new_v4().to_string();
        let mut token_bytes = [0u8; 32];
        getrandom::fill(&mut token_bytes).expect("system RNG must be available");
        let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(token_bytes);
        let token_hash: [u8; 32] = Sha256::digest(token.as_bytes()).into();

        let (sender, handle) = spawn_room(
            room_id.clone(),
            token_hash,
            self.became_empty_tx.clone(),
            self.translator.clone(),
            self.glossary.clone(),
            self.recognizer.clone(),
        );
        self.rooms.lock().unwrap().insert(
            room_id.clone(),
            RoomEntry {
                sender,
                handle,
                pending_expiry: None,
            },
        );

        (room_id, token)
    }

    pub fn find(&self, room_id: &str) -> Option<mpsc::Sender<RoomCommand>> {
        let mut rooms = self.rooms.lock().unwrap();
        let entry = rooms.get_mut(room_id)?;
        if let Some(cancel) = entry.pending_expiry.take() {
            let _ = cancel.send(());
        }
        Some(entry.sender.clone())
    }

    #[cfg(test)]
    fn room_exists_for_test(&self, room_id: &str) -> bool {
        self.rooms.lock().unwrap().contains_key(room_id)
    }

    pub fn allow_creation(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let mut creations = self.creation_times_by_ip.lock().unwrap();
        let times = creations.entry(ip).or_default();
        times.retain(|&created_at| now.duration_since(created_at) < RATE_LIMIT_WINDOW);
        if times.len() >= RATE_LIMIT_MAX {
            return false;
        }
        times.push(now);
        true
    }

    fn schedule_expiry(self: &Arc<Self>, room_id: String) {
        let (cancel_tx, cancel_rx) = oneshot::channel();
        {
            let mut rooms = self.rooms.lock().unwrap();
            if let Some(entry) = rooms.get_mut(&room_id) {
                entry.pending_expiry = Some(cancel_tx);
            } else {
                return;
            }
        }

        let registry = self.clone();
        tokio::spawn(async move {
            tokio::select! {
                _ = tokio::time::sleep(RECONNECT_GRACE) => {
                    let sender = {
                        let mut rooms = registry.rooms.lock().unwrap();
                        rooms.remove(&room_id).map(|entry| entry.sender)
                    };
                    drop(sender);
                }
                _ = cancel_rx => {}
            }
        });
    }

    #[cfg(test)]
    async fn pump_lifecycle_events_for_test(self: &Arc<Self>) {
        loop {
            let room_id = {
                let mut rx = self.became_empty_rx.lock().await;
                match rx.try_recv() {
                    Ok(id) => id,
                    Err(_) => break,
                }
            };
            self.schedule_expiry(room_id);
        }
        tokio::task::yield_now().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{ClientMessage, Language};
    use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};
    use crate::translator::{TranslationRequest, Translator};
    use async_trait::async_trait;
    use std::net::{IpAddr, Ipv4Addr};
    use std::sync::Arc;
    use tokio::sync::{mpsc, oneshot};

    struct NoopTranslator;

    #[async_trait]
    impl Translator for NoopTranslator {
        async fn translate(&self, request: TranslationRequest) -> Result<String, ()> {
            Ok(request.source_text)
        }
    }

    struct NoopRecognizer;

    #[async_trait]
    impl SpeechRecognizer for NoopRecognizer {
        async fn start(
            &self,
            _language: Language,
            _events: mpsc::UnboundedSender<RecognitionEvent>,
        ) -> Result<Box<dyn RecognitionSession>, ()> {
            Err(())
        }
    }

    fn test_registry() -> Arc<RoomRegistry> {
        // Tests pump lifecycle events to avoid a background task racing paused time.
        RoomRegistry::new(Arc::new(NoopTranslator), Arc::new(NoopRecognizer), vec![])
    }

    async fn join(
        room: &mpsc::Sender<RoomCommand>,
        room_id: &str,
        token: &str,
    ) -> crate::room::actor::JoinOutcome {
        let (connection, _inbox) = mpsc::unbounded_channel();
        let (reply_tx, reply_rx) = oneshot::channel();
        room.send(RoomCommand::Join {
            connection,
            message: ClientMessage::Join {
                room_id: room_id.to_string(),
                token: token.to_string(),
                display_name: "Alice".to_string(),
                speech_language: Language::Japanese,
                display_language: Language::English,
                consent: true,
            },
            reply: reply_tx,
        })
        .await
        .unwrap();
        reply_rx.await.unwrap()
    }

    #[tokio::test]
    async fn create_then_find_can_join_with_the_returned_token() {
        let registry = test_registry();
        let (room_id, token) = registry.create();

        let sender = registry
            .find(&room_id)
            .expect("room should exist right after creation");
        let outcome = join(&sender, &room_id, &token).await;
        assert!(matches!(
            outcome,
            crate::room::actor::JoinOutcome::Joined { .. }
        ));
    }

    #[tokio::test]
    async fn find_returns_none_for_an_unknown_room() {
        let registry = test_registry();
        assert!(registry.find("no-such-room").is_none());
    }

    #[tokio::test(start_paused = true)]
    async fn room_survives_a_rejoin_within_the_grace_period_and_is_gone_after() {
        let registry = test_registry();
        let (room_id, token) = registry.create();
        let sender = registry.find(&room_id).unwrap();

        let outcome = join(&sender, &room_id, &token).await;
        let participant_id = match outcome {
            crate::room::actor::JoinOutcome::Joined { participant_id } => participant_id,
            other => panic!("expected Joined, got {other:?}"),
        };
        sender
            .send(RoomCommand::Disconnect { participant_id })
            .await
            .unwrap();
        tokio::time::advance(std::time::Duration::from_millis(1)).await;
        registry.pump_lifecycle_events_for_test().await;

        tokio::time::advance(std::time::Duration::from_secs(4)).await;
        assert!(
            registry.room_exists_for_test(&room_id),
            "still within the 5s grace period"
        );

        tokio::time::advance(std::time::Duration::from_secs(2)).await;
        registry.pump_lifecycle_events_for_test().await;
        assert!(
            !registry.room_exists_for_test(&room_id),
            "grace period has elapsed"
        );
    }

    #[tokio::test(start_paused = true)]
    async fn rejoin_within_grace_period_cancels_the_pending_expiry() {
        let registry = test_registry();
        let (room_id, token) = registry.create();
        let sender = registry.find(&room_id).unwrap();

        let outcome = join(&sender, &room_id, &token).await;
        let participant_id = match outcome {
            crate::room::actor::JoinOutcome::Joined { participant_id } => participant_id,
            other => panic!("expected Joined, got {other:?}"),
        };
        sender
            .send(RoomCommand::Disconnect { participant_id })
            .await
            .unwrap();
        tokio::time::advance(std::time::Duration::from_millis(1)).await;
        registry.pump_lifecycle_events_for_test().await;

        tokio::time::advance(std::time::Duration::from_secs(4)).await;
        let sender = registry
            .find(&room_id)
            .expect("room should still exist within the grace period");
        let rejoin_outcome = join(&sender, &room_id, &token).await;
        assert!(matches!(
            rejoin_outcome,
            crate::room::actor::JoinOutcome::Joined { .. }
        ));

        tokio::time::advance(std::time::Duration::from_secs(2)).await;
        registry.pump_lifecycle_events_for_test().await;
        assert!(
            registry.room_exists_for_test(&room_id),
            "a rejoin within the grace period must cancel the pending expiry"
        );
    }

    #[test]
    fn rate_limiter_allows_five_then_rejects_the_sixth_within_the_window() {
        let registry = test_registry();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        for _ in 0..5 {
            assert!(registry.allow_creation(ip));
        }
        assert!(!registry.allow_creation(ip));
    }
}
