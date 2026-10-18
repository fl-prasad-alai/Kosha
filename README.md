# Kosha

**The AI credit passport for every corner shop.**

<div align="center">

### ▶ See Kosha in action

<a href="docs/media/kosha-demo.mp4"><img src="docs/readme/kosha-demo-preview.gif" alt="Kosha demo preview: Sunita's kirana, Gemini reading a handwritten Hindi ledger, the credit passport, a caught fraud and the closing line" width="720"></a>

<sub>3:48 narrated walkthrough · <a href="docs/media/kosha-demo.mp4"><b>Watch the full video (1080p)</b></a> · <a href="docs/media/kosha-demo.srt">Subtitles</a></sub>

</div>

---

Millions of small shops across Asia (kiranas in India, warungs in Indonesia, sari-sari stores in the Philippines) can't get formal working-capital loans. They have no audited accounts, so lenders can't see how good they are. Yet the shop already keeps everything a lender needs: a handwritten ledger, supplier bills, digital payment records and electricity bills.

Kosha reads those records with Gemini, cross-checks them against each other, scores the shop with fixed rules that can be audited, and issues a **credit passport** any lender can verify with a link or a QR code.

> *Kosha* is the word for a kingdom's treasury in Kautilya's *Arthashastra*.

## What it does

1. **Reads the handwritten ledger** (khata / buku catatan / listahan) in Devanagari, Bahasa or Taglish. Every line is translated, classified as a sale, stock bought, credit given, credit repaid or expense, and boxed on the photo.
2. **Reads the proof:** supplier bills, a UPI/QRIS statement or e-wallet screenshots, and electricity bills.
3. **Catches edited documents.** Gemini flags digits in a different font or weight, and code checks running balances between screenshots.
4. **Looks at the neighbourhood** with Gemini grounded on Google Search (or Google Maps on billed projects): schools, transport, markets and competitors.
5. **Holds a five-question voice interview** in the owner's language and checks the answers against the documents.
6. **Issues the passport:**
   - a score (300–900) built from capacity, character, conditions and stability
   - a working-capital limit sized to the shop's monthly surplus
   - a repayment schedule that follows festival seasons
   - reasons linked to the exact evidence
   - an explanation in the owner's language, read aloud with Gemini TTS
7. **Gives lenders a queue** of passports and a shareable verification page.

### Accounts, consent and who sees what
- **Shop owners** sign up, build passports, and see each lender's response on their dashboard (`/app`).
- **Lenders** sign up as *pending*. They see no shop data until Kosha staff verify their organisation; then they review the queue (`/lender`) and approve, ask for documents or decline, with a note the shop sees.
- **Kosha staff** (`/admin`) verify or reject lender organisations and read the audit log. They never see a shop's documents.
- **Consent is taken before a passport is issued.** The shop chooses *all verified lenders* or *only lenders I choose*, and whether the public link shows the offer amount. It can change or withdraw this any time from its dashboard or the passport page, and it takes effect at once.

| Who | Sees |
|---|---|
| The shop that owns the passport | Everything, every lender's decision, and an access log ("Viewed by Pune Merchants Co-op · 17 Oct") |
| A verified lender the shop shared with | The full passport and only its own organisation's decision. Every view is logged for the shop |
| A pending or rejected lender | No shop data, only a "being verified" page |
| Anyone with the link, and Kosha staff | A redacted record: shop name, owner's first name, area and city, shop type, score, band, offer status, issue date, sources count (and the offer amount only if the shop allows it) |

- One policy file, [`shared/policy.ts`](shared/policy.ts), lists every permission, and [`firestore.rules`](firestore.rules) enforces the same rules in Firestore on every read and write. The web app uses the policy file to hide routes and buttons. The public record is a separate Firestore document built field by field, so redacted fields are never readable; its score, band, status and seal must match the passport.
- One-click **demo accounts** on the sign-in page: *Sunita* (Sharma General Store), *Arjun* (Pune Merchants Co-operative Bank, a verified lender) and a subtle *Admin* button (*Meera Iyer*, Kosha Operations). The password for `shop@demo.kosha`, `lender@demo.kosha` and `admin@demo.kosha` is `kosha-demo`.
- Security: accounts use Firebase Authentication (passwords are never stored by Kosha, and repeated wrong passwords are throttled). Role and lender verification live in Firestore and are read fresh on every request; nobody can make themselves verified or an admin. *Sign out on all devices* ends every earlier sign-in. After issue, a passport's score and evidence cannot be changed, only the shop's consent. Sign-ins, lender views, decisions, consent changes and verifications go to an append-only audit log that no one can edit or delete. [`scripts/rules-test.mjs`](scripts/rules-test.mjs) checks 55 allowed and refused cases against the Firestore emulator.

### Verified identity: who runs the shop, and is it registered?
The first step, **"Who you are"**, takes about a minute and is scan-first:
- **Aadhaar Secure QR:** scanned with the phone camera and checked against **UIDAI's published public keys** in the browser. A genuine card makes the identity **Govt-signed**. The QR never carries the full Aadhaar number, and nothing from the card is uploaded.
- **PAN or any national ID:** Gemini reads the number, name and date of birth and looks for signs of editing. Kosha checks the PAN format, that it belongs to an individual, and that its 5th letter matches the surname.
- **Business registration (optional):** GSTIN (with its **check digit**, the **PAN inside it** and its **state code**), Udyam or Udyam Assist, FSSAI, shop licence, or DTI and TIN in the Philippines.
- Shop details are filled in from these documents, and a profile-strength meter shows what each document adds.

