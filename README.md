# 🏛️ ArchInvoice — Projects & Billing for Architecture Practices
### One Codebase for Web, Android, and iOS

ArchInvoice helps architecture and interior practices manage projects and generate client invoices from one portable TypeScript app built with React Native and Expo.

---

## 📱 Cross-Platform Architecture

```
                    ┌───────────────────────────────┐
                    │  Universal TypeScript App     │
                    │  (React Native + Expo SDK 52) │
                    └───────────────┬───────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
   🌐 Web Browser             🤖 Android App             🍎 iOS App
   (Chrome/Safari/Edge/PWA)   (Native APK/AAB)           (Native IPA/Simulator)
   - Desktop sidebar          - Bottom nav tabs          - Bottom nav tabs
   - Printable HTML5/Canvas   - Native expo-print        - Native expo-print
   - PDF download             - Native share intent      - Native share sheet
```

---

## 📁 Repository Structure

```
invoice-generator/
├── config/
│   ├── pricing.json              # §3 Single Source of Truth for pricing & guardrails
│   └── fx.json                   # Exchange rates (USD -> PKR)
├── firestore.rules               # §4 Multi-tenant security rules
├── storage.rules                 # §5 Cloud Storage signed URL rules
├── firestore.indexes.json        # §6 Composite query indexes
├── firebase.json                 # §11 Firebase deployment config
├── functions/                    # §7 Cloud Functions (Node 20, TypeScript)
│   ├── src/
│   │   ├── config/guard.ts       # Pricing safety deployment assertion
│   │   ├── counters/serial.ts    # §7.3 Atomic serial & invoice creation
│   │   ├── invoices/issue.ts     # §7.4 & §7.5 PDF generation & signed URLs
│   │   ├── pdf/template.ts       # §9 Handlebars HTML PDF template with visual seal
│   │   ├── auth/tenant.ts        # Company setup and archival
│   │   ├── billing/play.ts       # §7.6 & §10 Google Play RTDN & purchase verification
│   │   ├── metering/cron.ts      # §7.7 & §7.8 Daily metering & grace period enforcer
│   │   └── index.ts              # Function exports
│   └── __tests__/                # Functions unit tests (serial concurrency, pricing guard)
├── src/                          # Universal App Source Code (Web, Android, iOS)
│   ├── components/               # Button, Input, Card, Badge, ProgressBar, StatCard, Header, Sidebar, TabBar
│   ├── config/                   # Firebase web/native client initialization
│   ├── context/                  # AuthContext, TenantContext, ToastContext
│   ├── navigation/               # AppNavigator (responsive Web sidebar + Mobile tab bar)
│   ├── screens/
│   │   ├── auth/                 # Splash, SignIn, CreateCompany
│   │   ├── dashboard/            # Dashboard (Storage bar, Egress meter, KPIs, Quick actions)
│   │   ├── projects/             # ProjectList, CreateProject, ProjectDetail
│   │   ├── invoices/             # CreateInvoice, InvoicePreview, PdfViewer, InvoiceHistory
│   │   ├── billing/              # Billing & Storage packs (1GB @ PKR 100, 5GB @ PKR 450)
│   │   └── settings/             # Settings (Firm profile and invoice prefixes)
│   ├── services/                 # Universal API, offlineStorage, PDF generator, mockData
│   ├── types/                    # Canonical TypeScript interfaces matching Firestore schema
│   └── util/                     # PKR currency formatting, dates, tax & area calculations
├── App.tsx                       # Universal Root Component
├── app.json                      # Expo configuration for Web, Android, iOS
├── index.js                      # Universal entry point
├── package.json                  # Single root dependencies
└── scripts/
    └── assertPricingSafety.js    # Pre-deploy pricing safety guard script
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20 or v24+
- **npm** (included with Node)
- (Optional for mobile simulators): Android Studio / Xcode

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Locally on Web
```bash
npm run web
```
This opens the web app in your default browser at `http://localhost:8081`.

### 4. Run on Android Simulator or Device
```bash
npm run android
```
*(Or scan the QR code using Expo Go on your Android device)*

### 5. Run on iOS Simulator or Device
```bash
npm run ios
```
*(Or scan the QR code using Expo Go on your iPhone/iPad)*

---

## 🔒 Security & Pricing Safety Assertion

Run the pricing guard test at any time to verify that storage and egress margins meet the required guardrail thresholds:
```bash
node scripts/assertPricingSafety.js
```

Output:
```
[Pricing Guard] Storage Margin: 92.72% (Min required: 40%)
[Pricing Guard] Egress Margin: 44.00% (Min required: 40%)
✅ Pricing safety asserted: All margins pass safety thresholds.
```

---

## 🔑 Key Features Implemented

1. **Atomic Serial Number Allocation (§7.3)**:
   - Consecutive, gap-free format: `{PREFIX}-{FY}-{0001}` (e.g. `ARCH-2025-0001`, `INT-2025-0001`, `SUP-2025-0001`).
   - Transactional isolation prevents invoice serial collisions during simultaneous billing.

