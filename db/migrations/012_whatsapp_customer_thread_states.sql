ALTER TABLE whatsapp_customer_threads
DROP CONSTRAINT IF EXISTS whatsapp_customer_threads_state_check;

ALTER TABLE whatsapp_customer_threads
ADD CONSTRAINT whatsapp_customer_threads_state_check CHECK (
  state IN ('idle', 'awaiting_service', 'awaiting_barber')
);
