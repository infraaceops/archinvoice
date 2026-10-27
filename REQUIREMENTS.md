# 📦 Complete Build Specification for GitHub Copilot
## Architecture & Interior Invoice Generation App — Full Implementation Brief

> **How to use this document:** Paste this entire document into GitHub Copilot Chat / Copilot Workspace as context. Then issue prompts like "Generate the Android project structure per SPEC" or "Implement invoice serial allocation Cloud Function per SPEC §7.3". Every section is machine-actionable. No ambiguity.

---

## 0. Project Meta

```yaml
project_name: arch-invoice-app
type: multi-tenant SaaS mobile app
platform: Android (Kotlin, Jetpack Compose, minSdk 26, targetSdk 34)
backend: Firebase (Auth, Firestore, Storage, Cloud Functions, FCM, Remote Config)
admin_console: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
billing: Google Play Billing Library v6
pdf_engine: Puppeteer (Node 20) in Cloud Function
currency_display: PKR
internal_currency: USD (pricing stored in USD, converted at config fx)
timezone: Asia/Karachi
language: en (ur optional, phase 2)
tenant_model: multi-tenant, tenantId scoped everywhere
```

---

## 1. Repository Structure (monorepo)

```
arch-invoice-app/
├── android/                          # Kotlin Android app
│   ├── app/
│   │   ├── src/main/java/com/archinvoice/
│   │   │   ├── MainActivity.kt
│   │   │   ├── di/                   # Hilt modules
│   │   │   ├── data/
│   │   │   │   ├── remote/           # Firebase repos
│   │   │   │   ├── local/            # Room (offline drafts)
│   │   │   │   └── model/            # DTOs mirroring Firestore
│   │   │   ├── domain/
│   │   │   │   ├── model/            # domain entities
│   │   │   │   ├── repository/       # interfaces
│   │   │   │   └── usecase/
│   │   │   ├── ui/
│   │   │   │   ├── auth/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── company/
│   │   │   │   ├── project/
│   │   │   │   ├── invoice/
│   │   │   │   ├── pdf/
│   │   │   │   ├── billing/
│   │   │   │   └── common/
│   │   │   └── util/
│   │   └── build.gradle.kts
│   └── settings.gradle.kts
├── functions/                        # Cloud Functions (Node 20, TS)
│   ├── src/
│   │   ├── index.ts
│   │   ├── auth/                     # triggers
│   │   ├── counters/                 # serial allocation
│   │   ├── invoices/                 # create/issue
│   │   ├── pdf/                      # PDF pipeline
│   │   ├── billing/                  # Play RTDN
│   │   ├── metering/                 # daily usage cron
│   │   └── config/                   # pricing config guard
│   ├── package.json
│   └── tsconfig.json
├── admin-console/                    # Next.js owner back-office
│   └── src/app/...
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
├── config/
│   ├── pricing.json                  # single source of truth
│   └── fx.json
└── docs/
    ├── SRS.md
    ├── ADR-001-pricing.md
    └── API.md
```

---

## 2. Firestore Data Model (canonical schema)

