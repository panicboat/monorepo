use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

use crate::protocol::{
    Caption, CaptionKind, CaptionState, ClientMessage, Participant, ServerMessage, StatusCode,
};
use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};
use crate::translator::{TranslationRequest, Translator};

use super::registry::RoomBecameEmpty;

const MAX_PARTICIPANTS: usize = 3;
const MAX_CONTEXT_CAPTIONS: usize = 12;
const TRANSLATION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

enum InternalEvent {
    Command(RoomCommand),
    TranslationDone {
        caption_id: Uuid,
        result: Result<String, ()>,
    },
    Recognition {
        participant_id: Uuid,
        event: RecognitionEvent,
    },
    SessionStarted {
        participant_id: Uuid,
        session: Box<dyn RecognitionSession>,
    },
    // Explicit exit signal prevents the actor loop from retaining its own sender.
    Shutdown,
}

pub type Connection = mpsc::UnboundedSender<ServerMessage>;

#[derive(Debug)]
pub enum JoinOutcome {
    Joined { participant_id: Uuid },
    InvalidMessage,
    RoomNotFound,
    RoomFull,
}

pub enum RoomCommand {
    Join {
        connection: Connection,
        message: ClientMessage,
        reply: oneshot::Sender<JoinOutcome>,
    },
    HandleMessage {
        participant_id: Uuid,
        message: ClientMessage,
    },
    WriteAudio {
        participant_id: Uuid,
        chunk: Vec<u8>,
    },
    Disconnect {
        participant_id: Uuid,
        reconnectable: bool,
    },
}

struct ActiveParticipant {
    participant: Participant,
    connection: Connection,
    recognition_session: Option<Box<dyn RecognitionSession>>,
}

/// Room state stays task-confined because every mutation is serialized through the command channel.
struct RoomActor {
    room_id: String,
    join_token_hash: [u8; 32],
    participants: HashMap<Uuid, ActiveParticipant>,
    became_empty: mpsc::UnboundedSender<RoomBecameEmpty>,
    translator: Arc<dyn Translator>,
    recognizer: Arc<dyn SpeechRecognizer>,
    glossary: Vec<String>,
    captions: HashMap<Uuid, Caption>,
    context: Vec<Caption>,
    sequence: u64,
    translation_queue: std::collections::VecDeque<Uuid>,
    translation_in_flight: bool,
}

/// The returned channel is the sole mutation boundary for this room.
pub fn spawn_room(
    room_id: String,
    join_token_hash: [u8; 32],
    became_empty: mpsc::UnboundedSender<RoomBecameEmpty>,
    translator: Arc<dyn Translator>,
    glossary: Vec<String>,
    recognizer: Arc<dyn SpeechRecognizer>,
) -> (mpsc::Sender<RoomCommand>, tokio::task::JoinHandle<()>) {
    let (tx, mut rx) = mpsc::channel(64);
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<InternalEvent>();

    let forward_tx = event_tx.clone();
    tokio::spawn(async move {
        while let Some(command) = rx.recv().await {
            if forward_tx.send(InternalEvent::Command(command)).is_err() {
                break;
            }
        }
        // Closed command channel means all RoomCommand senders are gone.
        let _ = forward_tx.send(InternalEvent::Shutdown);
    });

    let handle = tokio::spawn(async move {
        let mut actor = RoomActor {
            room_id,
            join_token_hash,
            participants: HashMap::new(),
            became_empty,
            translator,
            recognizer,
            glossary,
            captions: HashMap::new(),
            context: Vec::new(),
            sequence: 0,
            translation_queue: std::collections::VecDeque::new(),
            translation_in_flight: false,
        };

        while let Some(event) = event_rx.recv().await {
            match event {
                InternalEvent::Command(command) => actor.handle(command, event_tx.clone()),
                InternalEvent::TranslationDone { caption_id, result } => {
                    actor.finish_translation(caption_id, result);
                    actor.translation_in_flight = false;
                    actor.drain_translation_queue(event_tx.clone());
                }
                InternalEvent::SessionStarted {
                    participant_id,
                    session,
                } => {
                    if let Some(active) = actor.participants.get_mut(&participant_id) {
                        active.recognition_session = Some(session);
                    } else {
                        session.stop();
                    }
                }
                InternalEvent::Recognition {
                    participant_id,
                    event,
                } => {
                    actor.handle_recognition_event(participant_id, event, event_tx.clone());
                }
                InternalEvent::Shutdown => break,
            }
        }
    });

    (tx, handle)
}

