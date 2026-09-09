// app/src/auth/token.rs
//
// Local decoding of the Kanidm session token. The token is an ES256 JWS
// in compact serialization; the payload segment (segment 2) is the
// base64url-encoded UserAuthToken. No signature verification is done
// locally: the token was verified by Kanidm at issue time and every
// proxied call re-verifies it server-side — tampering only ever yields
// a 401 downstream.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use kanidm_proto::internal::{PrivilegesActive, UatPurpose, UserAuthToken};
use time::{Duration, OffsetDateTime};

#[derive(Debug)]
pub enum TokenError {
    /// Not a 3-segment compact JWS.
    Malformed,
    Decode(base64::DecodeError),
    Json(serde_json::Error),
}

impl std::fmt::Display for TokenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Malformed => write!(f, "token is not a compact JWS"),
            Self::Decode(err) => write!(f, "payload is not valid base64url: {err}"),
            Self::Json(err) => write!(f, "payload is not a UserAuthToken: {err}"),
        }
    }
}

impl std::error::Error for TokenError {}

/// Decode the JWS payload segment into a `UserAuthToken`.
pub fn decode_user_auth_token(jws: &str) -> Result<UserAuthToken, TokenError> {
    let parts: Vec<&str> = jws.split('.').collect();
    if parts.len() != 3 {
        return Err(TokenError::Malformed);
    }
    let bytes = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(TokenError::Decode)?;
    serde_json::from_slice(&bytes).map_err(TokenError::Json)
}

/// Frontend-facing projection of the token (epoch seconds).
#[derive(Debug, Clone, PartialEq)]
pub struct SessionView {
    pub user_id: String,
    /// Full spn, e.g. "idm_admin@example.com".
    pub username: String,
    pub display_name: String,
    pub email: Option<String>,
    /// Epoch seconds when the session expires; None = no expiry.
    pub session_expires_at: Option<i64>,
    /// Epoch seconds until which writes are allowed; None = no live window.
    pub write_until: Option<i64>,
}

pub fn session_view(uat: &UserAuthToken) -> SessionView {
    fn epoch(dt: OffsetDateTime) -> i64 {
        dt.unix_timestamp()
    }

    SessionView {
        user_id: uat.uuid.to_string(),
        username: uat.spn.clone(),
        display_name: uat.displayname.clone(),
        email: uat.mail_primary.clone(),
        session_expires_at: uat.expiry.map(epoch),
        write_until: match &uat.purpose {
            UatPurpose::ReadWrite { expiry: Some(exp) } => Some(epoch(*exp)),
            _ => None,
        },
    }
}

/// True when the token is still valid at `now` (no expiry = always).
pub fn is_active(uat: &UserAuthToken, now: OffsetDateTime) -> bool {
    uat.expiry.map(|exp| now < exp).unwrap_or(true)
}

/// Remaining session seconds for the cookie Max-Age, clamped at zero.
/// None when the token has no expiry (cookie then gets no Max-Age and
/// lives for the browser session).
pub fn remaining_session_secs(uat: &UserAuthToken, now: OffsetDateTime) -> Option<i64> {
    uat.expiry
        .map(|exp| (exp - now).whole_seconds().max(0))
}

/// Effective write privilege, mirroring the CLI check: the vendored
/// `purpose_privilege_state` with a 20 s grace so an operation started
/// at the edge of the window still completes.
pub fn write_privilege(uat: &UserAuthToken, now: OffsetDateTime) -> PrivilegesActive {
    uat.purpose_privilege_state(now + Duration::seconds(20))
}

