# Night

Night is a private WhatsApp assistant with Cortex as its control plane.

## Core status

The current core provides:

- two independent WhatsApp sessions using pinned `@itsliaaa/baileys` `0.3.18-final`
- one pairing API for either configured account (pairing code or QR)
- persistent multi-file Baileys auth under `data/sessions/<session>`
- split / one-account / fallback role routing
- strict default-deny chat access with owner-only bootstrap commands
- hot-loaded commands and utils with last-known-good rollback
- normalized inbound WhatsApp messages, including view-once wrappers
- SQLite-backed Cortex Inbox for allowed chats only
- Server-Sent Events for Cortex realtime updates
- explicit outbound Inbox sending through the selected/active WhatsApp session
- reconnect, disconnect, and logout lifecycle controls
- configuration discovery with secret masking

## Run

Node 22.5+ is required.

```bash
npm install
npm start
```

Inject environment values through your process manager/container. At minimum configure `CORTEX_API_TOKEN`, `OWNER_NUMBER`, and `WHATSAPP_SESSIONS=main,assistant`.

Runtime data is intentionally excluded from Git: `data/`, WhatsApp auth/session credentials, logs, and local environment files.

## Pairing API

All Cortex endpoints except `/health` require `Authorization: Bearer <CORTEX_API_TOKEN>`.

```text
GET    /api/cortex/pairing
GET    /api/cortex/pairing/:session
POST   /api/cortex/pairing/:session/code
POST   /api/cortex/pairing/:session/qr
DELETE /api/cortex/pairing/:session
GET    /api/cortex/events
```

Pairing-code body:

```json
{"phoneNumber":"<country-code-and-number>"}
```

QR updates can arrive through the realtime event stream or be read by polling the pairing state endpoint. New unpaired sessions do not auto-start QR pairing at server boot.

## Session controls

```text
POST /api/cortex/sessions/:session/reconnect
POST /api/cortex/sessions/:session/disconnect
POST /api/cortex/sessions/:session/logout
```

`logout` clears that session's local WhatsApp credentials. `disconnect` leaves credentials intact.

## Roles

```text
PUT /api/cortex/roles
```

Example:

```json
{
  "mode": "split",
  "inboxSession": "main",
  "aiSession": "assistant",
  "fallbackEnabled": true
}
```

Fallback is sticky: if the preferred account fails, the healthy account can temporarily acquire the role. Night does not immediately jump back mid-task when the preferred account reconnects.

## Access model

Night is default-deny. Being the owner does not automatically activate a disabled DM or group.

The owner can bootstrap access with hot-loaded commands such as `.allow`, `.disallow`, `.allowed`, and `.groups`. Cortex can also manage the allowlist through its authenticated API. Only allowed chats are written to the Cortex Inbox database.

## Tests

```bash
npm test
```

CI intentionally does not pair a real WhatsApp account. Real integration testing should use an isolated burner account and private test chats/groups.
