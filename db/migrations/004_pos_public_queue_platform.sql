ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS public_queue_id TEXT,
ADD COLUMN IF NOT EXISTS public_queue_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE tenants
SET public_queue_id = CONCAT(
  slug,
  '-',
  SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6)
)
WHERE COALESCE(TRIM(public_queue_id), '') = '';

ALTER TABLE tenants
ALTER COLUMN public_queue_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_public_queue_id_idx
ON tenants (public_queue_id);

CREATE TABLE IF NOT EXISTS barber_access_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'barber',
  access_code TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (barber_id),
  CONSTRAINT barber_access_credentials_role_check CHECK (role IN ('barber', 'frontdesk')),
  CONSTRAINT barber_access_credentials_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS barber_access_credentials_tenant_idx
ON barber_access_credentials (tenant_id, status, created_at DESC);

ALTER TABLE queue_tickets
ADD COLUMN IF NOT EXISTS queue_number INTEGER,
ADD COLUMN IF NOT EXISTS queue_date DATE,
ADD COLUMN IF NOT EXISTS service_summary TEXT NOT NULL DEFAULT '';

UPDATE queue_tickets
SET queue_date = requested_at::date
WHERE queue_date IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, requested_at::date
      ORDER BY requested_at ASC, created_at ASC
    ) AS next_queue_number
  FROM queue_tickets
)
UPDATE queue_tickets q
SET queue_number = ranked.next_queue_number
FROM ranked
WHERE q.id = ranked.id
  AND q.queue_number IS NULL;

ALTER TABLE queue_tickets
ALTER COLUMN queue_date SET NOT NULL,
ALTER COLUMN queue_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS queue_tickets_tenant_queue_number_idx
ON queue_tickets (tenant_id, queue_date, queue_number);
