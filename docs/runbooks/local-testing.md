# Local Testing Guide

Panduan ini memakai PowerShell dan ditujukan untuk Windows.

## 1. Siapkan Environment

1. Salin `.env.example` menjadi `.env`.
2. Isi minimal nilai ini:
   - `POSTGRES_DSN`
   - `JWT_SIGNING_KEY`
3. Untuk tahap backend saat ini, Redis belum wajib dipakai karena worker reminder belum aktif penuh.

Contoh minimal `.env`:

```env
APP_ENV=development
HTTP_BIND_ADDRESS=:8080
POSTGRES_DSN=postgres://postgres:PASSWORD_ANDA@localhost:2006/barbera_db?sslmode=disable
JWT_SIGNING_KEY=dev-local-only-change-me
JWT_ACCESS_TOKEN_TTL=24h
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
ENABLE_HSTS=false
```

## 2. Siapkan PostgreSQL

Pilih salah satu:

- Jalankan PostgreSQL lokal Anda sendiri.
- Atau gunakan container PostgreSQL sesuai file `deployments/docker/docker-compose.dev.yml`.

Pastikan port PostgreSQL yang Anda pakai bisa diakses.
Pada mesin Anda saat ini, PostgreSQL terdeteksi berjalan di `localhost:2006`, jadi gunakan port itu kecuali Anda mengubah konfigurasi service-nya.

## 3. Install Dependency

```powershell
pnpm install
go mod tidy
```

## 4. Jalankan Migrasi dan Seed

Jika `go` sudah masuk ke PATH:

```powershell
go run ./cmd/migrate
go run ./cmd/seed
```

Jika belum:

```powershell
& 'D:\GO\bin\go.exe' run ./cmd/migrate
& 'D:\GO\bin\go.exe' run ./cmd/seed
```

## 5. Jalankan API

```powershell
go run ./cmd/api
```

Atau:

```powershell
& 'D:\GO\bin\go.exe' run ./cmd/api
```

API default berjalan di `http://[::1]:8080` pada setup lokal repo ini.
Jika di mesin Anda `localhost:8080` sudah dipakai service lain seperti Apache/httpd, tetap arahkan test Barbera ke listener API Anda sendiri, misalnya `http://[::1]:8080`, atau pindahkan `HTTP_BIND_ADDRESS` ke port lain.

## 6. Test Endpoint Manual

### Cek health

```powershell
Invoke-RestMethod -Uri 'http://[::1]:8080/health/live' -Method Get
```

### Cek daftar paket

```powershell
Invoke-RestMethod -Uri 'http://[::1]:8080/api/v1/public/plans' -Method Get
```

### Register tenant baru

```powershell
$body = @{
  barbershop_name = 'Barber Sultan'
  full_name = 'Owner Demo'
  email = 'owner-demo@example.com'
  phone_number = '081234567890'
  password = 'password123'
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri 'http://[::1]:8080/api/v1/auth/register' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body
```

### Login

```powershell
$body = @{
  email = 'owner-demo@example.com'
  password = 'password123'
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Uri 'http://[::1]:8080/api/v1/auth/login' `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body

$login.access_token
```

### Ambil profile `me`

```powershell
$token = $login.access_token

Invoke-RestMethod `
  -Uri 'http://[::1]:8080/api/v1/auth/me' `
  -Method Get `
  -Headers @{ Authorization = "Bearer $token" }
```

## 7. Script Test Cepat

Anda juga bisa pakai script:

```powershell
.\scripts\dev\test-auth-flow.ps1
```

Atau jika ingin memaksa base URL tertentu:

```powershell
.\scripts\dev\test-auth-flow.ps1 -BaseUrl 'http://[::1]:8080'
```

Atau lewat environment variable:

```powershell
$env:BARBERA_API_BASE_URL='http://[::1]:8080'
.\scripts\dev\test-auth-flow.ps1
```

Script ini akan:

- cek endpoint plans
- register tenant baru dengan email acak
- login
- panggil endpoint `me`

## 8. Jalankan Frontend

Tenant app:

```powershell
pnpm dev:web
```

Platform admin:

```powershell
pnpm dev:admin
```

POS barber:

```powershell
pnpm dev:pos
```

Jika Anda ingin server lebih stabil untuk test panjang dan menghindari cache issue dari `next dev`, jalankan mode production setelah build:

```powershell
pnpm build:web
pnpm build:admin
pnpm build:pos
pnpm --dir apps/web start
pnpm --dir apps/platform-admin start
pnpm --dir apps/pos start
```

Lalu buka:

- `http://localhost:3000/login`
- gunakan mode `Register Tenant` untuk membuat tenant baru
- setelah login, Anda bisa masuk ke:
  - `http://localhost:3000/dashboard`
  - `http://localhost:3000/pos`
- `http://localhost:3000/outlets`
- `http://localhost:3001/login`
- `http://localhost:3002/login`

## 9. Script Test CRM Cepat

Untuk mengetes customer + visits + dashboard summary tanpa browser:

```powershell
.\scripts\dev\test-crm-flow.ps1
```

Script ini akan:

- register tenant baru
- membuat customer baru
- membuat visit baru
- mengambil dashboard summary

## 10. Script Test Operasional Barber

Untuk mengetes flow barber, kursi, shift, antrean, dan command shift ala WhatsApp owner:

```powershell
.\scripts\dev\test-operations-flow.ps1
```

Script ini akan:

- register tenant baru
- membuat barber `Raka` dan `Bimo`
- membuat `Kursi 1` dan `Kursi 2`
- membuat shift aktif untuk Raka
- membuat customer dengan barber favorit
- membuat tiket antrean
- membuat visit yang terhubung ke barber dan kursi
- mengeksekusi command owner:
  - `SHIFT ADD|Bimo|YYYY-MM-DD|10:00|18:00`
  - `SHIFT LIST YYYY-MM-DD`
  - `SHIFT OFF|Bimo|YYYY-MM-DD`
- mengambil dashboard summary terbaru

Contoh endpoint baru yang bisa Anda tes manual:

```powershell
Invoke-RestMethod -Uri 'http://[::1]:8080/api/v1/barbers' -Headers @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri 'http://[::1]:8080/api/v1/stations' -Headers @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri 'http://[::1]:8080/api/v1/shifts?day=2026-04-03' -Headers @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri 'http://[::1]:8080/api/v1/queue' -Headers @{ Authorization = "Bearer $token" }
```

Command shift owner untuk integrasi WhatsApp nanti:

```text
SHIFT HELP
SHIFT LIST 2026-04-04
SHIFT ADD|Raka|2026-04-04|09:00|17:00
SHIFT OFF|Raka|2026-04-04
```

## 11. Yang Sudah Teruji di Mesin Ini

## 11. Script Test Outlet & Paket Pro

Untuk mengetes flow outlet utama default, limit paket Free, upgrade tenant ke Pro dari super admin API, lalu penambahan cabang:

```powershell
.\scripts\dev\test-outlets-flow.ps1
```

Script ini akan:

- register tenant baru
- memastikan tenant baru otomatis punya `Outlet Utama`
- memastikan plan `free` tidak bisa menambah outlet kedua
- upgrade tenant ke `pro` lewat endpoint super admin
- menambah outlet kedua dan ketiga
- memastikan outlet keempat ditolak oleh limit paket Pro

Endpoint super admin baru untuk override paket tenant:

```powershell
Invoke-RestMethod `
  -Uri 'http://[::1]:8080/api/v1/platform/tenants/TENANT_ID/plan' `
  -Method Post `
  -Headers @{ 'X-Platform-Admin-Key' = 'dev-platform-admin-key-change-me' } `
  -ContentType 'application/json' `
  -Body (@{ plan_code = 'pro' } | ConvertTo-Json)