impl RoomActor {
    fn handle(&mut self, command: RoomCommand, event_tx: mpsc::UnboundedSender<InternalEvent>) {
        match command {
            RoomCommand::Join {
                connection,
                message,
                reply,
            } => {
                let outcome = self.join(connection, message);
                // SILENT: A dropped join requester needs no response.
                let _ = reply.send(outcome);
            }
            RoomCommand::HandleMessage {
                participant_id,
                message,
            } => {
                self.handle_message(participant_id, message, event_tx);
            }
            RoomCommand::WriteAudio {
                participant_id,
                chunk,
            } => {
                if let Some(active) = self.participants.get(&participant_id) {
                    if let Some(session) = &active.recognition_session {
                        session.write(chunk);
                    }
                }
            }
            RoomCommand::Disconnect {
                participant_id,
                reconnectable,
            } => {
                self.disconnect(participant_id, reconnectable);
            }
        }
    }

    fn join(&mut self, connection: Connection, message: ClientMessage) -> JoinOutcome {
        let ClientMessage::Join {
            room_id,
            token,
            display_name,
            speech_language,
            display_language,
            consent,
        } = message
        else {
            return JoinOutcome::InvalidMessage;
        };
        if !consent {
            return JoinOutcome::InvalidMessage;
        }
        if room_id != self.room_id || !self.token_matches(&token) {
            return JoinOutcome::RoomNotFound;
        }
        if self.participants.len() >= MAX_PARTICIPANTS {
            return JoinOutcome::RoomFull;
        }

        let participant = Participant {
            id: Uuid::new_v4(),
            display_name,
            speech_language,
            display_language,
        };
        let participant_id = participant.id;

        let roster = self
            .participants
            .values()
            .map(|active| active.participant.clone())
            .chain(std::iter::once(participant.clone()))
            .collect();
        // SILENT: A client that closes during join cannot receive the initial roster.
        let _ = connection.send(ServerMessage::RoomJoined {
            participant_id,
            participants: roster,
        });
        self.broadcast(
            ServerMessage::ParticipantJoined {
                participant: participant.clone(),
            },
            None,
        );

        self.participants.insert(
            participant_id,
            ActiveParticipant {
                participant,
                connection,
                recognition_session: None,
            },
        );
        JoinOutcome::Joined { participant_id }
    }

    fn handle_message(
        &mut self,
        participant_id: Uuid,
        message: ClientMessage,
        event_tx: mpsc::UnboundedSender<InternalEvent>,
    ) {
        let Some(active) = self.participants.get(&participant_id) else {
            return;
        };
        let speaker = active.participant.clone();

        match message {
            ClientMessage::CaptionManual { text } => {
                self.enqueue_caption(
                    speaker.clone(),
                    speaker.speech_language,
                    text,
                    CaptionKind::Manual,
                    event_tx,
                );
            }
            ClientMessage::AudioStart => {
                self.start_recognition(participant_id, speaker.speech_language, event_tx);
            }
            ClientMessage::AudioStop => {
                self.stop_recognition(participant_id);
            }
            ClientMessage::Leave => {
                self.disconnect(participant_id, false);
            }
            ClientMessage::Join { .. } => {}
        }
    }

    fn start_recognition(
        &mut self,
        participant_id: Uuid,
        language: crate::protocol::Language,
        event_tx: mpsc::UnboundedSender<InternalEvent>,
    ) {
        if self
            .participants
            .get(&participant_id)
            .and_then(|participant| participant.recognition_session.as_ref())
            .is_some()
        {
            return;
        }
        let recognizer = self.recognizer.clone();
        let (events_tx, mut events_rx) = mpsc::unbounded_channel();
        let forward_tx = event_tx.clone();
        tokio::spawn(async move {
            while let Some(event) = events_rx.recv().await {
                if forward_tx
                    .send(InternalEvent::Recognition {
                        participant_id,
                        event,
                    })
                    .is_err()
                {
                    break;
                }
            }
        });

        let started_tx = event_tx.clone();
        tokio::spawn(async move {
            match recognizer.start(language, events_tx).await {
                Ok(session) => {
                    // SILENT: Actor shutdown can race with recognition startup.
                    let _ = started_tx.send(InternalEvent::SessionStarted {
                        participant_id,
                        session,
                    });
                }
                Err(()) => {
                    // SILENT: Actor shutdown can race with recognition startup.
                    let _ = started_tx.send(InternalEvent::Recognition {
                        participant_id,
                        event: RecognitionEvent::Error,
                    });
                }
            }
        });
    }

