# OpenClaw Luado Setup

Dette er en egen mappe med Luado MVP-moduler for OpenClaw (Phase 1), laget for polling-basert drift:

- Gmail polling
- Deterministisk regex-parser
- Postgres lagring
- Telegram inline approve/reject
- Google Calendar opprettelse kun ved approve

## Struktur

- `modules/luado/` - modulene
- `.env.example` - miljøvariabler du må fylle
- `openclaw.json.example` - Telegram inline-knapp capability

## Kjøring

```bash
npm install
npm run luado:start
```

## Tester

```bash
npm test
```
