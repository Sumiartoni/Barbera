CREATE TABLE IF NOT EXISTS tenant_whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disconnected',
  session_mode TEXT NOT NULL DEFAULT 'pair_code',
  phone_number TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  device_jid TEXT NOT NULL DEFAULT '',
  pairing_code TEXT NOT NULL DEFAULT '',
  pairing_expires_at TIMESTAMPTZ NULL,
  last_connected_at TIMESTAMPTZ NULL,
  last_seen_at TIMESTAMPTZ NULL,
  last_message_at TIMESTAMPTZ NULL,
  last_error TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_whatsapp_sessions_status_check CHECK (
    status IN ('disconnected', 'pairing', 'connected', 'logged_out', 'error')
  ),
  CONSTRAINT tenant_whatsapp_sessions_mode_check CHECK (
    session_mode IN ('pair_code')
  )
);

CREATE INDEX IF NOT EXISTS tenant_whatsapp_sessions_status_idx
ON tenant_whatsapp_sessions (status, updated_at DESC);

ALTER TABLE billing_orders
  ADD COLUMN IF NOT EXISTS unique_amount_idr BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_amount_idr BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS payment_confirm_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS paid_amount_idr BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matched_notification_id UUID NULL;

UPDATE billing_orders
SET
  payment_amount_idr = CASE
    WHEN payment_amount_idr = 0 THEN total_amount_idr
    ELSE payment_amount_idr
  END,
  paid_amount_idr = CASE
    WHEN status = 'paid' AND paid_amount_idr = 0 THEN
      CASE
        WHEN payment_amount_idr > 0 THEN payment_amount_idr
        ELSE total_amount_idr
      END
    ELSE paid_amount_idr
  END;

CREATE INDEX IF NOT EXISTS billing_orders_payment_amount_idx
ON billing_orders (payment_amount_idr, status, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_orders_payment_reference_idx
ON billing_orders (payment_reference);

CREATE TABLE IF NOT EXISTS billing_payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'android_forwarder',
  app_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  sender TEXT NOT NULL DEFAULT '',
  amount_idr BIGINT NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL,
  match_status TEXT NOT NULL DEFAULT 'pending',
  matched_order_id UUID NULL REFERENCES billing_orders(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_payment_notifications_match_status_check CHECK (
    match_status IN ('pending', 'matched', 'unmatched', 'ambiguous', 'invalid')
  )
);

CREATE INDEX IF NOT EXISTS billing_payment_notifications_status_idx
ON billing_payment_notifications (match_status, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_payment_notifications_amount_idx
ON billing_payment_notifications (amount_idr, created_at DESC);
