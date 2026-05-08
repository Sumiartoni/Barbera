package whatsapp

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"balikcukur/internal/modules/barbers"
	"balikcukur/internal/modules/queue"
)

const (
	customerActionQueueLink       = "menu:queue_link"
	customerActionChooseService   = "menu:choose_service"
	customerActionChooseBarber    = "menu:choose_barber"
	customerActionAvailableBarber = "menu:available_barbers"
	customerActionContactAdmin    = "menu:contact_admin"
	customerActionMenuHome        = "menu:home"
	customerActionServicePrefix   = "service:"
	customerActionBarberPrefix    = "barber:"
	customerActionServiceNextPage = "service:page:next:"
	customerActionServicePrevPage = "service:page:prev:"
	customerActionBarberNextPage  = "barber:page:next:"
	customerActionBarberPrevPage  = "barber:page:prev:"
)

type customerThread struct {
	PhoneNumber string
	CustomerID  string
	State       string
	Metadata    customerThreadMetadata
}

type customerThreadMetadata struct {
	ServiceOptions      []customerServiceOption `json:"service_options,omitempty"`
	BarberOptions       []customerBarberOption  `json:"barber_options,omitempty"`
	SelectedServiceID   string                  `json:"selected_service_id,omitempty"`
	SelectedServiceName string                  `json:"selected_service_name,omitempty"`
	ServicePage         int                     `json:"service_page,omitempty"`
	BarberPage          int                     `json:"barber_page,omitempty"`
}

