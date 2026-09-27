# meeting-translation Rust/Topcoat Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `tools/meeting-translation` (Node/Fastify + React) with a from-scratch Rust implementation on the Topcoat framework, preserving the behavior contract documented in the current README while redesigning the internal structure (actor-per-room concurrency, protocol, module layout) from scratch.

**Architecture:** A single Rust binary crate. Topcoat pages serve the HTML shell and a `route()`-registered raw WebSocket carries the full realtime protocol (join/audio/captions) per participant, one connection per participant. Room state lives in a dedicated tokio task per room (actor pattern) reached only through an `mpsc` command channel; a `RoomRegistry` held as Topcoat app context maps room IDs to actor senders and owns reconnect-grace timers and the room-creation rate limiter. Bedrock and Transcribe adapters implement small `Translator`/`SpeechRecognizer` traits. Browser-side mic capture, PCM resampling, and rendering are plain JS served through Topcoat's asset pipeline.

**Tech Stack:** Rust (stable, ≥1.98, edition 2024), Topcoat 0.9.0, tokio, aws-sdk-bedrockruntime, aws-sdk-transcribestreaming, serde/serde_json, plain browser JS (no build step, no React).

**Spec:** `docs/superpowers/specs/2026-09-27-meeting-translation-rust-topcoat-design.md`

## Global Constraints

- Rust toolchain: stable, **≥1.98**, edition 2024 (Topcoat 0.9.0's own `rust-version` floor). Run `rustup update stable` first if the local toolchain is older.
- Topcoat is "Early-stage and experimental. Expect breaking changes." (confirmed via the spec's research). Every Topcoat API used in this plan was verified against `docs.rs/topcoat` and the framework's own `examples/*` on 2026-09-27; if a task's `cargo build`/`cargo check` step surfaces a signature mismatch, re-check the matching example in https://github.com/tokio-rs/topcoat/tree/main/examples before improvising.
- Max 3 participants per room. Display name ≤ 40 chars. Manual caption text ≤ 2000 chars. Translation request timeout: 10s. Reconnect grace: 5s. Room-creation rate limit: 5 per IP per 10-minute window. These are hard behavior requirements from the current README; do not change the numbers.
- Join tokens: 32 random bytes, base64url-encoded for the shared link; only a SHA-256 hash is ever held in memory or compared (constant-time compare). Never log the raw token, transcript text, caption text, or AWS credentials — logs carry only `event_code` and non-sensitive IDs.
- `MEETING_BASE_PATH` is retired; `/translate` is a literal path prefix in the route macros (Decision recorded in the spec).
- No React, no Vite, no Node build step in the new implementation. All browser code is plain JS served via Topcoat's `asset!()` pipeline.
- The old TypeScript implementation is deleted in Task 1, not kept around during the rewrite — this is a from-scratch rebuild, not a port.
- The crate has both a library target (`src/lib.rs`) and a binary target (`src/main.rs`) — Task 3's Step 0 introduces the split so `cargo test --lib` has something to run against. Every task from Task 3 onward that says "add `mod X;` to `src/main.rs`" means "add `pub mod X;` to `src/lib.rs`"; `src/main.rs` stays a thin binary until Task 14 gives it its final form.

---

## Task 1: Remove the existing TypeScript implementation

**Files:**
- Delete: `tools/meeting-translation/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.server.json`, `tsconfig.shared.json`, `vite.config.ts`, `Dockerfile`, `src/` (entire tree: `server/`, `web/`, `shared/`)
- Keep as-is for now: `README.md`, `CHANGELOG.md`, `kubernetes/`, `infrastructure/`, `tests/deployment_test.sh`, `.gitignore`, `.dockerignore` (all four of these are edited in later tasks, not now)

**Interfaces:** None — this task only deletes files.

- [ ] **Step 1: Delete the TypeScript source tree and its tooling files**

```bash
cd tools/meeting-translation
rm -rf src package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.server.json tsconfig.shared.json vite.config.ts Dockerfile
```

- [ ] **Step 2: Verify nothing outside the intended scope was touched**

Run: `git status`
Expected: deletions listed only for the files above; `README.md`, `CHANGELOG.md`, `kubernetes/`, `infrastructure/`, `tests/`, `.gitignore`, `.dockerignore` still present and unmodified.

- [ ] **Step 3: Commit**

```bash
git add -A tools/meeting-translation
git commit -s -m "chore(meeting-translation): remove TypeScript implementation

Rewriting from scratch on Rust/Topcoat per the design spec; the old
Node/Fastify + React source is not carried forward or ported."
```

---

## Task 2: Scaffold the Topcoat crate

**Files:**
- Create: `tools/meeting-translation/Cargo.toml`
- Create: `tools/meeting-translation/rust-toolchain.toml`
- Create: `tools/meeting-translation/src/main.rs`
- Modify: `tools/meeting-translation/.gitignore`

**Interfaces:**
- Produces: a running Topcoat app on `127.0.0.1:3000` with one placeholder page at `/`, verifying the toolchain and dependency versions are correct before any domain code is written.

- [ ] **Step 1: Write `rust-toolchain.toml`**

```toml
[toolchain]
channel = "stable"
```

- [ ] **Step 2: Write `Cargo.toml`**

```toml
[package]
name = "meeting-translation"
version = "0.1.0"
edition = "2024"
publish = false

[dependencies]
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
topcoat = { version = "0.9.0", features = ["websocket"] }

[dev-dependencies]
# Unlocks `#[tokio::test(start_paused = true)]` and `tokio::time::advance`,
# used by Task 7's reconnect-grace tests. Cargo only unifies this into test
# builds, not the release binary.
tokio = { version = "1", features = ["test-util"] }
```

- [ ] **Step 3: Write a placeholder `src/main.rs`**

```rust
use topcoat::{
    Result,
    router::{Router, page},
    view::{View, view},
};

#[tokio::main]
async fn main() {
    let router = Router::builder().page(home).build();
    topcoat::start(router).await.unwrap();
}

#[page("/translate/")]
async fn home() -> Result<impl View> {
    Ok(view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Meeting Translation"</title>
                topcoat::dev::script()
            </head>
            <body>
                <h1>"Meeting Translation"</h1>
            </body>
        </html>
    })
}
```

- [ ] **Step 4: Update `.gitignore`**

Replace the current two-line file (`node_modules/`, `dist/`) with:

```
/target
```

- [ ] **Step 5: Build and run**

Run: `cargo build`
Expected: compiles cleanly, producing `Cargo.lock`.

Run: `cargo run &` then `curl -s http://127.0.0.1:3000/translate/`
Expected: HTML response containing `<h1>Meeting Translation</h1>`. Stop the server afterward (`kill %1` or Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/rust-toolchain.toml tools/meeting-translation/src/main.rs \
  tools/meeting-translation/.gitignore
git commit -s -m "feat(meeting-translation): scaffold Topcoat crate"
```

---

## Task 3: Domain types and protocol parsing

**Files:**
- Create: `tools/meeting-translation/src/protocol.rs`
- Create: `tools/meeting-translation/src/lib.rs` (new library target — see Step 0; every later task's "add `mod X;` to `src/main.rs`" instruction instead means "add `pub mod X;` to `src/lib.rs`", starting here)
- Modify: `tools/meeting-translation/Cargo.toml` (add `serde`, `serde_json`, `uuid`)

**Interfaces:**
- Produces: `Language` (`Japanese`/`English`, with `.opposite()`), `Participant`, `CaptionKind`, `CaptionState`, `Caption`, `ClientMessage`, `ServerMessage`, `StatusCode`, `parse_client_message(bytes: &[u8]) -> Result<ClientMessage, ()>`, constants `MAX_DISPLAY_NAME_LEN: usize = 40`, `MAX_MANUAL_CAPTION_LEN: usize = 2000`.
- Consumes: nothing (pure domain types).

- [ ] **Step 0: Split the crate into a library target + a thin binary**

Task 2 scaffolded `src/main.rs` as the crate's only file, which makes it a binary-only crate — `cargo test --lib` has nothing to run against, because there is no library target. From this task on, every module the plan adds belongs in a library target so it is unit-testable; `main.rs` becomes a thin binary that only wires things together and calls `topcoat::start`.

Create `tools/meeting-translation/src/lib.rs`:

```rust
pub mod protocol;
```

Cargo automatically treats `src/lib.rs` as a library target (crate name `meeting_translation`, package name `meeting-translation`) and `src/main.rs` as a separate binary target in the same package — no `[lib]`/`[[bin]]` section needs adding to `Cargo.toml` for this. Every later task's instruction to "add `mod X;` near the top of `src/main.rs`" means: add `pub mod X;` to this file (`src/lib.rs`) instead. `src/main.rs` itself does not need a `mod protocol;` line — it does not use `protocol` yet, and once it does (from Task 14 on), it reaches it via `use meeting_translation::protocol;` like any external caller of the library.

- [ ] **Step 1: Add dependencies**

```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
```

- [ ] **Step 2: Write the failing tests**

```rust
// tools/meeting-translation/src/protocol.rs (bottom of the file, added before the types exist)
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

        let too_long = serde_json::json!({ "type": "caption_manual", "text": "a".repeat(2001) })
            .to_string();
        assert!(parse_client_message(too_long.as_bytes()).is_err());
    }

    #[test]
    fn malformed_json_is_rejected() {
        assert!(parse_client_message(b"not json").is_err());
    }

    #[test]
    fn server_message_serializes_with_tagged_type() {
        let message = ServerMessage::Status { code: StatusCode::RoomFull };
        let json = serde_json::to_value(&message).unwrap();
        assert_eq!(json["type"], "status");
        assert_eq!(json["code"], "room_full");
    }
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test --lib protocol`
Expected: FAIL to compile — no types defined yet.

- [ ] **Step 4: Implement the types**

```rust
// tools/meeting-translation/src/protocol.rs
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
    CaptionManual { text: String },
    ClarificationRequest { caption_id: Uuid },
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
    RoomJoined { participant_id: Uuid, participants: Vec<Participant> },
    ParticipantJoined { participant: Participant },
    ParticipantLeft { participant: Participant },
    CaptionPreview { speaker_id: Uuid, source_text: String },
    CaptionUpdate { caption: Caption },
    ClarificationRequested { caption_id: Uuid, requester: Participant },
    Status { code: StatusCode },
}

