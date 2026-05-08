# Free Security Stack

Dokumen ini menetapkan baseline security dengan biaya serendah mungkin.

## Prinsip

- Gunakan layanan gratis resmi yang cukup kuat untuk tahap awal.
- Jangan mengandalkan satu lapisan saja.
- Lindungi admin panel lebih ketat daripada tenant app.

## Stack Gratis yang Direkomendasikan

### Edge

- `Cloudflare Free`
  - proxy DNS
  - Universal SSL
  - automatic DDoS protection
  - Bot Fight Mode
- `Cloudflare Turnstile Free`
  - untuk login, signup, reset password
- `Cloudflare Access Free`
  - untuk `platform-admin`
  - cocok untuk tim kecil
- `Cloudflare Tunnel`
  - origin tidak perlu membuka port admin ke internet

### Origin Server

- `Nginx OSS`
  - reverse proxy
  - request rate limiting
  - connection limiting
  - request body limit
- `UFW` atau firewall bawaan server
  - buka hanya port yang perlu
- `Fail2Ban`
  - ban IP untuk login/SSH abuse
- `OpenSSH hardening`
  - nonaktifkan password login
  - gunakan SSH key
  - ganti port hanya sebagai noise reduction, bukan kontrol utama

### App Layer

- middleware rate limiting
- secure cookies
- CSRF protection
- RBAC
- audit log
- encrypted session storage
- usage limits yang keras untuk paket Free

### Ops

- backup harian terenkripsi
- restore drill berkala
- dependency update rutin
- log retention minimum
- incident runbook

## Yang Sengaja Tidak Diasumsikan

- tidak mengandalkan WAF enterprise berbayar
- tidak mengandalkan SIEM mahal
- tidak mengandalkan managed bot protection premium

## Batasan Realistis

- Cloudflare Free sangat membantu, tetapi rule dan fleksibilitasnya tidak seluas paket berbayar.
- Proteksi DDoS layer 7 dan abuse yang sangat kompleks tetap punya batas.
- Untuk pertumbuhan tenant besar, kemungkinan nanti perlu upgrade bertahap.

