# Incident Response

## Saat Terjadi Insiden

1. Klasifikasikan severity: auth abuse, tenant breach, queue delay, session WA mass disconnect, atau service outage.
2. Bekukan perubahan non-esensial.
3. Kumpulkan request IDs, tenant IDs, IP, dan log terkait.
4. Putuskan containment:
   - rate limit lebih ketat,
   - suspend tenant abusive,
   - revoke session,
   - rotate keys jika perlu.
5. Komunikasikan status internal dan dampak tenant.
6. Setelah stabil, lakukan root cause analysis dan tindak lanjut permanen.

## Evidence Yang Harus Disimpan

- Timestamp kejadian.
- Endpoint terdampak.
- Tenant terdampak.
- Request IDs.
- Snapshot metric, logs, dan queue depth.

