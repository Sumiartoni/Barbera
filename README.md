# Barbera

Barbera adalah monorepo SaaS multi-tenant untuk operasional dan retensi barbershop. Repo ini menggabungkan backend Go, tenant app, POS app, internal platform admin, migrasi database, dan script smoke test dalam satu workspace.

README ini ditujukan untuk developer yang akan melanjutkan project, bukan sekadar menjalankan demo. Fokusnya adalah menjelaskan apa yang sudah hidup, apa yang masih fondasi, dan di mana titik lanjut yang paling aman.

## Ringkasan Cepat

- `apps/web`: aplikasi utama tenant. Landing page publik, login owner, dashboard tenant, POS access, queue, WhatsApp, billing, usage, role/permission, dan modul dinamis ada di sini.
- `apps/platform-admin`: control plane internal untuk super admin. Dipakai untuk overview platform, kelola tenant, plan, billing order, resource/config platform, audit, dan system status.
- `apps/pos`: POS app terpisah untuk barber/staff. Surface ini sudah ada, tetapi dokumentasi internalnya belum dirapikan.
- `apps/landing`: landing page Vite terpisah. Saat ini fungsinya overlap dengan landing di `apps/web`.
- `cmd/api`: HTTP API utama berbasis Go. Ini adalah service backend yang benar-benar menjalankan fitur inti saat ini.
- `cmd/migrate` dan `cmd/seed`: migrasi database dan seed plan awal.
- `cmd/worker`: process worker terpisah, tetapi saat ini masih heartbeat loop dan belum menjalankan job production sungguhan.
- `cmd/wa-service`: service WhatsApp terpisah, tetapi saat ini masih heartbeat loop. Fitur WhatsApp yang aktif sekarang masih dijalankan lewat API utama.

## Status Project Saat Ini

### Yang sudah berjalan

- Healthcheck: `/health/live`, `/health/ready`
- Tenant auth owner: register, login, me
- POS auth barber/staff: login dan `me`
- Public plan catalog
- Dashboard summary tenant
- CRUD tenant untuk:
  - barber
  - station
  - shift
  - customer
  - outlet
  - team member
- Queue aktif dan public queue
- Visit history dan ringkasan omzet dasar
- Resource/config generic untuk tenant
- Billing tenant:
  - catalog
  - summary
  - list/create order
  - manual QRIS forwarder webhook
- Platform admin API:
  - overview
  - tenant list
  - assign tenant plan
  - update tenant status
  - plan management
  - billing order monitoring
  - platform resource/config management
  - audit log
  - system status
- WhatsApp surface di API:
  - overview
  - logs
  - owner command
  - config
  - pair QR
  - pair phone
  - connect
  - disconnect
  - send test
- Script smoke test PowerShell untuk auth, CRM, operations, outlet/plan, onboarding default, commercial flow, menu smoke, dan payment forwarder

### Yang masih fondasi atau perlu dianggap belum final

- `cmd/worker` belum memproses queue/job sungguhan, hanya heartbeat.
- `cmd/wa-service` belum menjadi runtime WhatsApp produksi yang terpisah, hanya heartbeat.
- `apps/web` masih menyimpan session tenant di `localStorage` melalui `apps/web/lib/session.ts`.
- `apps/landing` dan landing di `apps/web` adalah dua implementasi terpisah yang overlap. Tim perlu memutuskan mana source of truth.
- Nama internal lama `balikcukur` masih muncul di Go module, nama container, dan beberapa default config. Ini bukan bug langsung, tapi penting diketahui sebelum refactor branding.
- `apps/pos/README.md` masih template default Next.js dan belum menggambarkan kondisi project sebenarnya.

## Peta Repo

```text
apps/
  web/             aplikasi tenant utama + landing page publik
  platform-admin/  panel internal super admin
  pos/             POS app terpisah untuk barber/staff
  landing/         landing page Vite terpisah
cmd/
  api/             server API utama
  migrate/         migrasi database
  seed/            seed data plan awal
  worker/          worker background (belum final)
  wa-service/      runtime WhatsApp terpisah (belum final)
internal/
  bootstrap/       wiring startup API
  http/            router, handler, middleware
  modules/         domain service per area bisnis
pkg/
  config/          env/config loader
  database/        koneksi dan migrasi DB
  httpx/           helper HTTP
  logger/          logger
  security/        helper security
db/
  migrations/      skema database bertahap
  seeds/           seed SQL
deployments/
  docker/          compose lokal
  nginx/           contoh nginx config
docs/
  architecture/    gambaran arsitektur
  runbooks/        panduan operasional dan local testing
  security/        baseline dan threat model
scripts/
  dev/             smoke test dan helper lokal
  ops/             placeholder script operasional
security/
  checklists/      checklist pre-launch dan maintenance
  cloudflare/      catatan hardening edge
```

