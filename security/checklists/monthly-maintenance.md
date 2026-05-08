# Monthly Security Maintenance

- Update dependency Go, Node, container image, dan base OS.
- Review audit log untuk login aneh, abuse, dan impersonation.
- Rotasi secret berisiko tinggi jika diperlukan.
- Uji restore backup di staging.
- Review usage tenant Free untuk mendeteksi spam atau cost abuse.
- Periksa rule Cloudflare/WAF dan false positive.
- Verifikasi TLS, domain, dan expiry certificate.
- Review akun admin internal yang masih aktif.
- Patch image/container yang punya CVE tinggi.
- Perbarui incident runbook jika ada insiden baru.

