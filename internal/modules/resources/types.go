package resources

import "time"

type ResourceItem struct {
	ID           string         `json:"id"`
	TenantID     string         `json:"tenant_id,omitempty"`
	ResourceType string         `json:"resource_type"`
	ResourceKey  string         `json:"resource_key,omitempty"`
	Name         string         `json:"name"`
	Status       string         `json:"status"`
	Config       map[string]any `json:"config"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

type ResourceInput struct {
	ResourceKey string         `json:"resource_key"`
	Name        string         `json:"name"`
	Status      string         `json:"status"`
	Config      map[string]any `json:"config"`
}