/// Test fixtures: build a compact-serialization JWS whose payload
/// decodes to a UserAuthToken with the given expiry and purpose.
/// Shared with the handler tests (5.1).
#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use std::collections::BTreeSet;

    pub(crate) fn fixture_token(
        spn: &str,
        expiry: Option<OffsetDateTime>,
        purpose: UatPurpose,
    ) -> String {
        let uat = UserAuthToken {
            session_id: uuid::Uuid::new_v4(),
            issued_at: OffsetDateTime::UNIX_EPOCH,
            expiry,
            purpose,
            uuid: uuid::Uuid::new_v4(),
            displayname: format!("Display {spn}"),
            spn: spn.to_string(),
            mail_primary: None,
            ui_hints: BTreeSet::new(),
            limit_search_max_results: None,
            limit_search_max_filter_test: None,
        };

        let payload = serde_json::to_vec(&uat).expect("serialize fixture uat");
        let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"ES256"}"#);
        let payload = URL_SAFE_NO_PAD.encode(payload);
        let signature = URL_SAFE_NO_PAD.encode(b"fixture-signature");
        format!("{header}.{payload}.{signature}")
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::fixture_token;
    use super::*;
    use time::Duration;

    #[test]
    fn decode_roundtrips_expiry_and_purpose() {
        // The vendored serde format keeps whole-second precision; truncate
        // the fixture so the round-trip comparison is exact.
        let expiry = (OffsetDateTime::now_utc() + Duration::hours(2))
            .replace_nanosecond(0)
            .unwrap();
        let token = fixture_token("idm_admin@example.com", Some(expiry), UatPurpose::ReadOnly);

        let uat = decode_user_auth_token(&token).expect("decode fixture");
        assert_eq!(uat.spn, "idm_admin@example.com");
        assert_eq!(uat.displayname, "Display idm_admin@example.com");
        assert_eq!(uat.expiry, Some(expiry));
        assert!(matches!(uat.purpose, UatPurpose::ReadOnly));
    }

    #[test]
    fn decode_rejects_two_segments() {
        assert!(matches!(
            decode_user_auth_token("a.b"),
            Err(TokenError::Malformed)
        ));
    }

    #[test]
    fn decode_rejects_four_segments() {
        assert!(matches!(
            decode_user_auth_token("a.b.c.d"),
            Err(TokenError::Malformed)
        ));
    }

    #[test]
    fn decode_rejects_garbage_payload() {
        let garbage = URL_SAFE_NO_PAD.encode(b"not json at all");
        let token = format!("h.{garbage}.s");
        assert!(matches!(
            decode_user_auth_token(&token),
            Err(TokenError::Json(_))
        ));
    }

    #[test]
    fn write_privilege_follows_purpose_state() {
        let now = OffsetDateTime::now_utc();

        let live = fixture_token(
            "a@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadWrite {
                expiry: Some(now + Duration::minutes(5)),
            },
        );
        let uat = decode_user_auth_token(&live).expect("decode");
        assert!(matches!(
            write_privilege(&uat, now),
            PrivilegesActive::True
        ));

        let expired_window = fixture_token(
            "a@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadWrite {
                expiry: Some(now - Duration::minutes(5)),
            },
        );
        let uat = decode_user_auth_token(&expired_window).expect("decode");
        assert!(matches!(
            write_privilege(&uat, now),
            PrivilegesActive::ReauthRequired
        ));

        // ReadWrite with no expiry = window not yet activated (matches the
        // vendored purpose_privilege_state semantics).
        let unactivated = fixture_token(
            "a@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadWrite { expiry: None },
        );
        let uat = decode_user_auth_token(&unactivated).expect("decode");
        assert!(matches!(
            write_privilege(&uat, now),
            PrivilegesActive::ReauthRequired
        ));

        let read_only = fixture_token(
            "a@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadOnly,
        );
        let uat = decode_user_auth_token(&read_only).expect("decode");
        assert!(matches!(
            write_privilege(&uat, now),
            PrivilegesActive::False
        ));
    }

    #[test]
    fn is_active_respects_expiry() {
        let now = OffsetDateTime::now_utc();

        let valid = fixture_token("a@example.com", Some(now + Duration::minutes(1)), UatPurpose::ReadOnly);
        let uat = decode_user_auth_token(&valid).expect("decode");
        assert!(is_active(&uat, now));

        let expired = fixture_token("a@example.com", Some(now - Duration::minutes(1)), UatPurpose::ReadOnly);
        let uat = decode_user_auth_token(&expired).expect("decode");
        assert!(!is_active(&uat, now));

        let eternal = fixture_token("a@example.com", None, UatPurpose::ReadOnly);
        let uat = decode_user_auth_token(&eternal).expect("decode");
        assert!(is_active(&uat, now));
    }

    #[test]
    fn remaining_session_secs_clamps_and_handles_none() {
        let now = OffsetDateTime::now_utc();

        let soon = fixture_token("a@example.com", Some(now + Duration::minutes(10)), UatPurpose::ReadOnly);
        let uat = decode_user_auth_token(&soon).expect("decode");
        let secs = remaining_session_secs(&uat, now).expect("remaining");
        assert!((590..=600).contains(&secs), "remaining secs: {secs}");

        let past = fixture_token("a@example.com", Some(now - Duration::minutes(1)), UatPurpose::ReadOnly);
        let uat = decode_user_auth_token(&past).expect("decode");
        assert_eq!(remaining_session_secs(&uat, now), Some(0));

        let eternal = fixture_token("a@example.com", None, UatPurpose::ReadOnly);
        let uat = decode_user_auth_token(&eternal).expect("decode");
        assert_eq!(remaining_session_secs(&uat, now), None);
    }

    #[test]
    fn session_view_maps_fields() {
        let now = OffsetDateTime::now_utc();
        let write_until = now + Duration::minutes(10);
        let token = fixture_token(
            "idm_admin@example.com",
            Some(now + Duration::hours(1)),
            UatPurpose::ReadWrite {
                expiry: Some(write_until),
            },
        );
        let uat = decode_user_auth_token(&token).expect("decode");

        let view = session_view(&uat);
        assert_eq!(view.username, "idm_admin@example.com");
        assert_eq!(view.display_name, "Display idm_admin@example.com");
        assert_eq!(view.session_expires_at, Some((now + Duration::hours(1)).unix_timestamp()));
        assert_eq!(view.write_until, Some(write_until.unix_timestamp()));
        assert!(view.user_id.len() == 36, "uuid string: {}", view.user_id);
    }
}
