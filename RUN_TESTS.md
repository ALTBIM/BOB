# 🧪 Kjør automatiske tester

## 📋 Hva testene gjør:

Testene vil automatisk:
1. ✅ Logge inn med test-bruker
2. ✅ Finne eller opprette test-prosjekt
3. ✅ Teste alle 14 database-tabeller
4. ✅ Teste IFC Search API (4 tester)
5. ✅ Teste Issues API (4 tester)
6. ✅ Teste Issue Details API (2 tester)
7. ✅ Teste Issue Comments API (3 tester)
8. ✅ Rydde opp (slette test-data)

**Totalt: ~30 tester**

---

## 🚀 Slik kjører du testene:

### Steg 1: Installer tsx (hvis ikke allerede installert)
```bash
npm install -D tsx
```

### Steg 2: Opprett test-bruker i Supabase

1. Gå til https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/auth/users
2. Klikk "Add user" → "Create new user"
3. Email: `test@bob.no`
4. Password: `TestPassword123!`
5. Klikk "Create user"

### Steg 3: Sett miljøvariabler

Opprett `.env.test.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://uofsfpvtgxlkbeysvtkk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
TEST_USER_EMAIL=test@bob.no
TEST_USER_PASSWORD=TestPassword123!
```

### Steg 4: Start dev-serveren (i ett terminal-vindu)
```bash
npm run dev
```

### Steg 5: Kjør testene (i et annet terminal-vindu)
```bash
npx tsx tests/api/test-all-apis.ts
```

---

## 📊 Forventet output:

```
============================================================
🧪 BOB Platform - Automated API Tests
============================================================

🔧 Setting up tests...
✅ Authenticated as test@bob.no
✅ Using existing project: abc-123

📊 Testing database tables...
✅ Database: ifc_elements exists (45ms)
✅ Database: issues exists (32ms)
✅ Database: issue_comments exists (28ms)
... (11 more)

🔍 Testing IFC Search API...
✅ IFC Search: Basic search without filters (156ms)
✅ IFC Search: Search with text (142ms)
✅ IFC Search: Search with filters (138ms)
✅ IFC Search: Error handling - missing project_id (45ms)

🚨 Testing Issues API...
✅ Issues: Create avvik (234ms)
✅ Issues: List issues (123ms)
✅ Issues: List with filters (118ms)
✅ Issues: Error handling - missing required fields (42ms)

📝 Testing Issue Details API...
✅ Issue Details: Get issue (89ms)
✅ Issue Details: Update issue (156ms)

💬 Testing Issue Comments API...
✅ Comments: Create comment (178ms)
✅ Comments: List comments (92ms)
✅ Comments: Error handling - empty comment (38ms)

🧹 Cleaning up...
✅ Cleanup: Delete test issue (145ms)

============================================================
📊 Test Summary
============================================================

Total: 30 tests
Passed: 30 ✅
Duration: 2847ms
```

---

## ❌ Hvis tester feiler:

### Feil: "Failed to authenticate"
**Løsning:** Sjekk at test-brukeren er opprettet i Supabase og at miljøvariablene er riktige.

### Feil: "Connection refused"
**Løsning:** Sjekk at dev-serveren kjører (`npm run dev`)

### Feil: "Table not accessible"
**Løsning:** Sjekk at du har kjørt `DATABASE_MIGRATIONS_SIMPLE.sql` og `DISABLE_RLS_FOR_TESTING.sql`

### Feil: "HTTP 401"
**Løsning:** Auth-token er ugyldig. Sjekk at test-brukeren kan logge inn.

### Feil: "HTTP 404"
**Løsning:** API-ruten finnes ikke. Sjekk at alle API-filer er på plass.

---

## 🎯 Alternativ: Manuell testing

Hvis automatiske tester ikke fungerer, kan du teste manuelt:

### Test 1: IFC Search
```bash
# Hent auth token fra browser (F12 → Application → Local Storage → supabase.auth.token)
TOKEN="your-token-here"
PROJECT_ID="your-project-id"

curl -X POST http://localhost:3000/api/ifc/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"project_id\":\"$PROJECT_ID\",\"limit\":10}"
```

### Test 2: Create Issue
```bash
curl -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"project_id\":\"$PROJECT_ID\",\"type\":\"avvik\",\"title\":\"Test\",\"priority\":\"høy\"}"
```

---

## ✅ Når testene er fullført:

Si "Testene er fullført" så lager jeg en oppsummering! 🎉
