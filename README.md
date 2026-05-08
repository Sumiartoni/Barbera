# Barbera Platform

Fondasi monorepo untuk SaaS multi-tenant barbershop retention dengan branding `Barbera`:

- `apps/web`: landing page dan tenant dashboard/POS.
- `apps/platform-admin`: panel internal milik Anda untuk kelola tenant, paket, dan harga.
- `cmd/api`: HTTP API utama berbasis Go.
- `cmd/worker`: scheduler, queue consumer, usage reset, dan background jobs.
- `cmd/wa-service`: isolasi koneksi WhatsApp per tenant.
- `docs/` dan `security/`: arsitektur, hardening, runbook, dan checklist operasional.

## Prinsip Arsitektur

- Multi-tenant sejak awal.
- Billing dan entitlements dikelola dari panel admin internal.
- WhatsApp per tenant, bukan memakai nomor pemilik platform.
- Security baseline dimulai dari edge, aplikasi, data, dan operasional.

## Catatan Penting Security

Struktur ini membantu hardening, tetapi tidak ada sistem yang bisa dijamin "aman total" dari DDoS atau penetration. Untuk DDoS, pertahanan utama tetap harus ada di edge seperti Cloudflare/WAF/CDN, lalu diperkuat dengan rate limiting, queue isolation, observability, dan incident response.

## Baseline Gratisan

Fase awal proyek ini diasumsikan memakai stack security gratis:

- Cloudflare Free untuk DNS proxy, Universal SSL, DDoS protection, dan Bot Fight Mode.
- Cloudflare Turnstile Free untuk proteksi form login/signup.
- Cloudflare Access Free untuk melindungi panel internal bila jumlah user masih kecil.
- Cloudflare Tunnel untuk mengurangi eksposur port publik ke origin.
- Nginx OSS, Linux firewall, dan Fail2Ban untuk hardening origin.

## Struktur Utama

```txt
apps/
  web/
  platform-admin/
cmd/
  api/
  worker/
  wa-service/
internal/
  bootstrap/
  http/
  modules/
  worker/
  wasvc/
pkg/
  config/
  httpx/
  logger/
  security/
db/
deployments/
docs/
security/
scripts/
```

## Kebutuhan Tooling

- Node.js `24+`
- pnpm `10+`
- Go `1.26+`
- PostgreSQL `16+`
- Redis `7+`

## Langkah Berikutnya

1. Pastikan `go` sudah masuk ke `PATH` atau gunakan binary di `D:\GO\bin\go.exe`.
2. Lengkapi domain model: tenant, plans, billing, customers, visits, reminders, campaigns, dan whatsapp sessions.
3. Tambahkan autentikasi owner/admin/barber, lalu lanjut ke POS dan worker reminder.

## Status Saat Ini

Yang sudah hidup dan bisa diuji:

- migrasi database
- seed paket `Free`, `Pro`, `Plus`
- endpoint `GET /api/v1/public/plans`
- endpoint `POST /api/v1/auth/register`
- endpoint `POST /api/v1/auth/login`
- endpoint `GET /api/v1/auth/me`

Panduan test lokal lengkap ada di [docs/runbooks/local-testing.md](D:/barber-retain-saas/docs/runbooks/local-testing.md).
