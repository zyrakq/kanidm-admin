// app/src/auth/known_groups.rs
//
// Constant table of Kanidm's builtin well-known groups: UUID -> name.
// The UUIDs are stable across installs (defined in the vendored server
// migration data), which lets /api/auth/profile translate the `memberof`
// UUIDs returned by whoami into group names without a second roundtrip.

use serde::Serialize;

/// A builtin group: well-known UUID string + its name.
pub struct KnownGroup {
    pub uuid: &'static str,
    pub name: &'static str,
}

/// All builtin groups: the dl15 migration set plus the core idm_admins /
/// system_admins groups (defined directly in constants/uuids.rs).
pub const KNOWN_GROUPS: &[KnownGroup] = &[
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000001", name: "idm_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000007", name: "idm_radius_servers" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000002", name: "idm_people_pii_read" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000010", name: "idm_schema_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000011", name: "idm_access_control_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000013", name: "idm_people_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000015", name: "idm_group_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000019", name: "system_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000020", name: "domain_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000027", name: "idm_oauth2_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000033", name: "idm_people_self_mail_write" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000035", name: "idm_all_persons" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000036", name: "idm_all_accounts" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000038", name: "idm_ui_enable_experimental_features" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000039", name: "idm_account_mail_read" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000041", name: "idm_service_desk" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000042", name: "idm_recycle_bin_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000043", name: "idm_radius_service_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000044", name: "idm_unix_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000045", name: "idm_people_on_boarding" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000046", name: "idm_service_account_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000047", name: "idm_account_policy_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000048", name: "idm_people_self_name_write" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000049", name: "idm_client_certificate_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000050", name: "idm_application_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000051", name: "idm_mail_service_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000052", name: "idm_mail_servers" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000053", name: "idm_unix_authentication_read" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000054", name: "idm_message_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000055", name: "idm_message_senders" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000056", name: "idm_oauth2_client_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000000057", name: "idm_oauth2_account_admins" },
    KnownGroup { uuid: "00000000-0000-0000-0000-000000001000", name: "idm_high_privilege" },
];

/// One resolved group in the profile response.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileGroup {
    pub uuid: String,
    /// Resolved builtin name; None when the UUID is not in the table.
    pub name: Option<String>,
}

/// Look up a builtin group name by its UUID string.
pub fn name_for_uuid(uuid: &str) -> Option<&'static str> {
    KNOWN_GROUPS.iter().find(|g| g.uuid == uuid).map(|g| g.name)
}

/// True when the value has the 8-4-4-4-12 hyphenated UUID shape.
fn looks_like_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && bytes[8] == b'-'
        && bytes[13] == b'-'
        && bytes[18] == b'-'
        && bytes[23] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, b)| i == 8 || i == 13 || i == 18 || i == 23 || b.is_ascii_hexdigit())
}

/// Resolve the raw `memberof` values of a whoami entry into profile
/// groups. Kanidm normally returns UUIDs (resolved through the table);
/// defensively, values that already look like group names / spns pass
/// through with name = the value itself.
pub fn resolve_groups(memberof: &[String]) -> Vec<ProfileGroup> {
    memberof
        .iter()
        .filter_map(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return None;
            }
            if looks_like_uuid(trimmed) {
                Some(ProfileGroup {
                    uuid: trimmed.to_string(),
                    name: name_for_uuid(trimmed).map(str::to_string),
                })
            } else {
                // Name- or spn-shaped value: keep it verbatim as the name.
                Some(ProfileGroup {
                    uuid: trimmed.to_string(),
                    name: Some(trimmed.to_string()),
                })
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_known_uuid_to_name() {
        let groups = resolve_groups(&[
            "00000000-0000-0000-0000-000000000013".to_string(), // idm_people_admins
        ]);
        assert_eq!(
            groups,
            vec![ProfileGroup {
                uuid: "00000000-0000-0000-0000-000000000013".to_string(),
                name: Some("idm_people_admins".to_string()),
            }]
        );
    }

    #[test]
    fn unknown_uuid_keeps_null_name() {
        let groups = resolve_groups(&["00000000-0000-0000-0000-0fffffffffff".to_string()]);
        assert_eq!(groups[0].name, None);
        assert_eq!(groups[0].uuid, "00000000-0000-0000-0000-0fffffffffff");
    }

    #[test]
    fn name_shaped_value_passes_through() {
        let groups = resolve_groups(&["idm_people_admins@example.com".to_string()]);
        assert_eq!(
            groups[0].name.as_deref(),
            Some("idm_people_admins@example.com")
        );
    }

    #[test]
    fn missing_memberof_yields_empty_groups() {
        assert!(resolve_groups(&[]).is_empty());
        assert!(resolve_groups(&["   ".to_string()]).is_empty());
    }

    #[test]
    fn table_covers_all_section_gate_groups() {
        // Every group referenced by the frontend SECTION_ACCESS map must
        // resolve. If this fails after a vendor upgrade, update the table
        // from the vendored migration data.
        for name in [
            "idm_people_admins",
            "idm_group_admins",
            "idm_service_account_admins",
            "idm_oauth2_admins",
            "idm_application_admins",
            "domain_admins",
            "idm_recycle_bin_admins",
            "idm_message_admins",
            "idm_account_policy_admins",
            "idm_radius_service_admins",
        ] {
            assert!(
                KNOWN_GROUPS.iter().any(|g| g.name == name),
                "missing gate group {name}"
            );
        }
    }

    #[test]
    fn table_uuids_and_names_are_unique() {
        let mut uuids: Vec<_> = KNOWN_GROUPS.iter().map(|g| g.uuid).collect();
        let mut names: Vec<_> = KNOWN_GROUPS.iter().map(|g| g.name).collect();
        let count = uuids.len();
        uuids.sort_unstable();
        uuids.dedup();
        names.sort_unstable();
        names.dedup();
        assert_eq!(uuids.len(), count, "duplicate uuid in table");
        assert_eq!(names.len(), count, "duplicate name in table");
    }
}