## Arsitektur Produk

Alur tingkat tinggi yang sedang dibangun:

1. Owner barbershop daftar tenant baru.
2. Tenant otomatis masuk plan awal.
3. Owner mengelola outlet, barber, station, customer, visit, queue, dan akses staff.
4. Tenant dapat menghubungkan WhatsApp untuk owner command dan komunikasi.
5. Tenant membeli upgrade plan melalui billing order.
6. Super admin mengelola monetisasi, resource platform, status tenant, dan audit lewat panel internal.

Pemisahan aplikasi sekarang memang disengaja:

- `apps/web` untuk tenant-facing surface
- `apps/platform-admin` untuk control plane internal
- `cmd/api` sebagai backend tunggal saat ini
- `cmd/worker` dan `cmd/wa-service` disiapkan untuk scaling terpisah di tahap berikutnya

## Domain Backend Yang Sudah Terlihat

Di `internal/modules`, domain yang sudah punya implementasi nyata saat ini meliputi:

- `auth`
- `audit`
- `barbers`
- `billing`
- `customers`
- `outlets`
- `ownercommands`
- `plans`
- `platform`
- `queue`
- `reports`
- `resources`
- `shifts`
- `staffaccess`
- `stations`
- `teammembers`
- `usage`
- `visits`
- `whatsapp`

Domain yang masih terlihat sebagai placeholder/fondasi:

- `campaigns`
- `reminders`
- `tenancy`

## Aplikasi Frontend

### `apps/web`

Ini adalah aplikasi tenant utama dan saat ini paling penting untuk pengembangan produk. Surface yang sudah ada antara lain:

- landing page publik di route root
- login owner tenant
- dashboard tenant
- barbers
- customers
- outlets
- stations
- shifts
- queue
- visits
- WhatsApp overview
- POS access
- modul dinamis seperti services, campaigns, templates, loyalty, usage, billing, permissions, settings, integrations, audit, help, changelog

### `apps/platform-admin`

Ini adalah panel super admin. Menu yang sudah dipetakan di code meliputi:

- overview
- tenants
- tenant detail
- tenant override
- suspension/reactivation
- plans
- pricing
- coupons
- subscriptions
- invoices
- payments
- manual confirmation
- usage metering
- quota limits
- feature flags
- access control
- admin users
- WhatsApp health
- system status
- audit logs
- blocked tenants
- login activity
- security settings
- support
- announcements
- maintenance

Tidak semua menu punya backend spesifik penuh, tetapi route dan struktur UI-nya sudah dipisah sehingga penambahan modul baru lebih mudah.

### `apps/pos`

POS app ini berjalan sebagai aplikasi Next.js terpisah untuk barber/staff. Ia sudah punya route login, account, history, transaksi baru, auth proxy, queue, dan transaksi. Namun dokumentasi lokalnya belum dirapikan dan beberapa script/package masih membawa default dari scaffold awal.

### `apps/landing`

Landing Vite ini merupakan implementasi marketing site terpisah. Karena `apps/web` juga sudah memiliki landing sendiri, developer baru sebaiknya memutuskan lebih dulu:

- pertahankan dua landing dan jelaskan boundary-nya, atau
- jadikan salah satunya source of truth lalu sinkronkan asset/section

## Prasyarat Development

- Node.js `24+`
- pnpm `10+`
- Go `1.26+`
- PostgreSQL `16+`
- Redis `7+`
- Docker Desktop opsional untuk stack lokal cepat
- PowerShell untuk menjalankan script di `scripts/dev`

## Environment Variables

Salin `.env.example` menjadi `.env`.

Minimal yang perlu diisi agar backend utama hidup:

```env
APP_ENV=development
APP_PUBLIC_URL=http://localhost:3000
HTTP_BIND_ADDRESS=:8080
POSTGRES_DSN=postgres://postgres:YOUR_PASSWORD@localhost:5432/barbera_db?sslmode=disable
JWT_SIGNING_KEY=change-me
JWT_ACCESS_TOKEN_TTL=24h
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
NEXT_PUBLIC_API_BASE_URL=http://[::1]:8080
PLATFORM_ADMIN_API_KEY=dev-platform-admin-key-change-me
```

Catatan penting:

- `PLATFORM_ADMIN_API_KEY` dipakai oleh backend dan `apps/platform-admin`, tetapi saat ini belum dicantumkan di `.env.example`. Tambahkan manual di `.env`.
- `SESSION_ENCRYPTION_KEY_BASE64` dan `WA_SESSION_ENCRYPTION_KEY_BASE64` sudah disiapkan di config, walau belum semua flow memakainya penuh.
- `BARBERA_API_BASE_URL` dipakai oleh beberapa script dan app internal sebagai override tambahan untuk base URL API.

