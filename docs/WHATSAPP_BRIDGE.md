# WhatsApp Web bridge

TalkoCRM runs one persistent WhatsApp Web session per `WhatsApp instance` in the private `whatsapp-bridge` service. The bridge uses Baileys, stores encrypted session state in the `whatsapp_auth` Docker volume, and posts status/message events back to the CRM. This is an unofficial WhatsApp Web integration; use the official WhatsApp Cloud API if your compliance or account policy requires Meta-supported automation.

## Admin flow

1. Sign in as an organization admin and open **WhatsApp instances**.
2. Add one instance for each employee and click **Connect**.
3. The admin page polls while the bridge starts and displays that instance's QR code.
4. On the matching employee phone, open WhatsApp → **Linked devices** → **Link a device**, then scan the QR code.
5. The status changes to **Connected** and incoming/outgoing text messages are stored against that employee's instance.

The QR code is short-lived and private to the instance. Never share screenshots of it. The bridge must have a stable Docker volume; deleting `whatsapp_auth` logs every number out.

## Production configuration

Set these values in `.env.production` before starting the stack:

```dotenv
WHATSAPP_BRIDGE_URL=http://whatsapp-bridge:3001
WHATSAPP_BRIDGE_TOKEN=<long-random-secret-shared-only-by-compose-services>
WHATSAPP_BRIDGE_TIMEOUT_SECONDS=15
```

The bridge is only reachable on the internal Compose network. It is not published through Caddy or exposed as a public port.

## Webhook contract

The bridge sends the following requests to the backend webhook. The backend stores the token encrypted at rest and also keeps a one-way hash for request verification.

The endpoint is:

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

Only admins can create, connect, pause, remove, or inspect instances and messages. The token is never returned by list or detail endpoints; rotate it from the admin view if it is exposed. The bridge API token is separate and must never be shown in the browser.
