use std::sync::LazyLock;

use regex::Regex;

static EXTENSION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\A\.[a-z0-9]{1,10}\z").expect("valid regex"));
static CONTENT_TYPE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\A(image|video)/[A-Za-z0-9_.+-]+\z").expect("valid regex"));
static OWNED_TAIL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\A[0-9a-f-]{36}(\.[a-z0-9]{1,10})?\z").expect("valid regex"));
static OPTIONAL_EXTENSION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\A(\.[a-z0-9]{1,10})?\z").expect("valid regex"));

pub fn key_for(profile_id: &str, media_id: &str, extension: &str) -> String {
    format!("media/{profile_id}/{media_id}{extension}")
}

pub fn extension_of(filename: &str) -> String {
    let trimmed = filename.trim_end_matches('/');
    let basename = trimmed.rsplit_once('/').map_or(trimmed, |(_, name)| name);
    let name = basename.trim_start_matches('.');
    // Not Path::extension: it reads "..foo" as extension "foo", File.extname reads none.
    let Some(dot) = name.rfind('.') else {
        return String::new();
    };
    let extension = name[dot..].to_lowercase();
    if EXTENSION.is_match(&extension) {
        extension
    } else {
        String::new()
    }
}

pub fn upload_content_type_allowed(content_type: &str) -> bool {
    CONTENT_TYPE.is_match(content_type)
}

pub fn owned_by(key: &str, profile_id: &str) -> bool {
    !profile_id.is_empty() && tail_matches(key, &format!("media/{profile_id}/"), &OWNED_TAIL)
}

pub fn issued_to(key: &str, profile_id: &str, media_id: &str) -> bool {
    !profile_id.is_empty()
        && !media_id.is_empty()
        && tail_matches(key, &key_for(profile_id, media_id, ""), &OPTIONAL_EXTENSION)
}

// Not a regex with the ids embedded: a literal prefix needs no escaping and cannot exceed the regex size limit.
fn tail_matches(key: &str, prefix: &str, tail: &Regex) -> bool {
    key.strip_prefix(prefix)
        .is_some_and(|rest| tail.is_match(rest))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROFILE: &str = "0190a000-0000-7000-8000-000000000001";
    const OTHER_PROFILE: &str = "0190a000-0000-7000-8000-000000000002";
    const MEDIA: &str = "0190a000-0000-7000-8000-0000000000a1";
    const OTHER_MEDIA: &str = "0190a000-0000-7000-8000-0000000000a2";

    #[test]
    fn builds_the_key_from_profile_media_and_extension() {
        assert_eq!(
            key_for(PROFILE, MEDIA, ""),
            format!("media/{PROFILE}/{MEDIA}")
        );
        assert_eq!(
            key_for(PROFILE, MEDIA, ".png"),
            format!("media/{PROFILE}/{MEDIA}.png")
        );
    }

    #[test]
    fn lowercases_a_plain_extension() {
        assert_eq!(extension_of("Photo.JPEG"), ".jpeg");
        assert_eq!(extension_of("dir/a.tar.gz"), ".gz");
        assert_eq!(extension_of("photo.0123456789"), ".0123456789");
    }

    #[test]
    fn drops_an_extension_that_is_not_plain() {
        for filename in [
            "photo.p ng",
            "photo.xxxxxxxxxxx",
            "photo.p%2Fg",
            ".bashrc",
            "a.",
            "photo",
            "",
            "photo.png\n",
            "photo.pngé",
        ] {
            assert_eq!(extension_of(filename), "", "{filename:?}");
        }
    }

    #[test]
    fn reads_the_extension_of_the_last_path_segment_like_ruby_file_extname() {
        assert_eq!(extension_of("a.png/"), ".png");
        assert_eq!(extension_of("a.b/c"), "");
        assert_eq!(extension_of("dir/.png"), "");
        assert_eq!(extension_of("..foo"), "");
        assert_eq!(extension_of("...foo.png"), ".png");
        assert_eq!(extension_of("a..png"), ".png");
    }

    #[test]
    fn allows_only_image_and_video_types() {
        for content_type in [
            "image/png",
            "video/mp4",
            "image/svg+xml",
            "video/x-matroska",
            "image/vnd.a_b-c",
        ] {
            assert!(
                upload_content_type_allowed(content_type),
                "{content_type:?}"
            );
        }
        for content_type in [
            "text/plain",
            "image/",
            "image",
            "",
            "image/png ",
            "image/png\n",
            "image/pngé",
            "image/png٣",
            "audio/mp3",
            "ximage/png",
            "image/png/x",
        ] {
            assert!(
                !upload_content_type_allowed(content_type),
                "{content_type:?}"
            );
        }
    }

    #[test]
    fn issues_keys_only_for_the_profile_and_media() {
        let refused = [
            key_for(OTHER_PROFILE, MEDIA, ".png"),
            key_for(PROFILE, OTHER_MEDIA, ".png"),
            format!("media/image/{MEDIA}.png"),
            format!("media/{PROFILE}/../{OTHER_PROFILE}/{MEDIA}.png"),
            format!("{}/extra", key_for(PROFILE, MEDIA, ".png")),
            key_for(PROFILE, MEDIA, ".p ng"),
        ];
        for key in &refused {
            assert!(!issued_to(key, PROFILE, MEDIA), "{key:?}");
        }
        assert!(issued_to(&key_for(PROFILE, MEDIA, ""), PROFILE, MEDIA));
        assert!(issued_to(&key_for(PROFILE, MEDIA, ".png"), PROFILE, MEDIA));
        assert!(!issued_to(&key_for(PROFILE, MEDIA, ".png"), "", MEDIA));
        assert!(!issued_to(&key_for(PROFILE, MEDIA, ".png"), PROFILE, ""));
        assert!(!issued_to(
            &format!("{}\n", key_for(PROFILE, MEDIA, ".png")),
            PROFILE,
            MEDIA
        ));
    }

    #[test]
    fn matches_the_ids_literally_in_the_issued_key() {
        assert!(!issued_to(&key_for("a.c", MEDIA, ".png"), "abc", MEDIA));
        assert!(issued_to(&key_for("a.c", MEDIA, ".png"), "a.c", MEDIA));
        assert!(!issued_to(&key_for(PROFILE, "m.d", ".png"), PROFILE, "mxd"));
    }

    #[test]
    fn owns_only_keys_under_the_profile() {
        let refused = [
            key_for(OTHER_PROFILE, OTHER_MEDIA, ".png"),
            format!("media/image/{OTHER_MEDIA}.png"),
            format!("media/{PROFILE}/../{OTHER_PROFILE}/{OTHER_MEDIA}.png"),
            "anything".to_string(),
            String::new(),
            format!("media/{PROFILE}/{OTHER_MEDIA}.png/extra"),
            format!("media/{PROFILE}/{OTHER_MEDIA}.p ng"),
            format!("media/{PROFILE}/{OTHER_MEDIA}\n"),
            format!("media/{PROFILE}/not-a-uuid.png"),
            format!("media/{PROFILE}/{}", OTHER_MEDIA.to_uppercase()),
        ];
        for key in &refused {
            assert!(!owned_by(key, PROFILE), "{key:?}");
        }
        assert!(owned_by(&key_for(PROFILE, OTHER_MEDIA, ".jpg"), PROFILE));
        assert!(owned_by(&key_for(PROFILE, OTHER_MEDIA, ""), PROFILE));
        assert!(!owned_by(&key_for("", OTHER_MEDIA, ".jpg"), ""));
        assert!(!owned_by(
            "media//0190a000-0000-7000-8000-0000000000a2.jpg",
            ""
        ));
    }
}
