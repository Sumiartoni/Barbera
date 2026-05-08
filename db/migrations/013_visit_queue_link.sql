ALTER TABLE visits
ADD COLUMN IF NOT EXISTS queue_ticket_id UUID REFERENCES queue_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS visits_queue_ticket_idx
ON visits (tenant_id, queue_ticket_id);
