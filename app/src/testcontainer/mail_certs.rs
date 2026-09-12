// app/src/testcontainer/mail_certs.rs
//
// leaf certificate for mailcrab's SMTP TLS endpoint, generated
// fresh per run with rcgen. The CA is mounted into the
// kanidm-mail-sender container (trust anchor) and the leaf +
// key into mailcrab (which serves them on its SMTP socket), so
// the sender verifies mailcrab with real TLS — no host or
// production certificate is ever touched. The leaf name is
// mode-aware: the sender connects to `localhost` in host mode
// (loopback-published SMTP) and to the container DNS name
// otherwise.

use rcgen::{
    BasicConstraints, CertificateParams, CertifiedIssuer, DistinguishedName, DnType,
    ExtendedKeyUsagePurpose, IsCa, KeyPair, KeyUsagePurpose,
};

use super::Mode;

/// Generated PKI material, PEM-encoded: the CA certificate (the
/// sender's trust anchor), the mailcrab leaf certificate and its
/// private key (mounted into mailcrab).
pub(crate) struct MailPki {
    pub(crate) ca_pem: Vec<u8>,
    pub(crate) cert_pem: Vec<u8>,
    pub(crate) key_pem: Vec<u8>,
}

/// Generate the dev mail PKI: a throwaway CA and a mailcrab leaf
/// certificate signed by it. Validity is left at rcgen's sane
/// defaults (avoids a direct `time` dependency).
pub(crate) fn generate(mode: Mode) -> Result<MailPki, Box<dyn std::error::Error + Send + Sync>> {
    let ca_key = KeyPair::generate()?;
    let ca = CertifiedIssuer::self_signed(ca_params()?, &ca_key)?;

    let leaf_key = KeyPair::generate()?;
    let leaf = leaf_params(mailcrab_name(mode))?.signed_by(&leaf_key, &ca)?;

    Ok(MailPki {
        ca_pem: ca.pem().into_bytes(),
        cert_pem: leaf.pem().into_bytes(),
        key_pem: leaf_key.serialize_pem().into_bytes(),
    })
}

/// CA certificate parameters: CN `kanidm-admin dev mail CA`,
/// unconstrained CA, key usages limited to cert/CRL signing.
fn ca_params() -> Result<CertificateParams, rcgen::Error> {
    let mut params = CertificateParams::new(Vec::<String>::new())?;
    params.distinguished_name = DistinguishedName::new();
    params
        .distinguished_name
        .push(DnType::CommonName, "kanidm-admin dev mail CA");
    params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];
    Ok(params)
}

/// The mailcrab leaf certificate name (SAN and CN): `localhost`
/// in host mode — the sender runs on the host network and relays
/// into the loopback-published SMTP port — and the container DNS
/// name in in-container mode.
fn mailcrab_name(mode: Mode) -> &'static str {
    match mode {
        Mode::Host => "localhost",
        Mode::InContainer => "mailcrab",
    }
}

/// Leaf certificate parameters: CN and SAN `name` (the host the
/// sender connects to), server-auth usage.
fn leaf_params(name: &str) -> Result<CertificateParams, rcgen::Error> {
    let mut params = CertificateParams::new(vec![name.to_string()])?;
    params.distinguished_name = DistinguishedName::new();
    params
        .distinguished_name
        .push(DnType::CommonName, name);
    params.extended_key_usages = vec![ExtendedKeyUsagePurpose::ServerAuth];
    params.key_usages = vec![
        KeyUsagePurpose::DigitalSignature,
        KeyUsagePurpose::KeyEncipherment,
    ];
    Ok(params)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine as _;

    /// Decode the base64 body of a PEM block (all lines between
    /// the markers) into DER bytes.
    fn pem_body_der(pem: &str) -> Vec<u8> {
        let body = pem
            .lines()
            .filter(|line| !line.starts_with("-----"))
            .collect::<String>();
        base64::engine::general_purpose::STANDARD
            .decode(body)
            .expect("PEM body is valid base64")
    }

    #[test]
    fn mailcrab_name_follows_the_mode() {
        assert_eq!(mailcrab_name(Mode::Host), "localhost");
        assert_eq!(mailcrab_name(Mode::InContainer), "mailcrab");
    }

    #[test]
    fn host_mode_leaf_carries_localhost_san() {
        let pki = generate(Mode::Host).expect("PKI generation should succeed");

        let ca = String::from_utf8(pki.ca_pem.clone()).expect("CA PEM is UTF-8");
        let cert = String::from_utf8(pki.cert_pem.clone()).expect("cert PEM is UTF-8");
        let key = String::from_utf8(pki.key_pem.clone()).expect("key PEM is UTF-8");

        assert!(
            ca.contains("-----BEGIN CERTIFICATE-----"),
            "CA PEM carries a certificate block"
        );
        assert!(
            cert.contains("-----BEGIN CERTIFICATE-----"),
            "leaf PEM carries a certificate block"
        );
        assert!(
            key.contains("-----BEGIN PRIVATE KEY-----"),
            "key PEM carries a PKCS#8 private key block"
        );

        // The CA subject carries the dev CA common name.
        let ca_der = pem_body_der(&ca);
        let ca_cn = b"kanidm-admin dev mail CA".as_slice();
        assert!(
            ca_der.windows(ca_cn.len()).any(|w| w == ca_cn),
            "CA certificate DER must contain the dev CA common name"
        );

        // The leaf carries the localhost SAN (and CN) as DER
        // string bytes — and not the in-container DNS name.
        let leaf_der = pem_body_der(&cert);
        let san = b"localhost".as_slice();
        assert!(
            leaf_der.windows(san.len()).any(|w| w == san),
            "leaf certificate DER must contain the localhost SAN"
        );
        let wrong = b"mailcrab".as_slice();
        assert!(
            !leaf_der.windows(wrong.len()).any(|w| w == wrong),
            "leaf certificate DER must not contain the mailcrab DNS name"
        );
    }

    #[test]
    fn in_container_leaf_carries_mailcrab_san() {
        let pki = generate(Mode::InContainer).expect("PKI generation should succeed");
        let cert = String::from_utf8(pki.cert_pem.clone()).expect("cert PEM is UTF-8");

        let leaf_der = pem_body_der(&cert);
        let san = b"mailcrab".as_slice();
        assert!(
            leaf_der.windows(san.len()).any(|w| w == san),
            "leaf certificate DER must contain the mailcrab SAN"
        );
        let wrong = b"localhost".as_slice();
        assert!(
            !leaf_der.windows(wrong.len()).any(|w| w == wrong),
            "leaf certificate DER must not contain the host-mode name"
        );
    }
}