type customerServiceOption struct {
	Index       int    `json:"index"`
	ServiceID   string `json:"service_id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type customerBarberOption struct {
	Index    int    `json:"index"`
	BarberID string `json:"barber_id"`
	Name     string `json:"name"`
	OnShift  bool   `json:"on_shift"`
}

func (s *Service) handleIncomingCustomerMessage(ctx context.Context, tenantID string, config Config, input IncomingOwnerMessageInput) (IncomingOwnerMessageResult, error) {
	if strings.TrimSpace(input.SenderNumber) == "" {
		return IncomingOwnerMessageResult{Handled: false}, nil
	}

	customerID, customerName, found, err := s.findCustomerByPhone(ctx, tenantID, input.SenderNumber)
	if err != nil {
		return IncomingOwnerMessageResult{}, err
	}
	if !found {
		customerName = deriveWhatsAppCustomerName(input.SenderNumber, input.SenderName)
	}

	thread, err := s.loadCustomerThread(ctx, tenantID, input.SenderNumber)
	if err != nil {
		return IncomingOwnerMessageResult{}, err
	}
	thread.PhoneNumber = normalizeSessionPhone(input.SenderNumber)
	if thread.CustomerID == "" {
		thread.CustomerID = customerID
	}

	text := strings.TrimSpace(input.Command)
	normalized := strings.ToUpper(text)
	if normalized == "" {
		reply, interactive := s.buildCustomerMainMenu(ctx, tenantID, config, customerName)
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, customerID, "idle", customerThreadMetadata{}); err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		return IncomingOwnerMessageResult{Handled: true, ReplyText: reply, Interactive: interactive}, nil
	}

	if normalized == "0" || normalized == "MENU" || normalized == "HALO" || normalized == "HI" || normalized == "HAI" || normalized == "BOOKING" || matchesCustomerAction(text, customerActionMenuHome) {
		reply, interactive := s.buildCustomerMainMenu(ctx, tenantID, config, customerName)
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, customerID, "idle", customerThreadMetadata{}); err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		return IncomingOwnerMessageResult{Handled: true, ReplyText: reply, Interactive: interactive}, nil
	}

	if thread.State == "awaiting_service" {
		reply, interactive, handled, err := s.handleAwaitingServiceSelection(ctx, tenantID, config, input.SenderNumber, input.SenderName, customerName, thread, text)
		if err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		if handled {
			return IncomingOwnerMessageResult{Handled: true, ReplyText: reply, Interactive: interactive}, nil
		}
	}

	if thread.State == "awaiting_barber" {
		reply, interactive, handled, err := s.handleAwaitingBarberSelection(ctx, tenantID, config, input.SenderNumber, input.SenderName, customerName, thread, text)
		if err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		if handled {
			return IncomingOwnerMessageResult{Handled: true, ReplyText: reply, Interactive: interactive}, nil
		}
	}

	if matchesCustomerAction(text, customerActionQueueLink) || normalized == "1" || normalized == "ANTRIAN" || normalized == "QUEUE" || normalized == "LINK" {
		reply, err := s.buildQueueLinkReply(ctx, tenantID, config, customerName)
		if err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, customerID, "idle", customerThreadMetadata{}); err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		return IncomingOwnerMessageResult{Handled: true, ReplyText: reply}, nil
	}
	if matchesCustomerAction(text, customerActionChooseService) || matchesCustomerAction(text, customerActionChooseBarber) || normalized == "1" || normalized == "2" || normalized == "PILIH LAYANAN" || normalized == "LAYANAN" || normalized == "PILIH BARBER" || normalized == "BARBER" {
		reply, metadata, interactive, err := s.buildServiceSelectionReply(ctx, tenantID, customerName, 0)
		if err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, customerID, "awaiting_service", metadata); err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		return IncomingOwnerMessageResult{Handled: true, ReplyText: reply, Interactive: interactive}, nil
	}
	if matchesCustomerAction(text, customerActionAvailableBarber) || normalized == "3" || normalized == "TERSEDIA" || normalized == "BARBER TERSEDIA" {
		reply, err := s.buildAvailableBarbersReply(ctx, tenantID)
		if err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, customerID, "idle", customerThreadMetadata{}); err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		return IncomingOwnerMessageResult{Handled: true, ReplyText: reply}, nil
	}
	if matchesCustomerAction(text, customerActionContactAdmin) || normalized == "4" || normalized == "ADMIN" {
		reply := s.buildAdminContactReply(config)
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, customerID, "idle", customerThreadMetadata{}); err != nil {
			return IncomingOwnerMessageResult{}, err
		}
		return IncomingOwnerMessageResult{Handled: true, ReplyText: reply}, nil
	}

	reply, interactive := s.buildCustomerMainMenu(ctx, tenantID, config, customerName)
	if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, customerID, "idle", customerThreadMetadata{}); err != nil {
		return IncomingOwnerMessageResult{}, err
	}
	return IncomingOwnerMessageResult{Handled: true, ReplyText: reply, Interactive: interactive}, nil
}

func (s *Service) handleAwaitingServiceSelection(ctx context.Context, tenantID string, config Config, senderNumber string, senderName string, customerName string, thread customerThread, text string) (string, *InteractiveReply, bool, error) {
	normalized := strings.ToLower(strings.TrimSpace(text))
	if normalized == customerActionMenuHome || normalized == "0" {
		reply, interactive := s.buildCustomerMainMenu(ctx, tenantID, config, customerName)
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "idle", customerThreadMetadata{}); err != nil {
			return "", nil, true, err
		}
		return reply, interactive, true, nil
	}

	if strings.HasPrefix(normalized, customerActionServiceNextPage) || strings.HasPrefix(normalized, customerActionServicePrevPage) {
		page, ok := parseActionPage(normalized, customerActionServiceNextPage, customerActionServicePrevPage)
		if !ok {
			return "", nil, false, nil
		}
		reply, metadata, interactive, err := s.buildServiceSelectionReply(ctx, tenantID, customerName, page)
		if err != nil {
			return "", nil, true, err
		}
		metadata.SelectedServiceID = thread.Metadata.SelectedServiceID
		metadata.SelectedServiceName = thread.Metadata.SelectedServiceName
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "awaiting_service", metadata); err != nil {
			return "", nil, true, err
		}
		return reply, interactive, true, nil
	}

	if strings.HasPrefix(normalized, customerActionServicePrefix) && !strings.HasPrefix(normalized, customerActionServiceNextPage) && !strings.HasPrefix(normalized, customerActionServicePrevPage) {
		selectedServiceID := strings.TrimSpace(strings.TrimPrefix(normalized, customerActionServicePrefix))
		for _, option := range thread.Metadata.ServiceOptions {
			if strings.EqualFold(option.ServiceID, selectedServiceID) {
				return s.transitionToBarberSelection(ctx, tenantID, thread, customerName, option)
			}
		}
	}

	selectedIndex, err := strconv.Atoi(strings.TrimSpace(text))
	if err != nil {
		return "", nil, false, nil
	}
	if selectedIndex <= 0 {
		reply, interactive := s.buildCustomerMainMenu(ctx, tenantID, config, customerName)
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "idle", customerThreadMetadata{}); err != nil {
			return "", nil, true, err
		}
		return reply, interactive, true, nil
	}

	for _, option := range thread.Metadata.ServiceOptions {
		if option.Index != selectedIndex {
			continue
		}
		return s.transitionToBarberSelection(ctx, tenantID, thread, customerName, option)
	}

	reply, metadata, interactive, err := s.buildServiceSelectionReply(ctx, tenantID, customerName, thread.Metadata.ServicePage)
	if err != nil {
		return "", nil, true, err
	}
	if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "awaiting_service", metadata); err != nil {
		return "", nil, true, err
	}
	return reply, interactive, true, nil
}

func (s *Service) handleAwaitingBarberSelection(ctx context.Context, tenantID string, config Config, senderNumber string, senderName string, customerName string, thread customerThread, text string) (string, *InteractiveReply, bool, error) {
	normalized := strings.ToLower(strings.TrimSpace(text))
	if normalized == customerActionMenuHome || normalized == "0" {
		reply, interactive := s.buildCustomerMainMenu(ctx, tenantID, config, customerName)
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "idle", customerThreadMetadata{}); err != nil {
			return "", nil, true, err
		}
		return reply, interactive, true, nil
	}

	if strings.HasPrefix(normalized, customerActionBarberNextPage) || strings.HasPrefix(normalized, customerActionBarberPrevPage) {
		page, ok := parseActionPage(normalized, customerActionBarberNextPage, customerActionBarberPrevPage)
		if !ok {
			return "", nil, false, nil
		}
		reply, metadata, interactive, err := s.buildBarberSelectionReply(ctx, tenantID, customerName, thread.Metadata.SelectedServiceID, thread.Metadata.SelectedServiceName, page)
		if err != nil {
			return "", nil, true, err
		}
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "awaiting_barber", metadata); err != nil {
			return "", nil, true, err
		}
		return reply, interactive, true, nil
	}

	if strings.HasPrefix(normalized, customerActionBarberPrefix) && !strings.HasPrefix(normalized, customerActionBarberNextPage) && !strings.HasPrefix(normalized, customerActionBarberPrevPage) {
		selectedBarberID := strings.TrimSpace(strings.TrimPrefix(normalized, customerActionBarberPrefix))
		for _, option := range thread.Metadata.BarberOptions {
			if strings.EqualFold(option.BarberID, selectedBarberID) {
				return s.createQueueForBarberSelection(ctx, tenantID, senderNumber, senderName, customerName, thread, option)
			}
		}
	}

	selectedIndex, err := strconv.Atoi(strings.TrimSpace(text))
	if err != nil {
		return "", nil, false, nil
	}
	if selectedIndex <= 0 {
		reply, interactive := s.buildCustomerMainMenu(ctx, tenantID, config, customerName)
		if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "idle", customerThreadMetadata{}); err != nil {
			return "", nil, true, err
		}
		return reply, interactive, true, nil
	}

	for _, option := range thread.Metadata.BarberOptions {
		if option.Index != selectedIndex {
			continue
		}
		return s.createQueueForBarberSelection(ctx, tenantID, senderNumber, senderName, customerName, thread, option)
	}

	reply, metadata, interactive, err := s.buildBarberSelectionReply(ctx, tenantID, customerName, thread.Metadata.SelectedServiceID, thread.Metadata.SelectedServiceName, thread.Metadata.BarberPage)
	if err != nil {
		return "", nil, true, err
	}
	if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "awaiting_barber", metadata); err != nil {
		return "", nil, true, err
	}
	return reply, interactive, true, nil
}

func (s *Service) createQueueForBarberSelection(ctx context.Context, tenantID string, senderNumber string, senderName string, customerName string, thread customerThread, option customerBarberOption) (string, *InteractiveReply, bool, error) {
	customerID := strings.TrimSpace(thread.CustomerID)
	if customerID == "" {
		var err error
		customerID, customerName, err = s.ensureCustomerByPhone(ctx, tenantID, senderNumber, senderName)
		if err != nil {
			return "", nil, true, err
		}
		thread.CustomerID = customerID
	}

	ticket, err := s.queue.Create(ctx, tenantID, queue.CreateInput{
		CustomerID:        customerID,
		PreferredBarberID: option.BarberID,
		Source:            "whatsapp",
		ServiceSummary:    queueServiceSummary(thread.Metadata.SelectedServiceName),
		Notes:             "Auto-created from WhatsApp customer flow",
	})
	if err != nil {
		return "", nil, true, fmt.Errorf("create queue from whatsapp: %w", err)
	}

	_, queueLink, err := s.queue.PublicLinkByTenantID(ctx, tenantID)
	if err != nil {
		queueLink = ""
	}

	replyLines := []string{
		fmt.Sprintf("Siap %s, permintaan antrean Anda untuk barber %s sudah dicatat.", customerName, option.Name),
		fmt.Sprintf("Nomor antrean Anda: #%02d", ticket.QueueNumber),
	}
	if queueLink != "" {
		replyLines = append(replyLines, "Pantau antrean live di sini: "+queueLink)
	}
	replyLines = append(replyLines, "Kalau ingin kembali ke menu, balas MENU.")

	if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, customerID, "idle", customerThreadMetadata{}); err != nil {
		return "", nil, true, err
	}
	return strings.Join(replyLines, "\n"), nil, true, nil
}

func (s *Service) buildCustomerMainMenu(ctx context.Context, tenantID string, config Config, customerName string) (string, *InteractiveReply) {
	name := strings.TrimSpace(customerName)
	if name == "" {
		name = "Kak"
	}
	_, queueLink, _ := s.queue.PublicLinkByTenantID(ctx, tenantID)
	lines := []string{
		fmt.Sprintf("Halo %s, selamat datang di BARBERA.", name),
		"Pilih kebutuhan Anda lewat tombol di bawah.",
	}
	if queueLink != "" {
		lines = append(lines, "Link antrean live: "+queueLink)
	}
	if adminNumber := strings.TrimSpace(config.LinkedNumber); adminNumber != "" {
		lines = append(lines, "Nomor admin: "+adminNumber)
	}
	lines = append(lines, "Kalau tombol belum muncul, balas MENU untuk memuat ulang.")

	buttons := []InteractiveReplyButton{
		{Kind: "quick_reply", ID: customerActionChooseService, Title: "Pilih layanan"},
		{Kind: "quick_reply", ID: customerActionAvailableBarber, Title: "Barber aktif"},
	}
	if queueLink != "" {
		buttons = append(buttons, InteractiveReplyButton{Kind: "url", Title: "Lihat antrean", URL: queueLink})
	} else if phone := normalizeSessionPhone(config.LinkedNumber); phone != "" {
		buttons = append(buttons, InteractiveReplyButton{Kind: "call", Title: "Hubungi admin", Phone: phone})
	} else {
		buttons = append(buttons, InteractiveReplyButton{Kind: "quick_reply", ID: customerActionContactAdmin, Title: "Hubungi admin"})
	}

	return strings.Join(lines, "\n"), &InteractiveReply{
		Type:        "template_buttons",
		Title:       "Menu Cepat Barbera",
		Description: fmt.Sprintf("Halo %s, pilih kebutuhan Anda tanpa perlu mengetik.", name),
		Footer:      "Setup cepat 5 menit, customer tinggal tap tombol yang dibutuhkan.",
		Buttons:     buttons,
	}
}

func (s *Service) buildQueueLinkReply(ctx context.Context, tenantID string, config Config, customerName string) (string, error) {
	_, queueLink, err := s.queue.PublicLinkByTenantID(ctx, tenantID)
	if err != nil || strings.TrimSpace(queueLink) == "" {
		return "Link antrean live belum aktif. Silakan gunakan tombol hubungi admin atau minta bantuan langsung ke barbershop.", nil
	}
	message := strings.TrimSpace(config.DefaultQueueMessage)
	if message == "" {
		message = "Halo {{name}}, berikut link antrean live barbershop Anda: {{queue_link}}"
	}
	message = strings.ReplaceAll(message, "{{name}}", strings.TrimSpace(customerName))
	message = strings.ReplaceAll(message, "{{queue_link}}", queueLink)
	return message, nil
}

func (s *Service) buildAvailableBarbersReply(ctx context.Context, tenantID string) (string, error) {
	items, err := s.barbers.List(ctx, tenantID, barbers.ListOptions{})
	if err != nil {
		return "", fmt.Errorf("list barbers for whatsapp: %w", err)
	}

	active := make([]barbers.Barber, 0, len(items))
	for _, item := range items {
		if item.Status == "active" && item.IsBookable {
			active = append(active, item)
		}
	}
	if len(active) == 0 {
		return "Saat ini belum ada barber aktif yang bisa dipilih. Silakan gunakan tombol hubungi admin atau tunggu barber berikutnya aktif.", nil
	}

	lines := []string{"Barber yang tersedia:"}
	for _, item := range active {
		shiftLabel := "off shift"
		if item.OnShift {
			shiftLabel = "on shift"
		}
		lines = append(lines, fmt.Sprintf("- %s (%s)", item.FullName, shiftLabel))
	}
	lines = append(lines, "Kalau ingin booking, pilih tombol layanan di menu WhatsApp.")
	return strings.Join(lines, "\n"), nil
}

func (s *Service) buildServiceSelectionReply(ctx context.Context, tenantID string, customerName string, requestedPage int) (string, customerThreadMetadata, *InteractiveReply, error) {
	options, err := s.listActiveServiceOptions(ctx, tenantID)
	if err != nil {
		return "", customerThreadMetadata{}, nil, fmt.Errorf("list services for selection: %w", err)
	}
	if len(options) == 0 {
		return "Saat ini belum ada layanan aktif yang bisa dipilih. Silakan gunakan tombol menu utama atau hubungi admin.", customerThreadMetadata{}, nil, nil
	}

	page, start, end := pageWindow(len(options), 2, requestedPage)
	visible := options[start:end]
	metadata := customerThreadMetadata{
		ServiceOptions: options,
		ServicePage:    page,
	}
	lines := []string{
		fmt.Sprintf("Siap %s, pilih layanan dulu agar antrean dan barber yang dipilih lebih akurat.", customerName),
	}
	buttons := make([]InteractiveReplyButton, 0, 3)
	for _, option := range visible {
		lines = append(lines, fmt.Sprintf("%d. %s", option.Index, option.Name))
		if option.Description != "" {
			lines = append(lines, "   "+option.Description)
		}
		buttons = append(buttons, InteractiveReplyButton{
			Kind:  "quick_reply",
			ID:    customerActionServicePrefix + option.ServiceID,
			Title: trimButtonLabel(option.Name),
		})
	}
	appendPaginationButtons(&buttons, page, len(options), 2, customerActionServicePrevPage, customerActionServiceNextPage, "Layanan lain", "Layanan sebelumnya")
	appendMenuButton(&buttons)
	lines = append(lines, "Kalau ingin kembali, tap Menu utama.")

	return strings.Join(lines, "\n"), metadata, &InteractiveReply{
		Type:        "template_buttons",
		Title:       "Pilih Layanan",
		Description: fmt.Sprintf("Siap %s, pilih layanan yang ingin diambil.", customerName),
		Footer:      "Setelah layanan dipilih, Barbera akan menampilkan barber yang tersedia.",
		Buttons:     buttons,
	}, nil
}

func (s *Service) buildBarberSelectionReply(ctx context.Context, tenantID string, customerName string, selectedServiceID string, selectedServiceName string, requestedPage int) (string, customerThreadMetadata, *InteractiveReply, error) {
	items, err := s.barbers.List(ctx, tenantID, barbers.ListOptions{})
	if err != nil {
		return "", customerThreadMetadata{}, nil, fmt.Errorf("list barbers for selection: %w", err)
	}

	active := make([]barbers.Barber, 0, len(items))
	for _, item := range items {
		if item.Status == "active" && item.IsBookable {
			active = append(active, item)
		}
	}
	sort.SliceStable(active, func(i, j int) bool {
		if active[i].OnShift == active[j].OnShift {
			return active[i].SortOrder < active[j].SortOrder
		}
		return active[i].OnShift
	})

	if len(active) == 0 {
		return "Saat ini belum ada barber aktif yang bisa dipilih. Silakan gunakan tombol menu utama atau hubungi admin.", customerThreadMetadata{}, nil, nil
	}

	allOptions := make([]customerBarberOption, 0, len(active))
	for index, item := range active {
		allOptions = append(allOptions, customerBarberOption{
			Index:    index + 1,
			BarberID: item.ID,
			Name:     item.FullName,
			OnShift:  item.OnShift,
		})
	}
	page, start, end := pageWindow(len(allOptions), 2, requestedPage)
	visible := allOptions[start:end]
	metadata := customerThreadMetadata{
		BarberOptions:       allOptions,
		SelectedServiceID:   selectedServiceID,
		SelectedServiceName: selectedServiceName,
		BarberPage:          page,
	}
	lines := []string{
		fmt.Sprintf("Layanan dipilih: %s", queueServiceSummary(selectedServiceName)),
		fmt.Sprintf("Siap %s, sekarang pilih barber yang diinginkan.", customerName),
	}
	buttons := make([]InteractiveReplyButton, 0, 3)
	for _, option := range visible {
		shiftLabel := "off shift"
		if option.OnShift {
			shiftLabel = "on shift"
		}
		lines = append(lines, fmt.Sprintf("%d. %s (%s)", option.Index, option.Name, shiftLabel))
		buttons = append(buttons, InteractiveReplyButton{
			Kind:  "quick_reply",
			ID:    customerActionBarberPrefix + option.BarberID,
			Title: trimButtonLabel(option.Name),
		})
	}
	appendPaginationButtons(&buttons, page, len(allOptions), 2, customerActionBarberPrevPage, customerActionBarberNextPage, "Barber lain", "Barber sebelumnya")
	appendMenuButton(&buttons)
	lines = append(lines, "Kalau ingin ganti layanan atau kembali, tap Menu utama.")

	return strings.Join(lines, "\n"), metadata, &InteractiveReply{
		Type:        "template_buttons",
		Title:       "Pilih Barber",
		Description: fmt.Sprintf("Layanan %s dipilih. Sekarang pilih barber favorit Anda.", queueServiceSummary(selectedServiceName)),
		Footer:      "Setelah barber dipilih, Barbera langsung membuat antrean WhatsApp Anda.",
		Buttons:     buttons,
	}, nil
}

func (s *Service) buildAdminContactReply(config Config) string {
	number := strings.TrimSpace(config.LinkedNumber)
	if number == "" {
		return "Admin belum mengatur nomor kontak khusus. Silakan tunggu balasan manual dari barbershop."
	}
	return "Silakan hubungi admin di nomor ini: " + number
}

func (s *Service) findCustomerByPhone(ctx context.Context, tenantID string, senderNumber string) (string, string, bool, error) {
	phone := normalizeSessionPhone(senderNumber)
	if phone == "" {
		return "", "", false, fmt.Errorf("nomor customer whatsapp tidak valid")
	}

	var (
		customerID   string
		customerName string
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT id, full_name
		FROM customers
		WHERE tenant_id = $1
		  AND phone_number = $2
		LIMIT 1
	`, tenantID, phone).Scan(&customerID, &customerName)
	if err == nil {
		return customerID, customerName, true, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return "", "", false, fmt.Errorf("load customer by phone: %w", err)
	}
	return "", "", false, nil
}