    fn stop_recognition(&mut self, participant_id: Uuid) {
        if let Some(active) = self.participants.get_mut(&participant_id) {
            if let Some(session) = active.recognition_session.take() {
                session.stop();
            }
        }
    }

    fn handle_recognition_event(
        &mut self,
        participant_id: Uuid,
        event: RecognitionEvent,
        event_tx: mpsc::UnboundedSender<InternalEvent>,
    ) {
        let Some(active) = self.participants.get(&participant_id) else {
            return;
        };
        let speaker = active.participant.clone();
        let connection = active.connection.clone();

        match event {
            RecognitionEvent::Partial(text) => {
                // SILENT: A disconnected client cannot receive recognition previews.
                let _ = connection.send(ServerMessage::CaptionPreview {
                    speaker_id: participant_id,
                    source_text: text,
                });
            }
            RecognitionEvent::Final(text) => {
                let language = speaker.speech_language;
                self.enqueue_caption(speaker, language, text, CaptionKind::Speech, event_tx);
            }
            RecognitionEvent::Error => {
                self.broadcast(
                    ServerMessage::Status {
                        code: StatusCode::RecognitionUnavailable,
                    },
                    None,
                );
            }
            RecognitionEvent::Reconnecting => {
                self.broadcast(
                    ServerMessage::Status {
                        code: StatusCode::Reconnecting,
                    },
                    None,
                );
            }
            RecognitionEvent::Reconnected => {
                self.broadcast(
                    ServerMessage::Status {
                        code: StatusCode::RecognitionAvailable,
                    },
                    None,
                );
            }
        }
    }

    fn enqueue_caption(
        &mut self,
        speaker: Participant,
        source_language: crate::protocol::Language,
        source_text: String,
        kind: CaptionKind,
        event_tx: mpsc::UnboundedSender<InternalEvent>,
    ) {
        self.sequence += 1;
        let caption = Caption {
            id: Uuid::new_v4(),
            sequence: self.sequence,
            speaker,
            source_language,
            source_text,
            translated_text: None,
            kind,
            state: CaptionState::Translating,
            created_at_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        };
        let caption_id = caption.id;
        self.captions.insert(caption_id, caption.clone());
        self.broadcast(ServerMessage::CaptionUpdate { caption }, None);
        self.translation_queue.push_back(caption_id);
        self.drain_translation_queue(event_tx);
    }

    fn drain_translation_queue(&mut self, event_tx: mpsc::UnboundedSender<InternalEvent>) {
        if self.translation_in_flight {
            return;
        }
        let Some(caption_id) = self.translation_queue.pop_front() else {
            return;
        };
        let Some(caption) = self.captions.get(&caption_id) else {
            return;
        };

        self.translation_in_flight = true;
        let request = TranslationRequest {
            source_text: caption.source_text.clone(),
            source_language: caption.source_language,
            target_language: caption.source_language.opposite(),
            context: self.context.clone(),
            glossary: self.glossary.clone(),
        };
        let translator = self.translator.clone();

        tokio::spawn(async move {
            let result = tokio::time::timeout(TRANSLATION_TIMEOUT, translator.translate(request))
                .await
                .unwrap_or(Err(()));
            let _ = event_tx.send(InternalEvent::TranslationDone { caption_id, result });
        });
    }