```typescript
// All timestamps = Firestore Timestamp

type Role = 'admin' | 'architect' | 'viewer';
type Category = 'architecture' | 'interior' | 'supervision';
type ProjectType = 'residential' | 'commercial';
type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';
type SubStatus = 'active' | 'grace' | 'locked';

interface UserDoc {            // /users/{uid}
  displayName: string;
  email: string;
  photoUrl: string;
  tenantId: string | null;
  role: Role | null;
  fcmTokens: string[];
  createdAt: Timestamp;
}

interface TenantDoc {          // /tenants/{tenantId}
  name: string;
  ceoName: string;
  logoUrl: string | null;
  sealUrl: string | null;
  address?: string;
  ntn?: string;
  currency: 'PKR';
  subscription: {
    status: SubStatus;
    plan: 'core_monthly';
    pricePkr: 280;
    currentPeriodEnd: Timestamp;
    purchaseToken: string;
    productId: string;
  };
  storage: {
    includedGb: 1;
    purchasedGb: number;
    usedBytes: number;
    egressMonthBytes: number;
    egressMonthKey: string;   // "2025-10"
    lastMeteredAt: Timestamp;
  };
  settings: {
    invoiceDefaults: {
      prefix: Record<Category, string>;   // e.g. ARCH, INT, SUP
      startAt: Record<Category, number>;  // default 1
      financialYear: string;              // "2025"
    };
  };
  createdAt: Timestamp;
}

interface MemberDoc {          // /tenants/{tenantId}/members/{uid}
  role: Role;
  invitedBy: string;
  joinedAt: Timestamp;
}

interface InviteDoc {          // /tenants/{tenantId}/invites/{code}
  email?: string;
  role: Role;
  createdBy: string;
  expiresAt: Timestamp;
  used: boolean;
}

interface ProjectDoc {         // /tenants/{tenantId}/projects/{projectId}
  name: string;
  type: ProjectType;
  area: number;
  unit: 'sqft' | 'sqm';
  clientName: string;
  location?: string;
  assignedArchitects: string[];
  rateCard: Record<Category, number>;  // per-sqft rate
  startDate: Timestamp;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: Timestamp;
}

interface CounterDoc {         // /tenants/{tenantId}/counters/{cat}_{fy}
  category: Category;
  financialYear: string;
  prefix: string;
  nextValue: number;
  lastIssuedAt: Timestamp;
}

interface LineItem {
  desc: string;
  category: Category;
  qty: number;
  rate: number;
  amount: number;
  pricingMode: 'per_sqft' | 'manual';
}

interface InvoiceDoc {         // /tenants/{tenantId}/invoices/{invoiceId}
  serial: string;              // "ARCH-2025-0001" — set ONLY by Function
  category: Category;
  financialYear: string;
  projectId: string;
  clientName: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: 'PKR';
  status: InvoiceStatus;
  pdfPath: string | null;
  pdfSnapshotHash: string | null;
  createdBy: string;
  createdAt: Timestamp;
  issuedAt: Timestamp | null;
}

interface StorageLedgerDoc {   // /tenants/{tenantId}/storage_ledger/{docId}
  deltaBytes: number;
  egressBytes: number;
  reason: 'pdf_create' | 'pdf_download' | 'logo_upload' | 'seal_upload';
  refId: string;
  at: Timestamp;
}

interface BillingMonthDoc {    // /tenants/{tenantId}/billing/{yyyy-mm}
  storageGb: number;
  egressGb: number;
  functionCalls: number;
  firestoreReads: number;
  computedCostPkr: number;
  revenuePkr: number;
  marginPkr: number;
  throttled: boolean;
}
```

---

## 3. Pricing Configuration (Single Source of Truth)

**File: `config/pricing.json`**

```json
{
  "version": 1,
  "currency_internal": "USD",
  "fx_usd_to_pkr": 280,
  "base": {
    "pricePkr": 280,
    "includedStorageGb": 1,
    "includedEgressGb": 3
  },
  "storage": {
    "pricePkrPerGbMonth": 100,
    "packSizeGb": 1
  },
  "egress": {
    "pricePkrPerGb": 40,
    "hardCapGbPerMonth": 10,
    "throttleAfterCap": true
  },
  "costBasisUsd": {
    "storagePerGb": 0.026,
    "egressPerGb": 0.12,
    "functionPerMillion": 0.40,
    "firestoreReadPer100k": 0.06,
    "firestoreWritePer100k": 0.18
  },
  "guardrails": {
    "minStorageMarginPct": 40,
    "minEgressMarginPct": 40,
    "playFeePct": 15,
    "firebaseBudgetAlertPkr": [10000, 20000, 35000],
    "autoThrottleOnNegativeMarginDays": 2
  }
}
```

**Cloud Function startup assertion (`functions/src/config/guard.ts`):**

```typescript
import pricing from '../../../config/pricing.json';

export function assertPricingSafety() {
  const fx = pricing.fx_usd_to_pkr;
  const costStoragePkr = pricing.costBasisUsd.storagePerGb * fx;
  const costEgressPkr = pricing.costBasisUsd.egressPerGb * fx;

  const storageMargin =
    (pricing.storage.pricePkrPerGbMonth - costStoragePkr) /
    pricing.storage.pricePkrPerGbMonth;
  const egressMargin =
    (pricing.egress.pricePkrPerGb - costEgressPkr) /
    pricing.egress.pricePkrPerGb;

  const minS = pricing.guardrails.minStorageMarginPct / 100;
  const minE = pricing.guardrails.minEgressMarginPct / 100;

  if (storageMargin < minS) {
    throw new Error(`FATAL: Storage margin ${storageMargin} < ${minS}`);
  }
  if (egressMargin < minE) {
    throw new Error(`FATAL: Egress margin ${egressMargin} < ${minE}`);
  }
  console.log('✅ Pricing safety asserted');
}
```

