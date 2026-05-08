package whatsapp

import (
	"context"
	"fmt"
	"strings"
)

func (s *Service) StartQRPairing(ctx context.Context, tenantID string) (SessionState, error) {
	if s.sessions == nil {
		return SessionState{}, fmt.Errorf("session WhatsApp belum siap")
	}
	return s.sessions.StartQRPairing(ctx, tenantID)
}

func (s *Service) PairPhone(ctx context.Context, tenantID string, input PairPhoneInput) (SessionState, error) {
	if s.sessions == nil {
		return SessionState{}, fmt.Errorf("session WhatsApp belum siap")
	}
	return s.sessions.PairPhone(ctx, tenantID, input.PhoneNumber)
}

func (s *Service) ConnectSession(ctx context.Context, tenantID string) (SessionState, error) {
	if s.sessions == nil {
		return SessionState{}, fmt.Errorf("session WhatsApp belum siap")
	}
	return s.sessions.ConnectExisting(ctx, tenantID)
}

func (s *Service) DisconnectSession(ctx context.Context, tenantID string) (SessionState, error) {
	if s.sessions == nil {
		return SessionState{}, fmt.Errorf("session WhatsApp belum siap")
	}
	return s.sessions.Disconnect(ctx, tenantID)
}

func (s *Service) SendTestMessage(ctx context.Context, tenantID string, input SendTestInput) (SessionState, error) {
	if s.sessions == nil {
		return SessionState{}, fmt.Errorf("session WhatsApp belum siap")
	}
	message := strings.TrimSpace(input.Message)
	if message == "" {
		message = "Tes koneksi WhatsApp BARBERA berhasil."
	}
	return s.sessions.SendTestMessage(ctx, tenantID, input.PhoneNumber, message)
}