func (s *Service) ensureCustomerByPhone(ctx context.Context, tenantID string, senderNumber string, senderName string) (string, string, error) {
	customerID, customerName, found, err := s.findCustomerByPhone(ctx, tenantID, senderNumber)
	if err != nil {
		return "", "", err
	}
	if found {
		return customerID, customerName, nil
	}

	phone := normalizeSessionPhone(senderNumber)
	if phone == "" {
		return "", "", fmt.Errorf("nomor customer whatsapp tidak valid")
	}
	customerName = deriveWhatsAppCustomerName(senderNumber, senderName)

	if err := s.db.QueryRowContext(ctx, `
		INSERT INTO customers (tenant_id, full_name, phone_number, notes)
		VALUES ($1, $2, $3, 'Auto-created from WhatsApp')
		RETURNING id, full_name
	`, tenantID, customerName, phone).Scan(&customerID, &customerName); err != nil {
		return "", "", fmt.Errorf("create customer from whatsapp: %w", err)
	}
	return customerID, customerName, nil
}

func deriveWhatsAppCustomerName(senderNumber string, senderName string) string {
	customerName := strings.TrimSpace(senderName)
	phone := normalizeSessionPhone(senderNumber)
	if customerName != "" {
		return customerName
	}
	if len(phone) > 4 {
		return "Pelanggan WhatsApp " + phone[len(phone)-4:]
	}
	return "Pelanggan WhatsApp"
}

