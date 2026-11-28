use std::time::SystemTime;

use chrono::{DateTime, SecondsFormat, Utc};

use crate::media::repository::MediaRow;
use crate::media::storage::{Storage, StorageError};
use crate::stub::media::v1 as pb;

pub fn media_type_name(value: i32) -> &'static str {
    match pb::MediaType::try_from(value) {
        Ok(pb::MediaType::Image) => "image",
        Ok(pb::MediaType::Video) => "video",
        // FALLBACK: Map unspecified and out-of-range values to "unknown".
        _ => "unknown",
    }
}

pub fn media_type_enum(name: &str) -> pb::MediaType {
    match name.to_lowercase().as_str() {
        "image" => pb::MediaType::Image,
        "video" => pb::MediaType::Video,
        // FALLBACK: Map unknown media types to UNSPECIFIED.
        _ => pb::MediaType::Unspecified,
    }
}

pub fn format_created_at(at: DateTime<Utc>) -> String {
    at.to_rfc3339_opts(SecondsFormat::Secs, false)
}

pub async fn to_proto(
    row: &MediaRow,
    storage: &dyn Storage,
    now: SystemTime,
) -> Result<pb::Media, StorageError> {
    Ok(pb::Media {
        id: row.id.to_string(),
        media_type: media_type_enum(&row.media_type) as i32,
        url: storage
            .download_url(row.media_key.as_deref().unwrap_or(""), now)
            .await?,
        thumbnail_url: storage
            .download_url(row.thumbnail_key.as_deref().unwrap_or(""), now)
            .await?,
        // FALLBACK: Use empty values for optional columns that are NULL in the database.
        filename: row.filename.clone().unwrap_or_default(),
        content_type: row.content_type.clone().unwrap_or_default(),
        size_bytes: row.size_bytes.unwrap_or_default(),
        created_at: format_created_at(row.created_at),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_created_at_like_ruby() {
        let at = DateTime::parse_from_rfc3339("2026-11-28T01:02:03.456Z")
            .unwrap()
            .with_timezone(&Utc);

        assert_eq!(format_created_at(at), "2026-11-28T01:02:03+00:00");
    }

    #[test]
    fn maps_media_types_both_ways() {
        assert_eq!(media_type_name(1), "image");
        assert_eq!(media_type_name(2), "video");
        assert_eq!(media_type_name(0), "unknown");
        assert_eq!(media_type_name(99), "unknown");
        assert_eq!(media_type_enum("image"), pb::MediaType::Image);
        assert_eq!(media_type_enum("IMAGE"), pb::MediaType::Image);
        assert_eq!(media_type_enum("video"), pb::MediaType::Video);
        assert_eq!(media_type_enum("unknown"), pb::MediaType::Unspecified);
    }
}
