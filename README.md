# Night

Night is a private WhatsApp assistant. **Cortex** is its private control plane.

This repository is the source of truth for Night Core, Cortex APIs, pairing/session infrastructure, hot-loaded commands/utilities, AI routing, media/storage pipelines, and integration tests.

## Core rules

- Default deny: Night only acts in explicitly allowed chats.
- The owner does **not** bypass a disabled chat except for access-control bootstrap commands.
- WhatsApp socket identity is separate from user permission.
- Multiple paired numbers can be assigned roles (split or all-on-one) with controlled fallback.
- Persistent services (WhatsApp sockets, DB, Blob/AI clients) are not recreated by command/util hot reloads.
- Secrets never appear in Cortex responses.
- Viewing Cortex Inbox is passive; sending is explicit.
- View-once is normalized as a special wrapper and is not automatically archived.
- Lia's Baileys fork is pinned to `0.3.18-final`.

## Current bootstrap

Implemented in the first kernel:

- dynamic config/ENV registry with secret masking and Groq key-pool counts
- strict access controller
- multi-session role manager with sticky controlled fallback
- per-session pairing attempt lock
- Baileys runtime session manager with bounded reconnect scheduling
- hot-loaded command and utility registry with safe swap behavior
- WhatsApp message normalizer including view-once wrappers
- SQLite Inbox mirror using Node's built-in SQLite
- authenticated Cortex API for config, commands, sessions, access, inbox read/send
- AI routing skeleton
- unit tests for the invariants above

## Local start

```bash
cp .env.example .env
npm install
npm test
npm start
```

Runtime state lives under `data/` and is ignored by Git.

## Burner testing

Use a disposable WhatsApp number with no personal conversations. Keep its auth state isolated under `data/sessions/<sessionId>`, use private test chats/groups, revoke the linked device after testing if desired, and never commit session credentials.
