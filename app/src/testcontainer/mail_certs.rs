// app/src/testcontainer/mail_certs.rs
//
// Throwaway PKI for the dev mail chain: a self-signed CA plus a
// leaf certificate for mailcrab's SMTP TLS endpoint, generated
// fresh per run with rcgen. The CA is mounted into the
// kanidm-mail-sender container (trust anchor) and the leaf +
// key into mailcrab (which serves them on its SMTP socket), so
// the sender verifies mailcrab with real TLS — no host or
// production certificate is ever touched.

use rcgen::{
    BasicConstraints, CertificateParams, CertifiedIssuer, DistinguishedName, DnType,
    ExtendedKeyUsagePurpose, IsCa, KeyPair, KeyUsagePurpose,
};

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
pub(crate) fn generate() -> Result<MailPki, Box<dyn std::error::Error + Send + Sync>> {
    let ca_key = KeyPair::generate()?;
    let ca = CertifiedIssuer::self_signed(ca_params()?, &ca_key)?;

    let leaf_key = KeyPair::generate()?;
    let leaf = leaf_params()?.signed_by(&leaf_key, &ca)?;

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

/// Leaf certificate parameters: CN and SAN `mailcrab` (the
/// container DNS name the sender connects to), server-auth
/// usage.
fn leaf_params() -> Result<CertificateParams, rcgen::Error> {
    let mut params = CertificateParams::new(vec!["mailcrab".to_string()])?;
    params.distinguished_name = DistinguishedName::new();
    params
        .distinguished_name
        .push(DnType::CommonName, "mailcrab");
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
    fn generates_ca_and_leaf_with_mailcrab_san() {
        let pki = generate().expect("PKI generation should succeed");

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

        // The leaf carries the mailcrab SAN (and CN) as DER string
        // bytes — dependency-free structural check.
        let leaf_der = pem_body_der(&cert);
        let san = b"mailcrab".as_slice();
        assert!(
            leaf_der.windows(san.len()).any(|w| w == san),
            "leaf certificate DER must contain the mailcrab SAN"
        );
    }
}