func (s *Service) loadCustomerThread(ctx context.Context, tenantID string, senderNumber string) (customerThread, error) {
	phone := normalizeSessionPhone(senderNumber)
	thread := customerThread{
		PhoneNumber: phone,
		State:       "idle",
	}
	if phone == "" {
		return thread, nil
	}

	var (
		customerID string
		state      string
		rawMeta    []byte
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(customer_id::text, ''), state, metadata
		FROM whatsapp_customer_threads
		WHERE tenant_id = $1 AND phone_number = $2
		LIMIT 1
	`, tenantID, phone).Scan(&customerID, &state, &rawMeta)
	if err == sql.ErrNoRows {
		return thread, nil
	}
	if err != nil {
		return thread, fmt.Errorf("load whatsapp customer thread: %w", err)
	}

	thread.CustomerID = strings.TrimSpace(customerID)
	thread.State = strings.TrimSpace(state)
	if len(rawMeta) > 0 {
		if err := json.Unmarshal(rawMeta, &thread.Metadata); err != nil {
			return thread, fmt.Errorf("parse whatsapp customer thread metadata: %w", err)
		}
	}
	if thread.State == "" {
		thread.State = "idle"
	}
	return thread, nil
}

func (s *Service) saveCustomerThread(ctx context.Context, tenantID string, phoneNumber string, customerID string, state string, metadata customerThreadMetadata) error {
	phone := normalizeSessionPhone(phoneNumber)
	if phone == "" {
		return nil
	}
	if state == "" {
		state = "idle"
	}
	rawMeta, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("marshal whatsapp customer thread metadata: %w", err)
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO whatsapp_customer_threads (
			tenant_id,
			phone_number,
			customer_id,
			state,
			metadata,
			last_message_at,
			updated_at
		)
		VALUES ($1, $2, NULLIF($3, '')::uuid, $4, $5::jsonb, NOW(), NOW())
		ON CONFLICT (tenant_id, phone_number)
		DO UPDATE SET
			customer_id = NULLIF($3, '')::uuid,
			state = EXCLUDED.state,
			metadata = EXCLUDED.metadata,
			last_message_at = NOW(),
			updated_at = NOW()
	`, tenantID, phone, customerID, state, rawMeta)
	if err != nil {
		return fmt.Errorf("save whatsapp customer thread: %w", err)
	}
	return nil
}