Called at the top of `functions/src/index.ts` — **prevents deploy if pricing is unsafe.**

---

## 4. Firestore Security Rules (complete)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function signedIn() { return request.auth != null; }
    function uid() { return request.auth.uid; }
    function memberOf(t) {
      return signedIn() &&
        exists(/databases/$(db)/documents/tenants/$(t)/members/$(uid()));
    }
    function roleOf(t) {
      return get(/databases/$(db)/documents/tenants/$(t)/members/$(uid())).data.role;
    }
    function isAdmin(t) { return memberOf(t) && roleOf(t) == 'admin'; }
    function canWriteInvoices(t) {
      return memberOf(t) && roleOf(t) in ['admin','architect'];
    }

    match /users/{userId} {
      allow read, write: if signedIn() && uid() == userId;
    }

    match /tenants/{t} {
      allow read: if memberOf(t);
      allow create: if signedIn();
      allow update: if isAdmin(t) &&
        !request.resource.data.diff(resource.data)
          .affectedKeys().hasAny(['subscription','storage']);
      allow delete: if false;
    }

    match /tenants/{t}/members/{m} {
      allow read: if memberOf(t);
      allow write: if isAdmin(t);
    }

    match /tenants/{t}/invites/{code} {
      allow read: if isAdmin(t);
      allow create: if isAdmin(t);
      allow update: if signedIn() && request.resource.data.used == true;
    }

    match /tenants/{t}/projects/{p} {
      allow read: if memberOf(t);
      allow create, update: if canWriteInvoices(t);
      allow delete: if isAdmin(t);
    }

    match /tenants/{t}/counters/{c} {
      allow read: if memberOf(t);
      allow write: if false;   // Functions only
    }

    match /tenants/{t}/invoices/{i} {
      allow read: if memberOf(t);
      allow create: if canWriteInvoices(t) &&
        request.resource.data.status == 'draft' &&
        request.resource.data.serial == null;
      allow update: if canWriteInvoices(t) &&
        resource.data.status in ['draft','issued'];
      allow delete: if false;
    }

    match /tenants/{t}/storage_ledger/{d} {
      allow read: if isAdmin(t);
      allow write: if false;
    }

    match /tenants/{t}/billing/{m} {
      allow read: if isAdmin(t);
      allow write: if false;
    }
  }
}
```

---

## 5. Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /tenants/{t}/{allPaths=**} {
      allow read: if request.auth != null &&
        firestore.get(
          /databases/(default)/documents/tenants/$(t)/members/$(request.auth.uid)
        ) != null;
      allow write: if false;   // signed URLs from Functions only
    }
  }
}
```

---

## 6. Firestore Indexes

