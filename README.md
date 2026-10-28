# 🏛️ ArchInvoice — Portable Native Multi-Tenant SaaS App
### Unified Single Codebase for Web, Android, and iOS

ArchInvoice is an Architecture & Interior Invoice Generation multi-tenant SaaS application built on a **single, portable native TypeScript codebase** powered by React Native and Expo, with Firebase Cloud Functions and Firestore backend.

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
│   │   ├── auth/tenant.ts        # §7.1 & §7.2 createTenant and joinTenant
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
│   │   ├── auth/                 # Splash, SignIn, Onboarding, CreateCompany, JoinCompany
│   │   ├── dashboard/            # Dashboard (Storage bar, Egress meter, KPIs, Quick actions)
│   │   ├── projects/             # ProjectList, CreateProject, ProjectDetail
│   │   ├── invoices/             # CreateInvoice, InvoicePreview, PdfViewer, InvoiceHistory
│   │   ├── billing/              # Billing & Storage packs (1GB @ PKR 100, 5GB @ PKR 450)
│   │   └── settings/             # Settings (Firm profile, Prefixes, Invite code generator)
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
   - Transactional isolation prevents race conditions when multiple architects issue invoices simultaneously.

2. **Universal PDF Engine (§9)**:
   - **Web**: Instant printable preview, HTML5 canvas rendering, direct PDF download.
   - **Android & iOS**: `expo-print` + `expo-sharing` triggers native OS share sheet and PDF generation.
   - Company branding, CEO signature line, and official visual seal watermark with disclaimer:
     > *"This seal is a company visual mark, not a certified digital signature."*

3. **Multi-Role Access Control (§4)**:
   - **Admin**: Company profile management, member invites, pricing settings, and invoice creation.
   - **Architect**: Project creation, rate card configuration, and invoice issuance.
   - **Viewer**: Read-only access; restricted from creating or issuing invoices.
   - User roles and company membership are guarded by Firebase Authentication and Firestore security rules; there is no client-side role switcher.

4. **Resource Quotas & Google Play Billing (§10)**:
   - Base Subscription: PKR 280/mo (Includes 1 GB storage, 3 GB egress).
   - Storage Packs: 1 GB pack (PKR 100), 5 GB pack (PKR 450 with 10% discount).
   - Egress hard cap: 10 GB/month with auto-throttle protection.

5. **Project Drawing Review (MVP demo)**:
   - Project-level client invitations and a restricted client navigation surface.
   - Drawing sets, revision history, review status, threaded comments/objections,
     objection resolution, client approval, and an in-app notification inbox.
   - File selection supports PDF, DWG, JPG, and PNG, with per-file and drawing-set
     size limits; opening a revision records the client-seen timestamp.

   **Current limitation:** this collaboration workflow follows the app's existing
   mock/offline architecture. Records are stored locally (browser localStorage on
   web; in-memory for the current native-app session). It does not yet upload files
   to Firebase Storage or deliver cross-device push/email notifications. Firebase
   Auth, callable status-transition functions, server-side quota enforcement, and
   malware scanning must be connected before using this workflow with real clients.

## 🔐 Google Sign-In, Company Setup, and Team Access

The app uses Firebase Authentication with Google as the provider. A signed-in
Google account without a company is directed to company setup. Company creation,
team invitations, invitation acceptance, and member removal are performed
directly through Firestore atomic writes protected by Firestore security rules;
these operations do not require Cloud Functions. Invitations are bound to a
verified email address, expire after seven days, and use a one-time random
token whose SHA-256 hash is stored in the company invitation record. The admin
shares the generated link; the app does not send invitation emails
automatically. Team members must sign in with the invited Google email.
Removing a member revokes their company membership but does not delete their
Firebase Authentication account.

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
   Review and deploy the Firestore security rules:

   ```bash
   firebase deploy --only firestore:rules
   ```

   Company setup and team management do not need Cloud Functions or a Storage
   bucket. Do not deploy Functions or Storage unless you intentionally enable
   the invoice PDF/cloud-storage features and understand their billing needs.

5. Run `npm run build:web` for the web client. For iOS and Android, build and
   test signed development builds with the configured OAuth client IDs and
   registered bundle/package identifiers; Expo Go is not a production OAuth
   test. The app scheme `archinvoice://` handles native invitation links when
   the app is installed. A verified web/universal-link domain and the
   associated iOS/Android asset files still need to be configured before
   distributing links that should open the app from any browser.

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
  Firestore rules to the same Firebase project used by the app. These rules
  must be deployed before company creation, invitations, or membership changes
  will work.
- After editing `.env`, stop Expo and restart with `npx expo start -c`; a web
  deployment must be rebuilt and redeployed to pick up environment changes.
- If company setup or team operations fail after deploying rules, check the
  browser console and Firebase Console → **Firestore → Rules** for the latest
  deployed rules/errors. Check whether a company was created in Firestore
  before retrying. Do not share `.env` contents, OAuth client secrets,
  service-account keys, or verification codes when requesting help.

## ☁️ Optional Cloudflare Web API (free-tier deployment)

The web app can use a Cloudflare Worker and D1 for Google sign-in, company
creation, and team invitations/removal instead of Firebase Auth/Firestore.
The current Worker implementation supports these identity and company
operations only. Project, invoice, drawing-review, and document data remain
local/offline in the current app and are **not** synchronized to D1 or Google
Drive. Do not use the local-only records as a shared production workspace.
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

The GitHub workflow validates the frontend, Worker, and existing Firebase
Functions code; it no longer deploys Firebase Functions or Firebase rules.
Deploy Worker changes manually with `cd worker; npm run deploy` after applying
the D1 migration. This avoids silently deploying the legacy Firebase backend
or requiring a Firebase service-account key in GitHub Actions.

The Worker validates Google ID-token signatures and OIDC claims, uses OAuth
state, nonce, and PKCE, and issues a random opaque, HttpOnly, Secure,
SameSite=Lax session cookie. D1 stores only a hash of the session token and
one-time invite token. Mutating API requests require the exact configured
frontend `Origin`. The Worker has no email delivery integration: admins share
the one-time invitation link themselves. Company logos/seals are currently
limited to small inline images; no R2 uploads are implemented.
Before inviting real users, configure Cloudflare rate-limiting/WAF rules for
the OAuth start and callback endpoints and monitor D1/Worker usage. The Worker
does not yet implement automated email delivery, MFA, audit exports, or
workspace/project/invoice data synchronization.

### Production readiness limits

- Native Firebase Auth persists sessions using React Native AsyncStorage. On
  shared or compromised devices, sign out and use device-level security; never
  store private service-account credentials in the client.
- Firebase App Check, production OAuth credentials, project deployment,
  multi-platform sign-in tests, and Firestore/Storage emulator security tests
  are not configured in this repository.
- Project drawing collaboration remains local/offline, as described above.
  Most project and invoice flows also retain existing demo/local behavior and
  must be migrated and security-tested before treating the whole product as a
  production multi-tenant SaaS.
