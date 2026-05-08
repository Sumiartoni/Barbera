WITH free_plan AS (
  INSERT INTO plans (
    code,
    name,
    description,
    monthly_price_idr,
    yearly_price_idr,
    is_free,
    is_active,
    display_order
  )
  VALUES (
    'free',
    'Free',
    'Paket gratis permanen untuk barbershop yang baru mulai.',
    0,
    0,
    TRUE,
    TRUE,
    1
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price_idr = EXCLUDED.monthly_price_idr,
    yearly_price_idr = EXCLUDED.yearly_price_idr,
    is_free = EXCLUDED.is_free,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    updated_at = NOW()
  RETURNING id
),
pro_plan AS (
  INSERT INTO plans (
    code,
    name,
    description,
    monthly_price_idr,
    yearly_price_idr,
    is_free,
    is_active,
    display_order
  )
  VALUES (
    'pro',
    'Pro',
    'Paket untuk barbershop aktif dengan reminder, campaign, dan export.',
    149000,
    1490000,
    FALSE,
    TRUE,
    2
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price_idr = EXCLUDED.monthly_price_idr,
    yearly_price_idr = EXCLUDED.yearly_price_idr,
    is_free = EXCLUDED.is_free,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    updated_at = NOW()
  RETURNING id
),
plus_plan AS (
  INSERT INTO plans (
    code,
    name,
    description,
    monthly_price_idr,
    yearly_price_idr,
    is_free,
    is_active,
    display_order
  )
  VALUES (
    'plus',
    'Plus',
    'Paket untuk multi-outlet dan operasional barbershop yang lebih besar.',
    399000,
    3990000,
    FALSE,
    TRUE,
    3
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price_idr = EXCLUDED.monthly_price_idr,
    yearly_price_idr = EXCLUDED.yearly_price_idr,
    is_free = EXCLUDED.is_free,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    updated_at = NOW()
  RETURNING id
)
INSERT INTO plan_limits (
  plan_id,
  max_outlets,
  max_users,
  max_customers,
  max_reminders_per_month,
  max_whatsapp_sessions,
  allow_campaigns,
  allow_loyalty,
  allow_exports,
  allow_multi_outlet
)
SELECT id, 1, 2, 300, 150, 1, FALSE, FALSE, FALSE, FALSE FROM free_plan
ON CONFLICT (plan_id) DO UPDATE SET
  max_outlets = EXCLUDED.max_outlets,
  max_users = EXCLUDED.max_users,
  max_customers = EXCLUDED.max_customers,
  max_reminders_per_month = EXCLUDED.max_reminders_per_month,
  max_whatsapp_sessions = EXCLUDED.max_whatsapp_sessions,
  allow_campaigns = EXCLUDED.allow_campaigns,
  allow_loyalty = EXCLUDED.allow_loyalty,
  allow_exports = EXCLUDED.allow_exports,
  allow_multi_outlet = EXCLUDED.allow_multi_outlet,
  updated_at = NOW();

WITH target_plan AS (
  SELECT id FROM plans WHERE code = 'pro'
)
INSERT INTO plan_limits (
  plan_id,
  max_outlets,
  max_users,
  max_customers,
  max_reminders_per_month,
  max_whatsapp_sessions,
  allow_campaigns,
  allow_loyalty,
  allow_exports,
  allow_multi_outlet
)
SELECT id, 3, 5, 3000, 1500, 2, TRUE, TRUE, TRUE, TRUE FROM target_plan
ON CONFLICT (plan_id) DO UPDATE SET
  max_outlets = EXCLUDED.max_outlets,
  max_users = EXCLUDED.max_users,
  max_customers = EXCLUDED.max_customers,
  max_reminders_per_month = EXCLUDED.max_reminders_per_month,
  max_whatsapp_sessions = EXCLUDED.max_whatsapp_sessions,
  allow_campaigns = EXCLUDED.allow_campaigns,
  allow_loyalty = EXCLUDED.allow_loyalty,
  allow_exports = EXCLUDED.allow_exports,
  allow_multi_outlet = EXCLUDED.allow_multi_outlet,
  updated_at = NOW();

WITH target_plan AS (
  SELECT id FROM plans WHERE code = 'plus'
)
INSERT INTO plan_limits (
  plan_id,
  max_outlets,
  max_users,
  max_customers,
  max_reminders_per_month,
  max_whatsapp_sessions,
  allow_campaigns,
  allow_loyalty,
  allow_exports,
  allow_multi_outlet
)
SELECT id, 10, 25, 50000, 10000, 10, TRUE, TRUE, TRUE, TRUE FROM target_plan
ON CONFLICT (plan_id) DO UPDATE SET
  max_outlets = EXCLUDED.max_outlets,
  max_users = EXCLUDED.max_users,
  max_customers = EXCLUDED.max_customers,
  max_reminders_per_month = EXCLUDED.max_reminders_per_month,
  max_whatsapp_sessions = EXCLUDED.max_whatsapp_sessions,
  allow_campaigns = EXCLUDED.allow_campaigns,
  allow_loyalty = EXCLUDED.allow_loyalty,
  allow_exports = EXCLUDED.allow_exports,
  allow_multi_outlet = EXCLUDED.allow_multi_outlet,
  updated_at = NOW();
