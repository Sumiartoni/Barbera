# Security Baseline

## Prinsip

- Tidak ada keamanan absolut. Targetnya adalah mengurangi risiko, mempercepat deteksi, dan mempercepat recovery.
- DDoS tidak bisa diselesaikan hanya di level aplikasi. Gunakan CDN/WAF seperti Cloudflare di depan Nginx dan API.
- Semua data dan session tenant harus terisolasi.

## Kontrol Minimum

- WAF/CDN di edge.
- Rate limiting di edge dan aplikasi.
- HTTPS end-to-end.
- Session dan auth state WhatsApp terenkripsi.
- JWT/signing secret dan encryption key dikelola di secret manager.
- Role-based access control untuk owner, admin, kasir, barber, dan super admin.
- Audit log untuk aksi sensitif.
- Backup terenkripsi dan restore drill.
- Monitoring uptime, error tracking, structured logging.

## Baseline Budget Minimum

Untuk tahap awal dengan modal minim, baseline yang dipilih adalah:

- Cloudflare Free di depan domain publik.
- Cloudflare Turnstile Free untuk form sensitif.
- Cloudflare Access Free + Cloudflare Tunnel untuk panel admin internal.
- Nginx OSS + Fail2Ban + firewall Linux di origin.
- Rate limiting wajib tetap hidup di Nginx dan aplikasi, jangan diasumsikan sepenuhnya ditangani edge plan gratis.

## Prioritas Tahap Awal

1. Cloudflare proxy, WAF managed rules, dan bot fight mode.
2. Login hardening: rate limit, lockout sementara, 2FA owner/admin.
3. Multi-tenant query scoping di semua repository layer.
4. Queue isolation untuk job reminder dan campaign.
5. Network segmentation antara public app, admin app, database, Redis, dan object storage.
