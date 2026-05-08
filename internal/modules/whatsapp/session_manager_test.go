package whatsapp

import (
	"testing"

	waE2E "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func TestExtractTextMessagePrefersInteractiveIDs(t *testing.T) {
	t.Run("buttons response", func(t *testing.T) {
		evt := &events.Message{
			Message: &waE2E.Message{
				ButtonsResponseMessage: &waE2E.ButtonsResponseMessage{
					SelectedButtonID: proto.String(customerActionQueueLink),
				},
			},
		}

		got := extractTextMessage(evt)
		if got != customerActionQueueLink {
			t.Fatalf("expected %q, got %q", customerActionQueueLink, got)
		}
	})

	t.Run("list response", func(t *testing.T) {
		evt := &events.Message{
			Message: &waE2E.Message{
				ListResponseMessage: &waE2E.ListResponseMessage{
					SingleSelectReply: &waE2E.ListResponseMessage_SingleSelectReply{
						SelectedRowID: proto.String(customerActionBarberPrefix + "barber-123"),
					},
				},
			},
		}

		got := extractTextMessage(evt)
		want := customerActionBarberPrefix + "barber-123"
		if got != want {
			t.Fatalf("expected %q, got %q", want, got)
		}
	})
}

func TestBuildInteractiveReplyMessageList(t *testing.T) {
	result := IncomingOwnerMessageResult{
		Handled:   true,
		ReplyText: "Halo, pilih menu",
		Interactive: &InteractiveReply{
			Type:        "list",
			Title:       "Menu Cepat",
			Description: "Pilih tanpa mengetik",
			ButtonText:  "Pilih Menu",
			Footer:      "Barbera",
			Sections: []InteractiveReplySection{
				{
					Title: "Pilihan",
					Options: []InteractiveReplyOption{
						{ID: customerActionQueueLink, Title: "Link antrean", Description: "Lihat antrean live"},
						{ID: customerActionChooseBarber, Title: "Pilih barber"},
					},
				},
			},
		},
	}

	msg, err := buildInteractiveReplyMessage(result)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if msg.GetListMessage() == nil {
		t.Fatal("expected list message to be built")
	}
	if got := msg.GetListMessage().GetButtonText(); got != "Pilih Menu" {
		t.Fatalf("expected button text %q, got %q", "Pilih Menu", got)
	}
	if len(msg.GetListMessage().GetSections()) != 1 {
		t.Fatalf("expected 1 section, got %d", len(msg.GetListMessage().GetSections()))
	}
	if len(msg.GetListMessage().GetSections()[0].GetRows()) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(msg.GetListMessage().GetSections()[0].GetRows()))
	}
	if got := msg.GetListMessage().GetSections()[0].GetRows()[0].GetRowID(); got != customerActionQueueLink {
		t.Fatalf("expected first row id %q, got %q", customerActionQueueLink, got)
	}
}

func TestBuildInteractiveReplyMessageTemplateButtons(t *testing.T) {
	result := IncomingOwnerMessageResult{
		Handled:   true,
		ReplyText: "Pilih layanan",
		Interactive: &InteractiveReply{
			Type:        "template_buttons",
			Title:       "Menu Cepat",
			Description: "Pilih tanpa mengetik",
			Footer:      "Barbera",
			Buttons: []InteractiveReplyButton{
				{Kind: "quick_reply", ID: customerActionChooseService, Title: "Pilih layanan"},
				{Kind: "quick_reply", ID: customerActionAvailableBarber, Title: "Barber aktif"},
				{Kind: "url", Title: "Lihat antrean", URL: "https://example.com/q/demo"},
			},
		},
	}

	msg, err := buildInteractiveReplyMessage(result)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if msg.GetTemplateMessage() == nil {
		t.Fatal("expected template message to be built")
	}
	template := msg.GetTemplateMessage().GetHydratedTemplate()
	if template == nil {
		t.Fatal("expected hydrated template to be set")
	}
	if got := template.GetHydratedTitleText(); got != "Menu Cepat" {
		t.Fatalf("expected title %q, got %q", "Menu Cepat", got)
	}
	if len(template.GetHydratedButtons()) != 3 {
		t.Fatalf("expected 3 buttons, got %d", len(template.GetHydratedButtons()))
	}
	first := template.GetHydratedButtons()[0].GetQuickReplyButton()
	if first == nil || first.GetID() != customerActionChooseService {
		t.Fatalf("expected first quick reply id %q", customerActionChooseService)
	}
	last := template.GetHydratedButtons()[2].GetUrlButton()
	if last == nil || last.GetURL() != "https://example.com/q/demo" {
		t.Fatal("expected url button to be preserved")
	}
}
