package whatsapp

import "time"

type Config struct {
	LinkedNumber          string `json:"linked_number"`
	LinkedName            string `json:"linked_name"`
	OwnerCommandsEnabled  bool   `json:"owner_commands_enabled"`
	AndroidWebhookURL     string `json:"android_webhook_url"`
	AndroidWebhookSecret  string `json:"android_webhook_secret"`
	DefaultQueueMessage   string `json:"default_queue_message"`
	DefaultReminderFooter string `json:"default_reminder_footer"`
}

type CommandLog struct {
	ID          string    `json:"id"`
	CommandText string    `json:"command_text"`
	Action      string    `json:"action"`
	Status      string    `json:"status"`
	Source      string    `json:"source"`
	OutputText  string    `json:"output_text"`
	CreatedAt   time.Time `json:"created_at"`
}

type Overview struct {
	Config         Config       `json:"config"`
	Session        SessionState `json:"session"`
	CommandCatalog []string     `json:"command_catalog"`
	RecentLogs     []CommandLog `json:"recent_logs"`
}

type SessionState struct {
	Status           string     `json:"status"`
	SessionMode      string     `json:"session_mode"`
	PhoneNumber      string     `json:"phone_number"`
	BusinessName     string     `json:"business_name"`
	DeviceJID        string     `json:"device_jid"`
	PairingCode      string     `json:"pairing_code"`
	PairingQR        string     `json:"pairing_qr"`
	PairingExpiresAt *time.Time `json:"pairing_expires_at,omitempty"`
	LastConnectedAt  *time.Time `json:"last_connected_at,omitempty"`
	LastSeenAt       *time.Time `json:"last_seen_at,omitempty"`
	LastMessageAt    *time.Time `json:"last_message_at,omitempty"`
	LastError        string     `json:"last_error"`
	IsConnected      bool       `json:"is_connected"`
	IsLoggedIn       bool       `json:"is_logged_in"`
}

type ExecuteInput struct {
	Command     string `json:"command"`
	ActorRole   string `json:"actor_role"`
	ActorUserID string `json:"actor_user_id"`
	ActorName   string `json:"actor_name"`
	Source      string `json:"source"`
}

type ForwarderInput struct {
	Secret       string `json:"secret"`
	Command      string `json:"command"`
	SenderNumber string `json:"sender_number"`
	ActorName    string `json:"actor_name"`
}

type PairPhoneInput struct {
	PhoneNumber string `json:"phone_number"`
}

type IncomingOwnerMessageInput struct {
	SenderNumber  string
	SenderName    string
	Command       string
	IsSelfCommand bool
}

type InteractiveReply struct {
	Type        string                    `json:"type"`
	Title       string                    `json:"title,omitempty"`
	Description string                    `json:"description,omitempty"`
	ButtonText  string                    `json:"button_text,omitempty"`
	Footer      string                    `json:"footer,omitempty"`
	Sections    []InteractiveReplySection `json:"sections,omitempty"`
	Buttons     []InteractiveReplyButton  `json:"buttons,omitempty"`
}

type InteractiveReplySection struct {
	Title   string                   `json:"title,omitempty"`
	Options []InteractiveReplyOption `json:"options,omitempty"`
}

type InteractiveReplyOption struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

type InteractiveReplyButton struct {
	Kind  string `json:"kind"`
	ID    string `json:"id,omitempty"`
	Title string `json:"title"`
	URL   string `json:"url,omitempty"`
	Phone string `json:"phone,omitempty"`
}

type IncomingOwnerMessageResult struct {
	Handled     bool
	ReplyText   string
	Interactive *InteractiveReply
}

type SendTestInput struct {
	PhoneNumber string `json:"phone_number"`
	Message     string `json:"message"`
}