    fn finish_translation(&mut self, caption_id: Uuid, result: Result<String, ()>) {
        let Some(caption) = self.captions.get_mut(&caption_id) else {
            return;
        };
        match result {
            Ok(text) => {
                caption.translated_text = Some(text);
                caption.state = CaptionState::Final;
                let finished = caption.clone();
                self.context.push(finished.clone());
                if self.context.len() > MAX_CONTEXT_CAPTIONS {
                    self.context.remove(0);
                }
                self.broadcast(ServerMessage::CaptionUpdate { caption: finished }, None);
            }
            Err(()) => {
                caption.state = CaptionState::Failed;
                let failed = caption.clone();
                self.broadcast(ServerMessage::CaptionUpdate { caption: failed }, None);
                self.broadcast(
                    ServerMessage::Status {
                        code: StatusCode::TranslationUnavailable,
                    },
                    None,
                );
            }
        }
    }

    fn disconnect(&mut self, participant_id: Uuid, reconnectable: bool) {
        let Some(mut removed) = self.participants.remove(&participant_id) else {
            return;
        };
        if let Some(session) = removed.recognition_session.take() {
            session.stop();
        }
        self.broadcast(
            ServerMessage::ParticipantLeft {
                participant: removed.participant,
            },
            None,
        );
        if self.participants.is_empty() {
            // SILENT: Room manager shutdown can race with the last participant leaving.
            let _ = self.became_empty.send(RoomBecameEmpty {
                room_id: self.room_id.clone(),
                reconnectable,
            });
        }
    }

    fn token_matches(&self, token: &str) -> bool {
        let candidate = Sha256::digest(token.as_bytes());
        bool::from(candidate.as_slice().ct_eq(&self.join_token_hash))
    }

