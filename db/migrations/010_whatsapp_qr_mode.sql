ALTER TABLE tenant_whatsapp_sessions
  DROP CONSTRAINT IF EXISTS tenant_whatsapp_sessions_mode_check;

ALTER TABLE tenant_whatsapp_sessions
  ADD CONSTRAINT tenant_whatsapp_sessions_mode_check CHECK (
    session_mode IN ('pair_code', 'qr_code')
  );
