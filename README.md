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
   - *Instant Role Switcher in the top header allows instant testing of permission restrictions.*

4. **Resource Quotas & Google Play Billing (§10)**:
   - Base Subscription: PKR 280/mo (Includes 1 GB storage, 3 GB egress).
   - Storage Packs: 1 GB pack (PKR 100), 5 GB pack (PKR 450 with 10% discount).
   - Egress hard cap: 10 GB/month with auto-throttle protection.
