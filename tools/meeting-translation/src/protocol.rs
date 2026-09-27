use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const MAX_DISPLAY_NAME_LEN: usize = 40;
pub const MAX_MANUAL_CAPTION_LEN: usize = 2000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Language {
    Japanese,
    English,
}

impl Language {
    pub fn opposite(self) -> Language {
        match self {
            Language::Japanese => Language::English,
            Language::English => Language::Japanese,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Participant {
    pub id: Uuid,
    pub display_name: String,
    pub speech_language: Language,
    pub display_language: Language,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptionKind {
    Speech,
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptionState {
    Translating,
    Final,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct Caption {
    pub id: Uuid,
    pub sequence: u64,
    pub speaker: Participant,
    pub source_language: Language,
    pub source_text: String,
    pub translated_text: Option<String>,
    pub kind: CaptionKind,
    pub state: CaptionState,
    pub created_at_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        room_id: String,
        token: String,
        display_name: String,
        speech_language: Language,
        display_language: Language,
        consent: bool,
    },
    AudioStart,
    AudioStop,
    CaptionManual {
        text: String,
    },
    ClarificationRequest {
        caption_id: Uuid,
    },
    Leave,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StatusCode {
    InvalidMessage,
    RoomFull,
    RoomNotFound,
    MicrophoneUnavailable,
    RecognitionAvailable,
    RecognitionUnavailable,
    TranslationUnavailable,
    Reconnecting,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    RoomJoined {
        participant_id: Uuid,
        participants: Vec<Participant>,
    },
    ParticipantJoined {
        participant: Participant,
    },
    ParticipantLeft {
        participant: Participant,
    },
    CaptionPreview {
        speaker_id: Uuid,
        source_text: String,
    },
    CaptionUpdate {
        caption: Caption,
    },
    ClarificationRequested {
        caption_id: Uuid,
        requester: Participant,
    },
    Status {
        code: StatusCode,
    },
}

/// Parses one incoming frame and returns Err(()) for malformed JSON or invalid field constraints.
pub fn parse_client_message(bytes: &[u8]) -> Result<ClientMessage, ()> {
    let message: ClientMessage = serde_json::from_slice(bytes).map_err(|_| ())?;

    match &message {
        ClientMessage::Join {
            display_name,
            consent,
            ..
        } => {
            if !consent
                || display_name.is_empty()
                || display_name.chars().count() > MAX_DISPLAY_NAME_LEN
            {
                return Err(());
            }
        }
        ClientMessage::CaptionManual { text } => {
            if text.is_empty() || text.chars().count() > MAX_MANUAL_CAPTION_LEN {
                return Err(());
            }
        }
        _ => {}
    }

    Ok(message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn language_opposite_swaps() {
        assert_eq!(Language::Japanese.opposite(), Language::English);
        assert_eq!(Language::English.opposite(), Language::Japanese);
    }

    #[test]
    fn join_requires_consent() {
        let body = serde_json::json!({
            "type": "join",
            "room_id": "r1",
            "token": "t1",
            "display_name": "Alice",
            "speech_language": "japanese",
            "display_language": "english",
            "consent": false
        })
        .to_string();

        assert!(parse_client_message(body.as_bytes()).is_err());
    }

    #[test]
    fn join_rejects_display_name_over_40_chars() {
        let long_name = "a".repeat(41);
        let body = serde_json::json!({
            "type": "join",
            "room_id": "r1",
            "token": "t1",
            "display_name": long_name,
            "speech_language": "japanese",
            "display_language": "english",
            "consent": true
        })
        .to_string();

        assert!(parse_client_message(body.as_bytes()).is_err());
    }

    #[test]
    fn join_accepts_valid_message() {
        let body = serde_json::json!({
            "type": "join",
            "room_id": "r1",
            "token": "t1",
            "display_name": "Alice",
            "speech_language": "japanese",
            "display_language": "english",
            "consent": true
        })
        .to_string();

        let message = parse_client_message(body.as_bytes()).expect("valid join message");
        assert!(matches!(message, ClientMessage::Join { .. }));
    }

    #[test]
    fn manual_caption_rejects_empty_and_over_2000_chars() {
        let empty = serde_json::json!({ "type": "caption_manual", "text": "" }).to_string();
        assert!(parse_client_message(empty.as_bytes()).is_err());

        let too_long =
            serde_json::json!({ "type": "caption_manual", "text": "a".repeat(2001) }).to_string();
        assert!(parse_client_message(too_long.as_bytes()).is_err());
    }

    #[test]
    fn malformed_json_is_rejected() {
        assert!(parse_client_message(b"not json").is_err());
    }

    #[test]
    fn server_message_serializes_with_tagged_type() {
        let message = ServerMessage::Status {
            code: StatusCode::RoomFull,
        };
        let json = serde_json::to_value(&message).unwrap();
        assert_eq!(json["type"], "status");
        assert_eq!(json["code"], "room_full");
    }
}