func matchesCustomerAction(text string, expected string) bool {
	return strings.EqualFold(strings.TrimSpace(text), strings.TrimSpace(expected))
}

func (s *Service) transitionToBarberSelection(ctx context.Context, tenantID string, thread customerThread, customerName string, option customerServiceOption) (string, *InteractiveReply, bool, error) {
	reply, metadata, interactive, err := s.buildBarberSelectionReply(ctx, tenantID, customerName, option.ServiceID, option.Name, 0)
	if err != nil {
		return "", nil, true, err
	}
	if err := s.saveCustomerThread(ctx, tenantID, thread.PhoneNumber, thread.CustomerID, "awaiting_barber", metadata); err != nil {
		return "", nil, true, err
	}
	return reply, interactive, true, nil
}

func (s *Service) listActiveServiceOptions(ctx context.Context, tenantID string) ([]customerServiceOption, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, COALESCE(config->>'description', '')
		FROM tenant_resource_items
		WHERE tenant_id = $1
		  AND resource_type = 'service'
		  AND status = 'active'
		ORDER BY created_at ASC, name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query active services: %w", err)
	}
	defer rows.Close()

	options := make([]customerServiceOption, 0, 8)
	index := 1
	for rows.Next() {
		option := customerServiceOption{Index: index}
		if err := rows.Scan(&option.ServiceID, &option.Name, &option.Description); err != nil {
			return nil, fmt.Errorf("scan active service: %w", err)
		}
		options = append(options, option)
		index++
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate active services: %w", err)
	}
	return options, nil
}