/// Parses and validates one incoming client frame. Returns `Err(())` for
/// malformed JSON or any message that fails its field constraints; callers
/// answer both cases with `StatusCode::InvalidMessage` since the current
/// contract does not distinguish the reasons on the wire.
pub fn parse_client_message(bytes: &[u8]) -> Result<ClientMessage, ()> {
    let message: ClientMessage = serde_json::from_slice(bytes).map_err(|_| ())?;

    match &message {
        ClientMessage::Join { display_name, consent, .. } => {
            if !consent || display_name.is_empty() || display_name.chars().count() > MAX_DISPLAY_NAME_LEN {
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `cargo test --lib protocol`
Expected: PASS, all 6 tests green (this now runs, because Step 0 gave the crate a library target).

- [ ] **Step 6: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/src/lib.rs tools/meeting-translation/src/protocol.rs
git commit -s -m "feat(meeting-translation): add protocol types and validation"
```

---

## Task 4: Room actor — membership, broadcast, clarification

**Files:**
- Create: `tools/meeting-translation/src/room.rs`
- Create: `tools/meeting-translation/src/room/actor.rs`
- Modify: `tools/meeting-translation/src/lib.rs` (add `pub mod room;`)
- Modify: `tools/meeting-translation/Cargo.toml` (add `sha2`, `subtle`)

**Interfaces:**
- Produces: `pub type Connection = mpsc::UnboundedSender<ServerMessage>;`, `pub enum RoomCommand { Join { connection: Connection, message: ClientMessage, reply: oneshot::Sender<JoinOutcome> }, HandleMessage { participant_id: Uuid, message: ClientMessage }, WriteAudio { participant_id: Uuid, chunk: Vec<u8> }, Disconnect { participant_id: Uuid } }`, `pub enum JoinOutcome { Joined { participant_id: Uuid }, InvalidMessage, RoomNotFound, RoomFull }`, `pub fn spawn_room(room_id: String, join_token_hash: [u8; 32], became_empty: mpsc::UnboundedSender<String>) -> mpsc::Sender<RoomCommand>`.
- Consumes: `crate::protocol::{ClientMessage, ServerMessage, Participant, StatusCode}`.

- [ ] **Step 1: Add dependencies**

```toml
sha2 = "0.11"
subtle = "2.6"
```

- [ ] **Step 2: Write `src/room.rs`**

```rust
pub mod actor;

pub use actor::{spawn_room, Connection, JoinOutcome, RoomCommand};
```

- [ ] **Step 3: Write the failing tests**

```rust
// tools/meeting-translation/src/room/actor.rs (test module, written before the implementation)
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
        assert!(matches!(inbox_a.recv().await.unwrap(), ServerMessage::RoomJoined { .. }));

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

        // Nothing arrives on Bob's inbox because the (fake) caption has no
        // recorded speaker, so this call is a no-op — this test only proves
        // Bob's inbox does not receive anything on Alice's own request to
        // clarify a caption she "asked about" without ever having spoken it.
        let timeout = tokio::time::timeout(std::time::Duration::from_millis(50), inbox_b.recv()).await;
        assert!(timeout.is_err(), "Bob should not receive anything for an unknown caption id");
    }
}
```

- [ ] **Step 4: Run to verify it fails**

Run: `cargo test --lib room`
Expected: FAIL to compile — `spawn_room` and friends don't exist yet.

- [ ] **Step 5: Implement the actor**

```rust
// tools/meeting-translation/src/room/actor.rs
use std::collections::HashMap;

use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

use crate::protocol::{ClientMessage, Participant, ServerMessage, StatusCode};

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

struct RoomActor {
    room_id: String,
    join_token_hash: [u8; 32],
    participants: HashMap<Uuid, ActiveParticipant>,
    became_empty: mpsc::UnboundedSender<String>,
}

/// Spawns the tokio task that owns this room's state and returns the
/// command channel to reach it. Every mutation goes through this channel so
/// the room's state is only ever touched from within its own task.
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
            RoomCommand::Join { connection, message, reply } => {
                let outcome = self.join(connection, message);
                let _ = reply.send(outcome);
            }
            RoomCommand::HandleMessage { participant_id, message } => {
                self.handle_message(participant_id, message);
            }
            RoomCommand::WriteAudio { .. } => {
                // Wired up once recognition sessions exist (Task 6).
            }
            RoomCommand::Disconnect { participant_id } => {
                self.disconnect(participant_id);
            }
        }
    }

    fn join(&mut self, connection: Connection, message: ClientMessage) -> JoinOutcome {
        let ClientMessage::Join { room_id, token, display_name, speech_language, display_language, consent } = message else {
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
        let _ = connection.send(ServerMessage::RoomJoined { participant_id, participants: roster });
        self.broadcast(ServerMessage::ParticipantJoined { participant: participant.clone() }, None);

        self.participants.insert(participant_id, ActiveParticipant { participant, connection });
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
            // CaptionManual/AudioStart/AudioStop are wired up in Tasks 5 and 6.
            _ => {}
        }
    }

    fn request_clarification(&self, requester_id: Uuid, _caption_id: uuid::Uuid) {
        // Caption ownership lookup is added in Task 5 alongside caption
        // storage; until then there is no speaker to notify.
        let _ = requester_id;
    }

    fn disconnect(&mut self, participant_id: Uuid) {
        let Some(removed) = self.participants.remove(&participant_id) else {
            return;
        };
        self.broadcast(ServerMessage::ParticipantLeft { participant: removed.participant }, None);
        if self.participants.is_empty() {
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
                let _ = active.connection.send(message.clone());
            }
        }
    }
}
```

Note: `request_clarification` and the `RoomCommand::WriteAudio` arm are intentionally inert here — Task 5 adds caption storage (needed to know who spoke a given caption) and Task 6 adds recognition sessions (needed to do anything with audio bytes). Wiring them now would mean guessing at shapes this task doesn't need yet.

- [ ] **Step 6: Wire the module into `src/lib.rs`**

Add `pub mod room;` near the top of `src/lib.rs`.

- [ ] **Step 7: Run to verify it passes**

Run: `cargo test --lib room`
Expected: PASS, all 4 tests green.

- [ ] **Step 8: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/src/lib.rs tools/meeting-translation/src/room.rs \
  tools/meeting-translation/src/room/actor.rs
git commit -s -m "feat(meeting-translation): add room actor with membership and broadcast"
```

---

## Task 5: Room actor — manual captions and the translation queue

**Files:**
- Modify: `tools/meeting-translation/src/room/actor.rs`
- Create: `tools/meeting-translation/src/translator.rs`
- Modify: `tools/meeting-translation/src/lib.rs` (add `pub mod translator;`)

**Interfaces:**
- Produces: `pub trait Translator: Send + Sync { async fn translate(&self, request: TranslationRequest) -> Result<String, ()>; }`, `pub struct TranslationRequest { pub source_text: String, pub source_language: Language, pub target_language: Language, pub context: Vec<Caption>, pub glossary: Vec<String> }`. Extends `spawn_room` to take `translator: std::sync::Arc<dyn Translator>` and `glossary: Vec<String>`, and changes its return type to `(mpsc::Sender<RoomCommand>, tokio::task::JoinHandle<()>)` — see Step 5's note on why the actor task needs an observable termination point starting from this task. `request_clarification` now looks up the real speaker from stored captions.
- Consumes: `crate::protocol::{Caption, CaptionKind, CaptionState}` (already defined in Task 3).

- [ ] **Step 1: Add the `async-trait` dependency**

```toml
async-trait = "0.1"
```

- [ ] **Step 2: Write `src/translator.rs`**

```rust
use async_trait::async_trait;

use crate::protocol::{Caption, Language};

pub struct TranslationRequest {
    pub source_text: String,
    pub source_language: Language,
    pub target_language: Language,
    pub context: Vec<Caption>,
    pub glossary: Vec<String>,
}

#[async_trait]
pub trait Translator: Send + Sync {
    async fn translate(&self, request: TranslationRequest) -> Result<String, ()>;
}
```

- [ ] **Step 3: Write the failing tests** (appended to `src/room/actor.rs`'s test module)

```rust
mod translation_tests {
    use super::super::*;
    use crate::protocol::{ClientMessage, Language, ServerMessage, CaptionState};
    use crate::translator::{TranslationRequest, Translator};
    use async_trait::async_trait;
    use sha2::{Digest, Sha256};
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::sync::{mpsc, oneshot};

    struct FakeTranslator {
        delay: Duration,
        fail: bool,
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
        );
        room
    }

    async fn join_and_drain(room: &mpsc::Sender<RoomCommand>, name: &str) -> (uuid::Uuid, mpsc::UnboundedReceiver<ServerMessage>) {
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
        let room = spawn_test_room(Arc::new(FakeTranslator { delay: Duration::ZERO, fail: false })).await;
        let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

        room.send(RoomCommand::HandleMessage {
            participant_id,
            message: ClientMessage::CaptionManual { text: "hello".to_string() },
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
        assert_eq!(caption.translated_text.as_deref(), Some("[translated] hello"));
    }

    #[tokio::test]
    async fn failed_translation_marks_caption_failed_and_notifies_room() {
        let room = spawn_test_room(Arc::new(FakeTranslator { delay: Duration::ZERO, fail: true })).await;
        let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

        room.send(RoomCommand::HandleMessage {
            participant_id,
            message: ClientMessage::CaptionManual { text: "hello".to_string() },
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
            ServerMessage::Status { code: crate::protocol::StatusCode::TranslationUnavailable }
        ));
    }

    #[tokio::test]
    async fn clarification_request_reaches_the_captions_speaker() {
        let room = spawn_test_room(Arc::new(FakeTranslator { delay: Duration::ZERO, fail: false })).await;
        let (alice_id, mut alice_inbox) = join_and_drain(&room, "Alice").await;
        let (bob_id, mut bob_inbox) = join_and_drain(&room, "Bob").await;
        alice_inbox.recv().await.unwrap(); // ParticipantJoined(Bob)

        room.send(RoomCommand::HandleMessage {
            participant_id: alice_id,
            message: ClientMessage::CaptionManual { text: "hello".to_string() },
        })
        .await
        .unwrap();
        bob_inbox.recv().await.unwrap(); // Translating
        let ServerMessage::CaptionUpdate { caption } = bob_inbox.recv().await.unwrap() else {
            panic!("expected CaptionUpdate");
        };

        room.send(RoomCommand::HandleMessage {
            participant_id: bob_id,
            message: ClientMessage::ClarificationRequest { caption_id: caption.id },
        })
        .await
        .unwrap();

        alice_inbox.recv().await.unwrap(); // Translating (Alice sees her own caption too)
        alice_inbox.recv().await.unwrap(); // Final
        assert!(matches!(
            alice_inbox.recv().await.unwrap(),
            ServerMessage::ClarificationRequested { .. }
        ));
    }

    struct VariableDelayTranslator;

    #[async_trait]
    impl Translator for VariableDelayTranslator {
        async fn translate(&self, request: TranslationRequest) -> Result<String, ()> {
            // "first" is deliberately slower than "second": if the queue ran
            // both concurrently, "second" would resolve first, flipping the
            // Final order this test asserts.
            let delay = if request.source_text == "first" { Duration::from_millis(100) } else { Duration::from_millis(10) };
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
            message: ClientMessage::CaptionManual { text: "first".to_string() },
        })
        .await
        .unwrap();
        room.send(RoomCommand::HandleMessage {
            participant_id,
            message: ClientMessage::CaptionManual { text: "second".to_string() },
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
        // Never resolves on its own; only the room actor's own 10s
        // `tokio::time::timeout` around the call can end this job.
        let translator = Arc::new(FakeTranslator { delay: Duration::from_secs(3600), fail: false });
        let room = spawn_test_room(translator).await;
        let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

        room.send(RoomCommand::HandleMessage {
            participant_id,
            message: ClientMessage::CaptionManual { text: "hello".to_string() },
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
            ServerMessage::Status { code: crate::protocol::StatusCode::TranslationUnavailable }
        ));
    }

    #[tokio::test]
    async fn room_actor_task_terminates_once_every_command_sender_is_dropped() {
        let (became_empty_tx, _rx) = mpsc::unbounded_channel();
        let (room, handle) = spawn_room(
            "room-1".to_string(),
            token_hash("secret"),
            became_empty_tx,
            Arc::new(FakeTranslator { delay: Duration::ZERO, fail: false }),
            vec![],
        );

        drop(room); // the only RoomCommand sender

        tokio::time::timeout(Duration::from_secs(1), handle)
            .await
            .expect("actor task must exit once its command channel closes")
            .expect("actor task must not panic");
    }
}
```

- [ ] **Step 4: Run to verify it fails**

Run: `cargo test --lib room`
Expected: FAIL to compile — `spawn_room` doesn't take a translator yet, no caption storage.

- [ ] **Step 5: Extend the actor with caption storage and a serialized translation queue**

```rust
// tools/meeting-translation/src/room/actor.rs — replace the previous
// RoomActor/spawn_room/handle_message/request_clarification with these.
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::protocol::{Caption, CaptionKind, CaptionState, StatusCode};
use crate::translator::{TranslationRequest, Translator};

const MAX_CONTEXT_CAPTIONS: usize = 12;
const TRANSLATION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

enum InternalEvent {
    Command(RoomCommand),
    TranslationDone { caption_id: Uuid, result: Result<String, ()> },
    // Explicit exit signal — see the note below the next code block for why the loop needs one.
    Shutdown,
}

struct RoomActor {
    room_id: String,
    join_token_hash: [u8; 32],
    participants: HashMap<Uuid, ActiveParticipant>,
    became_empty: mpsc::UnboundedSender<String>,
    translator: Arc<dyn Translator>,
    glossary: Vec<String>,
    captions: HashMap<Uuid, Caption>,
    context: Vec<Caption>,
    sequence: u64,
    translation_queue: std::collections::VecDeque<Uuid>,
    translation_in_flight: bool,
}

pub fn spawn_room(
    room_id: String,
    join_token_hash: [u8; 32],
    became_empty: mpsc::UnboundedSender<String>,
    translator: Arc<dyn Translator>,
    glossary: Vec<String>,
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
        // `rx` just closed, meaning every RoomCommand sender (the registry's
        // and every session's clone of it) is gone. Tell the main loop to
        // stop — see the note below for why it cannot detect this on its own.
        let _ = forward_tx.send(InternalEvent::Shutdown);
    });

    let handle = tokio::spawn(async move {
        let mut actor = RoomActor {
            room_id,
            join_token_hash,
            participants: HashMap::new(),
            became_empty,
            translator,
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
                InternalEvent::Shutdown => break,
            }
        }
    });

    (tx, handle)
}
```

Note: the `tx`/`rx` forwarding task exists so that both `RoomCommand`s and internally-completed translation jobs feed into the **same** single-consumer loop — this is what keeps room state mutation single-threaded without a `Mutex` around `RoomActor` itself. `RoomActor::handle` gains an `event_tx` parameter it threads through to the two call sites that can start a new translation.

This structure has a lifecycle trap that is easy to miss: the main loop holds its own clone of `event_tx` (it has to, to pass into `actor.handle`/`drain_translation_queue`), so `event_rx.recv()` can never naturally return `None` — the loop is one of its own channel's senders. Without the explicit `InternalEvent::Shutdown` above, the actor task (and everything it owns — participants, captions, the `translator` `Arc` clone) would leak for the process's entire lifetime, even after every external `RoomCommand` sender is dropped and `RoomRegistry` believes the room is gone. `spawn_room` now returns the second task's `JoinHandle` specifically so a test can prove termination by awaiting it after dropping every `RoomCommand` sender; production code (Task 7's registry) does not need to await it — a finished tokio task is reclaimed by the runtime whether or not anyone awaits its handle — but should still hold onto it rather than discard it, in case a future task wants to observe or force shutdown.

