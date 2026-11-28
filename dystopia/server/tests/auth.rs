mod support;

use dystopia_server::auth::{Caller, resolve_caller};
use sqlx::PgPool;
use support::{Cleanup, deactivate_account, disable_profile, pool};
use tonic::metadata::MetadataMap;
use tonic::{Code, Status};
use uuid::Uuid;

fn metadata(entries: &[(&'static str, &str)]) -> MetadataMap {
    let mut map = MetadataMap::new();
    for (name, value) in entries {
        map.insert(*name, value.parse().unwrap());
    }
    map
}

async fn resolve(pool: &PgPool, entries: &[(&'static str, &str)]) -> Caller {
    resolve_caller(pool, &metadata(entries))
        .await
        .expect("the caller is resolved")
}

fn reason(status: &Status) -> &str {
    status
        .metadata()
        .get("error-reason")
        .expect("error-reason is set")
        .to_str()
        .unwrap()
}

#[tokio::test]
async fn uses_the_only_visible_profile_without_a_header() {
    let pool = pool().await;
    let cleanup = Cleanup::new();
    let (account_id, profile_id) = cleanup.create_profile(&pool).await;
    let account = account_id.to_string();

    let caller = resolve(&pool, &[("x-user-id", &account)]).await;
    assert_eq!(caller.account_id.as_deref(), Some(account.as_str()));
    assert_eq!(caller.profile_id, Some(profile_id));
    assert!(!caller.profile_denied);
    assert_eq!(caller.require_profile().unwrap(), profile_id);

    let caller = resolve(&pool, &[("x-user-id", &account), ("x-profile-id", "")]).await;
    assert_eq!(caller.profile_id, Some(profile_id));
    assert!(!caller.profile_denied);
}

#[tokio::test]
async fn requires_a_choice_when_the_account_has_two_profiles() {
    let pool = pool().await;
    let cleanup = Cleanup::new();
    let (account_id, _) = cleanup.create_profile(&pool).await;
    cleanup.add_profile(&pool, account_id).await;
    let account = account_id.to_string();

    let caller = resolve(&pool, &[("x-user-id", &account)]).await;
    assert_eq!(caller.profile_id, None);
    assert!(!caller.profile_denied);
    let status = caller.require_profile().unwrap_err();
    assert_eq!(status.code(), Code::FailedPrecondition);
    assert_eq!(status.message(), "Active profile required");
    assert_eq!(reason(&status), "profile_required");
}

#[tokio::test]
async fn uses_the_requested_profile_of_the_account() {
    let pool = pool().await;
    let cleanup = Cleanup::new();
    let (account_id, first_id) = cleanup.create_profile(&pool).await;
    let second_id = cleanup.add_profile(&pool, account_id).await;
    let account = account_id.to_string();

    let first = first_id.to_string();
    let caller = resolve(&pool, &[("x-user-id", &account), ("x-profile-id", &first)]).await;
    assert_eq!(caller.require_profile().unwrap(), first_id);

    let second = second_id.to_string().to_uppercase();
    let caller = resolve(&pool, &[("x-user-id", &account), ("x-profile-id", &second)]).await;
    assert_eq!(caller.profile_id, Some(second_id));
    assert!(!caller.profile_denied);
}

#[tokio::test]
async fn denies_another_accounts_profile() {
    let pool = pool().await;
    let cleanup = Cleanup::new();
    let (account_id, own_id) = cleanup.create_profile(&pool).await;
    let (_, other_id) = cleanup.create_profile(&pool).await;
    let account = account_id.to_string();
    let other = other_id.to_string();

    let caller = resolve(&pool, &[("x-user-id", &account), ("x-profile-id", &other)]).await;
    assert_eq!(caller.profile_id, None);
    assert!(caller.profile_denied);
    let status = caller.require_profile().unwrap_err();
    assert_eq!(status.code(), Code::PermissionDenied);
    assert_eq!(status.message(), "Profile is not available");
    assert_eq!(reason(&status), "profile_not_permitted");

    let own = own_id.to_string();
    let uppercase_account = account.to_uppercase();
    let caller = resolve(
        &pool,
        &[("x-user-id", &uppercase_account), ("x-profile-id", &own)],
    )
    .await;
    assert!(caller.profile_denied);
}

#[tokio::test]
async fn denies_a_disabled_profile_or_a_deactivated_account() {
    let pool = pool().await;
    let cleanup = Cleanup::new();
    let (account_id, kept_id) = cleanup.create_profile(&pool).await;
    let disabled_id = cleanup.add_profile(&pool, account_id).await;
    disable_profile(&pool, disabled_id).await;
    let account = account_id.to_string();

    let disabled = disabled_id.to_string();
    let caller = resolve(
        &pool,
        &[("x-user-id", &account), ("x-profile-id", &disabled)],
    )
    .await;
    assert_eq!(caller.profile_id, None);
    assert!(caller.profile_denied);
    assert_eq!(
        caller.require_profile().unwrap_err().code(),
        Code::PermissionDenied
    );

    let caller = resolve(&pool, &[("x-user-id", &account)]).await;
    assert_eq!(caller.profile_id, Some(kept_id));

    deactivate_account(&pool, account_id).await;
    let kept = kept_id.to_string();
    let caller = resolve(&pool, &[("x-user-id", &account), ("x-profile-id", &kept)]).await;
    assert_eq!(caller.profile_id, None);
    assert!(caller.profile_denied);

    let caller = resolve(&pool, &[("x-user-id", &account)]).await;
    assert_eq!(caller.profile_id, None);
    assert!(!caller.profile_denied);
    let status = caller.require_profile().unwrap_err();
    assert_eq!(status.code(), Code::FailedPrecondition);
    assert_eq!(reason(&status), "profile_required");
}

#[tokio::test]
async fn denies_a_profile_id_that_is_not_a_uuid() {
    let pool = pool().await;
    let cleanup = Cleanup::new();
    let (account_id, profile_id) = cleanup.create_profile(&pool).await;
    let account = account_id.to_string();

    let forms = [
        "not-a-uuid".to_string(),
        profile_id.simple().to_string(),
        profile_id.braced().to_string(),
        profile_id.urn().to_string(),
        format!("{profile_id} "),
    ];
    for form in &forms {
        let caller = resolve(&pool, &[("x-user-id", &account), ("x-profile-id", form)]).await;
        assert_eq!(caller.profile_id, None, "{form}");
        assert!(caller.profile_denied, "{form}");
        assert_eq!(
            caller.require_profile().unwrap_err().code(),
            Code::PermissionDenied,
            "{form}"
        );
    }
}

#[tokio::test]
async fn keeps_an_account_id_that_is_not_a_uuid_without_a_profile() {
    let pool = pool().await;

    for account in ["not-a-uuid", ""] {
        let caller = resolve(&pool, &[("x-user-id", account)]).await;
        assert_eq!(caller.account_id.as_deref(), Some(account));
        assert_eq!(caller.profile_id, None);
        assert!(!caller.profile_denied);
        assert_eq!(
            caller.require_profile().unwrap_err().code(),
            Code::FailedPrecondition
        );
    }

    let profile = Uuid::now_v7().to_string();
    let caller = resolve(
        &pool,
        &[("x-user-id", "not-a-uuid"), ("x-profile-id", &profile)],
    )
    .await;
    assert!(caller.profile_denied);
}

#[tokio::test]
async fn refuses_a_request_without_an_account() {
    let pool = pool().await;

    let caller = resolve(&pool, &[("x-profile-id", &Uuid::now_v7().to_string())]).await;
    assert_eq!(caller.account_id, None);
    assert_eq!(caller.profile_id, None);
    assert!(!caller.profile_denied);
    let status = caller.require_profile().unwrap_err();
    assert_eq!(status.code(), Code::Unauthenticated);
    assert_eq!(status.message(), "Authentication required");
}

#[tokio::test]
async fn keeps_the_request_id_from_the_header() {
    let pool = pool().await;

    let caller = resolve(&pool, &[("x-request-id", "request-1")]).await;
    assert_eq!(caller.request_id, "request-1");

    let first = resolve(&pool, &[]).await;
    let second = resolve(&pool, &[]).await;
    assert!(Uuid::parse_str(&first.request_id).is_ok());
    assert_ne!(first.request_id, second.request_id);
}
