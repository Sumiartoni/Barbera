CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  preferred_barber TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  last_visit_at TIMESTAMPTZ NULL,
  total_visits INTEGER NOT NULL DEFAULT 0,
  total_spent_idr BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone_number)
);

CREATE INDEX IF NOT EXISTS customers_tenant_last_visit_idx
ON customers (tenant_id, last_visit_at DESC NULLS LAST, created_at DESC);

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL DEFAULT '',
  barber_name TEXT NOT NULL DEFAULT '',
  amount_idr BIGINT NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'paid',
  notes TEXT NOT NULL DEFAULT '',
  visit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_reminder_at TIMESTAMPTZ NULL,
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT visits_payment_status_check CHECK (payment_status IN ('paid', 'unpaid'))
);

CREATE INDEX IF NOT EXISTS visits_tenant_visit_at_idx
ON visits (tenant_id, visit_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS visits_tenant_reminder_idx
ON visits (tenant_id, next_reminder_at)
WHERE next_reminder_at IS NOT NULL;