**File: `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "financialYear", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "projects",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 7. Cloud Functions — Implementation Specs

### 7.1 `createTenant` (callable)
```typescript
// Input: { name, ceoName, logoBase64?, sealBase64? }
// Behavior:
//   1. Validate auth + user has no tenantId
//   2. Create /tenants/{newId} with default settings + subscription (trial 14d)
//   3. Set /users/{uid}.tenantId, role='admin'
//   4. Add /tenants/{id}/members/{uid} { role:'admin' }
//   5. If logoBase64: upload to Storage, set logoUrl
//   6. Same for seal
//   7. Return { tenantId }
```

### 7.2 `joinTenant` (callable)
```typescript
// Input: { inviteCode }
// Behavior:
//   1. Validate invite exists, not used, not expired
//   2. Create member doc with invite.role
//   3. Mark invite.used = true
//   4. Update user.tenantId, role
```

### 7.3 `allocateSerialAndCreateInvoice` (callable) ⭐ CRITICAL
```typescript
// Input: { projectId, category, lineItems[], taxRate, clientName }
// Uses Firestore transaction — atomic serial + invoice create
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const allocateSerialAndCreateInvoice = onCall(async (req) => {
  const uid = req.auth?.uid; if (!uid) throw new HttpsError('unauthenticated', '');
  const { tenantId, projectId, category, lineItems, taxRate, clientName } = req.data;

  // Validate membership
  const memberSnap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
  if (!memberSnap.exists) throw new HttpsError('permission-denied', '');
  const role = memberSnap.data()!.role;
  if (!['admin','architect'].includes(role)) throw new HttpsError('permission-denied', '');

  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  const tenant = tenantSnap.data()!;
  if (tenant.subscription.status === 'locked') {
    throw new HttpsError('failed-precondition', 'Subscription locked');
  }

  const fy = tenant.settings.invoiceDefaults.financialYear;
  const prefix = tenant.settings.invoiceDefaults.prefix[category];
  const startAt = tenant.settings.invoiceDefaults.startAt[category];
  const counterId = `${category}_${fy}`;
  const counterRef = db.doc(`tenants/${tenantId}/counters/${counterId}`);
  const invoiceRef = db.collection(`tenants/${tenantId}/invoices`).doc();

  return db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const next = counterSnap.exists ? counterSnap.data()!.nextValue : startAt;
    const serial = `${prefix}-${fy}-${String(next).padStart(4, '0')}`;

    const subtotal = lineItems.reduce(
      (s: number, i: any) => s + i.amount, 0);
    const tax = +(subtotal * (taxRate || 0) / 100).toFixed(2);
    const total = subtotal + tax;

    tx.set(counterRef, {
      category, financialYear: fy, prefix,
      nextValue: next + 1, lastIssuedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    tx.set(invoiceRef, {
      serial, category, financialYear: fy,
      projectId, clientName, lineItems,
      subtotal, tax, total, currency: 'PKR',
      status: 'draft', pdfPath: null, pdfSnapshotHash: null,
      createdBy: uid, createdAt: FieldValue.serverTimestamp(),
      issuedAt: null
    });

    return { invoiceId: invoiceRef.id, serial };
  });
});
```

### 7.4 `issueInvoiceAndGeneratePdf` (callable)
```typescript
// Input: { invoiceId }
// Behavior:
//   1. Load invoice + tenant (logo, seal, ceoName)
//   2. Render HTML from template (see §9)
//   3. Puppeteer → PDF buffer
//   4. Upload to Storage: tenants/{t}/invoices/{id}.pdf
//   5. Update invoice: status='issued', pdfPath, pdfSnapshotHash, issuedAt
//   6. Append storage_ledger doc (deltaBytes)
//   7. Update tenant.storage.usedBytes (atomic increment)
//   8. If usedBytes > quota → return warning flag
```

### 7.5 `getSignedPdfUrl` (callable)
```typescript
// Input: { invoiceId }
// Behavior:
//   1. Verify membership
//   2. Check egress budget: if egressMonthBytes >= hardCap * 1e9 → throw 'quota-exceeded'
//   3. Generate signed URL (15 min)
//   4. Log egress_estimate to storage_ledger (actual measured on cloud storage logs)
//   5. Return { url, estimatedBytes }
```

### 7.6 `playRTDNWebhook` (HTTPS function)
```typescript
// Receives Google Pub/Sub push from Play RTDN
// Verify JWT from Google
// On SUBSCRIPTION_PURCHASED / RENEWED:
//   - Look up tenant by purchaseToken (index on subscription.purchaseToken)
//   - Update subscription.status='active', currentPeriodEnd
// On SUBSCRIPTION_CANCELED / EXPIRED:
//   - status='grace' for 3 days, then 'locked' via scheduled function
// On CONSUMABLE_PURCHASED (storage pack):
//   - Increment tenant.storage.purchasedGb by pack count
```

### 7.7 `dailyMeteringCron` (scheduled — every 24h)
```typescript
// For each tenant:
//   1. Read Cloud Monitoring / Storage usage API for bytes + egress
//   2. Compute computedCostPkr using config/pricing costBasisUsd * fx
//   3. Compute revenuePkr = subscription.pricePkr + packsSold*100
//   4. Write /tenants/{t}/billing/{yyyy-mm}
//   5. If marginPkr < 0 for N consecutive days → set tenant.storage.throttled = true
//   6. Send FCM to admin if margin negative 2 days running
```

### 7.8 `gracePeriodEnforcer` (scheduled — hourly)
```typescript
// Find tenants with subscription.status='grace' and currentPeriodEnd + 3d < now
// → set status='locked' (read-only mode enforced in rules + app)
```

### 7.9 `configGuard` (deploy-time, non-function)
Runs in CI as pre-deploy script — calls `assertPricingSafety()`.

---

## 8. Android App — Screen List & Requirements

| # | Screen | Key behaviors |
|---|---|---|
| 1 | Splash | Check auth → route |
| 2 | Google Sign-In | Firebase Auth `GoogleAuthProvider` |
| 3 | Onboarding Choice | Create Company / Join Company |
| 4 | Create Company | Name, CEO, upload logo, upload seal (image picker → compress → base64) |
| 5 | Join Company | Enter invite code |
| 6 | Home / Dashboard | Subscription status, storage usage bar, quick actions |
| 7 | Project List | Filter active/archived, FAB new |
| 8 | Create Project | Name, type Res/Comm, area+unit, client, assign architects (multi-select), rateCard per category |
| 9 | Project Detail | Invoices list, generate invoice button |
| 10 | Create Invoice | Category selector, line items (per-sqft auto or manual), tax, preview total |
| 11 | Invoice Preview | Serial shown after create, "Issue & Generate PDF" |
| 12 | PDF Viewer | Download, Share (intent), cached copy |
| 13 | Billing | Subscription status, "Buy Storage Pack" (Play Billing), usage |
| 14 | History | Search, filter by category/date, bulk export ZIP |
| 15 | Settings | Company edit (admin), members, invites, invoice prefixes/start numbers |

**State management:** MVVM + StateFlow + Hilt DI
**Offline:** Room DB for drafts; WorkManager sync queue
**Error surface:** Snackbar for transient; dialog for quota/subscription blocks

---

## 9. PDF Template (HTML for Puppeteer)

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1a1a1a; }
  .header { display:flex; justify-content:space-between; align-items:center;
            border-bottom:3px solid #0f172a; padding-bottom:20px; }
  .brand { display:flex; gap:16px; align-items:center; }
  .brand img.logo { max-height:60px; }
  .brand h1 { margin:0; font-size:22px; }
  .meta { text-align:right; font-size:12px; }
  .meta .serial { font-size:16px; font-weight:700; color:#0f172a; }
  table { width:100%; border-collapse:collapse; margin-top:32px; }
  th { background:#f1f5f9; text-align:left; padding:10px; font-size:12px; }
  td { padding:10px; border-bottom:1px solid #e2e8f0; font-size:12px; }
  .totals { margin-top:20px; text-align:right; font-size:14px; }
  .totals .grand { font-size:18px; font-weight:700; margin-top:8px; }
  .footer { margin-top:80px; display:flex; justify-content:space-between;
            align-items:flex-end; }
  .seal { max-height:100px; opacity:0.9; }
  .signatory { text-align:center; font-size:12px; }
  .signatory .line { border-top:1px solid #333; width:200px;
                     margin-bottom:6px; padding-top:6px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img class="logo" src="{{logoUrl}}" />
      <h1>{{companyName}}</h1>
    </div>
    <div class="meta">
      <div class="serial">{{serial}}</div>
      <div>Date: {{issueDate}}</div>
      <div>Category: {{category}}</div>
    </div>
  </div>

  <div style="margin-top:24px">
    <strong>Bill To:</strong> {{clientName}}<br/>
    <strong>Project:</strong> {{projectName}} ({{projectType}})
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Description</th><th>Qty</th>
        <th>Rate (PKR)</th><th>Amount (PKR)</th>
      </tr>
    </thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>{{@index}}</td><td>{{desc}}</td><td>{{qty}}</td>
        <td>{{rate}}</td><td>{{amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <div>Subtotal: PKR {{subtotal}}</div>
    <div>Tax ({{taxRate}}%): PKR {{tax}}</div>
    <div class="grand">Total: PKR {{total}}</div>
  </div>

  <div class="footer">
    <div class="signatory">
      <div class="line"></div>
      {{ceoName}}<br/>Chief Executive Officer
    </div>
    {{#if sealUrl}}
    <img class="seal" src="{{sealUrl}}" />
    {{/if}}
  </div>
</body>
</html>
```

