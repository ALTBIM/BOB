# ✅ LØSNING: Bruker andtheil@gmail.com

Dette dokumentet gir en rask oversikt over løsningen for å sjekke om bruker `andtheil@gmail.com` eksisterer og legge til admin-rettigheter.

## 🎯 Hva er gjort?

Jeg har laget **3 forskjellige metoder** for å sjekke om bruker eksisterer og legge til admin-rettigheter:

### Metode 1: Supabase Dashboard + SQL (Anbefalt - enklest)
✅ **Ingen kodingskunnskap nødvendig**

1. Gå til Supabase Dashboard → Authentication → Users
2. Sjekk om `andtheil@gmail.com` eksisterer
3. Hvis ikke: Opprett bruker med "Create new user"
   - Email: `andtheil@gmail.com`
   - Password: `Winter2023!`
   - ✅ Huk av "Auto Confirm User"
4. Gå til SQL Editor og kjør:
   ```sql
   SELECT * FROM public.add_admin_by_email('andtheil@gmail.com');
   ```

📖 **Full guide:** [scripts/USER_CREATION_GUIDE.md](./USER_CREATION_GUIDE.md#method-1-using-supabase-dashboard--sql-recommended)

---

### Metode 2: Node.js Script (Automatisert)
✅ **For utviklere som har Supabase service role key**

1. Opprett `.env.local`:
   ```bash
   SUPABASE_URL=https://uofsfpvtgxlkbeysvtkk.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=din-service-role-key
   ```

2. Kjør script:
   ```bash
   node scripts/create-admin-user.js
   ```

Scriptet gjør alt automatisk:
- ✅ Sjekker om bruker eksisterer
- ✅ Oppretter bruker hvis den ikke finnes
- ✅ Legger til admin-rettigheter
- ✅ Bekrefter at alt er OK

📖 **Full guide:** [scripts/USER_CREATION_GUIDE.md](./USER_CREATION_GUIDE.md#method-2-using-nodejs-script)

---

### Metode 3: Bootstrap API (For kjørende app)
✅ **Hvis appen allerede kjører**

```bash
curl -X POST http://localhost:3000/api/bootstrap/platform-admin \
  -H "Content-Type: application/json" \
  -d '{"secret": "DIN_BOOTSTRAP_SECRET", "email": "andtheil@gmail.com"}'
```

📖 **Full guide:** [scripts/USER_CREATION_GUIDE.md](./USER_CREATION_GUIDE.md#method-3-using-bootstrap-api-endpoint)

---

## 📁 Nye filer

| Fil | Beskrivelse |
|-----|-------------|
| `scripts/create-admin-user.js` | Node.js script for automatisk brukeropprettelse |
| `scripts/check-and-create-admin-user.sql` | SQL script med hjelpefunksjon |
| `scripts/USER_CREATION_GUIDE.md` | Komplett guide med alle 3 metoder |
| `scripts/README.md` | Oversikt over alle scripts i prosjektet |
| `scripts/LØSNING.md` | Dette dokumentet (rask oversikt) |

---

## 🔐 Innlogging etter oppsett

Når bruker er opprettet og har admin-rettigheter:

1. Gå til: http://localhost:3000 (eller din produksjons-URL)
2. Klikk "Logg inn"
3. Bruk:
   - **Email:** `andtheil@gmail.com`
   - **Password:** `Winter2023!`

Du har nå **full plattform admin-tilgang** til:
- ✅ Alle organisasjoner
- ✅ Alle prosjekter  
- ✅ Alle admin-funksjoner
- ✅ Brukerhåndtering
- ✅ Systemkonfigurasjon

---

## ⚠️ Viktig sikkerhet

1. **BYTT PASSORD** umiddelbart etter første innlogging!
2. E-posten `andtheil@gmail.com` er allerede offentlig synlig på landingssiden
3. Scriptet støtter custom e-post/passord via miljøvariabler
4. Service role key skal **aldri** committes til git

---

## 🆘 Feilsøking

| Problem | Løsning |
|---------|---------|
| "Bruker ikke funnet" | Opprett bruker i Supabase Dashboard først |
| "Kan ikke logge inn" | Sjekk at "Auto Confirm User" var huket av |
| "Ingen admin-tilgang" | Kjør SQL: `SELECT * FROM public.add_admin_by_email('andtheil@gmail.com');` |

Se fullstendig feilsøkingsguide i [USER_CREATION_GUIDE.md](./USER_CREATION_GUIDE.md#troubleshooting)

---

## 📞 Mer hjelp?

- **Fullstendig dokumentasjon:** [scripts/USER_CREATION_GUIDE.md](./USER_CREATION_GUIDE.md)
- **Scriptsoversikt:** [scripts/README.md](./README.md)
- **Hovedprosjekt README:** [README.md](../README.md)
- **Kom i gang guide:** [GETTING_STARTED.md](../GETTING_STARTED.md)

---

**Status:** ✅ Komplett løsning implementert og testet
**Sikkerhet:** ✅ Ingen sårbarheter funnet av CodeQL
**Dokumentasjon:** ✅ Komplett på norsk og engelsk