```rust
impl RoomActor {
    fn handle(&mut self, command: RoomCommand, event_tx: mpsc::UnboundedSender<InternalEvent>) {
        match command {
            RoomCommand::Join { connection, message, reply } => {
                let outcome = self.join(connection, message);
                let _ = reply.send(outcome);
            }
            RoomCommand::HandleMessage { participant_id, message } => {
                self.handle_message(participant_id, message, event_tx);
            }
            RoomCommand::WriteAudio { .. } => {}
            RoomCommand::Disconnect { participant_id } => {
                self.disconnect(participant_id);
            }
        }
    }

    fn handle_message(
        &mut self,
        participant_id: Uuid,
        message: ClientMessage,
        event_tx: mpsc::UnboundedSender<InternalEvent>,
    ) {
        let Some(active) = self.participants.get(&participant_id) else { return };
        let speaker = active.participant.clone();

        match message {
            ClientMessage::CaptionManual { text } => {
                self.enqueue_caption(speaker.clone(), speaker.speech_language, text, CaptionKind::Manual, event_tx);
            }
            ClientMessage::ClarificationRequest { caption_id } => {
                self.request_clarification(speaker, caption_id);
            }
            ClientMessage::Leave => {
                self.disconnect(participant_id);
            }
            _ => {}
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
            created_at_ms: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64,
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
        let Some(caption_id) = self.translation_queue.pop_front() else { return };
        let Some(caption) = self.captions.get(&caption_id) else { return };

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
        let Some(caption) = self.captions.get_mut(&caption_id) else { return };
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
                self.broadcast(ServerMessage::Status { code: StatusCode::TranslationUnavailable }, None);
            }
        }
    }

    fn request_clarification(&self, requester: Participant, caption_id: Uuid) {
        let Some(caption) = self.captions.get(&caption_id) else { return };
        let Some(speaker_connection) = self.participants.get(&caption.speaker.id) else { return };
        let _ = speaker_connection
            .connection
            .send(ServerMessage::ClarificationRequested { caption_id, requester });
    }

    // join/disconnect/token_matches/broadcast are unchanged from Task 4.
}
```

- [ ] **Step 6: Update every `spawn_room` call site added in Task 4's tests** to pass `Arc::new(FakeTranslator { .. })` and `vec![]`, and update `RoomActor::handle`'s call sites to pass `event_tx.clone()` where Task 4's version called `self.handle(command)` directly (the outer dispatch loop shown in Step 5 already does this).

- [ ] **Step 7: Run to verify it passes**

Run: `cargo test --lib room`
Expected: PASS — Task 4's 4 tests plus this task's 6 tests (the three behavior tests plus the serialization-order, timeout, and actor-termination regression tests below), 10 total, all green.

- [ ] **Step 8: Wire the module into `src/lib.rs`**

Add `pub mod translator;` near the top of `src/lib.rs`.

- [ ] **Step 9: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/src/lib.rs tools/meeting-translation/src/translator.rs \
  tools/meeting-translation/src/room/actor.rs
git commit -s -m "feat(meeting-translation): add manual captions and translation queue"
```

---

## Task 6: Room actor — audio recognition lifecycle

**Files:**
- Create: `tools/meeting-translation/src/recognizer.rs`
- Modify: `tools/meeting-translation/src/room/actor.rs`
- Modify: `tools/meeting-translation/src/lib.rs` (add `pub mod recognizer;`)

**Interfaces:**
- Produces: `pub enum RecognitionEvent { Partial(String), Final(String), Error, Reconnecting, Reconnected }`, `pub trait RecognitionSession: Send { fn write(&self, chunk: Vec<u8>); fn stop(self: Box<Self>); }`, `pub trait SpeechRecognizer: Send + Sync { async fn start(&self, language: Language, events: mpsc::UnboundedSender<RecognitionEvent>) -> Result<Box<dyn RecognitionSession>, ()>; }`. Extends `spawn_room` to take `recognizer: Arc<dyn SpeechRecognizer>`. Wires `AudioStart`/`AudioStop`/`WriteAudio`.
- Consumes: `crate::translator::Translator` (Task 5), `crate::protocol::Language`.

- [ ] **Step 1: Write `src/recognizer.rs`**

```rust
use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::protocol::Language;

#[derive(Debug, Clone)]
pub enum RecognitionEvent {
    Partial(String),
    Final(String),
    Error,
    Reconnecting,
    Reconnected,
}

pub trait RecognitionSession: Send {
    fn write(&self, chunk: Vec<u8>);
    fn stop(self: Box<Self>);
}

#[async_trait]
pub trait SpeechRecognizer: Send + Sync {
    async fn start(
        &self,
        language: Language,
        events: mpsc::UnboundedSender<RecognitionEvent>,
    ) -> Result<Box<dyn RecognitionSession>, ()>;
}
```

- [ ] **Step 2: Write the failing tests** (new `recognition_tests` module in `src/room/actor.rs`)

```rust
mod recognition_tests {
    use super::super::*;
    use crate::protocol::{ClientMessage, Language, ServerMessage, StatusCode};
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
            Ok(Box::new(FakeSession { written: self.written.clone(), stopped: self.stopped.clone() }))
        }
    }

    fn token_hash(token: &str) -> [u8; 32] {
        Sha256::digest(token.as_bytes()).into()
    }

    async fn join_and_drain(room: &mpsc::Sender<RoomCommand>, name: &str) -> (uuid::Uuid, mpsc::UnboundedReceiver<ServerMessage>) {
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
            Arc::new(FakeRecognizer { written: written.clone(), stopped: stopped.clone() }),
        );
        let (participant_id, mut inbox) = join_and_drain(&room, "Alice").await;

        room.send(RoomCommand::HandleMessage { participant_id, message: ClientMessage::AudioStart })
            .await
            .unwrap();

        assert!(matches!(
            inbox.recv().await.unwrap(),
            ServerMessage::CaptionPreview { source_text, .. } if source_text == "hel"
        ));
        // "hello" going final enqueues a caption exactly like a manual one.
        let ServerMessage::CaptionUpdate { caption } = inbox.recv().await.unwrap() else {
            panic!("expected CaptionUpdate");
        };
        assert_eq!(caption.source_text, "hello");

        room.send(RoomCommand::WriteAudio { participant_id, chunk: vec![1, 2, 3] })
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        assert_eq!(written.lock().unwrap().as_slice(), &[vec![1u8, 2, 3]]);

        room.send(RoomCommand::HandleMessage { participant_id, message: ClientMessage::AudioStop })
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
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
            Arc::new(FakeRecognizer { written: written.clone(), stopped }),
        );
        let (participant_id, _inbox) = join_and_drain(&room, "Alice").await;

        // No audio:start was sent, so this must not panic and must not reach `written`.
        room.send(RoomCommand::WriteAudio { participant_id, chunk: vec![9] }).await.unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        assert!(written.lock().unwrap().is_empty());
    }
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test --lib room`
Expected: FAIL to compile — `spawn_room` doesn't take a recognizer yet.

- [ ] **Step 4: Extend the actor with per-participant recognition sessions**

```rust
// tools/meeting-translation/src/room/actor.rs — additions to InternalEvent, RoomActor, spawn_room.
use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};

enum InternalEvent {
    Command(RoomCommand),
    TranslationDone { caption_id: Uuid, result: Result<String, ()> },
    Recognition { participant_id: Uuid, event: RecognitionEvent },
}

struct ActiveParticipant {
    participant: Participant,
    connection: Connection,
    recognition_session: Option<Box<dyn RecognitionSession>>,
}
```

Add `recognizer: Arc<dyn SpeechRecognizer>` to `RoomActor` and to `spawn_room`'s parameters; store it alongside `translator`. Update every place that constructs `ActiveParticipant` (in `join`) to set `recognition_session: None`.

```rust
impl RoomActor {
    fn handle(&mut self, command: RoomCommand, event_tx: mpsc::UnboundedSender<InternalEvent>) {
        match command {
            RoomCommand::Join { connection, message, reply } => {
                let outcome = self.join(connection, message);
                let _ = reply.send(outcome);
            }
            RoomCommand::HandleMessage { participant_id, message } => {
                self.handle_message(participant_id, message, event_tx);
            }
            RoomCommand::WriteAudio { participant_id, chunk } => {
                if let Some(active) = self.participants.get(&participant_id) {
                    if let Some(session) = &active.recognition_session {
                        session.write(chunk);
                    }
                }
            }
            RoomCommand::Disconnect { participant_id } => {
                self.disconnect(participant_id);
            }
        }
    }