2. **Universal PDF Engine (§9)**:
   - **Web**: Instant printable preview, HTML5 canvas rendering, direct PDF download.
   - **Android & iOS**: `expo-print` + `expo-sharing` triggers native OS share sheet and PDF generation.
   - Company branding, CEO signature line, and official visual seal watermark with disclaimer:
     > *"This seal is a company visual mark, not a certified digital signature."*

3. **Company Profile and Billing**:
   - Set up your practice profile, legal signatory, and invoice numbering.
   - Create projects, configure rate cards, and generate invoices and PDFs.
   - Company records remain isolated by account and protected by Firebase security rules.

4. **Resource Quotas & Google Play Billing (§10)**:
   - Base Subscription: PKR 280/mo (Includes 1 GB storage, 3 GB egress).
   - Storage Packs: 1 GB pack (PKR 100), 5 GB pack (PKR 450 with 10% discount).
   - Egress hard cap: 10 GB/month with auto-throttle protection.

## 🔐 Google Sign-In and Company Setup

The app uses Firebase Authentication with Google as the provider. A signed-in
Google account without a company profile is directed to company setup. Each
account creates its own company profile for invoice branding and numbering;
projects and invoices remain scoped to that company in Firestore. Team
invitations, join links, and team management have been removed. Existing
memberships and records are not deleted automatically; existing members may
retain access until the company is archived.

The company can be archived after typing its exact name. Archiving preserves
its Firestore records and generated PDFs, revokes active member profiles, and
blocks further company access; Google accounts remain active.
Admins can also permanently delete projects (including their invoices and PDFs)
or individual invoices (including issued invoices and their PDFs). On Firebase,
these deletions are performed by Firebase Functions rather than direct client
writes. In optional Cloudflare-auth mode, project and invoice data remains
device-local, so deletion only affects that device's cache; company archiving is
not available in that mode.

### Firebase and Google configuration

1. Create a Firebase project and register a Firebase Web app. Enable **Google**
   in **Authentication → Sign-in method**, and add each production web domain to
   **Authentication → Settings → Authorized domains**.
2. In Google Cloud Console, configure the OAuth consent screen and create the
   OAuth clients for the Web app, iOS bundle ID `com.archinvoice.app`, and
   Android package `com.archinvoice.app`. Register the Firebase auth handler
   domain for the web client. For Android, add the app's signing-certificate
   SHA fingerprints to the OAuth/Firebase Android app configuration.
3. Copy `.env.example` to `.env` and fill in the Firebase Web app config values
   and Google OAuth client IDs. These Expo `EXPO_PUBLIC_` values are included in
   the client bundle; they are identifiers, not server secrets. Never put
   service-account keys or other private credentials in `.env` or client code.
4. Configure the Firebase CLI for the same project with `firebase use --add`.
   Deploy the Firestore rules and Firebase Functions:

   ```bash
   firebase deploy --only functions,firestore:rules
   ```

   Invoice PDF/cloud-storage features require the configured Firebase bucket
   and may have billing costs.

5. Run `npm run build:web` for the web client. For iOS and Android, build and
   test signed development builds with the configured OAuth client IDs and
   registered bundle/package identifiers; Expo Go is not a production OAuth
   test.

### Sign-in and company-setup troubleshooting

- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` must be a hostname only, such as
  `your-project.firebaseapp.com`. Do not put `https://`, a slash, or an auth
  callback path in this variable.
- The Google OAuth Web client's **Authorized redirect URI** must be
  `https://your-project.firebaseapp.com/__/auth/handler` (note `handler`, not
  `handle`). The Firebase Authentication **Authorized domains** list contains
  the hostname only, for example `your-project.firebaseapp.com`.
- Company logos and seals are compressed and stored inline in the company
  Firestore document (maximum 128 KB per image); this onboarding path does not
  require a Firebase Storage bucket. This consumes Firestore storage/read quota.
- Issued invoice PDFs still use Cloud Storage through the invoice function. To
  use that feature, configure the default bucket and billing as required by
  Firebase. Leaving `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` blank does not enable
  PDF storage.
- Firestore has a no-cost quota on Firebase Spark, but reads/writes and stored
  image data use that quota. Check current Firebase pricing and quotas; free
  usage is not unlimited. Company logos and seals are kept small to fit safely
  in the tenant document.
- Invoice serial allocation/PDF functions elsewhere in this app are still
  separate Cloud Functions and may require a billing-enabled Firebase plan.
  Avoid deploying or using those features if you cannot accept possible
  charges.
- Enable Firestore and create its default database. Deploy the current
  Firestore rules to the same Firebase project used by the app before company
  setup and project/invoice use.
- After editing `.env`, stop Expo and restart with `npx expo start -c`; a web
  deployment must be rebuilt and redeployed to pick up environment changes.
