package customers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context, tenantID string, filters ListFilters) ([]Customer, error) {
	limit := filters.Limit
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	query := strings.TrimSpace(filters.Query)
	searchTerm := "%"
	if query != "" {
		searchTerm = "%" + strings.ToLower(query) + "%"
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			c.id,
			c.tenant_id,
			c.full_name,
			c.phone_number,
			COALESCE(c.preferred_barber_id::text, ''),
			COALESCE(b.full_name, c.preferred_barber, ''),
			c.notes,
			c.last_visit_at,
			c.total_visits,
			c.total_spent_idr,
			c.created_at,
			c.updated_at
		FROM customers c
		LEFT JOIN barbers b ON b.id = c.preferred_barber_id
		WHERE c.tenant_id = $1
		  AND (
			$2 = '%'
			OR LOWER(c.full_name) LIKE $2
			OR LOWER(c.phone_number) LIKE $2
			OR LOWER(COALESCE(b.full_name, c.preferred_barber, '')) LIKE $2
		  )
		ORDER BY c.last_visit_at DESC NULLS LAST, c.created_at DESC
		LIMIT $3
	`, tenantID, searchTerm, limit)
	if err != nil {
		return nil, fmt.Errorf("query customers: %w", err)
	}
	defer rows.Close()

	customers := make([]Customer, 0, limit)
	for rows.Next() {
		record, err := scanCustomer(rows)
		if err != nil {
			return nil, err
		}
		customers = append(customers, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate customers: %w", err)
	}

	return customers, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, input CreateInput) (Customer, error) {
	fullName := strings.TrimSpace(input.FullName)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	preferredBarberID := strings.TrimSpace(input.PreferredBarberID)
	preferredBarber := strings.TrimSpace(input.PreferredBarber)
	notes := strings.TrimSpace(input.Notes)

	if tenantID == "" || fullName == "" || phoneNumber == "" {
		return Customer{}, ErrValidation
	}

	if preferredBarberID != "" {
		err := s.db.QueryRowContext(ctx, `
			SELECT full_name
			FROM barbers
			WHERE tenant_id = $1 AND id = $2
			LIMIT 1
		`, tenantID, preferredBarberID).Scan(&preferredBarber)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return Customer{}, ErrValidation
			}
			return Customer{}, fmt.Errorf("load preferred barber: %w", err)
		}
	}

	record := Customer{}
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO customers (
			tenant_id,
			full_name,
			phone_number,
			preferred_barber_id,
			preferred_barber,
			notes
		)
		VALUES ($1, $2, $3, NULLIF($4, '')::uuid, $5, $6)
		RETURNING
			id,
			tenant_id,
			full_name,
			phone_number,
			COALESCE(preferred_barber_id::text, ''),
			preferred_barber,
			notes,
			last_visit_at,
			total_visits,
			total_spent_idr,
			created_at,
			updated_at
	`, tenantID, fullName, phoneNumber, preferredBarberID, preferredBarber, notes).Scan(
		&record.ID,
		&record.TenantID,
		&record.FullName,
		&record.PhoneNumber,
		&record.PreferredBarberID,
		&record.PreferredBarberName,
		&record.Notes,
		nullTime(&record.LastVisitAt),
		&record.TotalVisits,
		&record.TotalSpentIDR,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "customers_tenant_id_phone_number_key") {
			return Customer{}, ErrPhoneInUse
		}
		return Customer{}, fmt.Errorf("insert customer: %w", err)
	}
	record.PreferredBarber = record.PreferredBarberName

	return record, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID string, customerID string) (Customer, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT
			c.id,
			c.tenant_id,
			c.full_name,
			c.phone_number,
			COALESCE(c.preferred_barber_id::text, ''),
			COALESCE(b.full_name, c.preferred_barber, ''),
			c.notes,
			c.last_visit_at,
			c.total_visits,
			c.total_spent_idr,
			c.created_at,
			c.updated_at
		FROM customers c
		LEFT JOIN barbers b ON b.id = c.preferred_barber_id
		WHERE c.tenant_id = $1 AND c.id = $2
		LIMIT 1
	`, tenantID, customerID)

	record, err := scanCustomer(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Customer{}, ErrCustomerAbsent
		}
		return Customer{}, err
	}

	return record, nil
}

func (s *Service) Update(ctx context.Context, tenantID string, customerID string, input UpdateInput) (Customer, error) {
	fullName := strings.TrimSpace(input.FullName)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	preferredBarberID := strings.TrimSpace(input.PreferredBarberID)
	preferredBarber := strings.TrimSpace(input.PreferredBarber)
	notes := strings.TrimSpace(input.Notes)

	if tenantID == "" || customerID == "" || fullName == "" || phoneNumber == "" {
		return Customer{}, ErrValidation
	}

	if preferredBarberID != "" {
		err := s.db.QueryRowContext(ctx, `
			SELECT full_name
			FROM barbers
			WHERE tenant_id = $1 AND id = $2
			LIMIT 1
		`, tenantID, preferredBarberID).Scan(&preferredBarber)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return Customer{}, ErrValidation
			}
			return Customer{}, fmt.Errorf("load preferred barber: %w", err)
		}
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE customers
		SET full_name = $3,
			phone_number = $4,
			preferred_barber_id = NULLIF($5, '')::uuid,
			preferred_barber = $6,
			notes = $7,
			updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, customerID, fullName, phoneNumber, preferredBarberID, preferredBarber, notes)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "customers_tenant_id_phone_number_key") {
			return Customer{}, ErrPhoneInUse
		}
		return Customer{}, fmt.Errorf("update customer: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Customer{}, fmt.Errorf("customer rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return Customer{}, ErrCustomerAbsent
	}

	return s.GetByID(ctx, tenantID, customerID)
}

type customerScanner interface {
	Scan(dest ...any) error
}

func scanCustomer(scanner customerScanner) (Customer, error) {
	var (
		record      Customer
		lastVisitAt sql.NullTime
	)

	err := scanner.Scan(
		&record.ID,
		&record.TenantID,
		&record.FullName,
		&record.PhoneNumber,
		&record.PreferredBarberID,
		&record.PreferredBarberName,
		&record.Notes,
		&lastVisitAt,
		&record.TotalVisits,
		&record.TotalSpentIDR,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return Customer{}, fmt.Errorf("scan customer: %w", err)
	}

	if lastVisitAt.Valid {
		value := lastVisitAt.Time.UTC()
		record.LastVisitAt = &value
	}
	if record.PreferredBarberName == "" {
		record.PreferredBarberName = record.PreferredBarber
	}
	record.PreferredBarber = record.PreferredBarberName

	return record, nil
}

func nullTime(target **time.Time) any {
	return &sqlNullTimeTarget{target: target}
}

type sqlNullTimeTarget struct {
	target **time.Time
}

func (n *sqlNullTimeTarget) Scan(value any) error {
	if value == nil {
		*n.target = nil
		return nil
	}

	switch typed := value.(type) {
	case time.Time:
		v := typed.UTC()
		*n.target = &v
		return nil
	default:
		return fmt.Errorf("unsupported time value %T", value)
	}
}
