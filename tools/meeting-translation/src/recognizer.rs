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