## Menjalankan Project Secara Lokal

### 1. Install dependency

```powershell
pnpm install
go mod tidy
```

### 2. Jalankan database pendukung

Jika ingin cepat, pakai Docker Compose:

```powershell
docker compose -f deployments/docker/docker-compose.dev.yml up -d
```

Stack ini menyiapkan:

- PostgreSQL
- Redis
- MinIO

Catatan:

- Nama container dan default DB di compose masih memakai branding lama `balikcukur`.
- Sesuaikan `POSTGRES_DSN` di `.env` dengan port dan credential yang benar. File compose default memakai PostgreSQL `5432`.

### 3. Jalankan migrasi dan seed

```powershell
go run ./cmd/migrate
go run ./cmd/seed
```

### 4. Jalankan backend API

```powershell
go run ./cmd/api
```

Default API lokal yang dipakai repo ini adalah:

- `http://[::1]:8080`

### 5. Jalankan frontend

Tenant app:

```powershell
pnpm dev:web
```

Platform admin:

```powershell
pnpm dev:admin
```

POS:

```powershell
pnpm dev:pos
```

Landing Vite terpisah:

```powershell
pnpm dev:landing
```

### 6. Port default

- `apps/web`: `http://localhost:3000`
- `apps/platform-admin`: `http://localhost:3001`
- `apps/pos`: `http://localhost:3002`
- `cmd/api`: `http://[::1]:8080`

## Build Commands

```powershell
pnpm build:web
pnpm build:admin
pnpm build:pos
pnpm build:landing
```

Untuk backend:

```powershell
go build ./cmd/api
go build ./cmd/migrate
go build ./cmd/seed
go build ./cmd/worker
go build ./cmd/wa-service
```

## Smoke Test Yang Sudah Tersedia

Semua script berikut ada di `scripts/dev` dan ditulis untuk PowerShell.

- `test-auth-flow.ps1`: register -> login -> me
- `test-crm-flow.ps1`: customer + visit + dashboard summary
- `test-operations-flow.ps1`: barber, station, shift, queue, visit, owner command
- `test-outlets-flow.ps1`: outlet default, limit plan free/pro, upgrade tenant via platform API
- `test-menu-smoke.ps1`: route tenant + super admin + resource/config smoke
- `test-onboarding-defaults.ps1`: default settings/resource saat tenant baru dibuat
- `test-commercial-whatsapp-flow.ps1`: coupon, billing order, premium gating, WhatsApp owner flow
- `test-payment-forwarder-flow.ps1`: manual QRIS forwarder sampai order paid
- `browser-smoke.spec.ts`: smoke browser berbasis Playwright

Sebagian besar script mengasumsikan base URL API:

```powershell
$env:BARBERA_API_BASE_URL='http://[::1]:8080'
```

Jika script menyentuh platform API, pastikan juga:

```powershell
$env:PLATFORM_ADMIN_API_KEY='dev-platform-admin-key-change-me'
```

## Endpoint Penting

Berikut endpoint yang paling sering dipakai saat development:

### Public

- `GET /health/live`
- `GET /health/ready`
- `GET /api/v1/public/plans`
- `GET /api/v1/public/queue/{publicQueueID}`
- `POST /api/v1/public/whatsapp/owner-command/{publicQueueID}`
- `POST /api/v1/public/payments/manual-qris-forwarder`

