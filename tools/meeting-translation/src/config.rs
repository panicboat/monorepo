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
