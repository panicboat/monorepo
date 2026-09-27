use topcoat::Result;
use topcoat::context::{Cx, app_context};
use topcoat::router::content::websocket::{Message, WebSocketUpgrade};
use topcoat::router::response::Response;
use topcoat::router::{path_param, route};

use crate::protocol::{ClientMessage, ServerMessage, StatusCode, parse_client_message};
use crate::room::{JoinOutcome, RoomCommand, RoomRegistry};

topcoat::router::path_param!(room_id: String, error = bad_request);

#[route(GET "/translate/rooms/{room_id}/session")]
pub async fn session(cx: &Cx, upgrade: WebSocketUpgrade) -> Result<Response> {
    let room_id = path_param::<RoomId>(cx)?.clone();
    let registry = app_context::<std::sync::Arc<RoomRegistry>>(cx).clone();

    upgrade.on_upgrade(move |socket| async move {
        run_session(socket, room_id, registry).await;
    })
}

async fn run_session(
    socket: topcoat::router::content::websocket::WebSocket,
    room_id: String,
    registry: std::sync::Arc<RoomRegistry>,
) {
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
                        if matches!(&message, ClientMessage::Leave) {
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
        let _ = room
            .send(RoomCommand::Disconnect {
                participant_id: id,
                reconnectable: !explicit_leave,
            })
            .await;
    }
}

fn status_frame(code: StatusCode) -> Message {
    let body = serde_json::to_string(&ServerMessage::Status { code }).unwrap();
    Message::Text(body.into())
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_trait::async_trait;
    use futures_util::{SinkExt, StreamExt};
    use tokio::sync::mpsc;
    use topcoat::router::Router;

    use crate::protocol::Language;
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
        async fn start(
            &self,
            _language: Language,
            _events: mpsc::UnboundedSender<RecognitionEvent>,
        ) -> Result<Box<dyn RecognitionSession>, ()> {
            Err(())
        }
    }

    async fn spawn_test_server() -> (std::net::SocketAddr, Arc<RoomRegistry>) {
        let registry =
            RoomRegistry::new(Arc::new(NoopTranslator), Arc::new(NoopRecognizer), vec![]);
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
        socket
            .send(tokio_tungstenite::tungstenite::Message::Text(
                join.to_string().into(),
            ))
            .await
            .unwrap();

        let reply = socket.next().await.unwrap().unwrap();
        let text = reply.into_text().unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(parsed["type"], "room_joined");
    }
}
