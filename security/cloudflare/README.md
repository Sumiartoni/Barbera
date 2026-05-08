# Rekomendasi Cloudflare

- Aktifkan proxy untuk domain publik.
- Gunakan plan `Free` dulu, tidak perlu fitur berbayar pada fase awal.
- Gunakan proteksi dasar yang tersedia di plan gratis seperti proxy, SSL, dan Bot Fight Mode.
- Pertimbangkan Turnstile di halaman login dan signup.
- Pisahkan domain tenant app dan admin app.

## Catatan Gratisan

- Pada plan Free, andalkan fitur bawaan seperti DDoS protection, Bot Fight Mode, SSL, dan Access/Turnstile yang tersedia gratis.
- Jangan berasumsi semua fitur WAF lanjutan atau edge rate limiting tersedia seperti di plan berbayar.
- Karena itu, login throttling, API throttling, dan abuse control tetap harus berjalan di Nginx dan aplikasi.
