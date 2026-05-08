# Monorepo Blueprint

## Tujuan

Repositori ini memisahkan concern utama:

- `apps/web`: tenant-facing app.
- `apps/platform-admin`: internal control plane.
- `cmd/api`: entrypoint backend utama.
- `cmd/worker`: background processing.
- `cmd/wa-service`: koneksi WhatsApp per tenant.

## Alasan Pemisahan

- Tenant app dan platform admin punya kebutuhan auth serta threat surface berbeda.
- Worker dan WA service perlu scaling independen dari API.
- Security, docs, dan deployment disimpan terpisah agar maintainable untuk jangka panjang.

## Alur Tingkat Tinggi

1. Owner barbershop daftar dan otomatis masuk paket `Free`.
2. Owner menghubungkan WhatsApp sendiri melalui QR.
3. POS menyimpan kunjungan pelanggan.
4. Worker menjadwalkan reminder.
5. WA service mengirim reminder dari nomor tenant.
6. Super admin Anda mengelola plan, harga, override, dan abuse dari panel internal.