**Note:** Seal is a **visual watermark only** — add footer microtext: *"This seal is a company visual mark, not a certified digital signature."*

---

## 10. Play Billing Product Setup

**Products to create in Play Console:**

| Product ID | Type | Price | Description |
|---|---|---|---|
| `core_monthly` | Subscription | PKR 280/mo | Core app access |
| `storage_pack_1gb` | Consumable | PKR 100 | 1 GB storage pack (1 month) |
| `storage_pack_5gb` | Consumable | PKR 450 | 5 GB (10% discount) |

**Server verification flow:**
1. Client purchases → receives `purchaseToken`
2. Client → callable `verifyPurchase({productId, purchaseToken})`
3. Function calls **Google Play Developer API** `purchases.products.get` (consumable) or `purchases.subscriptions.get`
4. Verify `purchaseState = 0` (purchased), not already consumed
5. Apply benefit (extend subscription / add GB pack)
6. Return `{success: true}`

**Note on Play policy:** Usage-based automatic overage billing may require Play's dedicated usage-billing program. **MVP = prepaid packs only** (no surprise charges). Overage beyond cap = throttle, user buys more packs. This is 100% policy-compliant.

---

## 11. Environment / Config Files

**`firebase.json`**
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": { "rules": "storage.rules" },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "predeploy": ["npm --prefix functions run build"]
  },
  "hosting": {
    "public": "admin-console/out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  }
}
```

**`functions/package.json`**
```json
{
  "name": "arch-invoice-functions",
  "engines": { "node": "20" },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "deploy": "firebase deploy --only functions",
    "test": "jest"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "puppeteer": "^22.0.0",
    "handlebars": "^4.7.8"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

---

## 12. Testing Requirements

### Unit tests (functions)
- `allocateSerialAndCreateInvoice` — 100 concurrent calls produce 100 unique consecutive serials
- `assertPricingSafety` — throws when margin < config
- `dailyMeteringCron` — cost computed from mock usage matches expected

### Firestore rules tests (`@firebase/rules-unit-testing`)
- Tenant A cannot read Tenant B invoices
- Non-member cannot create invoice
- Architect can create invoice, cannot edit tenant
- Viewer cannot create invoice
- Client cannot write counters

### Android instrumentation tests
- Google Sign-In mock
- Create company flow
- Create invoice → verify serial format `{PREFIX}-{FY}-{NNNN}`
- PDF generated and downloadable

---

## 13. CI/CD Pipeline

**`.github/workflows/deploy.yml`**
```yaml
name: Deploy
on: { push: { branches: [main] } }
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/assertPricingSafety.js
  functions:
    needs: guard
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci --prefix functions
      - run: npm test --prefix functions
      - run: npm run build --prefix functions
      - uses: w9jds/firebase-action@master
        with: { args: deploy --only functions }
        env:
          GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
  rules:
    needs: guard
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: w9jds/firebase-action@master
        with: { args: deploy --only firestore:rules,firestore:indexes,storage }
        env:
          GCP_SA_KEY: ${{ secrets.GCP_SA_KEY }}
```

---

## 14. Key Implementation Rules for Copilot

> **Copilot: when generating any code, enforce these rules.**

1. **Never** allow a client to write `serial`, `subscription`, `storage`, or `counters` documents. Only Cloud Functions (admin SDK) write these.
2. **Every** callable function must start with auth + membership check.
3. **Every** Firestore query must be scoped by `tenantId` path.
4. **Every** billing-affecting resource (PDF, egress, storage pack) must log to `storage_ledger`.
5. **Every** new configurable price/cap must go in `config/pricing.json`, never hardcoded.
6. **Every** PDF generation must embed the tenant's logo and seal (if present) and include the "visual seal" disclaimer.
7. **Every** invoice must have a serial set by `allocateSerialAndCreateInvoice` — reject any client-supplied serial.
8. **Every** subscription check must happen both client-side (UX) and server-side (enforcement).
9. **All** timestamps use `FieldValue.serverTimestamp()`.
10. **All** money fields are integers (PKR paisa) or decimals — never floats without rounding.
11. Use **transactions** for any multi-doc write affecting counters, quotas, or billing.
12. Follow **Android MVVM** with StateFlow; no business logic in Composables.
13. Use **Hilt** for DI; no service locator pattern.
14. Use **TypeScript strict mode** for all Functions.
15. Every module must have a corresponding test file.

---

## 15. Acceptance Test Script (Manual QA)

```
[T-01] Sign in with Google → lands on Create/Join Company
[T-02] Create company "Acme Arch" with logo + seal + CEO → home screen
[T-03] Invite architect by code → architect joins on second device
[T-04] Create project "Villa 12" residential 2000 sqft, rateCard architecture=150 → saved
[T-05] Create invoice architecture, 2000 qty @ 150 → subtotal 300,000
[T-06] Issue → serial "ARCH-2025-0001" appears
[T-07] Create second invoice same category → serial "ARCH-2025-0002"
[T-08] Create interior invoice → serial "INT-2025-0001" (independent counter)
[T-09] Generate PDF → verify logo + seal + CEO name present in PDF
[T-10] Download PDF → storage_ledger entry created, egressMonthBytes incremented
[T-11] Concurrent test: 10 clients create architecture invoices simultaneously → 10 unique consecutive serials, no gaps
[T-12] Buy storage pack PKR 100 → tenant.storage.purchasedGb +1
[T-13] Exceed 1 GB storage → new PDF blocked with "buy pack" prompt
[T-14] Exceed 10 GB egress → downloads throttled to 1/day
[T-15] Subscription expires + 3 days → locked status, invoices read-only
[T-16] Viewer role attempts invoice creation → denied
[T-17] Firestore rules test: tenant A → can read own, denied tenant B
[T-18] Config guard: set storagePricePerGb=10 → CI deploy fails
[T-19] Margin simulation: heavy downloader (30 GB egress) → daily meter shows positive margin
[T-20] Bulk ZIP export → only 1 per day enforced
```

---

## 16. Deployment Checklist

- [ ] Firebase project created (Blaze plan, budget alerts set at PKR 10k/20k/35k)
- [ ] Auth providers enabled: Google
- [ ] Firestore rules + indexes deployed
- [ ] Storage rules deployed
- [ ] Cloud Functions deployed (`nodejs20`)
- [ ] Play Console app created, products configured
- [ ] Play RTDN Pub/Sub topic configured → webhook URL set
- [ ] GCP Service Account for Play Developer API created, secret stored
- [ ] Android signing keys, Play App Signing enabled
- [ ] `config/pricing.json` committed, guard passing
- [ ] Sentry / Crashlytics enabled
- [ ] Analytics events defined
- [ ] Legal: privacy policy, terms, refund policy URLs in Play listing
- [ ] Backup: Firestore daily export to Cloud Storage bucket

---

## 17. Analytics Events (Firebase Analytics)

| Event | Params |
|---|---|
| `company_created` | `{company_name_hash}` |
| `project_created` | `{type, area}` |
| `invoice_created` | `{category, line_count, total}` |
| `invoice_issued` | `{serial_prefix, category}` |
| `pdf_generated` | `{invoice_id, size_kb, duration_ms}` |
| `pdf_downloaded` | `{invoice_id}` |
| `storage_pack_purchased` | `{pack_size_gb, price_pkr}` |
| `quota_exceeded` | `{resource: 'storage'|'egress'}` |
| `subscription_locked` | `{days_since_expiry}` |

---

## 18. Out of Scope (Phase 2+)

- iOS app
- Web tenant portal (only owner console in MVP)
- Automatic usage-based billing (Play policy confirmation pending)
- Urdu localization
- Multi-currency
- Tax e-filing integration (FBR)
- Offline-first (Room drafts in MVP; full offline sync Phase 2)

---

## 19. Final Sign-Off Decisions

| Decision | Value |
|---|---|
| Base subscription | PKR 280/month, 1 GB storage, 3 GB egress |
| Storage pack | PKR 100/GB/month, prepaid consumable |
| Egress overage | PKR 40/GB, hard cap 10 GB/month |
| Pricing safety | Config guard blocks unsafe deploy |
| Serial allocation | Transactional, per (tenant, category, FY) |
| Financial protection | Metering + caps + auto-throttle, enforced in code |
| Abuse prevention | Signed URLs, rate-limited bulk export, no "unlimited" feature |
| Platform | Android (Compose) + Firebase + Next.js admin |

**This document is complete and buildable. Copilot: proceed to scaffold in order — Firebase configs → Functions → Rules → Android → Admin console → Tests → CI.**

---

**End of Spec.** — *Paste into Copilot, then say: "Scaffold the project per SPEC §1" to begin.*