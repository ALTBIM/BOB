# Luado MVP (Phase 1)

Deterministic Luado automation using:

- Gmail polling
- Regex parser only
- Postgres
- Telegram polling + inline callbacks
- Google Calendar (only after approve)

No LLM calls, no paid API requirements, no webhooks, no Pub/Sub.

## Required env vars

- `DATABASE_URL` (or `LUADO_DATABASE_URL`)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `LUADO_TELEGRAM_CHAT_ID`

Optional:

- `LUADO_GMAIL_USER` (default `me`)
- `LUADO_GMAIL_QUERY` (default `from:hei@luado.no newer_than:30d -label:ops/processed`)
- `LUADO_GMAIL_LABEL` (default `ops/processed`)
- `LUADO_GMAIL_POLL_MS` (default `300000`)
- `LUADO_CALENDAR_ID` (default Luado calendar id from spec)

## Run

```bash
npm install
npm run luado:start
```

## Tests

```bash
npm test
```