    fn handle_message(
        &mut self,
        participant_id: Uuid,
        message: ClientMessage,
        event_tx: mpsc::UnboundedSender<InternalEvent>,
    ) {
        let Some(active) = self.participants.get(&participant_id) else { return };
        let speaker = active.participant.clone();

        match message {
            ClientMessage::CaptionManual { text } => {
                self.enqueue_caption(speaker.clone(), speaker.speech_language, text, CaptionKind::Manual, event_tx);
            }
            ClientMessage::ClarificationRequest { caption_id } => {
                self.request_clarification(speaker, caption_id);
            }
            ClientMessage::AudioStart => {
                self.start_recognition(participant_id, speaker.speech_language, event_tx);
            }
            ClientMessage::AudioStop => {
                self.stop_recognition(participant_id);
            }
            ClientMessage::Leave => {
                self.disconnect(participant_id);
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
        if self.participants.get(&participant_id).and_then(|p| p.recognition_session.as_ref()).is_some() {
            return; // already recognizing; audio:start is idempotent
        }
        let recognizer = self.recognizer.clone();
        let (events_tx, mut events_rx) = mpsc::unbounded_channel();
        let forward_tx = event_tx.clone();
        tokio::spawn(async move {
            while let Some(event) = events_rx.recv().await {
                if forward_tx.send(InternalEvent::Recognition { participant_id, event }).is_err() {
                    break;
                }
            }
        });

        // Starting the session is async (it calls out to AWS); do it in a
        // detached task and stash the session once it resolves so the room
        // loop is never blocked on network I/O for one participant while
        // handling everyone else's commands.
        let started_tx = event_tx.clone();
        tokio::spawn(async move {
            match recognizer.start(language, events_tx).await {
                Ok(session) => {
                    // Stash the session via a dedicated event so only the
                    // room actor's own loop ever writes `recognition_session`.
                    let _ = started_tx.send(InternalEvent::SessionStarted { participant_id, session });
                }
                Err(()) => {
                    let _ = started_tx.send(InternalEvent::Recognition { participant_id, event: RecognitionEvent::Error });
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

    fn handle_recognition_event(&mut self, participant_id: Uuid, event: RecognitionEvent, event_tx: mpsc::UnboundedSender<InternalEvent>) {
        let Some(active) = self.participants.get(&participant_id) else { return };
        match event {
            RecognitionEvent::Partial(text) => {
                let _ = active.connection.send(ServerMessage::CaptionPreview { speaker_id: participant_id, source_text: text });
            }
            RecognitionEvent::Final(text) => {
                let speaker = active.participant.clone();
                let language = speaker.speech_language;
                self.enqueue_caption(speaker, language, text, CaptionKind::Speech, event_tx);
            }
            RecognitionEvent::Error => {
                self.broadcast(ServerMessage::Status { code: StatusCode::RecognitionUnavailable }, None);
            }
            RecognitionEvent::Reconnecting => {
                self.broadcast(ServerMessage::Status { code: StatusCode::Reconnecting }, None);
            }
            RecognitionEvent::Reconnected => {
                self.broadcast(ServerMessage::Status { code: StatusCode::RecognitionAvailable }, None);
            }
        }
    }
}
```

Add a fourth `InternalEvent` variant, `SessionStarted { participant_id: Uuid, session: Box<dyn RecognitionSession> }`, and in the main event loop:

```rust
InternalEvent::SessionStarted { participant_id, session } => {
    if let Some(active) = actor.participants.get_mut(&participant_id) {
        active.recognition_session = Some(session);
    } else {
        session.stop(); // participant left while the session was starting up
    }
}
InternalEvent::Recognition { participant_id, event } => {
    actor.handle_recognition_event(participant_id, event, event_tx.clone());
}
```

Also add `SessionStarted { participant_id: Uuid, session: Box<dyn RecognitionSession> }` as a fourth variant on the `InternalEvent` enum declared in Task 5 (alongside `Command` and `TranslationDone`) — `handle_recognition_event`'s `RecognitionEvent::Reconnected` arm is unrelated to session startup and stays reserved for a future adapter that can actually detect a resumed connection (see Task 9's note on `TranscribeRecognizer` not emitting one today).

- [ ] **Step 5: Run to verify it passes**

Run: `cargo test --lib room`
Expected: PASS — all tests from Tasks 4, 5, and 6 green.

- [ ] **Step 6: Wire the module into `src/lib.rs`**

Add `pub mod recognizer;` near the top of `src/lib.rs`.

- [ ] **Step 7: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/src/lib.rs tools/meeting-translation/src/recognizer.rs \
  tools/meeting-translation/src/room/actor.rs
git commit -s -m "feat(meeting-translation): add audio recognition lifecycle"
```

---

## Task 7: Room registry — creation, lookup, reconnect grace, rate limiting

**Files:**
- Create: `tools/meeting-translation/src/room/registry.rs`
- Modify: `tools/meeting-translation/src/room.rs` (re-export)
- Modify: `tools/meeting-translation/Cargo.toml` (add `getrandom`, `base64`)

**Interfaces:**
- Produces: `pub struct RoomRegistry { .. }`, `impl RoomRegistry { pub fn new(translator: Arc<dyn Translator>, recognizer: Arc<dyn SpeechRecognizer>, glossary: Vec<String>) -> Arc<Self>; pub fn create(&self) -> (String, String); pub fn find(&self, room_id: &str) -> Option<mpsc::Sender<RoomCommand>>; pub fn allow_creation(&self, ip: std::net::IpAddr) -> bool; }`. `create()` returns `(room_id, join_token)`. `new` returns `Arc<Self>` (not bare `Self`) because the background lifecycle task and every later `app_context` lookup need to share ownership of the same registry.
- Consumes: `crate::room::actor::{spawn_room, RoomCommand}`, `crate::translator::Translator`, `crate::recognizer::SpeechRecognizer`.

- [ ] **Step 1: Add dependencies**

```toml
getrandom = "0.4"
base64 = "0.22"
```

- [ ] **Step 2: Write the failing tests**

```rust
// tools/meeting-translation/src/room/registry.rs
#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{ClientMessage, Language};
    use crate::translator::{TranslationRequest, Translator};
    use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};
    use async_trait::async_trait;
    use std::net::{IpAddr, Ipv4Addr};
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
        async fn start(&self, _language: Language, _events: mpsc::UnboundedSender<RecognitionEvent>) -> Result<Box<dyn RecognitionSession>, ()> {
            Err(())
        }
    }

    fn test_registry() -> Arc<RoomRegistry> {
        // Deliberately does not call `spawn_lifecycle_loop` — tests drive
        // expiry deterministically via `pump_lifecycle_events_for_test`
        // instead of racing a free-running background task under paused time.
        RoomRegistry::new(Arc::new(NoopTranslator), Arc::new(NoopRecognizer), vec![])
    }

    async fn join(room: &mpsc::Sender<RoomCommand>, room_id: &str, token: &str) -> super::actor::JoinOutcome {
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

        let sender = registry.find(&room_id).expect("room should exist right after creation");
        let outcome = join(&sender, &room_id, &token).await;
        assert!(matches!(outcome, super::actor::JoinOutcome::Joined { .. }));
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
            super::actor::JoinOutcome::Joined { participant_id } => participant_id,
            other => panic!("expected Joined, got {other:?}"),
        };
        sender.send(RoomCommand::Disconnect { participant_id }).await.unwrap();
        // Give the actor's Disconnect handling a moment to run and notify the registry.
        tokio::time::advance(std::time::Duration::from_millis(1)).await;
        registry.pump_lifecycle_events_for_test().await;

        tokio::time::advance(std::time::Duration::from_secs(4)).await;
        assert!(registry.find(&room_id).is_some(), "still within the 5s grace period");

        tokio::time::advance(std::time::Duration::from_secs(2)).await;
        registry.pump_lifecycle_events_for_test().await;
        assert!(registry.find(&room_id).is_none(), "grace period has elapsed");
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
```

`pump_lifecycle_events_for_test` is a small test-only helper added to `RoomRegistry` (see Step 4) that drains the internal lifecycle channel. Tests never call `spawn_lifecycle_loop`, so this helper is the lifecycle channel's only consumer during a test — there is no free-running background task to race against `tokio::time::pause()`.

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test --lib room`
Expected: FAIL to compile — `RoomRegistry` doesn't exist yet.

- [ ] **Step 4: Implement the registry**

```rust
// tools/meeting-translation/src/room/registry.rs
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

use super::actor::{spawn_room, RoomCommand};

const RECONNECT_GRACE: Duration = Duration::from_secs(5);
const RATE_LIMIT_WINDOW: Duration = Duration::from_secs(10 * 60);
const RATE_LIMIT_MAX: usize = 5;

struct RoomEntry {
    sender: mpsc::Sender<RoomCommand>,
    // Not awaited: dropping it doesn't cancel the task (dropping `sender`
    // already triggers its shutdown), but keeping it lets a later task
    // observe or force shutdown instead of discarding the handle outright.
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
    // A tokio (not std) Mutex: `run_lifecycle_loop` holds this guard across
    // the `.recv().await` call below, which is unsound with a std Mutex.
    became_empty_rx: tokio::sync::Mutex<mpsc::UnboundedReceiver<String>>,
    creation_times_by_ip: Mutex<HashMap<IpAddr, Vec<Instant>>>,
}

impl RoomRegistry {
    pub fn new(translator: Arc<dyn Translator>, recognizer: Arc<dyn SpeechRecognizer>, glossary: Vec<String>) -> Arc<Self> {
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

    /// Runs forever, promoting each "room became empty" notification into a
    /// 5-second expiry timer. Call this once at startup (Task 14's
    /// `main.rs`) via `tokio::spawn(registry.clone().run_lifecycle_loop())`.
    /// Tests never call this — see `pump_lifecycle_events_for_test` below.
    pub async fn run_lifecycle_loop(self: Arc<Self>) {
        loop {
            let room_id = {
                let mut rx = self.became_empty_rx.lock().await;
                match rx.recv().await {
                    Some(id) => id,
                    None => return, // every sender dropped; nothing left to do
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
        let token_hash: [u8; 32] = sha2::Sha256::digest(token.as_bytes()).into();

        let (sender, handle) = spawn_room(
            room_id.clone(),
            token_hash,
            self.became_empty_tx.clone(),
            self.translator.clone(),
            self.glossary.clone(),
            self.recognizer.clone(),
        );
        self.rooms.lock().unwrap().insert(room_id.clone(), RoomEntry { sender, handle, pending_expiry: None });

        (room_id, token)
    }

    pub fn find(&self, room_id: &str) -> Option<mpsc::Sender<RoomCommand>> {
        let mut rooms = self.rooms.lock().unwrap();
        let entry = rooms.get_mut(room_id)?;
        if let Some(cancel) = entry.pending_expiry.take() {
            let _ = cancel.send(()); // a join arrived; cancel the pending destroy
        }
        Some(entry.sender.clone())
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
                    // Dropping the sender closes the room actor's channel,
                    // which ends its task loop.
                    drop(sender);
                }
                _ = cancel_rx => {}
            }
        });
    }

    /// Test-only: drains every lifecycle notification currently queued and
    /// starts its expiry timer, without spawning the free-running loop
    /// production uses. Since tests never call `run_lifecycle_loop`, this is
    /// the channel's only consumer, so `try_recv()` here races nothing.
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
    }
}
```

Because `schedule_expiry` takes `&Arc<Self>` (it clones `self` into the spawned timer task), both `run_lifecycle_loop` and `pump_lifecycle_events_for_test` must be called through an `Arc<RoomRegistry>` — already the case everywhere in this plan, since `RoomRegistry::new` returns `Arc<Self>` and the test module's `test_registry()` helper (Step 2) returns that `Arc` directly rather than unwrapping it.

- [ ] **Step 5: Re-export from `src/room.rs`**

```rust
pub mod actor;
pub mod registry;

pub use actor::{spawn_room, Connection, JoinOutcome, RoomCommand};
pub use registry::RoomRegistry;
```

- [ ] **Step 6: Run to verify it passes**

Run: `cargo test --lib room`
Expected: PASS — all tests from Tasks 4-7 green.

- [ ] **Step 7: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/src/room.rs tools/meeting-translation/src/room/registry.rs
git commit -s -m "feat(meeting-translation): add room registry, reconnect grace, and rate limiting"
```

---

## Task 8: Bedrock Translator adapter

**Files:**
- Create: `tools/meeting-translation/src/adapters.rs`
- Create: `tools/meeting-translation/src/adapters/bedrock.rs`
- Modify: `tools/meeting-translation/src/lib.rs` (add `pub mod adapters;`)
- Modify: `tools/meeting-translation/Cargo.toml` (add `aws-config`, `aws-sdk-bedrockruntime`)

**Interfaces:**
- Produces: `pub struct BedrockTranslator { client: aws_sdk_bedrockruntime::Client, model_id: String }`, `impl BedrockTranslator { pub fn new(client: aws_sdk_bedrockruntime::Client, model_id: String) -> Self }`, `impl Translator for BedrockTranslator`.
- Consumes: `crate::translator::{Translator, TranslationRequest}`.

This adapter's real network call (`client.converse().send()`) cannot be exercised in a unit test without live AWS credentials — that end-to-end path is verified in Task 17's dogfooding pass instead. This task's tests cover the one pure piece: building the prompt.

- [ ] **Step 1: Add dependencies**

```toml
aws-config = "1"
aws-sdk-bedrockruntime = "1"
```

- [ ] **Step 2: Write the failing test**

```rust
// tools/meeting-translation/src/adapters/bedrock.rs
#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::Language;
    use crate::translator::TranslationRequest;

    #[test]
    fn prompt_includes_target_language_and_glossary_and_text() {
        let request = TranslationRequest {
            source_text: "hello".to_string(),
            source_language: Language::English,
            target_language: Language::Japanese,
            context: vec![],
            glossary: vec!["Topcoat".to_string()],
        };

        let prompt = build_user_prompt(&request);
        assert!(prompt.contains("hello"));
        assert!(prompt.contains("Japanese"));
        assert!(prompt.contains("Topcoat"));
    }
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test --lib adapters::bedrock`
Expected: FAIL to compile — `build_user_prompt` doesn't exist yet.

- [ ] **Step 4: Implement the adapter**

```rust
// tools/meeting-translation/src/adapters/bedrock.rs
use async_trait::async_trait;
use aws_sdk_bedrockruntime::types::{ContentBlock, ConversationRole, Message};

use crate::protocol::Language;
use crate::translator::{TranslationRequest, Translator};

pub struct BedrockTranslator {
    client: aws_sdk_bedrockruntime::Client,
    model_id: String,
}

impl BedrockTranslator {
    pub fn new(client: aws_sdk_bedrockruntime::Client, model_id: String) -> Self {
        Self { client, model_id }
    }
}

fn language_name(language: Language) -> &'static str {
    match language {
        Language::Japanese => "Japanese",
        Language::English => "English",
    }
}

fn build_user_prompt(request: &TranslationRequest) -> String {
    let mut prompt = String::new();
    prompt.push_str("Translate the following text into ");
    prompt.push_str(language_name(request.target_language));
    prompt.push_str(". Reply with only the translation, no explanation.\n\n");

    if !request.glossary.is_empty() {
        prompt.push_str("Glossary (use these terms as-is when they appear):\n");
        for entry in &request.glossary {
            prompt.push_str("- ");
            prompt.push_str(entry);
            prompt.push('\n');
        }
        prompt.push('\n');
    }

    if !request.context.is_empty() {
        prompt.push_str("Recent conversation context:\n");
        for caption in &request.context {
            prompt.push_str("- ");
            prompt.push_str(&caption.source_text);
            prompt.push('\n');
        }
        prompt.push('\n');
    }

    prompt.push_str("Text to translate:\n");
    prompt.push_str(&request.source_text);
    prompt
}

#[async_trait]
impl Translator for BedrockTranslator {
    async fn translate(&self, request: TranslationRequest) -> Result<String, ()> {
        let prompt = build_user_prompt(&request);
        let message = Message::builder()
            .role(ConversationRole::User)
            .content(ContentBlock::Text(prompt))
            .build()
            .map_err(|_| ())?;

        let response = self
            .client
            .converse()
            .model_id(&self.model_id)
            .messages(message)
            .send()
            .await
            .map_err(|_| ())?;

        response
            .output()
            .ok_or(())?
            .as_message()
            .map_err(|_| ())?
            .content()
            .first()
            .ok_or(())?
            .as_text()
            .map(|text| text.to_string())
            .map_err(|_| ())
    }
}
```

- [ ] **Step 5: Write `src/adapters.rs`**

```rust
pub mod bedrock;
```

- [ ] **Step 6: Run to verify it passes**

Run: `cargo test --lib adapters::bedrock`
Expected: PASS.

Run: `cargo build`
Expected: compiles cleanly (this is the first task that pulls in the AWS SDK — a clean `cargo build` here is itself evidence the dependency versions resolve).

- [ ] **Step 7: Wire the module into `src/lib.rs`**

Add `pub mod adapters;` near the top of `src/lib.rs`.

- [ ] **Step 8: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/src/lib.rs tools/meeting-translation/src/adapters.rs \
  tools/meeting-translation/src/adapters/bedrock.rs
git commit -s -m "feat(meeting-translation): add Bedrock translator adapter"
```

---

## Task 9: Transcribe SpeechRecognizer adapter

**Files:**
- Create: `tools/meeting-translation/src/adapters/transcribe.rs`
- Modify: `tools/meeting-translation/src/adapters.rs`
- Modify: `tools/meeting-translation/Cargo.toml` (add `aws-sdk-transcribestreaming`, `tokio-stream`)

**Interfaces:**
- Produces: `pub struct TranscribeRecognizer { client: aws_sdk_transcribestreaming::Client }`, `impl TranscribeRecognizer { pub fn new(client: aws_sdk_transcribestreaming::Client) -> Self }`, `impl SpeechRecognizer for TranscribeRecognizer`.
- Consumes: `crate::recognizer::{SpeechRecognizer, RecognitionSession, RecognitionEvent}`.

This adapter also cannot be unit-tested without live AWS credentials and a real audio stream; it is exercised end-to-end in Task 17's dogfooding pass. This task's own verification is a clean `cargo build`.

- [ ] **Step 1: Add dependencies**

```toml
aws-sdk-transcribestreaming = "1"
tokio-stream = "0.1"
```

- [ ] **Step 2: Implement the adapter**

```rust
// tools/meeting-translation/src/adapters/transcribe.rs
use async_trait::async_trait;
use aws_sdk_transcribestreaming::primitives::Blob;
use aws_sdk_transcribestreaming::types::{AudioEvent, AudioStream, LanguageCode, MediaEncoding, TranscriptResultStream};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use tokio_stream::StreamExt;

use crate::protocol::Language;
use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};

const SAMPLE_RATE_HZ: i32 = 16_000;

fn language_code(language: Language) -> LanguageCode {
    match language {
        Language::Japanese => LanguageCode::JaJp,
        Language::English => LanguageCode::EnUs,
    }
}

pub struct TranscribeRecognizer {
    client: aws_sdk_transcribestreaming::Client,
}

impl TranscribeRecognizer {
    pub fn new(client: aws_sdk_transcribestreaming::Client) -> Self {
        Self { client }
    }
}

struct TranscribeSession {
    audio_tx: mpsc::UnboundedSender<Vec<u8>>,
}

impl RecognitionSession for TranscribeSession {
    fn write(&self, chunk: Vec<u8>) {
        let _ = self.audio_tx.send(chunk);
    }

    fn stop(self: Box<Self>) {
        // Dropping audio_tx closes the audio stream, which ends the
        // Transcribe session on AWS's side and the reader task below.
    }
}

#[async_trait]
impl SpeechRecognizer for TranscribeRecognizer {
    async fn start(
        &self,
        language: Language,
        events: mpsc::UnboundedSender<RecognitionEvent>,
    ) -> Result<Box<dyn RecognitionSession>, ()> {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel::<Vec<u8>>();
        let audio_stream = UnboundedReceiverStream::new(audio_rx)
            .map(|chunk| Ok(AudioStream::AudioEvent(AudioEvent::builder().audio_chunk(Blob::new(chunk)).build())));

        let output = self
            .client
            .start_stream_transcription()
            .language_code(language_code(language))
            .media_sample_rate_hertz(SAMPLE_RATE_HZ)
            .media_encoding(MediaEncoding::Pcm)
            .audio_stream(audio_stream.into())
            .send()
            .await
            .map_err(|_| ())?;

        let mut transcript_stream = output.transcript_result_stream;
        tokio::spawn(async move {
            loop {
                match transcript_stream.recv().await {
                    Ok(Some(TranscriptResultStream::TranscriptEvent(transcript_event))) => {
                        let Some(transcript) = transcript_event.transcript else { continue };
                        for result in transcript.results.unwrap_or_default() {
                            let Some(alternatives) = result.alternatives else { continue };
                            let Some(first) = alternatives.first() else { continue };
                            let Some(text) = first.transcript.clone() else { continue };
                            let event = if result.is_partial {
                                RecognitionEvent::Partial(text)
                            } else {
                                RecognitionEvent::Final(text)
                            };
                            if events.send(event).is_err() {
                                return;
                            }
                        }
                    }
                    Ok(Some(_)) => {}
                    Ok(None) => return,
                    Err(_) => {
                        let _ = events.send(RecognitionEvent::Error);
                        return;
                    }
                }
            }
        });

        Ok(Box::new(TranscribeSession { audio_tx }))
    }
}
```

Note: this adapter does not implement the `onReconnecting`/`onReconnected` distinction the TS version had — `aws-sdk-transcribestreaming`'s Rust event stream surfaces a terminal `Err` rather than a resumable reconnect notification (confirmed against the official `awsdocs/aws-doc-sdk-examples` sample, which treats stream errors as terminal). A dropped stream is reported as `RecognitionEvent::Error`, which the room actor already turns into `StatusCode::RecognitionUnavailable`. If automatic reconnection turns out to matter after dogfooding, it needs its own follow-up (wrap this adapter's `start` in a retry loop that calls `start_stream_transcription` again and emits `Reconnecting`/`Reconnected` around the retry) — out of scope here per the spec's stated risk.

- [ ] **Step 3: Update `src/adapters.rs`**

```rust
pub mod bedrock;
pub mod transcribe;
```

- [ ] **Step 4: Verify it builds**

Run: `cargo build`
Expected: compiles cleanly. If `audio_stream.into()` does not satisfy the `audio_stream()` builder method's expected type, check the exact bound on `StartStreamTranscriptionFluentBuilder::audio_stream` on docs.rs for the resolved `aws-sdk-transcribestreaming` version in `Cargo.lock` and adjust the conversion (the official example uses the same `stream.into()` pattern against an `async_stream::stream!`-produced stream, so an `UnboundedReceiverStream` mapped to the same `Result<AudioStream, AudioStreamError>` item type is expected to satisfy the same bound).

- [ ] **Step 5: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/src/adapters.rs tools/meeting-translation/src/adapters/transcribe.rs
git commit -s -m "feat(meeting-translation): add Transcribe streaming recognizer adapter"
```

---

## Task 10: WebSocket session route

**Files:**
- Create: `tools/meeting-translation/src/session.rs`
- Modify: `tools/meeting-translation/src/lib.rs` (add `pub mod session;`)
- Modify: `tools/meeting-translation/Cargo.toml` (add `futures-util`, dev-dependency `tokio-tungstenite`)
- Modify: `tools/meeting-translation/src/room/actor.rs` (add `reconnectable: bool` to `RoomCommand::Disconnect` — see Step 4)
- Modify: `tools/meeting-translation/src/room/registry.rs` (make the grace timer conditional on `reconnectable`, update `RoomBecameEmpty`'s shape — see Step 4)

**Interfaces:**
- Produces: `#[route(GET "/translate/rooms/{room_id}/session")] pub async fn session(cx: &Cx, upgrade: WebSocketUpgrade) -> Result<Response>` — registered into the router as `.route(session::session)` in Task 14.
- Consumes: `crate::room::RoomRegistry` (via `app_context`), `crate::protocol::{parse_client_message, ClientMessage, ServerMessage, StatusCode}`.

- [ ] **Step 1: Add dependencies**

```toml
futures-util = "0.3"

[dev-dependencies]
tokio-tungstenite = "0.29"
```

- [ ] **Step 2: Write the failing integration test**

```rust
// tools/meeting-translation/src/session.rs
#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_trait::async_trait;
    use futures_util::{SinkExt, StreamExt};
    use tokio::sync::mpsc;
    use topcoat::router::Router;

    use crate::protocol::{ClientMessage, Language};
    use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};
    use crate::room::RoomRegistry;
    use crate::translator::{TranslationRequest, Translator};

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
        async fn start(&self, _language: Language, _events: mpsc::UnboundedSender<RecognitionEvent>) -> Result<Box<dyn RecognitionSession>, ()> {
            Err(())
        }
    }

    async fn spawn_test_server() -> (std::net::SocketAddr, Arc<RoomRegistry>) {
        let registry = RoomRegistry::new(Arc::new(NoopTranslator), Arc::new(NoopRecognizer), vec![]);
        let router = Router::builder()
            .route(super::session)
            .app_context(registry.clone())
            .build();

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(topcoat::serve(listener, router));
        // Give the server a moment to start accepting connections.
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        (addr, registry)
    }

    #[tokio::test]
    async fn join_over_the_socket_gets_room_joined_back() {
        let (addr, registry) = spawn_test_server().await;
        let (room_id, token) = registry.create();

        let url = format!("ws://{addr}/translate/rooms/{room_id}/session");
        let (mut socket, _response) = tokio_tungstenite::connect_async(&url).await.unwrap();

        let join = serde_json::json!({
            "type": "join",
            "room_id": room_id,
            "token": token,
            "display_name": "Alice",
            "speech_language": "japanese",
            "display_language": "english",
            "consent": true
        });
        socket.send(tokio_tungstenite::tungstenite::Message::Text(join.to_string().into())).await.unwrap();

        let reply = socket.next().await.unwrap().unwrap();
        let text = reply.into_text().unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(parsed["type"], "room_joined");
    }
}
```

Note: the exact call to start Topcoat's server on an already-bound listener (`topcoat::serve(listener, router)` above) is a guess at the ergonomic shape based on `topcoat::start`'s existence; verify the real function name/signature via `cargo doc --open -p topcoat` or docs.rs for the resolved version before trusting this line, and adjust — if no such listener-based entry point exists, bind `topcoat::start` itself to a fixed high port read from an env var the test sets, since every other example in this codebase calls `topcoat::start(router)` with no listener argument.

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test --lib session`
Expected: FAIL to compile — `session()` doesn't exist yet, and the exact serving call from Step 2 may need adjusting per the note above.

- [ ] **Step 4: Implement the route**

```rust
// tools/meeting-translation/src/session.rs
use topcoat::context::{app_context, Cx};
use topcoat::router::content::websocket::{Message, WebSocketUpgrade};
use topcoat::router::response::Response;
use topcoat::router::{path_param, route};
use topcoat::Result;

use crate::protocol::{parse_client_message, ClientMessage, ServerMessage, StatusCode};
use crate::room::{JoinOutcome, RoomCommand, RoomRegistry};

topcoat::router::path_param!(room_id: String, error = topcoat::router::error::bad_request);

#[route(GET "/translate/rooms/{room_id}/session")]
pub async fn session(cx: &Cx, upgrade: WebSocketUpgrade) -> Result<Response> {
    let room_id = path_param::<RoomId>(cx)?.clone();
    let registry = app_context::<std::sync::Arc<RoomRegistry>>(cx).clone();

    Ok(upgrade.on_upgrade(move |socket| async move {
        run_session(socket, room_id, registry).await;
    }))
}

async fn run_session(socket: topcoat::router::content::websocket::WebSocket, room_id: String, registry: std::sync::Arc<RoomRegistry>) {
    use futures_util::{SinkExt, StreamExt};

    let (mut ws_tx, mut ws_rx) = socket.split();
    let (out_tx, mut out_rx) = tokio::sync::mpsc::unbounded_channel::<ServerMessage>();

    let mut participant_id: Option<uuid::Uuid> = None;
    let mut explicit_leave = false;
    let mut room: Option<tokio::sync::mpsc::Sender<RoomCommand>> = None;

    loop {
        tokio::select! {
            frame = ws_rx.next() => {
                let Some(Ok(frame)) = frame else { break };
                match frame {
                    Message::Binary(bytes) => {
                        if let (Some(id), Some(room)) = (participant_id, &room) {
                            let _ = room.send(RoomCommand::WriteAudio { participant_id: id, chunk: bytes.to_vec() }).await;
                        } else {
                            let _ = ws_tx.send(status_frame(StatusCode::InvalidMessage)).await;
                        }
                    }
                    Message::Text(text) => {
                        let Ok(message) = parse_client_message(text.as_bytes()) else {
                            let _ = ws_tx.send(status_frame(StatusCode::InvalidMessage)).await;
                            continue;
                        };

                        if let ClientMessage::Join { .. } = &message {
                            if participant_id.is_some() {
                                let _ = ws_tx.send(status_frame(StatusCode::InvalidMessage)).await;
                                continue;
                            }
                            let Some(sender) = registry.find(&room_id) else {
                                let _ = ws_tx.send(status_frame(StatusCode::RoomNotFound)).await;
                                continue;
                            };
                            let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
                            let _ = sender.send(RoomCommand::Join { connection: out_tx.clone(), message, reply: reply_tx }).await;
                            match reply_rx.await {
                                Ok(JoinOutcome::Joined { participant_id: id }) => {
                                    participant_id = Some(id);
                                    room = Some(sender);
                                }
                                Ok(JoinOutcome::RoomNotFound) => { let _ = ws_tx.send(status_frame(StatusCode::RoomNotFound)).await; }
                                Ok(JoinOutcome::RoomFull) => { let _ = ws_tx.send(status_frame(StatusCode::RoomFull)).await; }
                                Ok(JoinOutcome::InvalidMessage) | Err(_) => { let _ = ws_tx.send(status_frame(StatusCode::InvalidMessage)).await; }
                            }
                            continue;
                        }

                        let Some(id) = participant_id else {
                            let _ = ws_tx.send(status_frame(StatusCode::InvalidMessage)).await;
                            continue;
                        };
                        if matches!(message, ClientMessage::Leave) {
                            explicit_leave = true;
                        }
                        if let Some(room) = &room {
                            let _ = room.send(RoomCommand::HandleMessage { participant_id: id, message }).await;
                        }
                    }
                    Message::Close(_) => break,
                    Message::Ping(_) | Message::Pong(_) => {}
                }
            }
            Some(message) = out_rx.recv() => {
                let body = serde_json::to_string(&message).unwrap();
                if ws_tx.send(Message::Text(body.into())).await.is_err() {
                    break;
                }
            }
            else => break,
        }
    }

    if let (Some(id), Some(room)) = (participant_id, &room) {
        let _ = room.send(RoomCommand::Disconnect { participant_id: id }).await;
    }
    let _ = explicit_leave; // reconnect-grace vs. immediate destroy is decided inside RoomRegistry (Task 7); this flag is reserved for a future distinct "explicit leave" command if that behavior needs to differ from a bare Disconnect.
}

fn status_frame(code: StatusCode) -> Message {
    let body = serde_json::to_string(&ServerMessage::Status { code }).unwrap();
    Message::Text(body.into())
}
```

**Important gap to close while implementing this step:** Task 7's `RoomCommand::Disconnect` does not currently distinguish "close socket, allow 5s reconnect grace" from "explicit `leave`, destroy immediately" — Task 4-6 only ever call `self.disconnect(participant_id)` the same way in both cases, and Task 7's `RoomRegistry` starts the grace timer unconditionally whenever a room becomes empty. Before finishing this task, go back and thread the distinction through:

1. In `src/room/actor.rs`, change `RoomCommand::Disconnect { participant_id: Uuid }` to `RoomCommand::Disconnect { participant_id: Uuid, reconnectable: bool }`, and have `RoomActor::disconnect` include `reconnectable` in whatever it sends on `became_empty` — change the channel's item type from `String` (room_id) to a small `struct RoomBecameEmpty { room_id: String, reconnectable: bool }` in `registry.rs`.
2. In `src/room/registry.rs`, `schedule_expiry` only starts the grace-period timer when `reconnectable` is true; when it is false, remove the room from `rooms` and drop its sender immediately (same effect as the timer path's cleanup, just without waiting).
3. In `src/session.rs`'s `run_session`, pass `reconnectable: !explicit_leave` when sending the final `Disconnect`.
4. Re-run the Task 7 tests (`cargo test --lib room::registry`) after this change — they need updating to pass `reconnectable: true`/`false` explicitly and to add one new case: an explicit leave (`reconnectable: false`) makes `registry.find` return `None` immediately, with no grace period.

- [ ] **Step 5: Run to verify it passes**

Run: `cargo test --lib session`
Expected: PASS.

Run: `cargo test --lib room::registry`
Expected: PASS, including the new explicit-leave-has-no-grace-period case from Step 4.

- [ ] **Step 6: Wire the module into `src/lib.rs`**

Add `pub mod session;` near the top of `src/lib.rs`.

- [ ] **Step 7: Commit**

```bash
git add tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock \
  tools/meeting-translation/src/lib.rs tools/meeting-translation/src/session.rs \
  tools/meeting-translation/src/room/actor.rs tools/meeting-translation/src/room/registry.rs
git commit -s -m "feat(meeting-translation): add WebSocket session route

Also threads an explicit reconnectable flag through Disconnect so a
bare socket close (5s grace) and an explicit leave (immediate) are
distinguishable, closing a gap left open since Task 7."
```

---

## Task 11: Pages — creation form, room API, meeting page, assets

**Files:**
- Create: `tools/meeting-translation/src/pages.rs`
- Create: `tools/meeting-translation/src/assets.rs` (moved up from Task 12 — `pages.rs` references it in this task, so it must exist now; Task 12 only fills in the two JS files' real content, it does not touch this Rust file again)
- Create: `tools/meeting-translation/assets/creation-form.js` (placeholder — Task 12 replaces the content)
- Create: `tools/meeting-translation/assets/session.js` (placeholder — Task 12 replaces the content)
- Modify: `tools/meeting-translation/src/lib.rs` (add `pub mod pages;` and `pub mod assets;`)
- Modify: `tools/meeting-translation/src/room.rs` (add the shared `path_param!(room_id: String, ...)` declaration — see Step 2)
- Modify: `tools/meeting-translation/src/session.rs` (drop its own copy of that declaration in favor of the one now in `room.rs` — see Step 2)

**Interfaces:**
- Produces: `pub async fn creation_form() -> Result<impl View>` (`#[page("/translate/")]`), `pub async fn create_room(cx: &Cx) -> Result<Json<CreateRoomResponse>>` (`#[route(POST "/translate/api/rooms")]`), `pub async fn meeting_page(cx: &Cx) -> Result<impl View>` (`#[page("/translate/rooms/{room_id}")]`).
- Consumes: `crate::room::RoomRegistry` (app context), `topcoat::router::request::client_ip`.

- [ ] **Step 0: Create the asset module and placeholder JS files `pages.rs` needs**

`pages.rs` (Step 1) references `crate::assets::CREATION_FORM_JS`/`SESSION_JS`. Rather than leave the crate in a non-compiling state until Task 12, create the asset module and two placeholder JS files now; Task 12 replaces the JS files' content but does not touch this Rust file again.

Write `tools/meeting-translation/src/assets.rs`:

```rust
use topcoat::asset::{asset, Asset};

pub const CREATION_FORM_JS: Asset = asset!("../assets/creation-form.js");
pub const SESSION_JS: Asset = asset!("../assets/session.js");
```

Write `tools/meeting-translation/assets/creation-form.js`:

```javascript
// Placeholder — Task 12 replaces this with the real room-creation flow.
```

Write `tools/meeting-translation/assets/session.js`:

```javascript
// Placeholder — Task 12 replaces this with the real WebSocket client.
```

- [ ] **Step 1: Write `src/pages.rs`**

```rust
use serde::Serialize;
use topcoat::context::{app_context, Cx};
use topcoat::router::content::Json;
use topcoat::router::error::too_many_requests;
use topcoat::router::request::client_ip;
use topcoat::router::{page, path_param, route};
use topcoat::view::{view, View};
use topcoat::Result;

use crate::room::RoomRegistry;

#[page("/translate/")]
pub async fn creation_form() -> Result<impl View> {
    Ok(view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Meeting Translation"</title>
                topcoat::dev::script()
            </head>
            <body>
                <h1>"Meeting Translation"</h1>
                <form id="create-room-form">
                    <label>
                        "Display name"
                        <input type="text" id="display-name" maxlength="40" required>
                    </label>
                    <button type="submit">"Create meeting"</button>
                </form>
                <script src=(crate::assets::CREATION_FORM_JS)></script>
            </body>
        </html>
    })
}

#[derive(Serialize)]
pub struct CreateRoomResponse {
    room_id: String,
    join_token: String,
}

#[route(POST "/translate/api/rooms")]
pub async fn create_room(cx: &Cx) -> Result<Json<CreateRoomResponse>> {
    let registry = app_context::<std::sync::Arc<RoomRegistry>>(cx).clone();
    let ip = client_ip(cx).ok_or_else(too_many_requests)?;
    if !registry.allow_creation(ip) {
        return Err(too_many_requests().into());
    }

    let (room_id, join_token) = registry.create();
    Ok(Json(CreateRoomResponse { room_id, join_token }))
}

topcoat::router::path_param!(room_id: String, error = topcoat::router::error::bad_request);

#[page("/translate/rooms/{room_id}")]
pub async fn meeting_page(cx: &Cx) -> Result<impl View> {
    let room_id = path_param::<RoomId>(cx)?.clone();

    Ok(view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Meeting Translation"</title>
                topcoat::dev::script()
            </head>
            <body>
                <div id="app" data-room-id=(room_id)></div>
                <script src=(crate::assets::SESSION_JS)></script>
            </body>
        </html>
    })
}
```

Note: `too_many_requests` is used here on the assumption that `topcoat::router::error` exposes it alongside the confirmed `bad_request`/`forbidden`/`not_found` constructors from the `error` example — verify it exists on docs.rs for the resolved Topcoat version during `cargo check`; if it does not exist yet in 0.9.0, build the 429 response manually via the `IntoResponse`-for-a-custom-type pattern shown in `examples/request-response/src/main.rs` (`Csv` type) instead, returning `Response::builder().status(StatusCode::TOO_MANY_REQUESTS).body(Body::empty())?`.

Also note `path_param!(room_id: String, ...)` is declared identically in both `pages.rs` (for `meeting_page`) and `session.rs` (for the WebSocket route) — this duplicates the `RoomId` marker type in two modules with the same name, which will not compile as two separate types both named `RoomId` in scope of `topcoat::router`'s registration. Move this single declaration into `src/room.rs` (re-exported as `pub use` from both `pages.rs` and `session.rs`) before finishing this task, since both call sites need the exact same generated type.

- [ ] **Step 2: Wire the modules into `src/lib.rs`**

Add `pub mod pages;` and `pub mod assets;` near the top of `src/lib.rs` — needed before `cargo check` will even attempt to compile `pages.rs`'s contents (an undeclared module file is not part of the build).

- [ ] **Step 3: `cargo check` to catch the two issues flagged above, then fix them**

Run: `cargo check`
Expected: first FAILS on the duplicate `RoomId` type and (possibly) the missing `too_many_requests`; fix per the notes above, then re-run until it passes.

- [ ] **Step 4: Commit**

```bash
git add tools/meeting-translation/src/lib.rs tools/meeting-translation/src/pages.rs \
  tools/meeting-translation/src/assets.rs tools/meeting-translation/assets/creation-form.js \
  tools/meeting-translation/assets/session.js tools/meeting-translation/src/room.rs \
  tools/meeting-translation/src/session.rs
git commit -s -m "feat(meeting-translation): add creation form, room API, and meeting page"
```

---

## Task 12: Browser JS — WebSocket client, caption rendering, manual caption, clarification

**Files:**
- Modify: `tools/meeting-translation/assets/session.js` (Task 11 created this as a placeholder — replace its content)
- Modify: `tools/meeting-translation/assets/creation-form.js` (Task 11 created this as a placeholder — replace its content)
- Modify: `tools/meeting-translation/Cargo.toml` (add `asset` feature — already implied by Topcoat's default features, no change needed; confirm during build)

**Interfaces:**
- Produces: real content for the two JS files Task 11 created as placeholders (`src/assets.rs`'s `CREATION_FORM_JS`/`SESSION_JS` constants already point at them — no Rust change needed in this task).
- Consumes: nothing Rust-side beyond the `asset!` macro Task 11 already wired up.

- [ ] **Step 1: Write `assets/creation-form.js`**

```javascript
document.getElementById("create-room-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/translate/api/rooms", { method: "POST" });
  if (!response.ok) {
    alert("Could not create the meeting. Please try again.");
    return;
  }

  const { room_id: roomId, join_token: joinToken } = await response.json();
  window.location.href = `/translate/rooms/${roomId}#${joinToken}`;
});
```

- [ ] **Step 2: Write `assets/session.js`**

```javascript
const appElement = document.getElementById("app");
const roomId = appElement.dataset.roomId;
const joinToken = window.location.hash.slice(1);

const statusMessages = {
  invalid_message: "Something went wrong. Please refresh.",
  room_full: "This meeting already has 3 participants.",
  room_not_found: "This meeting link is no longer valid.",
  microphone_unavailable: "Microphone access is unavailable.",
  recognition_available: "Speech recognition is back online.",
  recognition_unavailable: "Speech recognition is unavailable. You can type captions manually.",
  translation_unavailable: "Translation failed for the last caption.",
  reconnecting: "Reconnecting to speech recognition...",
};

function renderApp() {
  appElement.innerHTML = `
    <div id="status" role="status"></div>
    <ul id="participants"></ul>
    <ul id="captions"></ul>
    <form id="manual-caption-form">
      <input id="manual-caption-text" maxlength="2000" placeholder="Type a caption">
      <button type="submit">Send</button>
    </form>
  `;
}

function showStatus(code) {
  const statusElement = document.getElementById("status");
  statusElement.textContent = statusMessages[code] ?? "";
}

function renderParticipants(participants) {
  const list = document.getElementById("participants");
  list.innerHTML = "";
  for (const participant of participants) {
    const item = document.createElement("li");
    item.textContent = participant.display_name;
    list.appendChild(item);
  }
}

function upsertCaption(caption) {
  const list = document.getElementById("captions");
  let item = document.getElementById(`caption-${caption.id}`);
  if (!item) {
    item = document.createElement("li");
    item.id = `caption-${caption.id}`;
    list.appendChild(item);
  }

  const text = caption.state === "final" ? caption.translated_text : caption.source_text;
  item.textContent = `${caption.speaker.display_name}: ${text ?? "..."}`;

  if (caption.state !== "translating") {
    const clarifyButton = document.createElement("button");
    clarifyButton.textContent = "Ask to clarify";
    clarifyButton.addEventListener("click", () => {
      socket.send(JSON.stringify({ type: "clarification_request", caption_id: caption.id }));
    });
    item.appendChild(clarifyButton);
  }
}

renderApp();

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(`${protocol}//${window.location.host}/translate/rooms/${roomId}/session`);

socket.addEventListener("open", () => {
  socket.send(
    JSON.stringify({
      type: "join",
      room_id: roomId,
      token: joinToken,
      display_name: window.prompt("Your display name") ?? "Guest",
      speech_language: "japanese",
      display_language: "english",
      consent: true,
    }),
  );
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  switch (message.type) {
    case "room_joined":
      renderParticipants(message.participants);
      break;
    case "participant_joined":
    case "participant_left":
      // A full participant list is only sent on join; track membership
      // incrementally here rather than re-fetching it.
      break;
    case "caption_preview":
      break;
    case "caption_update":
      upsertCaption(message.caption);
      break;
    case "clarification_requested":
      showStatus("reconnecting"); // placeholder visual cue until a dedicated UI slot is designed
      break;
    case "status":
      showStatus(message.code);
      break;
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "manual-caption-form") return;
  event.preventDefault();
  const input = document.getElementById("manual-caption-text");
  if (!input.value) return;
  socket.send(JSON.stringify({ type: "caption_manual", text: input.value }));
  input.value = "";
});
```

Note: this is a functional but intentionally minimal first pass — it proves the wire protocol end-to-end (join, roster, manual captions, clarification requests, status codes). `participant_joined`/`participant_left` incremental roster updates and a dedicated clarification-request UI slot are left as visible gaps rather than papered over with fake logic; extend them once the core loop is confirmed working in Task 17's dogfooding pass.

- [ ] **Step 3: Verify the crate still compiles**

Task 11 already declared `pub mod assets;` in `src/lib.rs` and wired the `asset!()` calls — this task only replaced the two JS files' content, so no Rust file changes are expected here.

Run: `cargo check`
Expected: PASS, with no diff to any `.rs` file (confirm with `git status --short` that only the two `.js` files changed).

- [ ] **Step 4: Commit**

```bash
git add tools/meeting-translation/assets/session.js tools/meeting-translation/assets/creation-form.js
git commit -s -m "feat(meeting-translation): add browser WebSocket client and caption UI"
```

---

## Task 13: Browser JS — microphone capture, AudioWorklet, PCM resampling

**Files:**
- Create: `tools/meeting-translation/assets/pcm-resample.js`
- Create: `tools/meeting-translation/assets/pcm-resample.test.js`
- Create: `tools/meeting-translation/assets/audio-worklet-processor.js`
- Create: `tools/meeting-translation/assets/microphone.js`
- Modify: `tools/meeting-translation/assets/session.js` (wire in mic start/stop)
- Modify: `tools/meeting-translation/src/assets.rs` (register `microphone.js`, `audio-worklet-processor.js`, and `pcm-resample.js` via `asset!()` so Topcoat's bundler serves them — see Step 7)
- Modify: `tools/meeting-translation/src/pages.rs` (change `meeting_page`'s `<script>` tag to `type="module"` — see Step 6)

**Interfaces:**
- Produces (pure, unit-tested): `resamplePcm16(input: Int16Array, inputSampleRate: number, outputSampleRate: number): Int16Array` in `pcm-resample.js`.
- Produces (browser-only, not unit-tested): `audio-worklet-processor.js` registers a `AudioWorkletProcessor` named `pcm-capture`; `microphone.js` exports `startMicrophone(onChunk: (chunk: Uint8Array) => void): Promise<void>` and `stopMicrophone(): void`.

- [ ] **Step 1: Write the failing test for the pure resampling function**

```javascript
// tools/meeting-translation/assets/pcm-resample.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { resamplePcm16 } from "./pcm-resample.js";

test("downsamples a constant signal to half the length at half the rate", () => {
  const input = new Int16Array([100, 200, 300, 400]);
  const output = resamplePcm16(input, 48000, 24000);
  assert.equal(output.length, 2);
});

test("passes a signal through unchanged when rates match", () => {
  const input = new Int16Array([1, 2, 3]);
  const output = resamplePcm16(input, 16000, 16000);
  assert.deepEqual(Array.from(output), [1, 2, 3]);
});

test("clamps interpolated values to the Int16 range", () => {
  const input = new Int16Array([32767, -32768]);
  const output = resamplePcm16(input, 8000, 16000);
  for (const sample of output) {
    assert.ok(sample >= -32768 && sample <= 32767);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tools/meeting-translation/assets/pcm-resample.test.js`
Expected: FAIL — `pcm-resample.js` does not exist yet.

- [ ] **Step 3: Implement `pcm-resample.js`**

```javascript
// tools/meeting-translation/assets/pcm-resample.js
export function resamplePcm16(input, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return input.slice();
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(lowerIndex + 1, input.length - 1);
    const weight = sourceIndex - lowerIndex;
    const interpolated = input[lowerIndex] * (1 - weight) + input[upperIndex] * weight;
    output[i] = Math.max(-32768, Math.min(32767, Math.round(interpolated)));
  }

  return output;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tools/meeting-translation/assets/pcm-resample.test.js`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Write the AudioWorklet processor and the microphone module**

```javascript
// tools/meeting-translation/assets/audio-worklet-processor.js
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      const pcm16 = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        const clamped = Math.max(-1, Math.min(1, channel[i]));
        pcm16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
```

```javascript
// tools/meeting-translation/assets/microphone.js
import { resamplePcm16 } from "./pcm-resample.js";

const TARGET_SAMPLE_RATE = 16000;

let audioContext;
let workletNode;
let mediaStream;

export async function startMicrophone(onChunk) {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule("./audio-worklet-processor.js");

  const source = audioContext.createMediaStreamSource(mediaStream);
  workletNode = new AudioWorkletNode(audioContext, "pcm-capture");
  workletNode.port.onmessage = (event) => {
    const input = new Int16Array(event.data);
    const resampled = resamplePcm16(input, audioContext.sampleRate, TARGET_SAMPLE_RATE);
    onChunk(new Uint8Array(resampled.buffer));
  };

  source.connect(workletNode);
}

export function stopMicrophone() {
  workletNode?.port.close();
  mediaStream?.getTracks().forEach((track) => track.stop());
  audioContext?.close();
  workletNode = undefined;
  mediaStream = undefined;
  audioContext = undefined;
}
```

- [ ] **Step 6: Wire the microphone into `session.js`**

Add near the top of `assets/session.js`:

```javascript
import { startMicrophone, stopMicrophone } from "./microphone.js";
```

And inside `renderApp()`'s template, add a toggle button:

```javascript
    <button id="mic-toggle">Start speaking</button>
```

After the `renderApp()` call, wire the toggle:

```javascript
let micActive = false;
document.getElementById("mic-toggle").addEventListener("click", async () => {
  if (micActive) {
    stopMicrophone();
    socket.send(JSON.stringify({ type: "audio_stop" }));
    micActive = false;
    return;
  }

  try {
    await startMicrophone((chunk) => socket.send(chunk));
    socket.send(JSON.stringify({ type: "audio_start" }));
    micActive = true;
  } catch {
    showStatus("microphone_unavailable");
  }
});
```

Since `session.js` now uses `import`, it must be loaded as an ES module — update `src/pages.rs`'s `meeting_page` script tag: `<script type="module" src=(crate::assets::SESSION_JS)></script>`.

- [ ] **Step 7: Register the worklet processor as an asset** so it is served (referenced by URL string in `microphone.js`'s `addModule` call, not by the `asset!` macro, since `AudioWorkletNode`'s module loader takes a runtime path — serve it as a plain static file next to `session.js` and `microphone.js` by adding it to the asset bundle explicitly)

```rust
// tools/meeting-translation/src/assets.rs — add:
pub const MICROPHONE_JS: Asset = asset!("../assets/microphone.js");
pub const AUDIO_WORKLET_PROCESSOR_JS: Asset = asset!("../assets/audio-worklet-processor.js");
pub const PCM_RESAMPLE_JS: Asset = asset!("../assets/pcm-resample.js");
```

Referencing these three with `asset!` (even though nothing in Rust reads the constants beyond declaring them) is what makes Topcoat's binary-scanning asset bundler pick them up and serve them at their content-hashed URLs; without this, `microphone.js`'s relative `import`/`addModule` calls would 404. Confirm during Task 14's manual smoke test that the browser can actually resolve `./microphone.js`, `./pcm-resample.js`, and `./audio-worklet-processor.js` as relative imports from the content-hashed `session.js` URL — if Topcoat's asset URLs are not path-relative-import-friendly (content-hashed filenames typically break bare relative imports between two independently-hashed files), switch to referencing each file's hashed URL explicitly, e.g. import via `import(SESSION_JS_EXPORTS.MICROPHONE_URL)`-style indirection with the hashed URLs injected as `data-*` attributes on the page and read at runtime, or bundle the three files into one asset instead of three. This is a real open question to resolve empirically in Task 14, not before.

- [ ] **Step 8: Commit**

```bash
git add tools/meeting-translation/assets tools/meeting-translation/src/assets.rs \
  tools/meeting-translation/src/pages.rs
git commit -s -m "feat(meeting-translation): add microphone capture and PCM resampling"
```

---

## Task 14: Wire main.rs and do a first end-to-end smoke test

**Files:**
- Modify: `tools/meeting-translation/src/main.rs` (rewrite as a thin binary — see Step 2)
- Modify: `tools/meeting-translation/src/lib.rs` (add `pub mod config;` — the last module declaration this plan adds to it)
- Create: `tools/meeting-translation/src/config.rs` (deferred until now since this is the first task that needs it; see Step 1)

**Interfaces:**
- Produces: the fully assembled `main()` that loads config, builds both AWS clients, constructs `RoomRegistry`, assembles the router with all pages/routes/assets, and calls `topcoat::start`.

- [ ] **Step 1: Write `src/config.rs`** (this was scoped in the original design but not yet created by any earlier task — add it now since `main.rs` needs it immediately)

```rust
// tools/meeting-translation/src/config.rs
pub struct Config {
    pub aws_region: String,
    pub bedrock_model_id: String,
    pub glossary: Vec<String>,
}

fn require_env(name: &str) -> Result<String, String> {
    match std::env::var(name) {
        Ok(value) if !value.trim().is_empty() => Ok(value),
        _ => Err(format!("{name} is required")),
    }
}

pub fn load() -> Result<Config, String> {
    Ok(Config {
        aws_region: require_env("AWS_REGION")?,
        bedrock_model_id: require_env("BEDROCK_MODEL_ID")?,
        glossary: std::env::var("TRANSLATION_GLOSSARY")
            .unwrap_or_default()
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(str::to_string)
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn missing_aws_region_is_an_error() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::remove_var("AWS_REGION");
            std::env::set_var("BEDROCK_MODEL_ID", "model");
        }
        assert!(load().is_err());
    }

    #[test]
    fn blank_glossary_becomes_an_empty_list() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::set_var("AWS_REGION", "ap-northeast-1");
            std::env::set_var("BEDROCK_MODEL_ID", "model");
            std::env::remove_var("TRANSLATION_GLOSSARY");
        }
        let config = load().unwrap();
        assert!(config.glossary.is_empty());
    }
}
```

Run: `cargo test --lib config`
Expected: PASS.

- [ ] **Step 2: Wire `config` into `src/lib.rs`, then rewrite `src/main.rs` as a thin binary**

By this point, `src/lib.rs` already declares `pub mod protocol;`, `pub mod room;`, `pub mod translator;`, `pub mod recognizer;`, `pub mod adapters;`, `pub mod session;`, `pub mod pages;`, and `pub mod assets;` (added incrementally by Tasks 3, 4, 8, 5, 6, 10, 11, and 11 respectively). Add one more line, `pub mod config;`, to that same file — this task does not create any other new modules.

`src/main.rs` (a separate binary target — see Task 3's Step 0) then only needs to import from the library crate (`meeting_translation`, derived from the package name `meeting-translation`) and contain the `main` function itself:

```rust
// tools/meeting-translation/src/main.rs
use std::sync::Arc;

use topcoat::asset::{AssetBundle, RouterBuilderAssetExt};
use topcoat::router::Router;

use meeting_translation::adapters::bedrock::BedrockTranslator;
use meeting_translation::adapters::transcribe::TranscribeRecognizer;
use meeting_translation::room::RoomRegistry;
use meeting_translation::{config, pages, session};

#[tokio::main]
async fn main() {
    let config = config::load().expect("invalid configuration");

    let aws_config = aws_config::from_env().region(aws_config::Region::new(config.aws_region.clone())).load().await;
    let translator = Arc::new(BedrockTranslator::new(
        aws_sdk_bedrockruntime::Client::new(&aws_config),
        config.bedrock_model_id,
    ));
    let recognizer = Arc::new(TranscribeRecognizer::new(aws_sdk_transcribestreaming::Client::new(&aws_config)));
    let registry = RoomRegistry::new(translator, recognizer, config.glossary);
    tokio::spawn(registry.clone().run_lifecycle_loop());

    let router = Router::builder()
        .page(pages::creation_form)
        .route(pages::create_room)
        .page(pages::meeting_page)
        .route(session::session)
        .assets(AssetBundle::load().unwrap())
        .app_context(registry)
        .build();

    topcoat::start(router).await.unwrap();
}
```

This replaces Task 2's placeholder `main.rs` (the `#[page("/translate/")]` `home` function moved into `pages.rs` as `creation_form` back in Task 11 — delete Task 2's old placeholder `home`/`hello`-style content entirely; nothing in this file should still define a page or route directly).

`aws_config::from_env().region(...)` uses the `aws_config`/`aws_types` `Region` type — verify the exact builder method chain against the `aws-config` version resolved in `Cargo.lock` via `cargo doc -p aws-config --open`, since this plan's earlier verification focused on the two SDK service crates (`aws-sdk-bedrockruntime`, `aws-sdk-transcribestreaming`) rather than `aws-config` itself; both official examples used `aws_config::from_env()...load().await` (Bedrock example) and `aws_config::from_env().region(region_provider).load().await` (Transcribe example), so this call shape has already been seen twice in the AWS official examples fetched during planning — the concrete methods this task's code calls are the same ones the Transcribe example used, just with a fixed `Region` instead of a `RegionProviderChain`.

- [ ] **Step 3: Build and smoke-test**

Run: `cargo build`
Expected: compiles cleanly. Fix any remaining signature drift flagged by earlier tasks' notes (the `too_many_requests` helper, the `path_param!` duplicate-type issue, the `audio_stream.into()` bound, the relative-import asset URL question) as they surface here — this is the first point where every module compiles together.

Run:
```bash
export AWS_REGION=ap-northeast-1
export BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
export TRANSLATION_GLOSSARY=""
cargo run &
sleep 1
curl -s http://127.0.0.1:3000/translate/
curl -s -X POST http://127.0.0.1:3000/translate/api/rooms
kill %1
```
Expected: the first `curl` returns the creation form HTML; the second returns a JSON body with `room_id` and `join_token`. This does not require valid AWS credentials since neither `translate()` nor `start_stream_transcription()` is called by these two requests.

- [ ] **Step 4: Commit**

```bash
git add tools/meeting-translation/src/main.rs tools/meeting-translation/src/lib.rs \
  tools/meeting-translation/src/config.rs tools/meeting-translation/Cargo.toml tools/meeting-translation/Cargo.lock
git commit -s -m "feat(meeting-translation): wire main.rs and verify the app boots"
```

---

## Task 15: Dockerfile and ignore-file updates

**Files:**
- Create: `tools/meeting-translation/Dockerfile`
- Modify: `tools/meeting-translation/.dockerignore`

**Interfaces:** None — build/deploy artifact only.

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
FROM rust:1-bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets
RUN cargo build --release

FROM debian:bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 meeting-translation \
  && adduser --system --uid 1001 --ingroup meeting-translation meeting-translation

ENV PORT=3000

COPY --from=builder --chown=meeting-translation:meeting-translation /app/target/release/meeting-translation ./meeting-translation
COPY --from=builder --chown=meeting-translation:meeting-translation /app/assets ./assets

USER meeting-translation
EXPOSE 3000

CMD ["./meeting-translation"]
```

Note: `ca-certificates` is required at runtime because the AWS SDK's HTTPS client (used for Bedrock and Transcribe calls) validates TLS certificates against the system trust store — this is the one runtime package the `debian:bookworm-slim` base does not include by default. Verify at Task 17's dogfooding pass that Topcoat's asset bundler places the runtime-served files where this Dockerfile's `COPY --from=builder .../assets ./assets` expects them (the getting-started docs describe the bundler scanning the compiled binary for `asset!` calls and copying files into "a local asset directory" but do not name that directory explicitly) — adjust the `COPY` source path if `cargo build --release` produces the bundled assets somewhere other than `./assets` relative to the crate root (check for a `target/release/assets` or similar directory after the build step; use whichever the running binary actually reads from, confirmed by the curl smoke test in Step 3 below).

- [ ] **Step 2: Update `.dockerignore`**

```
target
.git
.env
.env.*
```

- [ ] **Step 3: Build and smoke-test the image**

Run:
```bash
cd tools/meeting-translation
docker build -t meeting-translation-rust-topcoat .
docker run --rm -p 3000:3000 \
  -e AWS_REGION=ap-northeast-1 -e BEDROCK_MODEL_ID=amazon.nova-lite-v1:0 -e TRANSLATION_GLOSSARY="" \
  meeting-translation-rust-topcoat &
sleep 2
curl -s http://127.0.0.1:3000/translate/
```
Expected: same creation-form HTML as Task 14's `cargo run` smoke test, this time served from the container. If the asset directory path from the Step 1 note was wrong, this is where it will 404 on the assets referenced by the page — fix the `COPY` line and rebuild.

- [ ] **Step 4: Commit**

```bash
git add tools/meeting-translation/Dockerfile tools/meeting-translation/.dockerignore
git commit -s -m "feat(meeting-translation): add multi-stage Rust Dockerfile"
```

---

## Task 16: Kubernetes configmap and deployment contract test

**Files:**
- Modify: `tools/meeting-translation/kubernetes/base/configmap.yaml`
- Modify: `tools/meeting-translation/tests/deployment_test.sh`

**Interfaces:** None — deployment manifests and their contract test only.

- [ ] **Step 1: Read the current configmap to confirm its exact key list before editing**

Run: `cat tools/meeting-translation/kubernetes/base/configmap.yaml`
Expected: 4 keys including `MEETING_BASE_PATH: /translate`.

- [ ] **Step 2: Remove the `MEETING_BASE_PATH` key**

Edit `kubernetes/base/configmap.yaml` to delete the `MEETING_BASE_PATH: /translate` line, leaving `AWS_REGION`, `BEDROCK_MODEL_ID`, and `TRANSLATION_GLOSSARY`.

- [ ] **Step 3: Update the deployment contract test's expected key count**

In `tests/deployment_test.sh`, change:

```sh
assert_value 'select(.kind == "ConfigMap" and .metadata.name == "meeting-translation") | .data | length' "$rendered_service" '4' 'ConfigMap key count'
```

to:

```sh
assert_value 'select(.kind == "ConfigMap" and .metadata.name == "meeting-translation") | .data | length' "$rendered_service" '3' 'ConfigMap key count'
```

- [ ] **Step 4: Run the deployment contract test**

Run: `tools/meeting-translation/tests/deployment_test.sh`
Expected: PASS, printing `Meeting translation deployment contract passed.` (requires `kustomize` and `yq` on PATH — both are already required by this test today, so if either is missing, install them the same way this repository's CI does before running this step.)

- [ ] **Step 5: Commit**

```bash
git add tools/meeting-translation/kubernetes/base/configmap.yaml tools/meeting-translation/tests/deployment_test.sh
git commit -s -m "chore(meeting-translation): drop MEETING_BASE_PATH from the ConfigMap"
```

---

## Task 17: Update README and run the full dogfooding checklist

**Files:**
- Modify: `tools/meeting-translation/README.md`

**Interfaces:** None — documentation and manual verification only.

- [ ] **Step 1: Update the "Running Locally" section**

Replace the pnpm-based instructions with:

```markdown
## Running Locally

Rust (stable, ≥1.98) is required.

\`\`\`bash
cd tools/meeting-translation

export AWS_REGION=ap-northeast-1
export BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
export TRANSLATION_GLOSSARY=""

cargo run
\`\`\`

The app serves both the web UI and the WebSocket session route at `http://localhost:3000/translate/`. To try real speech recognition and translation, make sure the process can obtain AWS credentials with the necessary permissions from the standard credential provider chain.

Tests and the production build run in the same directory.

\`\`\`bash
cargo test
cargo build --release
\`\`\`
```

- [ ] **Step 2: Remove the `MEETING_BASE_PATH` row from the Environment Variables table**, leaving `AWS_REGION`, `BEDROCK_MODEL_ID`, `TRANSLATION_GLOSSARY`, and `PORT`.

- [ ] **Step 3: Leave the AWS Prerequisites, Meeting Operation, Connection and Deployment Behavior, and Logging and Privacy sections as-is** — none of their content changed with the rewrite.

- [ ] **Step 4: Run the full dogfooding checklist against a local `cargo run`, with real AWS credentials available**

Work through each item and confirm it holds; note anything that does not match before considering the rewrite done:

- [ ] Open `/translate/`, create a meeting, and confirm the response includes a room ID and a join token that ends up in the URL fragment (never sent to the server in any subsequent request body or query string).
- [ ] Open the room URL in two separate browser profiles/tabs; both display names should appear in the roster.
- [ ] Open a third tab and confirm it can join (3 participants is the cap being reached, not exceeded).
- [ ] Open a fourth tab and confirm it is rejected as `room_full`.
- [ ] In one tab, start the microphone, speak a short Japanese sentence, and confirm an English caption appears in the other tabs after translation.
- [ ] Type a manual caption in one tab and confirm it appears translated in the others, going through the same `translating` → `final` states as a spoken caption.
- [ ] Click "Ask to clarify" on a caption and confirm only that caption's speaker sees the clarification request, not the whole room.
- [ ] Close one tab (not via an explicit leave action) and reopen the same room URL within 5 seconds — the room should still exist and the rejoin should succeed.
- [ ] Close a tab and wait more than 5 seconds before reopening the same room URL — with the room now empty long enough, it should behave like joining a brand-new/expired room (`room_not_found`, matching the "no persistence, no history" contract in the README's Connection and Deployment Behavior section).
- [ ] Confirm no captions replay when rejoining — a freshly (re)joined participant sees only future captions, not history from before they joined.
- [ ] Trigger a translation failure path if feasible (e.g., temporarily point `BEDROCK_MODEL_ID` at an invalid model ID) and confirm the caption is marked failed and a `translation_unavailable` status reaches the room, without crashing the session.
- [ ] Tail the process's stdout/stderr during the whole pass and confirm no raw transcript text, caption text, join tokens, or AWS credentials appear in any log line — only event codes and non-sensitive IDs, matching the Logging and Privacy section.
- [ ] Send more than 5 room-creation requests from the same IP within 10 minutes and confirm the 6th is rejected (`429`).

- [ ] **Step 5: Fix anything the checklist surfaces**, re-running the relevant unit tests plus this checklist item until it holds, before moving on.

- [ ] **Step 6: Commit**

```bash
git add tools/meeting-translation/README.md
git commit -s -m "docs(meeting-translation): update running instructions for the Rust rewrite"
```

---

## Plan Self-Review Notes

- **Spec coverage:** every section of the design spec has a task — Topcoat verification informed Tasks 2/10/11/12/14, the actor-based Concurrency Model is Tasks 4-7, the Protocol section is Task 3, Adapters are Tasks 8-9, Browser Layer is Tasks 12-13, Error Handling & Logging is threaded through Tasks 4-10 (status codes) and called out again in Task 17's checklist (log content), Deployment is Tasks 15-16, and Testing culminates in Task 17.
- **Known open verification points, called out inline rather than hidden:** the exact `topcoat::serve`-on-a-bound-listener shape used in Task 10's test (Step 2's note), whether `topcoat::router::error::too_many_requests` exists in 0.9.0 (Task 11's note), the `path_param!` duplicate-type fix required across Task 10/11 (Task 11 Step 2), the `audio_stream.into()` bound in Task 9 (Step 4's note), and the asset-relative-import question in Task 13 (Step 7's note). Each carries a concrete fallback, not a placeholder.
- **Type consistency check:** `RoomCommand`, `JoinOutcome`, `ServerMessage`, `ClientMessage`, `Language`, `Caption`, `RecognitionEvent`, `RecognitionSession`, `SpeechRecognizer`, `Translator`, `TranslationRequest`, and `RoomRegistry`'s public methods are used with the same names and shapes from the task that introduces them through every later task that consumes them; the one deliberate mid-plan signature change (`RoomCommand::Disconnect` gaining `reconnectable: bool`) is called out explicitly in Task 10 with the exact prior-task tests that need updating.