```

## 12. Yang Sudah Teruji di Mesin Ini

Saya sudah memverifikasi:

- `go build` untuk `cmd/api`, `cmd/worker`, `cmd/wa-service`, `cmd/migrate`, `cmd/seed`
- `go test ./...`
- `pnpm build:web`
- `pnpm build:admin`
- `test-operations-flow.ps1`
- `test-outlets-flow.ps1`
- `test-menu-smoke.ps1`
- `test-commercial-whatsapp-flow.ps1`
- `test-onboarding-defaults.ps1`

## 13. Smoke Test Menyeluruh

Untuk mengetes menu tenant, menu super admin, CRUD resource/config, update shift, assignment paket tenant, dan status halaman frontend:

```powershell
.\scripts\dev\test-menu-smoke.ps1
```

Script ini akan:

- register tenant baru
- membuat barber, station, customer, shift, queue, dan visit
- upgrade tenant ke `pro` sebelum mengetes modul premium
- mengetes update barber, station, customer, outlet, shift, dan status queue
- mengetes tenant resource/config untuk layanan, reminder, campaign, template, loyalty, permissions, integrations, settings, dan overview WhatsApp
- mengetes endpoint super admin untuk overview, tenants, plans, system status, audit logs, assign plan, update status tenant, resource platform, dan config platform
- mengecek route frontend tenant dan super admin agar semua menu utama mengembalikan `200`

## 14. Smoke Test Onboarding Default

Untuk memastikan owner baru bisa setup cepat tanpa menulis semuanya dari nol:

```powershell
.\scripts\dev\test-onboarding-defaults.ps1
```

Script ini akan:

- register tenant baru
- memastikan `settings`, `integrations`, `permissions`, dan `whatsapp config` default langsung terisi
- memastikan service default, reminder default, dan template WhatsApp default langsung tersedia
- memverifikasi webhook owner command otomatis mengandung `public_queue_id`

## 15. Smoke Test Komersial & WhatsApp Owner

Untuk memverifikasi flow monetisasi dan keunggulan command owner via WhatsApp:

```powershell
.\scripts\dev\test-commercial-whatsapp-flow.ps1
```

Script ini akan:

- membuat coupon platform
- register tenant baru di paket `free`
- memastikan fitur premium terkunci di paket `free`
- membuat order upgrade ke `pro` lalu menandainya `paid`
- membuat barber dan akses POS
- membuat shift barber
- menyimpan konfigurasi WhatsApp owner
- menjalankan command owner dan memastikan log WhatsApp tercatat

## 16. Smoke Test Payment Forwarder QRIS Pribadi

Untuk memverifikasi flow `QRIS statis pribadi + nominal unik + forwarder Android`:

```powershell
.\scripts\dev\test-payment-forwarder-flow.ps1
```

Script ini akan:

- menyimpan konfigurasi `manual-qris-payment` di panel platform
- register tenant baru
- membuat order paket `pro` dengan channel `manual_qris`
- memastikan nominal unik dan referensi pembayaran terbentuk
- mengirim webhook notifikasi forwarder publik
- memastikan order otomatis berubah menjadi `paid`
- memastikan tenant otomatis aktif di paket `pro`

## 17. Session WhatsApp Live

Endpoint WhatsApp session yang sekarang tersedia:

```powershell
POST /api/v1/whatsapp/session/pair-phone
POST /api/v1/whatsapp/session/connect
POST /api/v1/whatsapp/session/disconnect
POST /api/v1/whatsapp/session/send-test
```

Contoh generate pairing code:

```powershell
Invoke-RestMethod `
  -Uri 'http://[::1]:8080/api/v1/whatsapp/session/pair-phone' `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'application/json' `
  -Body (@{ phone_number = '6281234567890' } | ConvertTo-Json)
```

Contoh reconnect session yang sudah pernah tertaut:

```powershell
Invoke-RestMethod `
  -Uri 'http://[::1]:8080/api/v1/whatsapp/session/connect' `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" }
```

Contoh kirim pesan uji:

```powershell
Invoke-RestMethod `
  -Uri 'http://[::1]:8080/api/v1/whatsapp/session/send-test' `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'application/json' `
  -Body (@{
    phone_number = '6281234567890'
    message = 'Tes koneksi WhatsApp BARBERA berhasil.'
  } | ConvertTo-Json)
```

## 18. Yang Sudah Terverifikasi di Mesin Ini

Di machine ini saya sudah memverifikasi:

- migrasi dan seed berhasil
- auth flow `register -> login -> me` berhasil
- CRM flow `create customer -> create visit -> dashboard summary` berhasil
- pairing code WhatsApp bisa tergenerate dari endpoint session tenant
- payment forwarder `manual_qris` bisa mengaktifkan order secara otomatis lewat nominal unik
- `test-menu-smoke.ps1`, `test-commercial-whatsapp-flow.ps1`, dan `test-payment-forwarder-flow.ps1` berhasil

Yang belum terverifikasi end-to-end saat ini adalah `pairing sampai benar-benar login dengan nomor WhatsApp real tenant` dan `pengiriman pesan live dari session yang sudah linked`, karena tahap itu membutuhkan nomor WhatsApp nyata dari HP Anda.
