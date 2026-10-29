# Blagajna — domače finance

Organizator domačih financ in mesečnih prihrankov **za dve osebi**: beleženje
prihodkov in odhodkov, nakazil na/iz računov, prenosov med računi, varčevalnih
ciljev in ponavljajočih postavk. Teče na Vercelu, podatki v MySQL (Neoserv).
Poddomena: **blagajna.visionone.si**.

## Kaj zna

- **Računi**: skupni, osebni, varčevalni, gotovina — vsak s tekočim stanjem.
- **Vnosi**: prihodek / odhodek / prenos med računi, z zneskom, kategorijo, osebo, datumom in opombo.
- **Pregled meseca**: skupno stanje, prihodki/odhodki/saldo, graf zadnjih 6 mesecev, razdelitev po kategorijah in po osebi.
- **Varčevalni cilji**: npr. »Dopust 2000 €« z napredkom in pologi/dvigi.
- **Ponavljajoče postavke**: plača, položnice, naročnine — samodejno vsak mesec (dnevni cron).
- **Uvoz CSV iz banke**: naložiš izpisek, program prepozna datum/znesek/opis in uvozi.

## Namestitev (Vercel + Neoserv)

1. **Baza**: v Neoservu ustvari MySQL bazo + uporabnika, dovoli oddaljeni dostop (Remote MySQL).
2. **Vercel**: Import Git Repository → ta repo. Framework: Other (ostalo zazna sam; vmesnik je v `public/`, nastavljeno v `vercel.json`).
3. **Settings → Environment Variables**: vpiši vrednosti iz `.env.example`
   (`DB_*`, `SESSION_SECRET`, `SETUP_TOKEN`). Skrivnosti: `node scripts/keygen.js`.
4. **Domena**: dodaj `blagajna.visionone.si` (Vercel → Domains) in uredi DNS pri Cloudflare.
5. **Prvi zagon** (ustvari tabele + obe osebi + skupni račun):
   ```
   curl -X POST https://blagajna.visionone.si/api/setup \
     -H "Content-Type: application/json" \
     -d '{"token":"<SETUP_TOKEN>","users":[
           {"username":"ana","display_name":"Ana","password":"geslo-ana"},
           {"username":"bojan","display_name":"Bojan","password":"geslo-bojan"}
         ],"accountName":"Skupni račun"}'
   ```
   Nato se prijavita na `https://blagajna.visionone.si`.

> **Cron** (ponavljajoče postavke) je dnevni — združljiv z Vercel Hobby planom.

## Uporaba

- **Spodaj + (FAB)**: hiter vnos. Zgoraj prestavljaš mesec.
- **Pregled**: stanje, prihodki/odhodki, grafi, kategorije, kdo je porabil.
- **Promet**: vsi vnosi po dnevih, filtri po tipu in računu; klik = urejanje.
- **Cilji**: varčevalni cilji in pologi.
- **Več**: računi, kategorije, ponavljajoče postavke, uvoz CSV, sprememba gesla.

## Razvoj

```
npm install
npm test
```
- `api/` — Vercel funkcije, `lib/` — baza/kripto/seje/shema, `public/` — vmesnik.
- Varnost: scrypt gesla, seje v bazi (HttpOnly+Secure), CSP in varnostne glave.
