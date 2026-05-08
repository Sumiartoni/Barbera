CREATE TABLE IF NOT EXISTS whatsapp_customer_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  customer_id UUID NULL REFERENCES customers(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone_number),
  CONSTRAINT whatsapp_customer_threads_state_check CHECK (
    state IN ('idle', 'awaiting_barber')
  )
);

CREATE INDEX IF NOT EXISTS whatsapp_customer_threads_lookup_idx
ON whatsapp_customer_threads (tenant_id, phone_number);