func parseActionPage(value string, prevPrefix string, nextPrefix string) (int, bool) {
	value = strings.TrimSpace(strings.ToLower(value))
	switch {
	case strings.HasPrefix(value, nextPrefix):
		page, err := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(value, nextPrefix)))
		if err != nil {
			return 0, false
		}
		return page, true
	case strings.HasPrefix(value, prevPrefix):
		page, err := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(value, prevPrefix)))
		if err != nil {
			return 0, false
		}
		return page, true
	default:
		return 0, false
	}
}

func pageWindow(total int, pageSize int, requestedPage int) (int, int, int) {
	if pageSize <= 0 {
		pageSize = 2
	}
	maxPage := 0
	if total > 0 {
		maxPage = (total - 1) / pageSize
	}
	page := requestedPage
	if page < 0 {
		page = 0
	}
	if page > maxPage {
		page = maxPage
	}
	start := page * pageSize
	end := start + pageSize
	if end > total {
		end = total
	}
	return page, start, end
}

func appendPaginationButtons(buttons *[]InteractiveReplyButton, page int, total int, pageSize int, prevPrefix string, nextPrefix string, nextTitle string, prevTitle string) {
	if buttons == nil || len(*buttons) >= 3 || total <= pageSize {
		return
	}
	maxPage := (total - 1) / pageSize
	if page < maxPage && len(*buttons) < 3 {
		*buttons = append(*buttons, InteractiveReplyButton{
			Kind:  "quick_reply",
			ID:    fmt.Sprintf("%s%d", nextPrefix, page+1),
			Title: nextTitle,
		})
		return
	}
	if page > 0 && len(*buttons) < 3 {
		*buttons = append(*buttons, InteractiveReplyButton{
			Kind:  "quick_reply",
			ID:    fmt.Sprintf("%s%d", prevPrefix, page-1),
			Title: prevTitle,
		})
	}
}

func appendMenuButton(buttons *[]InteractiveReplyButton) {
	if buttons == nil || len(*buttons) >= 3 {
		return
	}
	*buttons = append(*buttons, InteractiveReplyButton{
		Kind:  "quick_reply",
		ID:    customerActionMenuHome,
		Title: "Menu utama",
	})
}

func queueServiceSummary(selectedServiceName string) string {
	selectedServiceName = strings.TrimSpace(selectedServiceName)
	if selectedServiceName == "" {
		return "Potong Rambut via WhatsApp"
	}
	return selectedServiceName
}

func trimButtonLabel(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 20 {
		return value
	}
	return strings.TrimSpace(value[:17]) + "..."
}
