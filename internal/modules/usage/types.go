package usage

type Summary struct {
	Outlets           int `json:"outlets"`
	Customers         int `json:"customers"`
	Visits30d         int `json:"visits_30d"`
	QueueWaiting      int `json:"queue_waiting"`
	Barbers           int `json:"barbers"`
	Stations          int `json:"stations"`
	MaxOutlets        int `json:"max_outlets"`
	MaxCustomers      int `json:"max_customers"`
	MaxRemindersMonth int `json:"max_reminders_per_month"`
}
