package ownercommands

import "balikcukur/internal/modules/shifts"

type CustomerMatch struct {
	FullName        string `json:"full_name"`
	PhoneNumber     string `json:"phone_number"`
	PreferredBarber string `json:"preferred_barber"`
	TotalVisits     int    `json:"total_visits"`
}

type ExecuteInput struct {
	Command       string `json:"command"`
	ActorRole     string `json:"actor_role"`
	ActorUserID   string `json:"actor_user_id"`
	ActorFullName string `json:"actor_full_name"`
}

type Result struct {
	Action         string          `json:"action"`
	Message        string          `json:"message"`
	Output         string          `json:"output,omitempty"`
	CommandPreview string          `json:"command_preview"`
	Day            string          `json:"day,omitempty"`
	CreatedShift   *shifts.Shift   `json:"created_shift,omitempty"`
	Shifts         []shifts.Shift  `json:"shifts,omitempty"`
	CanceledCount  int64           `json:"canceled_count,omitempty"`
	QueueWaiting   int             `json:"queue_waiting,omitempty"`
	QueueServing   int             `json:"queue_serving,omitempty"`
	QueueURL       string          `json:"queue_url,omitempty"`
	Barbers        []string        `json:"barbers,omitempty"`
	Customers      []CustomerMatch `json:"customers,omitempty"`
}
