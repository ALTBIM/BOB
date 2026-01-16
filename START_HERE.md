# 🚀 START HER - Kjør database-migreringer

**Tid:** 2-3 minutter

---

## Steg 1: Åpne Supabase SQL Editor

Klikk på denne lenken (åpner direkt i SQL Editor):
👉 https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new

---

## Steg 2: Kopier SQL-kode

1. Åpne filen `DATABASE_MIGRATIONS.sql` i VSCode (den er allerede åpen i tabs)
2. Trykk `Ctrl+A` (velg alt)
3. Trykk `Ctrl+C` (kopier)

---

## Steg 3: Lim inn og kjør

1. Gå tilbake til Supabase SQL Editor
2. Trykk `Ctrl+V` (lim inn)
3. Klikk "Run" (eller trykk `Ctrl+Enter`)

**Vent 10-30 sekunder...**

---

## Steg 4: Verifiser

Du skal se output som:
```
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
ALTER TABLE
CREATE POLICY
...
```

Hvis du ser noen "already exists" meldinger - **det er OK!** 
Scriptet bruker `IF NOT EXISTS`.

---

## Steg 5: Si fra til meg!

Når du ser at SQL-en er ferdig kjørt, skriv bare:
- "Ferdig" eller
- "Kjørt" eller
- "Done"

Så fortsetter jeg med å teste alle API-endepunktene! 🧪

---

## 🆘 Hvis noe går galt:

**Problem: Timeout**
- Kjør SQL-en i mindre deler (se `QUICK_START_MIGRATIONS.md`)

**Problem: Permission denied**
- Sørg for at du er logget inn som database-eier

**Problem: Annet**
- Si fra, så hjelper jeg deg!

---

**Klar? Gå til Steg 1! 👆**
