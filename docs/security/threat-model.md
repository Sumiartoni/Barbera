# Threat Model Ringkas

## Ancaman Utama

- Credential stuffing ke owner/admin.
- Spam dan abuse pada pengiriman WhatsApp.
- Enumerasi tenant atau IDOR pada data pelanggan.
- Session hijack untuk dashboard tenant.
- DDoS ke public endpoints dan webhook endpoints.
- Penyalahgunaan fitur Free untuk blast/promo masif.

## Mitigasi Awal

- Brute-force protection dan MFA.
- Signed webhook verification.
- Per-tenant usage metering dan hard limits.
- Edge rate limiting dan bot filtering.
- Internal admin panel dipisah domain dan IP allowlist jika memungkinkan.
- CSP, HSTS, secure cookies, CSRF protection, dan same-site policy.
- Enkripsi session WhatsApp saat disimpan.

