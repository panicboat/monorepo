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
