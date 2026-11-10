# 🏛️ ABS Invoice — Projects & Billing for Architecture Practices
### One Codebase for Web, Android, and iOS

ABS Invoice helps architecture and interior practices manage projects and generate client invoices from one portable TypeScript app built with React Native and Expo. It uses Firebase username/password sign-in, ABS architecture invoice numbering, optional invoice descriptions in PDFs, and no company-seal area in generated invoices.

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
│   │   ├── pdf/template.ts       # §9 Handlebars HTML PDF template
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
│   ├── services/                 # Universal API, offlineStorage, PDF generator
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
   - Consecutive format: `{PREFIX}-{FY}-{0001}` (e.g. `ABS-2025-0001`, `INT-2025-0001`, `SUP-2025-0001`).
   - Transactional isolation prevents invoice serial collisions during simultaneous billing.

2. **Universal PDF Engine (§9)**:
   - **Web**: Instant printable preview, HTML5 canvas rendering, direct PDF download.
   - **Android & iOS**: `expo-print` + `expo-sharing` triggers native OS share sheet and PDF generation.
   - Company logo, invoice description, and CEO signatory line. Company seals are not collected or printed.

3. **Company Profile and Billing**:
   - Set up your practice profile, legal signatory, and invoice numbering.
   - Create projects, configure rate cards, and generate invoices and PDFs.
   - Company records remain isolated by account and protected by Firebase security rules.

4. **Resource Quotas & Google Play Billing (§10)**:
   - Base Subscription: PKR 280/mo (Includes 1 GB storage, 3 GB egress).
   - Storage Packs: 1 GB pack (PKR 100), 5 GB pack (PKR 450 with 10% discount).
   - Egress hard cap: 10 GB/month with auto-throttle protection.

## 🔐 Username/Password Sign-In and Company Setup

The app uses Firebase Authentication for username/password accounts. Passwords
are managed and hashed by Firebase Authentication; the app and Firestore never
store plaintext passwords. Changing credentials requires reauthentication with
the current username and password. Usernames are 3–32 characters and passwords
must be at least 12 characters. Sign-in accepts either a username or the full
email address of a Firebase Authentication account.

Company setup is optional during sign-in and is available in Settings. Projects
and invoices remain scoped to the user's company in Firestore and are available
after a company profile is created. Existing Google-only accounts cannot use
Google sign-in after this change; create or provision a username/password
account before disabling Google in Firebase Authentication. Team invitations,
join links, and team management have been removed.

### Firebase configuration and initial administrator

1. Create a Firebase project and register a Firebase Web app. Enable
   **Email/Password** in **Authentication → Sign-in method** and configure
   Firestore. Add production domains to **Authentication → Settings → Authorized
   domains**.
2. Copy `.env.example` to `.env` and fill in the Firebase Web app config values.
   `EXPO_PUBLIC_` values are client identifiers, not server secrets. Never put
   service-account keys or passwords in `.env` or source code.
3. Configure Firebase Admin SDK credentials for the same project. Keep the
   service-account JSON outside the repository and restrict access to it. Set
   `USERNAME_AUTH_DOMAIN` to the same value as
   `EXPO_PUBLIC_USERNAME_AUTH_DOMAIN`. The initial account is created once via
   the Firebase Admin SDK; the password is read only for that process and is
   not written to the repository:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = Read-Host "Path to Firebase Admin credential JSON"
   $env:GCLOUD_PROJECT = Read-Host "Firebase project ID"
   $env:USERNAME_AUTH_DOMAIN = Read-Host "Username auth domain"
   $env:ADMIN_USERNAME = 'absadminuser'
   $secret = Read-Host "Initial administrator password" -AsSecureString
   $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
   try {
     $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
     npm --prefix functions run provision:admin
   } finally {
     Remove-Item Env:ADMIN_PASSWORD,Env:ADMIN_USERNAME,Env:USERNAME_AUTH_DOMAIN,Env:GCLOUD_PROJECT,Env:GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue
     [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
     Remove-Variable secret,pointer -ErrorAction SilentlyContinue
   }
   ```

   The provisioning script refuses to overwrite an existing account. It stores
   only the Firebase Auth account and user profile; Firebase Authentication
   handles the password hash.
4. Deploy the Firestore rules and Firebase Functions:

   ```bash
   firebase deploy --only functions,firestore:rules
   ```

   Invoice PDF/cloud-storage features require the configured Firebase bucket
   and may have billing costs.

5. Run `npm run build:web` for the web client. Build and test Android/iOS with
   the configured Firebase app identifiers.

### Sign-in and company-setup troubleshooting

- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` must be a hostname only, such as
  `your-project.firebaseapp.com`. Do not put `https://`, a slash, or an auth
  callback path in this variable.
- `USERNAME_AUTH_DOMAIN` and `EXPO_PUBLIC_USERNAME_AUTH_DOMAIN` must match.
- Company logos are compressed and stored inline in the company Firestore
  document (maximum 128 KB); this onboarding path does not
  require a Firebase Storage bucket. This consumes Firestore storage/read quota.
- Issued invoice PDFs still use Cloud Storage through the invoice function. To
  use that feature, configure the default bucket and billing as required by
  Firebase. Leaving `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` blank does not enable
  PDF storage.
- Firestore has a no-cost quota on Firebase Spark, but reads/writes and stored
  image data use that quota. Check current Firebase pricing and quotas; free
  usage is not unlimited.
- Invoice serial allocation/PDF functions elsewhere in this app are still
  separate Cloud Functions and may require a billing-enabled Firebase plan.
  Avoid deploying or using those features if you cannot accept possible
  charges.
- Enable Firestore and create its default database. Deploy the current
  Firestore rules to the same Firebase project used by the app before company
  setup and project/invoice use.
- After editing `.env`, stop Expo and restart with `npx expo start -c`; a web
  deployment must be rebuilt and redeployed to pick up environment changes.
  Do not share `.env` contents, service-account keys, or passwords when
  requesting help.

The old Cloudflare Google sign-in flow is removed. Use Firebase mode for account
sign-in and authenticated company data.

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