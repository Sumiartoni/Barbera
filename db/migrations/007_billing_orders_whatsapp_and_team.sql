ALTER TABLE tenant_configurations
ADD COLUMN IF NOT EXISTS whatsapp JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS billing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  plan_code TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  billing_cycle_days INTEGER NOT NULL DEFAULT 30,
  base_amount_idr BIGINT NOT NULL DEFAULT 0,
  coupon_code TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT '',
  discount_value BIGINT NOT NULL DEFAULT 0,
  discount_amount_idr BIGINT NOT NULL DEFAULT 0,
  total_amount_idr BIGINT NOT NULL DEFAULT 0,
  payment_channel TEXT NOT NULL DEFAULT 'manual_qris',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  notes TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_orders_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'yearly')),
  CONSTRAINT billing_orders_status_check CHECK (status IN ('pending_payment', 'waiting_confirmation', 'paid', 'rejected', 'canceled', 'expired'))
);

CREATE INDEX IF NOT EXISTS billing_orders_tenant_lookup_idx
ON billing_orders (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_orders_status_lookup_idx
ON billing_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_command_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT '',
  command_text TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'success',
  source TEXT NOT NULL DEFAULT 'dashboard',
  output_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_command_logs_status_check CHECK (status IN ('success', 'error'))
);

CREATE INDEX IF NOT EXISTS whatsapp_command_logs_tenant_lookup_idx
ON whatsapp_command_logs (tenant_id, created_at DESC);