    fn broadcast(&self, message: ServerMessage, exclude: Option<Uuid>) {
        for (id, active) in &self.participants {
            if Some(*id) != exclude {
                // SILENT: A disconnected client cannot receive later room updates.
                let _ = active.connection.send(message.clone());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{ClientMessage, Language, ServerMessage};
    use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};
    use async_trait::async_trait;
    use sha2::{Digest, Sha256};
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::sync::{mpsc, oneshot};

    struct NoopSession;

    impl RecognitionSession for NoopSession {
        fn write(&self, _chunk: Vec<u8>) {}

        fn stop(self: Box<Self>) {}
    }

    struct NoopRecognizer;

    #[async_trait]
    impl SpeechRecognizer for NoopRecognizer {
        async fn start(
            &self,
            _language: Language,
            _events: mpsc::UnboundedSender<RecognitionEvent>,
        ) -> Result<Box<dyn RecognitionSession>, ()> {
            Ok(Box::new(NoopSession))
        }
    }

    fn token_hash(token: &str) -> [u8; 32] {
        Sha256::digest(token.as_bytes()).into()
    }

    fn join_message(token: &str, name: &str) -> ClientMessage {
        ClientMessage::Join {
            room_id: "room-1".to_string(),
            token: token.to_string(),
            display_name: name.to_string(),
            speech_language: Language::Japanese,
            display_language: Language::English,
            consent: true,
        }
    }

    async fn join(
        room: &mpsc::Sender<RoomCommand>,
        token: &str,
        name: &str,
    ) -> (JoinOutcome, mpsc::UnboundedReceiver<ServerMessage>) {
        let (connection, inbox) = mpsc::unbounded_channel();
        let (reply_tx, reply_rx) = oneshot::channel();
        room.send(RoomCommand::Join {
            connection,
            message: join_message(token, name),
            reply: reply_tx,
        })
        .await
        .unwrap();
        (reply_rx.await.unwrap(), inbox)
    }

    #[tokio::test]
    async fn join_then_second_participant_broadcasts_to_first_only() {
        let (became_empty_tx, _became_empty_rx) = mpsc::unbounded_channel();
        let (room, _handle) = spawn_room(
            "room-1".to_string(),
            token_hash("secret"),
            became_empty_tx,
            Arc::new(translation_tests::FakeTranslator {
                delay: Duration::ZERO,
                fail: false,
            }),
            vec![],
            Arc::new(NoopRecognizer),
        );

        let (outcome_a, mut inbox_a) = join(&room, "secret", "Alice").await;
        assert!(matches!(outcome_a, JoinOutcome::Joined { .. }));
        // The joiner's own RoomJoined message.
        assert!(matches!(
            inbox_a.recv().await.unwrap(),
            ServerMessage::RoomJoined { .. }
        ));

        let (outcome_b, _inbox_b) = join(&room, "secret", "Bob").await;
        assert!(matches!(outcome_b, JoinOutcome::Joined { .. }));

        // Alice is told about Bob; Bob is not told about himself.
        assert!(matches!(
            inbox_a.recv().await.unwrap(),
            ServerMessage::ParticipantJoined { .. }
        ));
    }

    #[tokio::test]
    async fn wrong_token_is_room_not_found() {
        let (became_empty_tx, _rx) = mpsc::unbounded_channel();
        let (room, _handle) = spawn_room(
            "room-1".to_string(),
            token_hash("secret"),
            became_empty_tx,
            Arc::new(translation_tests::FakeTranslator {
                delay: Duration::ZERO,
                fail: false,
            }),
            vec![],
            Arc::new(NoopRecognizer),
        );

        let (outcome, _inbox) = join(&room, "wrong-token", "Alice").await;
        assert!(matches!(outcome, JoinOutcome::RoomNotFound));
    }

    #[tokio::test]
    async fn fourth_participant_is_rejected_as_room_full() {
        let (became_empty_tx, _rx) = mpsc::unbounded_channel();
        let (room, _handle) = spawn_room(
            "room-1".to_string(),
            token_hash("secret"),
            became_empty_tx,
            Arc::new(translation_tests::FakeTranslator {
                delay: Duration::ZERO,
                fail: false,
            }),
            vec![],
            Arc::new(NoopRecognizer),
        );

        for name in ["Alice", "Bob", "Carol"] {
            let (outcome, _inbox) = join(&room, "secret", name).await;
            assert!(matches!(outcome, JoinOutcome::Joined { .. }));
        }

        let (outcome, _inbox) = join(&room, "secret", "Dave").await;
        assert!(matches!(outcome, JoinOutcome::RoomFull));
    }

    mod translation_tests {
        use super::super::*;
        use super::NoopRecognizer;
        use crate::protocol::{CaptionState, ClientMessage, Language, ServerMessage};
        use crate::translator::{TranslationRequest, Translator};
        use async_trait::async_trait;
        use sha2::{Digest, Sha256};
        use std::sync::Arc;
        use std::time::Duration;
        use tokio::sync::{mpsc, oneshot};

        pub(super) struct FakeTranslator {
            pub(super) delay: Duration,
            pub(super) fail: bool,
        }

        #[async_trait]
        impl Translator for FakeTranslator {
            async fn translate(&self, request: TranslationRequest) -> Result<String, ()> {
                tokio::time::sleep(self.delay).await;
                if self.fail {
                    Err(())
                } else {
                    Ok(format!("[translated] {}", request.source_text))
                }
            }
        }

        fn token_hash(token: &str) -> [u8; 32] {
            Sha256::digest(token.as_bytes()).into()
        }

        async fn spawn_test_room(translator: Arc<dyn Translator>) -> mpsc::Sender<RoomCommand> {
            let (became_empty_tx, _rx) = mpsc::unbounded_channel();
            let (room, _handle) = spawn_room(
                "room-1".to_string(),
                token_hash("secret"),
                became_empty_tx,
                translator,
                vec![],
                Arc::new(NoopRecognizer),
            );
            room
        }

        async fn join_and_drain(
            room: &mpsc::Sender<RoomCommand>,
            name: &str,
        ) -> (uuid::Uuid, mpsc::UnboundedReceiver<ServerMessage>) {
            let (connection, mut inbox) = mpsc::unbounded_channel();
            let (reply_tx, reply_rx) = oneshot::channel();
            room.send(RoomCommand::Join {
                connection,
                message: ClientMessage::Join {
                    room_id: "room-1".to_string(),
                    token: "secret".to_string(),
                    display_name: name.to_string(),
                    speech_language: Language::Japanese,
                    display_language: Language::English,
                    consent: true,
                },
                reply: reply_tx,
            })
            .await
            .unwrap();
            let id = match reply_rx.await.unwrap() {
                JoinOutcome::Joined { participant_id } => participant_id,
                other => panic!("expected Joined, got {other:?}"),
            };
            inbox.recv().await.unwrap(); // RoomJoined
            (id, inbox)
        }

        #[tokio::test]
        async fn manual_caption_becomes_final_after_translation() {
            let room = spawn_test_room(Arc::new(FakeTranslator {
                delay: Duration::ZERO,
                fail: false,
            }))
            .await;
            let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

            room.send(RoomCommand::HandleMessage {
                participant_id,
                message: ClientMessage::CaptionManual {
                    text: "hello".to_string(),
                },
            })
            .await
            .unwrap();

            let ServerMessage::CaptionUpdate { caption } = inbox.recv().await.unwrap() else {
                panic!("expected CaptionUpdate");
            };
            assert_eq!(caption.state, CaptionState::Translating);

            let ServerMessage::CaptionUpdate { caption } = inbox.recv().await.unwrap() else {
                panic!("expected CaptionUpdate");
            };
            assert_eq!(caption.state, CaptionState::Final);
            assert_eq!(
                caption.translated_text.as_deref(),
                Some("[translated] hello")
            );
        }

        #[tokio::test]
        async fn failed_translation_marks_caption_failed_and_notifies_room() {
            let room = spawn_test_room(Arc::new(FakeTranslator {
                delay: Duration::ZERO,
                fail: true,
            }))
            .await;
            let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

            room.send(RoomCommand::HandleMessage {
                participant_id,
                message: ClientMessage::CaptionManual {
                    text: "hello".to_string(),
                },
            })
            .await
            .unwrap();

            inbox.recv().await.unwrap(); // Translating
            let ServerMessage::CaptionUpdate { caption } = inbox.recv().await.unwrap() else {
                panic!("expected CaptionUpdate");
            };
            assert_eq!(caption.state, CaptionState::Failed);
            assert!(matches!(
                inbox.recv().await.unwrap(),
                ServerMessage::Status {
                    code: crate::protocol::StatusCode::TranslationUnavailable
                }
            ));
        }

        struct VariableDelayTranslator;

        #[async_trait]
        impl Translator for VariableDelayTranslator {
            async fn translate(&self, request: TranslationRequest) -> Result<String, ()> {
                // "first" is slower so concurrent translation would reverse final order.
                let delay = if request.source_text == "first" {
                    Duration::from_millis(100)
                } else {
                    Duration::from_millis(10)
                };
                tokio::time::sleep(delay).await;
                Ok(format!("[translated] {}", request.source_text))
            }
        }

        #[tokio::test]
        async fn second_caption_does_not_translate_until_the_first_resolves() {
            let room = spawn_test_room(Arc::new(VariableDelayTranslator)).await;
            let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

            room.send(RoomCommand::HandleMessage {
                participant_id,
                message: ClientMessage::CaptionManual {
                    text: "first".to_string(),
                },
            })
            .await
            .unwrap();
            room.send(RoomCommand::HandleMessage {
                participant_id,
                message: ClientMessage::CaptionManual {
                    text: "second".to_string(),
                },
            })
            .await
            .unwrap();

            let mut states = Vec::new();
            for _ in 0..4 {
                let ServerMessage::CaptionUpdate { caption } = inbox.recv().await.unwrap() else {
                    panic!("expected CaptionUpdate");
                };
                states.push((caption.source_text, caption.state));
            }

            assert_eq!(
                states,
                vec![
                    ("first".to_string(), CaptionState::Translating),
                    ("second".to_string(), CaptionState::Translating),
                    ("first".to_string(), CaptionState::Final),
                    ("second".to_string(), CaptionState::Final),
                ],
                "the second caption's Final must not arrive before the first caption's Final",
            );
        }

        #[tokio::test(start_paused = true)]
        async fn translation_times_out_after_ten_seconds() {
            // The translator never resolves; the room timeout must finish this job.
            let translator = Arc::new(FakeTranslator {
                delay: Duration::from_secs(3600),
                fail: false,
            });
            let room = spawn_test_room(translator).await;
            let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

            room.send(RoomCommand::HandleMessage {
                participant_id,
                message: ClientMessage::CaptionManual {
                    text: "hello".to_string(),
                },
            })
            .await
            .unwrap();
            inbox.recv().await.unwrap(); // Translating

            tokio::time::advance(Duration::from_secs(10)).await;

            let ServerMessage::CaptionUpdate { caption } = inbox.recv().await.unwrap() else {
                panic!("expected CaptionUpdate");
            };
            assert_eq!(caption.state, CaptionState::Failed);
            assert!(matches!(
                inbox.recv().await.unwrap(),
                ServerMessage::Status {
                    code: crate::protocol::StatusCode::TranslationUnavailable
                }
            ));
        }

        #[tokio::test]
        async fn room_actor_task_terminates_once_every_command_sender_is_dropped() {
            let (became_empty_tx, _rx) = mpsc::unbounded_channel();
            let (room, handle) = spawn_room(
                "room-1".to_string(),
                token_hash("secret"),
                became_empty_tx,
                Arc::new(FakeTranslator {
                    delay: Duration::ZERO,
                    fail: false,
                }),
                vec![],
                Arc::new(NoopRecognizer),
            );

            drop(room); // the only RoomCommand sender

            tokio::time::timeout(Duration::from_secs(1), handle)
                .await
                .expect("actor task must exit once its command channel closes")
                .expect("actor task must not panic");
        }

        mod recognition_tests {
            use super::super::*;
            use crate::protocol::{ClientMessage, Language, ServerMessage};
            use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};
            use crate::translator::{TranslationRequest, Translator};
            use async_trait::async_trait;
            use sha2::{Digest, Sha256};
            use std::sync::atomic::{AtomicBool, Ordering};
            use std::sync::{Arc, Mutex};
            use tokio::sync::{mpsc, oneshot};

            struct NoopTranslator;

            #[async_trait]
            impl Translator for NoopTranslator {
                async fn translate(&self, request: TranslationRequest) -> Result<String, ()> {
                    Ok(format!("[translated] {}", request.source_text))
                }
            }

            struct FakeSession {
                written: Arc<Mutex<Vec<Vec<u8>>>>,
                stopped: Arc<AtomicBool>,
            }

            impl RecognitionSession for FakeSession {
                fn write(&self, chunk: Vec<u8>) {
                    self.written.lock().unwrap().push(chunk);
                }

                fn stop(self: Box<Self>) {
                    self.stopped.store(true, Ordering::SeqCst);
                }
            }

            struct FakeRecognizer {
                written: Arc<Mutex<Vec<Vec<u8>>>>,
                stopped: Arc<AtomicBool>,
            }

            #[async_trait]
            impl SpeechRecognizer for FakeRecognizer {
                async fn start(
                    &self,
                    _language: Language,
                    events: mpsc::UnboundedSender<RecognitionEvent>,
                ) -> Result<Box<dyn RecognitionSession>, ()> {
                    let _ = events.send(RecognitionEvent::Partial("hel".to_string()));
                    let _ = events.send(RecognitionEvent::Final("hello".to_string()));
                    Ok(Box::new(FakeSession {
                        written: self.written.clone(),
                        stopped: self.stopped.clone(),
                    }))
                }
            }

            fn token_hash(token: &str) -> [u8; 32] {
                Sha256::digest(token.as_bytes()).into()
            }

            async fn join_and_drain(
                room: &mpsc::Sender<RoomCommand>,
                name: &str,
            ) -> (uuid::Uuid, mpsc::UnboundedReceiver<ServerMessage>) {
                let (connection, mut inbox) = mpsc::unbounded_channel();
                let (reply_tx, reply_rx) = oneshot::channel();
                room.send(RoomCommand::Join {
                    connection,
                    message: ClientMessage::Join {
                        room_id: "room-1".to_string(),
                        token: "secret".to_string(),
                        display_name: name.to_string(),
                        speech_language: Language::Japanese,
                        display_language: Language::English,
                        consent: true,
                    },
                    reply: reply_tx,
                })
                .await
                .unwrap();
                let id = match reply_rx.await.unwrap() {
                    JoinOutcome::Joined { participant_id } => participant_id,
                    other => panic!("expected Joined, got {other:?}"),
                };
                inbox.recv().await.unwrap();
                (id, inbox)
            }

            #[tokio::test]
            async fn audio_start_streams_partial_then_final_becomes_a_caption() {
                let written = Arc::new(Mutex::new(Vec::new()));
                let stopped = Arc::new(AtomicBool::new(false));
                let (became_empty_tx, _rx) = mpsc::unbounded_channel();
                let (room, _handle) = spawn_room(
                    "room-1".to_string(),
                    token_hash("secret"),
                    became_empty_tx,
                    Arc::new(NoopTranslator),
                    vec![],
                    Arc::new(FakeRecognizer {
                        written: written.clone(),
                        stopped: stopped.clone(),
                    }),
                );
                let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

                room.send(RoomCommand::HandleMessage {
                    participant_id,
                    message: ClientMessage::AudioStart,
                })
                .await
                .unwrap();

                assert!(matches!(
                    inbox.recv().await.unwrap(),
                    ServerMessage::CaptionPreview { source_text, .. } if source_text == "hel"
                ));
                let ServerMessage::CaptionUpdate { caption } = inbox.recv().await.unwrap() else {
                    panic!("expected CaptionUpdate");
                };
                assert_eq!(caption.source_text, "hello");

                room.send(RoomCommand::WriteAudio {
                    participant_id,
                    chunk: vec![1, 2, 3],
                })
                .await
                .unwrap();
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                assert_eq!(written.lock().unwrap().as_slice(), &[vec![1u8, 2, 3]]);

                room.send(RoomCommand::HandleMessage {
                    participant_id,
                    message: ClientMessage::AudioStop,
                })
                .await
                .unwrap();
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                assert!(stopped.load(Ordering::SeqCst));
            }

            #[tokio::test]
            async fn disconnect_stops_active_recognition_session() {
                let written = Arc::new(Mutex::new(Vec::new()));
                let stopped = Arc::new(AtomicBool::new(false));
                let (became_empty_tx, _rx) = mpsc::unbounded_channel();
                let (room, _handle) = spawn_room(
                    "room-1".to_string(),
                    token_hash("secret"),
                    became_empty_tx,
                    Arc::new(NoopTranslator),
                    vec![],
                    Arc::new(FakeRecognizer {
                        written: written.clone(),
                        stopped: stopped.clone(),
                    }),
                );
                let (participant_id, _inbox) = join_and_drain(&room, "Alice").await;

                room.send(RoomCommand::HandleMessage {
                    participant_id,
                    message: ClientMessage::AudioStart,
                })
                .await
                .unwrap();

                let marker = vec![4, 5, 6];
                tokio::time::timeout(std::time::Duration::from_secs(1), async {
                    while !written.lock().unwrap().iter().any(|chunk| chunk == &marker) {
                        room.send(RoomCommand::WriteAudio {
                            participant_id,
                            chunk: marker.clone(),
                        })
                        .await
                        .unwrap();
                        tokio::task::yield_now().await;
                    }
                })
                .await
                .expect("recognition session must be installed before disconnect");

                room.send(RoomCommand::Disconnect {
                    participant_id,
                    reconnectable: true,
                })
                .await
                .unwrap();
                tokio::time::timeout(std::time::Duration::from_secs(1), async {
                    while !stopped.load(Ordering::SeqCst) {
                        tokio::task::yield_now().await;
                    }
                })
                .await
                .expect("disconnect must stop the active recognition session");
                assert!(stopped.load(Ordering::SeqCst));
            }

            #[tokio::test]
            async fn write_audio_without_active_session_is_a_silent_no_op() {
                let written = Arc::new(Mutex::new(Vec::new()));
                let stopped = Arc::new(AtomicBool::new(false));
                let (became_empty_tx, _rx) = mpsc::unbounded_channel();
                let (room, _handle) = spawn_room(
                    "room-1".to_string(),
                    token_hash("secret"),
                    became_empty_tx,
                    Arc::new(NoopTranslator),
                    vec![],
                    Arc::new(FakeRecognizer {
                        written: written.clone(),
                        stopped,
                    }),
                );
                let (participant_id, _inbox) = join_and_drain(&room, "Alice").await;

                room.send(RoomCommand::WriteAudio {
                    participant_id,
                    chunk: vec![9],
                })
                .await
                .unwrap();
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                assert!(written.lock().unwrap().is_empty());
            }
        }
    }
}
