CREATE TABLE IF NOT EXISTS barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  is_bookable BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT barbers_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS barbers_tenant_sort_idx
ON barbers (tenant_id, sort_order ASC, full_name ASC);

CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stations_status_check CHECK (status IN ('active', 'inactive')),
  UNIQUE (tenant_id, name)
);

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS preferred_barber_id UUID NULL REFERENCES barbers(id) ON DELETE SET NULL;

ALTER TABLE visits
ADD COLUMN IF NOT EXISTS barber_id UUID NULL REFERENCES barbers(id) ON DELETE SET NULL;

ALTER TABLE visits
ADD COLUMN IF NOT EXISTS station_id UUID NULL REFERENCES stations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS barber_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'dashboard',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT NOT NULL DEFAULT '',
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT barber_shifts_source_check CHECK (source IN ('dashboard', 'whatsapp')),
  CONSTRAINT barber_shifts_status_check CHECK (status IN ('scheduled', 'canceled')),
  CONSTRAINT barber_shifts_range_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS barber_shifts_tenant_range_idx
ON barber_shifts (tenant_id, starts_at ASC, ends_at ASC);

CREATE INDEX IF NOT EXISTS barber_shifts_barber_range_idx
ON barber_shifts (barber_id, starts_at ASC, ends_at ASC);

CREATE TABLE IF NOT EXISTS queue_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  preferred_barber_id UUID NULL REFERENCES barbers(id) ON DELETE SET NULL,
  assigned_barber_id UUID NULL REFERENCES barbers(id) ON DELETE SET NULL,
  station_id UUID NULL REFERENCES stations(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'walk_in',
  status TEXT NOT NULL DEFAULT 'waiting',
  notes TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT queue_tickets_source_check CHECK (source IN ('walk_in', 'whatsapp', 'booking')),
  CONSTRAINT queue_tickets_status_check CHECK (status IN ('waiting', 'assigned', 'in_service', 'done', 'canceled'))
);

CREATE INDEX IF NOT EXISTS queue_tickets_tenant_status_idx
ON queue_tickets (tenant_id, status, requested_at ASC);