Every fact gets a proof level: *Self-declared*, *Read from document*, *Registry-confirmed* or *Govt-signed*. Four new cross-checks join "Do the sources agree?": the same person on every document and bill, a registration that fits, ID addresses that fit the shop, and **one identity, one shop** (a PAN backs only one shop; Kosha keeps just a one-way fingerprint of it). A failed identity check **holds the offer**, like an edited payment record. Identity never adds score points.

Lenders see an identity column and filters (*Govt-signed ID*, *Registered business*), a masked identity panel, a printable **KYC summary**, and can ask for exact documents as a checklist the shop sees. Lenders sign up with their regulator registration number, and shops see which lenders are regulated. `npx tsx scripts/identity-test.ts` checks the rules on good and bad cases.

### Smooth on old phones and PCs
Kosha checks the device (CPU cores, memory, data saver, reduced motion) and watches the real frame rate. On a slow device it lowers the 3D quality, freezes the animated background and drops blur effects, and it stops animating whenever the tab is hidden.

### Fair and auditable by design
- Gemini **reads, translates, checks and explains**. The **score and limit come from deterministic rules** in [`src/fb/score.ts`](src/fb/score.ts), so the same evidence always gives the same result.
- A failed integrity check **holds** the offer whatever the score.
- The limit uses a prudent margin (at most 25%) and keeps the instalment under 35% of monthly surplus.
- The interview never judges accent, tone or confidence. It only compares facts with documents.
- Kosha pre-screens; a lender makes the final decision.

## Architecture

```mermaid
flowchart LR
  U["Shop owner / field agent<br/>(phone browser)"] --> W["React web app on Firebase Hosting<br/>Vite · Tailwind · Motion"]
  W -- "sign-in" --> A["Firebase Authentication"]
  W -- "photos, audio" --> G["Gemini API (Google AI Studio)<br/>gemini-3-flash"]
  G -- "grounding" --> GS["Google Search"]
  W -- "voice" --> TTS["Gemini TTS"]
  W --> R["Rules engine<br/>metrics · 12 cross-checks · score · limit"]
  W --> F[("Cloud Firestore<br/>passports · consent · decisions · audit")]
  F -. "security rules: owner · verified lender · admin · public" .- W
  L["Lender"] --> W
```

| Step | Gemini call | Output |
|---|---|---|
| Ledger | Vision, JSON schema | Every line: date, original text, English, type, amount, bounding box |
| Supplier bills | Vision, JSON schema | Supplier, date, total, items, credit terms, tamper signs |
| Payments | Vision (image or PDF) | Daily totals, payers, balances, tamper flags with boxes |
| Electricity | Vision | Month, kWh, amount, paid on time |
| Shopfront | Vision | Signboard text, matches the shop name, stock level |
| Neighbourhood | Search or Maps grounding | Demand drivers, competitors, distance, bearing |
| Interview | Audio | Transcript, translation, facts |
| Passport | Text, JSON schema | Reasons, owner explanation, festival seasonality, loan-purpose return |

A full passport takes about 10 Gemini calls and costs a few US cents.

## Run it locally

```bash
cp .env.example .env                   # add a GEMINI_API_KEY from AI Studio
npm install
printf 'VITE_FIREBASE_EMULATORS=1\nVITE_FIREBASE_PROJECT_ID=demo-kosha\n' > .env.development.local
npm run emulators                      # Auth + Firestore emulators (needs Java)
npm run seed:emulators                 # demo accounts and sample passports (another terminal)
npm run dev                            # web on :5173
```

Open http://localhost:5173 and choose a sample shop (this signs you in to the demo shop account), or sign in as the demo lender at `/login`. The two sample shops are fictional; their documents are in [`public/samples`](public/samples). Their Gemini results are cached in [`cache/`](cache), so the demo also works offline.

- **Sharma General Store** (Pune, India): Hindi ledger, UPI statement. Gets an offer.
- **Nena's Sari-Sari Store** (Quezon City, Philippines): Taglish ledger. One wallet screenshot was edited to add ₱48,000, so the passport is **held**.

End-to-end test in real Chrome: `node scripts/e2e.mjs 0` (or `1` for the second shop). Security rules: `node scripts/rules-test.mjs`.

## Deploy to Firebase

Live at **https://kosha-ai.web.app**.


Kosha runs entirely on Firebase's free Spark plan: Hosting for the web app, Authentication for accounts and Cloud Firestore for data. Gemini is called with an AI Studio key restricted to the site's domain.

1. Create a Firebase project, add a **Web app**, enable **Authentication → Email/Password**, and create a **Cloud Firestore** database.
2. Put the web app's config in `.env.production.local`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_APP_ID=...
   VITE_GEMINI_API_KEY=...     # AI Studio key, restricted to your-project.web.app
   ```
3. Deploy the rules, indexes and site, then add the demo accounts and sample passports:
   ```bash
   npx firebase login
   npx firebase use your-project
   npx firebase target:apply hosting app your-site-id        # e.g. kosha-ai → kosha-ai.web.app
   npm run deploy
   node scripts/seed.mjs your-project    # uses gcloud application-default credentials
   ```

## Project layout

| Path | What |
|---|---|
| `src/` | React app: guided six-step flow, passport card, lender view |
| `src/fb/` | Firebase setup and Gemini calls (`gemini.ts`, `extract.ts`, `location.ts`, `interview.ts`, `tts.ts`), rules (`score.ts`), passport assembly (`assess.ts`) |
| `src/lib/api.ts` | Every action the app takes: accounts, passports, consent, decisions, admin, audit |
| `firestore.rules` | Who may read or change what |
| `shared/` | Types, the permission policy and interview questions |
| `public/samples/` | Sample shop documents (fictional) and their generator in `scripts/samples/kosha` |
| `cache/` | Cached Gemini results for the sample shops |

UI components from [Unlumen UI](https://ui.unlumen.com) and [Smooth UI](https://smoothui.dev).
