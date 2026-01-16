    # Kjør Database-migreringer - Steg-for-steg guide

**Estimert tid:** 5 minutter

---

## Metode 1: Supabase Dashboard SQL Editor (Anbefalt)

### Steg 1: Åpne Supabase Dashboard
1. Gå til https://supabase.com/dashboard
2. Logg inn
3. Velg prosjektet ditt (uofsfpvtgxlkbeysvtkk)

### Steg 2: Åpne SQL Editor
1. Klikk på "SQL Editor" i venstre meny
2. Klikk på "New query" (eller bruk eksisterende)

### Steg 3: Kopier og kjør DATABASE_MIGRATIONS.sql
1. Åpne filen `DATABASE_MIGRATIONS.sql` i VSCode
2. Kopier **ALT** innhold (Ctrl+A, Ctrl+C)
3. Lim inn i SQL Editor i Supabase Dashboard
4. Klikk "Run" (eller Ctrl+Enter)

### Steg 4: Verifiser at migreringen var vellykket
Du skal se output som:
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
ALTER TABLE
CREATE POLICY
...
```

### Steg 5: Kjør verifikasjonsskript
1. Åpne filen `test-database-setup.sql` i VSCode
2. Kopier ALT innhold
3. Lim inn i en ny SQL query i Supabase Dashboard
4. Klikk "Run"

**Forventet resultat:**
```
✅ All 14 tables created successfully
✅ All tables have RLS Enabled
✅ Sufficient indexes created
...
```

---

## Metode 2: Via Node.js script (Alternativ)

Hvis du vil kjøre migreringene via kode, kan jeg lage et Node.js-script som bruker `pg`-pakken (som allerede er installert).

**Vil du at jeg skal lage dette scriptet?**

---

## Hva skjer når du kjører migreringene?

### 14 nye tabeller opprettes:

1. **ifc_elements** - For IFC-søk med fasetter
2. **issues** - Avvik/RFI/Endringsforespørsler
3. **issue_comments** - Kommentarer på issues
4. **issue_history** - Endringshistorikk
5. **controls** - Kvalitetskontroller
6. **control_runs** - Kontrollkjøringer
7. **control_findings** - Funn fra kontroller
8. **cutlist_items** - Kappliste-elementer
9. **drawing_snippets** - Tegningsutsnitt med pos.nr
10. **activity_log** - Full revisjonslogg
11. **notifications** - Varsler til brukere
12. **file_versions** - Filversjonering
13. **meetings** - Møter
14. **meeting_packages** - Møtepakker

### RLS Policies opprettes:
- Alle tabeller får Row Level Security
- Policies sikrer at brukere kun ser data de har tilgang til
- Ingen data-lekkasje mellom prosjekter/organisasjoner

### Indekser opprettes:
- 30+ indekser for rask søk
- Full-text search index på ifc_elements
- Foreign key indekser

---

## Feilsøking

### Problem: "relation already exists"
**Løsning:** Noen tabeller eksisterer allerede. Dette er OK - scriptet bruker `IF NOT EXISTS`.

### Problem: "permission denied"
**Løsning:** Sørg for at du er logget inn som database-eier i Supabase Dashboard.

### Problem: Timeout
**Løsning:** Scriptet er stort. Hvis det timer ut, kjør det i mindre deler:
1. Først: Alle CREATE TABLE statements
2. Deretter: Alle CREATE INDEX statements
3. Til slutt: Alle CREATE POLICY statements

---

## Etter migreringen

### Verifiser at alt fungerer:

1. **Sjekk at tabellene eksisterer:**
   ```sql
   SELECT tablename 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename IN (
     'ifc_elements', 'issues', 'controls', 
     'cutlist_items', 'notifications'
   );
   ```

2. **Sjekk RLS:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename = 'ifc_elements';
   ```
   Skal returnere: `rowsecurity = t` (true)

3. **Test en enkel insert:**
   ```sql
   -- Dette skal feile hvis RLS fungerer (ingen project_id tilgang)
   INSERT INTO ifc_elements (project_id, model_id, guid, element_type)
   VALUES ('test', 'test', 'test', 'test');
   ```

---

## Neste steg etter migreringen

1. ✅ Database-migreringer fullført
2. 🔄 Test API-endepunkter
3. 🔄 Implementer frontend-komponenter

**Si fra når migreringen er fullført, så fortsetter vi!**

---

**Opprettet:** 16. januar 2026  
**Status:** Klar til bruk
