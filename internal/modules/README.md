# Domain Modules

Folder ini disiapkan untuk domain-domain utama:

- `auth`
- `billing`
- `plans`
- `tenancy`
- `customers`
- `visits`
- `reminders`
- `campaigns`
- `whatsapp`
- `reports`
- `usage`
- `audit`

Saat implementasi mulai berjalan, tiap modul idealnya memiliki:

- `service.go`
- `repository.go`
- `types.go`
- `handler.go` atau `transport.go`
- `validator.go`

