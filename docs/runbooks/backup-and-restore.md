# Backup and Restore

## Backup Minimum

- Database PostgreSQL: harian penuh, retention minimal 14-30 hari.
- Redis: hanya untuk cache/queue, jangan jadi satu-satunya sumber data.
- Object storage: backup metadata dan bucket policy.
- Secret manager: versioning aktif.

## Restore Drill

1. Pulihkan dump database ke environment staging.
2. Verifikasi tabel tenant, users, customers, visits, reminders, dan billing.
3. Uji login, lookup customer, dan dashboard tenant.
4. Dokumentasikan durasi restore dan gap yang ditemukan.

## Tujuan

- Mengetahui RPO/RTO nyata.
- Memastikan backup bukan hanya ada, tapi benar-benar bisa dipakai.