### Tenant auth dan operasional

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/dashboard/summary`
- `GET/POST /api/v1/barbers`
- `GET/POST /api/v1/stations`
- `GET/POST /api/v1/shifts`
- `GET/POST /api/v1/customers`
- `GET/POST /api/v1/outlets`
- `GET/POST /api/v1/team-members`
- `GET/POST /api/v1/queue`
- `GET/POST /api/v1/visits`
- `GET/POST /api/v1/billing/orders`
- `GET /api/v1/billing/summary`
- `GET /api/v1/usage/summary`
- `GET /api/v1/audit-logs`

### Tenant config/resource generic

- `GET/POST /api/v1/resources/{resourceType}`
- `PUT/DELETE /api/v1/resources/{resourceType}/{itemID}`
- `GET /api/v1/config/{configType}`
- `PUT /api/v1/config/{configType}`

### WhatsApp tenant

- `GET /api/v1/whatsapp/overview`
- `GET /api/v1/whatsapp/logs`
- `POST /api/v1/whatsapp/execute`
- `PUT /api/v1/whatsapp/config`
- `POST /api/v1/whatsapp/session/pair-qr`
- `POST /api/v1/whatsapp/session/pair-phone`
- `POST /api/v1/whatsapp/session/connect`
- `POST /api/v1/whatsapp/session/disconnect`
- `POST /api/v1/whatsapp/session/send-test`

### Platform admin

- `GET /api/v1/platform/overview`
- `GET /api/v1/platform/tenants`
- `POST /api/v1/platform/tenants/{tenantID}/plan`
- `POST /api/v1/platform/tenants/{tenantID}/status`
- `GET /api/v1/platform/plans`
- `PUT /api/v1/platform/plans/{planCode}`
- `GET /api/v1/platform/billing-orders`
- `POST /api/v1/platform/billing-orders/{orderID}/status`
- `GET/POST /api/v1/platform/resources/{resourceType}`
- `PUT/DELETE /api/v1/platform/resources/{resourceType}/{itemID}`
- `GET /api/v1/platform/config/{configType}`
- `PUT /api/v1/platform/config/{configType}`
- `GET /api/v1/platform/system-status`
- `GET /api/v1/platform/audit-logs`

Semua endpoint platform admin memakai header:

```text
X-Platform-Admin-Key: <your-key>
```

## Cara Melanjutkan Project Dengan Aman

### Jika menambah fitur backend

Ikuti pola yang sudah ada:

1. Tambah atau lengkapi domain di `internal/modules/<domain>`.
2. Tambah handler di `internal/http/handlers`.
3. Sambungkan route di `internal/http/router.go`.
4. Jika butuh data baru, buat migrasi SQL di `db/migrations`.
5. Tambah smoke test PowerShell bila flow penting sudah cukup stabil.

### Jika menambah halaman tenant

Ada dua pola UI di `apps/web`:

- halaman spesifik seperti `dashboard`, `barbers`, `queue`, `whatsapp`
- halaman dinamis berbasis section di `app/(app)/[section]/page.tsx` dan `components/tenant-dynamic-page-client.tsx`

Kalau fitur baru masih cocok sebagai modul generik tenant, lebih murah menambahkannya ke sistem section dinamis yang sudah ada.

### Jika menambah modul platform admin

Lihat tiga titik utama:

- `apps/platform-admin/lib/admin-navigation.ts`
- `apps/platform-admin/components/admin-pages.tsx`
- `apps/platform-admin/lib/platform-api.ts`

Biasanya alur termurah adalah:

1. tambahkan section baru di navigation
2. render UI di `admin-pages.tsx`
3. sambungkan ke endpoint platform yang sudah ada atau tambah endpoint baru di backend

## Known Gotchas

- Go module masih bernama `balikcukur`.
- Compose lokal memakai nama container lama `balikcukur-*`.
- `apps/web` masih memakai `localStorage` untuk menyimpan session tenant.
- `apps/pos` dan `apps/platform-admin` tidak sepenuhnya sinkron dalam kualitas dokumentasi internal.
- `apps/landing` dan landing di `apps/web` berpotensi drift bila keduanya diedit terpisah.
- Beberapa default URL di code masih bercampur antara `http://[::1]:8080`, `http://localhost:8080`, dan fallback lain. Saat debug, cek file config/frontend helper lebih dulu sebelum menyimpulkan API rusak.

## Dokumen Tambahan Yang Wajib Dibaca

- `docs/architecture/monorepo.md`
- `docs/runbooks/local-testing.md`
- `docs/runbooks/backup-and-restore.md`
- `docs/runbooks/incident-response.md`
- `docs/security/security-baseline.md`
- `docs/security/threat-model.md`
- `docs/security/free-security-stack.md`
- `security/checklists/pre-launch.md`
- `security/checklists/monthly-maintenance.md`
- `security/cloudflare/README.md`

## Rekomendasi Prioritas Lanjutan

Jika Anda mengambil alih repo ini hari ini, urutan kerja yang paling rasional adalah:

1. Putuskan source of truth untuk landing: `apps/web` atau `apps/landing`.
2. Rapikan env contract: tambahkan semua env yang benar-benar dipakai ke `.env.example`.
3. Finalkan runtime worker sungguhan di `cmd/worker`.
4. Finalkan boundary WhatsApp: tetap di API utama atau benar-benar dipindah ke `cmd/wa-service`.
5. Rapikan auth tenant agar tidak bergantung pada `localStorage` bila target deployment sudah lebih production-oriented.
6. Tambahkan test otomatis yang lebih dekat ke CI untuk flow bisnis kritis.

## Catatan Akhir

Jangan anggap repo ini sebagai greenfield kosong. Dasar domain, route, migrasi, admin surface, dan smoke script sudah cukup banyak. Jalur paling aman untuk melanjutkan project adalah memanfaatkan pola yang sudah ada, bukan membuat surface baru dari nol tanpa alasan kuat.
