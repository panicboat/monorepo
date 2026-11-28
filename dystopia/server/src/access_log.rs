use std::io::Write;

use chrono::{DateTime, SecondsFormat, Utc};
use serde::Serialize;

use crate::media::presenter::format_created_at;

pub struct AccessLogEntry {
    pub time: DateTime<Utc>,
    pub request_id: String,
    pub method: &'static str,
    pub service: &'static str,
    pub account_id: Option<String>,
    pub profile_id: Option<String>,
    pub duration_ms: f64,
    pub error: Option<(String, String)>,
}

// Structs, not a serde_json map: the map sorts keys, Ruby writes them in insertion order.
#[derive(Serialize)]
struct Envelope<'a> {
    progname: &'a str,
    severity: &'a str,
    time: String,
    message: &'a str,
}

#[derive(Serialize)]
struct Line<'a> {
    time: String,
    request_id: &'a str,
    method: &'a str,
    service: &'a str,
    account_id: Option<&'a str>,
    profile_id: Option<&'a str>,
    duration_ms: f64,
    status: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_class: Option<&'a str>,
}

impl AccessLogEntry {
    // Not a bare JSON line: the CloudWatch query shared with the monolith reads the logger envelope.
    pub fn to_json_line(&self, logged_at: DateTime<Utc>) -> String {
        let message = self.message_json();
        let envelope = Envelope {
            progname: "dystopia-server",
            severity: if self.error.is_some() {
                "ERROR"
            } else {
                "INFO"
            },
            time: logged_at.to_rfc3339_opts(SecondsFormat::Secs, true),
            message: &message,
        };
        serde_json::to_string(&envelope).expect("an access log envelope serializes")
    }

    fn message_json(&self) -> String {
        let line = Line {
            time: format_created_at(self.time),
            request_id: &self.request_id,
            method: self.method,
            service: self.service,
            account_id: self.account_id.as_deref(),
            profile_id: self.profile_id.as_deref(),
            duration_ms: (self.duration_ms * 100.0).round() / 100.0,
            status: if self.error.is_some() { "ERROR" } else { "OK" },
            error: self.error.as_ref().map(|(message, _)| message.as_str()),
            error_class: self.error.as_ref().map(|(_, class)| class.as_str()),
        };
        serde_json::to_string(&line).expect("an access log line serializes")
    }

    pub fn emit(&self) {
        let line = self.to_json_line(Utc::now());
        // SILENT: a closed stdout must not fail the request being logged.
        let _ = writeln!(std::io::stdout().lock(), "{line}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    fn entry(error: Option<(&str, &str)>) -> AccessLogEntry {
        AccessLogEntry {
            time: DateTime::parse_from_rfc3339("2026-11-28T01:02:03.456Z")
                .unwrap()
                .with_timezone(&Utc),
            request_id: "req-1".to_string(),
            method: "register_media",
            service: "media.v1.media_service",
            account_id: Some("0190a000-0000-7000-8000-000000000001".to_string()),
            profile_id: Some("0190a000-0000-7000-8000-000000000002".to_string()),
            duration_ms: 12.3456,
            error: error.map(|(message, class)| (message.to_string(), class.to_string())),
        }
    }

    fn logged_at() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-28T01:02:04.789Z")
            .unwrap()
            .with_timezone(&Utc)
    }

    fn envelope_of(entry: &AccessLogEntry) -> Value {
        serde_json::from_str(&entry.to_json_line(logged_at())).unwrap()
    }

    fn message_of(entry: &AccessLogEntry) -> String {
        envelope_of(entry)["message"].as_str().unwrap().to_string()
    }

    #[test]
    fn wraps_the_line_in_the_envelope_the_ruby_logger_writes() {
        let line = entry(None).to_json_line(logged_at());

        assert!(
            line.starts_with(concat!(
                r#"{"progname":"dystopia-server","severity":"INFO","#,
                r#""time":"2026-11-28T01:02:04Z","message":"{\"time\":"#
            )),
            "{line}"
        );
        let envelope = envelope_of(&entry(None));
        assert_eq!(envelope.as_object().unwrap().len(), 4);
        assert!(envelope["message"].is_string());
    }

    #[test]
    fn logs_an_error_with_the_error_severity() {
        let envelope = envelope_of(&entry(Some(("Invalid input", "InvalidArgument"))));

        assert_eq!(envelope["severity"], json!("ERROR"));
        assert_eq!(envelope["progname"], json!("dystopia-server"));
    }

    #[test]
    fn writes_the_access_log_fields_ruby_writes() {
        assert_eq!(
            message_of(&entry(None)),
            concat!(
                r#"{"time":"2026-11-28T01:02:03+00:00","request_id":"req-1","method":"register_media","#,
                r#""service":"media.v1.media_service","account_id":"0190a000-0000-7000-8000-000000000001","#,
                r#""profile_id":"0190a000-0000-7000-8000-000000000002","duration_ms":12.35,"status":"OK"}"#
            )
        );

        let failed: Value = serde_json::from_str(&message_of(&entry(Some((
            "Invalid input",
            "InvalidArgument",
        )))))
        .unwrap();
        assert_eq!(failed["status"], json!("ERROR"));
        assert_eq!(failed["error"], json!("Invalid input"));
        assert_eq!(failed["error_class"], json!("InvalidArgument"));
        assert_eq!(failed["method"], json!("register_media"));
        assert_eq!(failed["duration_ms"], json!(12.35));

        let anonymous = AccessLogEntry {
            account_id: None,
            profile_id: None,
            duration_ms: 3.0,
            ..entry(None)
        };
        let message = message_of(&anonymous);
        assert!(message.contains(r#""account_id":null,"profile_id":null,"duration_ms":3.0,"#));
        let anonymous: Value = serde_json::from_str(&message).unwrap();
        assert!(anonymous.get("error").is_none());
        assert!(anonymous.get("error_class").is_none());
    }
}
