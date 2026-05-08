# Pre-Launch Checklist

- Cloudflare/WAF aktif untuk domain publik.
- TLS valid dan redirect HTTP ke HTTPS.
- Secret tidak disimpan di repo.
- Env production dipisah dari staging.
- Backup harian dan uji restore.
- Rate limit login, API, webhook, dan campaign send.
- Admin panel tidak di-publish seperti tenant app.
- Audit log aktif untuk support impersonation dan perubahan paket.
- Free plan memiliki batas yang keras agar tidak jadi celah abuse.
- Session WhatsApp tersimpan terenkripsi.
- Turnstile aktif di login tenant dan login admin.
- Admin panel dilindungi Access/Tunnel atau minimal IP allowlist.
