use std::sync::LazyLock;

use regex::Regex;
use sqlx::PgPool;
use tonic::metadata::{MetadataMap, MetadataValue};
use tonic::{Code, Status};
use uuid::Uuid;

const REQUEST_ID_HEADER: &str = "x-request-id";
const USER_ID_HEADER: &str = "x-user-id";
const PROFILE_ID_HEADER: &str = "x-profile-id";
const ERROR_REASON_KEY: &str = "error-reason";
const PROFILE_REQUIRED_REASON: &str = "profile_required";
const PROFILE_NOT_PERMITTED_REASON: &str = "profile_not_permitted";

// Uuid::parse_str also accepts the simple, braced and urn forms, which Ruby's UUID_FORMAT rejects.
static UUID_FORMAT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\A[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\z")
        .expect("valid regex")
});

// Both lookups share one visibility rule, and sqlx 0.9 accepts only 'static SQL, so it is spliced with concat!.
macro_rules! visible_profiles {
    () => {
        "FROM profile.profiles WHERE disabled_at IS NULL \
         AND account_id IN (SELECT id FROM identity.accounts WHERE deactivated_at IS NULL)"
    };
}

const VISIBLE_IDS_BY_ACCOUNT: &str = concat!(
    "SELECT id ",
    visible_profiles!(),
    " AND account_id = $1 LIMIT 2"
);

const VISIBLE_ACCOUNT_BY_ID: &str =
    concat!("SELECT account_id ", visible_profiles!(), " AND id = $1");

#[derive(Debug, Clone, PartialEq)]
pub struct Caller {
    pub request_id: String,
    pub account_id: Option<String>,
    pub profile_id: Option<Uuid>,
    pub profile_denied: bool,
}

pub async fn resolve_caller(pool: &PgPool, metadata: &MetadataMap) -> sqlx::Result<Caller> {
    let request_id =
        header(metadata, REQUEST_ID_HEADER).unwrap_or_else(|| Uuid::new_v4().to_string());
    let Some(account_id) = header(metadata, USER_ID_HEADER) else {
        return Ok(Caller {
            request_id,
            account_id: None,
            profile_id: None,
            profile_denied: false,
        });
    };
    let requested = header(metadata, PROFILE_ID_HEADER).filter(|value| !value.is_empty());
    let (profile_id, profile_denied) = match requested {
        None => (only_visible_profile(pool, &account_id).await?, false),
        Some(requested) => {
            let profile_id = requested_profile(pool, &requested, &account_id).await?;
            (profile_id, profile_id.is_none())
        }
    };
    Ok(Caller {
        request_id,
        account_id: Some(account_id),
        profile_id,
        profile_denied,
    })
}

impl Caller {
    pub fn require_profile(&self) -> Result<Uuid, Status> {
        if self.account_id.is_none() {
            return Err(Status::unauthenticated("Authentication required"));
        }
        if let Some(profile_id) = self.profile_id {
            return Ok(profile_id);
        }
        if self.profile_denied {
            return Err(status_with_reason(
                Code::PermissionDenied,
                "Profile is not available",
                PROFILE_NOT_PERMITTED_REASON,
            ));
        }
        Err(status_with_reason(
            Code::FailedPrecondition,
            "Active profile required",
            PROFILE_REQUIRED_REASON,
        ))
    }
}

fn status_with_reason(code: Code, message: &str, reason: &'static str) -> Status {
    let mut metadata = MetadataMap::new();
    metadata.insert(ERROR_REASON_KEY, MetadataValue::from_static(reason));
    Status::with_metadata(code, message, metadata)
}

// Lossy so an unreadable value still counts as present and cannot fall back to the account's only profile.
fn header(metadata: &MetadataMap, name: &str) -> Option<String> {
    metadata
        .get(name)
        .map(|value| String::from_utf8_lossy(value.as_bytes()).into_owned())
}

fn parse_uuid(value: &str) -> Option<Uuid> {
    if UUID_FORMAT.is_match(value) {
        Uuid::parse_str(value).ok()
    } else {
        None
    }
}

// An account with several profiles gets none, so a missing header never acts as an unintended profile.
async fn only_visible_profile(pool: &PgPool, account_id: &str) -> sqlx::Result<Option<Uuid>> {
    let Some(account_id) = parse_uuid(account_id) else {
        return Ok(None);
    };
    let rows: Vec<(Uuid,)> = sqlx::query_as(VISIBLE_IDS_BY_ACCOUNT)
        .bind(account_id)
        .fetch_all(pool)
        .await?;
    Ok(match rows.as_slice() {
        [(profile_id,)] => Some(*profile_id),
        _ => None,
    })
}

async fn requested_profile(
    pool: &PgPool,
    requested: &str,
    account_id: &str,
) -> sqlx::Result<Option<Uuid>> {
    let Some(profile_id) = parse_uuid(requested) else {
        return Ok(None);
    };
    let owner: Option<(Uuid,)> = sqlx::query_as(VISIBLE_ACCOUNT_BY_ID)
        .bind(profile_id)
        .fetch_optional(pool)
        .await?;
    // Compared as text: Ruby compares the header string as is, so an uppercase x-user-id never owns a profile.
    Ok(owner
        .filter(|(owner_id,)| owner_id.to_string() == account_id)
        .map(|_| profile_id))
}
