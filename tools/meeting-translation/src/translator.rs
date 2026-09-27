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
