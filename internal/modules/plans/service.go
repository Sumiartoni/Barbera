package plans

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) ListPublic(ctx context.Context) ([]PublicPlan, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			p.code,
			p.name,
			p.description,
			p.is_free,
			p.monthly_price_idr,
			p.yearly_price_idr,
			p.billing_cycle_days,
			l.max_outlets,
			l.max_users,
			l.max_customers,
			l.max_reminders_per_month,
			l.max_whatsapp_sessions,
			l.allow_campaigns,
			l.allow_loyalty,
			l.allow_exports,
			l.allow_multi_outlet
		FROM plans p
		INNER JOIN plan_limits l ON l.plan_id = p.id
		WHERE p.is_active = TRUE
		ORDER BY p.display_order ASC, p.name ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query plans: %w", err)
	}
	defer rows.Close()

	plans := make([]PublicPlan, 0)
	for rows.Next() {
		var plan PublicPlan
		if err := rows.Scan(
			&plan.Code,
			&plan.Name,
			&plan.Description,
			&plan.IsFree,
			&plan.MonthlyPriceIDR,
			&plan.YearlyPriceIDR,
			&plan.BillingCycleDays,
			&plan.MaxOutlets,
			&plan.MaxUsers,
			&plan.MaxCustomers,
			&plan.MaxRemindersPerMonth,
			&plan.MaxWhatsAppSessions,
			&plan.AllowCampaigns,
			&plan.AllowLoyalty,
			&plan.AllowExports,
			&plan.AllowMultiOutlet,
		); err != nil {
			return nil, fmt.Errorf("scan plan: %w", err)
		}
		plans = append(plans, plan)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate plans: %w", err)
	}

	return plans, nil
}

func (s *Service) Update(ctx context.Context, planCode string, input UpdatePlanInput) (PublicPlan, error) {
	if planCode == "" || input.Name == "" || input.BillingCycleDays <= 0 {
		return PublicPlan{}, fmt.Errorf("invalid plan update input")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return PublicPlan{}, fmt.Errorf("begin plan update tx: %w", err)
	}
	defer tx.Rollback()

	var planID string
	monthlyPrice := input.MonthlyPriceIDR
	yearlyPrice := input.YearlyPriceIDR
	if strings.TrimSpace(planCode) == "free" {
		monthlyPrice = 0
		yearlyPrice = 0
	}
	err = tx.QueryRowContext(ctx, `
		UPDATE plans
		SET name = $2,
			description = $3,
			monthly_price_idr = $4,
			yearly_price_idr = $5,
			billing_cycle_days = $6,
			updated_at = NOW()
		WHERE code = $1
		RETURNING id
	`, planCode, input.Name, input.Description, monthlyPrice, yearlyPrice, input.BillingCycleDays).Scan(&planID)
	if err != nil {
		return PublicPlan{}, fmt.Errorf("update plan row: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE plan_limits
		SET max_outlets = $2,
			max_users = $3,
			max_customers = $4,
			max_reminders_per_month = $5,
			max_whatsapp_sessions = $6,
			allow_campaigns = $7,
			allow_loyalty = $8,
			allow_exports = $9,
			allow_multi_outlet = $10,
			updated_at = NOW()
		WHERE plan_id = $1
	`, planID, input.MaxOutlets, input.MaxUsers, input.MaxCustomers, input.MaxRemindersPerMonth, input.MaxWhatsAppSessions, input.AllowCampaigns, input.AllowLoyalty, input.AllowExports, input.AllowMultiOutlet); err != nil {
		return PublicPlan{}, fmt.Errorf("update plan limits: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return PublicPlan{}, fmt.Errorf("commit plan update: %w", err)
	}

	items, err := s.ListPublic(ctx)
	if err != nil {
		return PublicPlan{}, err
	}
	for _, item := range items {
		if item.Code == planCode {
			return item, nil
		}
	}

	return PublicPlan{}, fmt.Errorf("updated plan %s not found after update", planCode)
}