- If company setup fails after deploying rules, check the
  browser console and Firebase Console → **Firestore → Rules** for the latest
  deployed rules/errors. Check whether a company was created in Firestore
  before retrying. Do not share `.env` contents, OAuth client secrets,
  service-account keys, or verification codes when requesting help.

## ☁️ Optional Cloudflare Web API (free-tier deployment)

The web app can use a Cloudflare Worker and D1 for Google sign-in and company
creation instead of Firebase Auth/Firestore.
The current Worker implementation supports these identity and company
operations only. Project, invoice, and document data remain local/offline in
the current app and are **not** synchronized to D1 or Google Drive. Do not rely
on local-only records for shared project or billing workflows.
Paid subscriptions, storage packs, and invoice PDF generation are disabled in
this Cloudflare path; requests for purchases are rejected rather than simulated.
Cloudflare free-plan allowances and availability can change; review the current
Cloudflare limits before relying on them.

The recommended domains are:

- Web app: `https://archinvoice.infraaceops.com`
- Worker API: `https://api.archinvoice.infraaceops.com`

### Prepare and deploy the Worker

1. In Cloudflare, create a D1 database named `archinvoice` and copy its database
   ID into `worker/wrangler.jsonc`, replacing
   `REPLACE_WITH_D1_DATABASE_ID`. The domain must be active in the same
   Cloudflare account. Sign in to Wrangler from the `worker` folder:

   ```powershell
   cd worker
   npm install
   npx wrangler login
   ```

2. Set the Google OAuth Web client ID and secret on the Worker, create the D1
   tables, and deploy:

   ```powershell
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npm run db:migrate:remote
   npm run deploy
   ```

   Enter values when Wrangler prompts. The deployment configures the HTTPS
   custom domain `api.archinvoice.infraaceops.com`. Do not paste the client
   secret into source files, GitHub Pages settings, or chat. In Google Cloud
   Console, add this exact authorized redirect URI to the OAuth Web client:

   ```text
   https://api.archinvoice.infraaceops.com/auth/google/callback
   ```

   Ensure `infraaceops.com` is listed as an authorized domain on the Google
   OAuth consent screen.

3. In the root `.env`, use:

   ```text
   EXPO_PUBLIC_AUTH_PROVIDER=cloudflare
   EXPO_PUBLIC_API_BASE_URL=https://api.archinvoice.infraaceops.com
   EXPO_PUBLIC_APP_DOMAIN=archinvoice.infraaceops.com
   ```

   This Cloudflare login path currently supports the **web app**. Keep
   `EXPO_PUBLIC_AUTH_PROVIDER=firebase` for the existing native Firebase login
   until a separate native session flow is implemented.
4. In the repository's **Settings → Pages**, choose **GitHub Actions** as the
   source and set `archinvoice.infraaceops.com` as the custom domain. In
   Cloudflare DNS, add the GitHub Pages CNAME record recommended by GitHub for
   your repository/account, then enable HTTPS in GitHub Pages. The workflow
   builds the app with the Cloudflare API URL and publishes `dist` on pushes to
   `main`. Deploy the Worker and configure its custom domain before enabling
   this frontend deployment. The app/API must stay on the
   `infraaceops.com` domain family for the browser's secure session cookie to
   work reliably; the default `*.github.io` origin is not supported.

The GitHub workflow validates the frontend, Worker, and Firebase Functions
code, and publishes the web app on pushes to `main`. It does not deploy Firebase
or Cloudflare services. Deploy Worker changes manually with `cd worker; npm run
deploy`; this feature removal needs no D1 migration. Deploy Firebase Functions
and Firestore rules separately when using the Firebase backend.

The Worker validates Google ID-token signatures and OIDC claims, uses OAuth
state, nonce, and PKCE, and issues a random opaque, HttpOnly, Secure,
SameSite=Lax session cookie. D1 stores only a hash of the session token.
Mutating API requests require the exact configured frontend `Origin`.
Company logos/seals are currently
limited to small inline images; no R2 uploads are implemented.
Before using Google sign-in with real users, configure Cloudflare
rate-limiting/WAF rules for the OAuth start and callback endpoints and monitor
D1/Worker usage. The Worker
does not yet implement MFA, audit exports, or project/invoice data
synchronization.

### Production readiness limits

- Native Firebase Auth persists sessions using React Native AsyncStorage. On
  shared or compromised devices, sign out and use device-level security; never
  store private service-account credentials in the client.
- Firebase App Check, production OAuth credentials, project deployment,
  multi-platform sign-in tests, and Firestore/Storage emulator security tests
  are not configured in this repository.
- Most project and invoice flows retain existing demo/local behavior and
  must be migrated and security-tested before treating the whole product as a
  production project and billing service.
ut7tyutft9uyoihk/.

 mlnk jhfhjn k\]
  k jvhhmlnk\bnbuu h 

    j j
     j jkkkgj  []] jj jgyd try i;] jb kjk ]\