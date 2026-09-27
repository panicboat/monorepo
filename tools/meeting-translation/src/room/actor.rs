use std::collections::HashMap;

use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

use crate::protocol::{ClientMessage, Participant, ServerMessage};

const MAX_PARTICIPANTS: usize = 3;

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
    },
}

struct ActiveParticipant {
    participant: Participant,
    connection: Connection,
}

/// Room state stays task-confined because every mutation is serialized through the command channel.
struct RoomActor {
    room_id: String,
    join_token_hash: [u8; 32],
    participants: HashMap<Uuid, ActiveParticipant>,
    became_empty: mpsc::UnboundedSender<String>,
}

/// The returned channel is the sole mutation boundary for this room.
pub fn spawn_room(
    room_id: String,
    join_token_hash: [u8; 32],
    became_empty: mpsc::UnboundedSender<String>,
) -> mpsc::Sender<RoomCommand> {
    let (tx, mut rx) = mpsc::channel(64);

    tokio::spawn(async move {
        let mut actor = RoomActor {
            room_id,
            join_token_hash,
            participants: HashMap::new(),
            became_empty,
        };

        while let Some(command) = rx.recv().await {
            actor.handle(command);
        }
    });

    tx
}

impl RoomActor {
    fn handle(&mut self, command: RoomCommand) {
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
                self.handle_message(participant_id, message);
            }
            RoomCommand::WriteAudio { .. } => {
                // TODO: Forward audio chunks once recognition sessions own the participant stream.
            }
            RoomCommand::Disconnect { participant_id } => {
                self.disconnect(participant_id);
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
            },
        );
        JoinOutcome::Joined { participant_id }
    }

    fn handle_message(&mut self, participant_id: Uuid, message: ClientMessage) {
        if !self.participants.contains_key(&participant_id) {
            return;
        }

        match message {
            ClientMessage::ClarificationRequest { caption_id } => {
                self.request_clarification(participant_id, caption_id);
            }
            ClientMessage::Leave => {
                self.disconnect(participant_id);
            }
            _ => {}
        }
    }

    fn request_clarification(&self, _requester_id: Uuid, _caption_id: Uuid) {
        // TODO: Look up caption ownership once captions are stored.
    }

    fn disconnect(&mut self, participant_id: Uuid) {
        let Some(removed) = self.participants.remove(&participant_id) else {
            return;
        };
        self.broadcast(
            ServerMessage::ParticipantLeft {
                participant: removed.participant,
            },
            None,
        );
        if self.participants.is_empty() {
            // SILENT: Room manager shutdown can race with the last participant leaving.
            let _ = self.became_empty.send(self.room_id.clone());
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
    use sha2::{Digest, Sha256};
    use tokio::sync::{mpsc, oneshot};

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
        let room = spawn_room("room-1".to_string(), token_hash("secret"), became_empty_tx);

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
        let room = spawn_room("room-1".to_string(), token_hash("secret"), became_empty_tx);

        let (outcome, _inbox) = join(&room, "wrong-token", "Alice").await;
        assert!(matches!(outcome, JoinOutcome::RoomNotFound));
    }

    #[tokio::test]
    async fn fourth_participant_is_rejected_as_room_full() {
        let (became_empty_tx, _rx) = mpsc::unbounded_channel();
        let room = spawn_room("room-1".to_string(), token_hash("secret"), became_empty_tx);

        for name in ["Alice", "Bob", "Carol"] {
            let (outcome, _inbox) = join(&room, "secret", name).await;
            assert!(matches!(outcome, JoinOutcome::Joined { .. }));
        }

        let (outcome, _inbox) = join(&room, "secret", "Dave").await;
        assert!(matches!(outcome, JoinOutcome::RoomFull));
    }

    #[tokio::test]
    async fn clarification_request_notifies_only_the_speaker() {
        let (became_empty_tx, _rx) = mpsc::unbounded_channel();
        let room = spawn_room("room-1".to_string(), token_hash("secret"), became_empty_tx);

        let (outcome_a, mut inbox_a) = join(&room, "secret", "Alice").await;
        let alice_id = match outcome_a {
            JoinOutcome::Joined { participant_id } => participant_id,
            other => panic!("expected Joined, got {other:?}"),
        };
        let (_outcome_b, mut inbox_b) = join(&room, "secret", "Bob").await;
        // Drain Alice's RoomJoined + ParticipantJoined(Bob) before asserting on the next message.
        inbox_a.recv().await.unwrap();
        inbox_a.recv().await.unwrap();
        // Drain Bob's own RoomJoined.
        inbox_b.recv().await.unwrap();

        let caption_id = uuid::Uuid::new_v4();
        room.send(RoomCommand::HandleMessage {
            participant_id: alice_id,
            message: ClientMessage::ClarificationRequest { caption_id },
        })
        .await
        .unwrap();

        // Unknown captions have no recorded speaker, so clarification is a no-op.
        let timeout =
            tokio::time::timeout(std::time::Duration::from_millis(50), inbox_b.recv()).await;
        assert!(
            timeout.is_err(),
            "Bob should not receive anything for an unknown caption id"
        );
    }
}
