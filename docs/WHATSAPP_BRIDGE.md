# WhatsApp bridge contract

The CRM stores the admin control plane and message history; it does not automate WhatsApp Web itself. Run one approved WhatsApp Web/Cloud bridge session per `WhatsApp instance` and keep the bridge session key separate for every row.

When an admin creates an instance, the UI shows a webhook URL and a one-time token. Send the token in `X-WhatsApp-Token` for every request. The endpoint is:

```text
POST {PUBLIC_BASE_URL}/api/whatsapp/webhook/{instance_id}
```

Mark the session state:

```json
{
  "event": "status",
  "status": "connected",
  "phone_number": "+919999900000"
}
```

Record a message (the `external_message_id` makes retries safe):

```json
{
  "event": "message",
  "message": {
    "external_message_id": "wamid.example-123",
    "contact_phone": "+919811122233",
    "contact_name": "Ravi Kumar",
    "direction": "inbound",
    "message_type": "text",
    "body": "Please send the catalogue",
    "sent_at": "2026-09-04T10:30:00Z",
    "lead_id": null,
    "metadata": {}
  }
}
```

Only admins can create, connect, pause, remove, or inspect instances and messages. The token is hashed at rest and is never returned by list or detail endpoints; rotate it from the admin view if it is exposed.
