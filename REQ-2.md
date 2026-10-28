# 📐 Module 2: Project Progress & Client Collaboration Workflow
## (Urdu Requirements → Refined Engineering Spec)

> **Aap ka requirement (Urdu summary):** Client aur assigned architect/team ke darmiyan drawing upload → client review → comments/objections → rectification → status tracking ka poora loop app ke andar hona chahiye. Phone calls / WhatsApp ka manual interaction replace ho. Notifications se client ko pata chale ke uski drawing upload ho gayi hai, woh login karke check kare, comment daale, aur architect rectify karke wapas upload kare.

---

## 1. Requirement Translation (Raw Urdu → Structured)

| # | Urdu Raw Statement | Refined Requirement |
|---|---|---|
| U1 | "جو بندہ جس کو پروجیکٹ ایسائن کریں وہ پروگرس اپلوڈ کرے" | Assigned architect/staff uploads progress updates (drawings, documents, photos) against a project. |
| U2 | "کلائنٹ اس کو چیک کرے، اس کو میسج آئے" | Client receives push notification when a new drawing/update is uploaded for their project. |
| U3 | "لوگن کر کے چیک کرے" | Client logs in (Google auth) and opens the specific project by ID to review. |
| U4 | "کوئی کمنٹ ہے وہ فیڈ کرے، یہ ہمارے objection ہیں" | Client submits comments / objections attached to specific drawing or pin/marker. |
| U5 | "ان کو ریکٹیفائی کر لیں" | Architect receives objection, rectifies, re-uploads revised version; loop continues. |
| U6 | "جو بندہ کیا سٹیٹس ہے" | Each drawing/comment has a live status (Pending Review, Objection Raised, Rectified, Approved). |
| U7 | "پلائنڈ کی ڈائریکٹ فون کے interaction، وہ ایپ کے تھرو ہو جائے گی" | All manual phone/WhatsApp interactions replaced by in-app structured workflow. |
| U8 | "اپنی چیک کرے، کوئی ری ہے وہ ڈال دے" | Client can add "re" (remarks/revisions) directly in app. |
| U9 | "آج ہے نوٹیفکیشن کہ یہ پروجیکٹ ID ہے، یہ concern ہے" | Notification payload contains project ID + concern reference so client can deep-link into the exact item. |
| U10 | "اس کی ڈرائنگ اپ لوڈ کر دیں اس طریقے سے" | Round-trip loop: upload → notify → review → comment → rectify → re-upload → approve. |

---

## 2. User Roles in This Module

| Role | Capability |
|---|---|
| **Architect (Uploader)** | Upload drawings, view client comments, mark rectified, re-upload versions |
| **Client (Reviewer)** | View drawings, add comments/objections (text + pin), approve/reject, upload reference files |
| **Firm Admin** | Supervise all projects, escalate stalled reviews, reassign architect |
| **Platform Owner** | Read-only (for support/dispute resolution) |

> **New role introduced:** `client` — a distinct auth role with **project-scoped access** (only sees projects where they are listed as client). This is a new concept vs the original invoice-only spec.

---

## 3. Functional Requirements (New — Prefix `FR-PROG`)

### 3.1 Project Client Assignment
| ID | Requirement | Priority |
|---|---|---|
| FR-PROG-01 | Admin can attach **Client Contact** to a project (name, email, phone, Google account). Sends invite link. | Must |
| FR-PROG-02 | Client accepts invite → gets `client` role **scoped to that project only** (not company-wide). | Must |
| FR-PROG-03 | One project can have multiple client reviewers (e.g., husband + wife, or client + PMC). | Should |
| FR-PROG-04 | Client sees only their project(s) — **never** other projects or firm financial data. | Must |

### 3.2 Drawing / Progress Upload (Architect side)
| ID | Requirement | Priority |
|---|---|---|
| FR-PROG-05 | Architect uploads a **Drawing** (PDF, DWG, JPG, PNG — max 25 MB each) or a **Progress Update** (photo + text) to a project. | Must |
| FR-PROG-06 | Each upload creates a **Revision** object with auto-incremented revision number (R1, R2, R3…). | Must |
| FR-PROG-07 | Upload requires: title, category (Architecture / Interior / Supervision / Structural / MEP / Other), and optional description. | Must |
| FR-PROG-08 | Multiple files per revision allowed (as a "drawing set"). | Should |
| FR-PROG-09 | Upload triggers **push notification + email** to all client reviewers on that project. | Must |
| FR-PROG-10 | Architect can **replace** a revision before client opens it (soft-delete original, keep audit trail). | Should |
| FR-PROG-11 | Uploading a new revision of an existing drawing keeps the full version history visible to both parties. | Must |

### 3.3 Client Review & Commenting
| ID | Requirement | Priority |
|---|---|---|
| FR-PROG-12 | Client opens drawing in in-app viewer (PDF/image pan-zoom; DWG rendered via Cloud Function to PDF first — Phase 2). | Must |
| FR-PROG-13 | Client can add **comments** — text only (MVP), **pinned to a location on the drawing** (Phase 2). | Must (text) / Should (pin) |
| FR-PROG-14 | Comment types: **Question**, **Objection**, **Approval Note**. | Must |
| FR-PROG-15 | Client can upload **reference files** with a comment (e.g., screenshot showing the issue). | Should |
| FR-PROG-16 | Client can mark revision as **Approved** (locks further comments on that revision). | Must |
| FR-PROG-17 | Client can **Reject** → forces status = "Objection Raised" and architect must respond. | Must |
| FR-PROG-18 | Every comment threads — architect can reply inline (not just re-upload). | Must |

### 3.4 Status Lifecycle (Critical)
Every **Revision** has a state machine:

```
DRAFT
  └─> PENDING_REVIEW         (architect uploaded, client notified)
        ├─> UNDER_REVIEW     (client opened it)
        │     ├─> APPROVED    (client accepted — terminal)
        │     └─> OBJECTION_RAISED   (client rejected/commented)
        │           └─> RECTIFICATION_IN_PROGRESS   (architect working)
        │                 └─> RECTIFIED (new revision uploaded → new PENDING_REVIEW)
        └─> AUTO_ESCALATED   (no client action in X days — admin notified)
```

| ID | Requirement | Priority |
|---|---|---|
| FR-PROG-19 | Status transitions are **server-enforced** (Cloud Function), never client-writable directly. | Must |
| FR-PROG-20 | Each transition writes to `revision_events` audit log (who, when, from, to, note). | Must |
| FR-PROG-21 | Status shown as colored badge in app (grey/blue/amber/green/red). | Must |
| FR-PROG-22 | Admin dashboard shows **aging report**: revisions pending > 7 days, objections open > 3 days. | Should |

### 3.5 Notifications (Deep-linkable)
| ID | Requirement | Priority |
|---|---|---|
| FR-PROG-23 | On upload → client push: `"Drawing 'Ground Floor Plan R2' uploaded for Project Villa-12. Tap to review."` with **deep link** to the exact revision. | Must |
| FR-PROG-24 | On comment → architect push: `"Client raised 3 objections on 'Ground Floor Plan R2'. Tap to view."` | Must |
| FR-PROG-25 | On approval → architect + admin push. | Must |
| FR-PROG-26 | On rectification upload → client push (loop continues). | Must |
| FR-PROG-27 | **Escalation reminders**: pending review > 3 days → daily nudge to client; > 7 days → notify admin. | Should |
| FR-PROG-28 | Notification preferences per user (push / email / both / off per event type). | Should |
| FR-PROG-29 | Notification payload MUST contain: `projectId`, `revisionId`, `eventType`, `deepLink` — so tapping opens exact screen. | Must |

### 3.6 Revisions & Versioning
| ID | Requirement | Priority |
|---|---|---|
| FR-PROG-30 | A drawing has a **Drawing Group** (`drawingId`) with many revisions (`revisionId`). | Must |
| FR-PROG-31 | Old revisions are **immutable** (can't be edited/deleted after issue). | Must |
| FR-PROG-32 | Client can compare R1 vs R2 (Phase 2: side-by-side PDF compare via Cloud Function). | Could |
| FR-PROG-33 | Only latest revision appears by default; toggle to view history. | Should |

### 3.7 Communication Log
| ID | Requirement | Priority |
|---|---|---|
| FR-PROG-34 | All in-app messages/comments are **timestamped, immutable, and exportable** (PDF transcript per drawing) — replaces WhatsApp records for dispute resolution. | Must |
| FR-PROG-35 | No WhatsApp/email-based comment accepted as authoritative — only in-app comments count as formal. (Policy note.) | Must |

---

## 4. Non-Functional Requirements (New)

| ID | Requirement |
|---|---|
| NFR-PROG-01 | Drawing upload ≤ 25 MB each; progress photo ≤ 10 MB; auto-compress images client-side. |
| NFR-PROG-02 | PDF viewer must load a 25 MB file in ≤ 4 s on 3G. |
| NFR-PROG-03 | File uploads use **signed URLs** with resumable upload (Firebase Storage resumable protocol). |
| NFR-PROG-04 | All files virus-scanned via Cloud Function (ClamAV) before client notification. |
| NFR-PROG-05 | Drawing uploads count against tenant storage quota (§Pricing ADR-001) — big CAD files can blow quota → enforce per-file cap and warn. |
| NFR-PROG-06 | Comment submission ≤ 1 s round-trip (optimistic UI). |
| NFR-PROG-07 | Deep-link must resolve to correct screen even if app cold-started. |
| NFR-PROG-08 | Audit log immutable (append-only collection, no update/delete rules). |

---

## 5. Firestore Data Model — New Collections

```typescript
// ===== PROJECT CLIENTS (many per project) =====
// /tenants/{t}/projects/{projectId}/clients/{clientUid}
interface ProjectClientDoc {
  clientUid: string;              // Firebase Auth uid
  name: string;
  email: string;
  phone?: string;
  inviteStatus: 'invited' | 'accepted' | 'revoked';
  invitedBy: string;
  invitedAt: Timestamp;
  acceptedAt?: Timestamp;
}

// ===== DRAWING GROUPS (logical drawing) =====
// /tenants/{t}/projects/{projectId}/drawings/{drawingId}
interface DrawingDoc {
  title: string;
  category: 'architecture' | 'interior' | 'supervision'
          | 'structural' | 'mep' | 'other';
  description?: string;
  currentRevisionId: string;
  currentRevisionNumber: number;   // 1, 2, 3...
  status: RevisionStatus;          // mirrors current revision
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type RevisionStatus =
  | 'pending_review'
  | 'under_review'
  | 'objection_raised'
  | 'rectification_in_progress'
  | 'rectified'
  | 'approved'
  | 'auto_escalated';

// ===== REVISIONS (immutable once issued) =====
// /tenants/{t}/projects/{projectId}/drawings/{drawingId}/revisions/{revId}
interface RevisionDoc {
  revisionNumber: number;        // 1,2,3...
  files: {
    path: string;                // Storage path
    name: string;
    sizeBytes: number;
    mimeType: string;
    virusScanned: boolean;
  }[];
  status: RevisionStatus;
  uploadedBy: string;
  uploadedAt: Timestamp;
  clientNotifiedAt?: Timestamp;
  firstOpenedByClientAt?: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  revisionOf?: string;           // previous revisionId if rectification
  rectifiesObjectionIds?: string[];
}

// ===== COMMENTS (threaded) =====
// /tenants/{t}/projects/{projectId}/drawings/{drawingId}/revisions/{revId}/comments/{commentId}
interface CommentDoc {
  authorUid: string;
  authorRole: 'client' | 'architect' | 'admin';
  type: 'question' | 'objection' | 'approval_note' | 'reply';
  body: string;
  attachments?: { path: string; name: string; sizeBytes: number; }[];
  pin?: { x: number; y: number; page: number };   // normalized 0..1, phase 2
  status: 'open' | 'resolved' | 'wont_fix';
  parentCommentId?: string;      // for threaded replies
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
}

// ===== REVISION EVENT LOG (append-only audit) =====
// /tenants/{t}/projects/{projectId}/drawings/{drawingId}/events/{eventId}
interface RevisionEventDoc {
  revisionId: string;
  fromStatus: RevisionStatus | null;
  toStatus: RevisionStatus;
  actorUid: string;
  actorRole: string;
  note?: string;
  at: Timestamp;
}

// ===== NOTIFICATION QUEUE (for reliable delivery + retry) =====
// /users/{uid}/notifications/{notifId}
interface NotificationDoc {
  type: 'drawing_uploaded' | 'comment_added' | 'approved'
      | 'rejected' | 'reminder' | 'escalation';
  projectId: string;
  drawingId: string;
  revisionId?: string;
  title: string;
  body: string;
  deepLink: string;              // e.g. archinvoice://project/{pid}/drawing/{did}/rev/{rid}
  read: boolean;
  createdAt: Timestamp;
}
```

**Firestore indexes to add:**
```json
{ "collectionGroup": "drawings",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]},
{ "collectionGroup": "comments",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]}
```

---

## 6. Firestore Security Rules — Additions

```javascript
// Add inside match /databases/{db}/documents

function isClientOf(t, p) {
  return signedIn() &&
    exists(/databases/$(db)/documents/tenants/$(t)/projects/$(p)/clients/$(uid()));
}
function memberOrClient(t, p) {
  return memberOf(t) || isClientOf(t, p);
}

match /tenants/{t}/projects/{p}/clients/{cuid} {
  allow read: if memberOf(t) || cuid == uid();
  allow create, update, delete: if isAdmin(t);
}

match /tenants/{t}/projects/{p}/drawings/{d} {
  allow read: if memberOrClient(t, p);
  allow create: if canWriteInvoices(t);           // admin/architect only
  allow update: if false;                          // functions only
  allow delete: if false;
}

match /tenants/{t}/projects/{p}/drawings/{d}/revisions/{r} {
  allow read: if memberOrClient(t, p);
  allow create: if false;   // via createRevision callable (sets status + notifies)
  allow update: if false;   // state transitions via Functions
  allow delete: if false;
}

match /tenants/{t}/projects/{p}/drawings/{d}/revisions/{r}/comments/{cm} {
  allow read: if memberOrClient(t, p);
  allow create: if (memberOrClient(t, p)) &&
    request.resource.data.authorUid == uid() &&
    request.resource.data.status == 'open';
  allow update: if false;   // resolve via Function (sets resolvedBy/At)
  allow delete: if false;
}

match /tenants/{t}/projects/{p}/drawings/{d}/events/{e} {
  allow read: if memberOf(t);
  allow write: if false;    // append-only via Functions
}

match /users/{u}/notifications/{n} {
  allow read, update: if uid() == u &&  // client marks read
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['read']);
  allow create, delete: if false;       // Functions only
}
```

---

## 7. Cloud Functions — New

### 7.1 `createDrawing` (callable)
```typescript
// Input: { projectId, title, category, description?, files: [{path,name,size,mime}] }
// Behavior:
//   1. Auth + architect/admin check
//   2. Quota check: tenant.storage.usedBytes + sum(files.size) <= quota
//   3. Create drawing doc + revision R1
//   4. Atomic: increment tenant.storage.usedBytes
//   5. Log to storage_ledger
//   6. Fan out notifications to all project clients
//   7. Return { drawingId, revisionId }
```

### 7.2 `uploadRevision` (callable) — Rectification path
```typescript
// Input: { drawingId, files, note?, rectifiesObjectionIds[] }
// Behavior:
//   1. Auth + architect/admin
//   2. Load drawing, currentRevision
//   3. Enforce: currentRevision.status in ['objection_raised','rectification_in_progress','approved']
//      (cannot upload while pending_review — client hasn't seen previous)
//   4. revisionNumber = current + 1
//   5. Create revision (status='pending_review')
//   6. Update drawing.currentRevisionId, status
//   7. Write event log
//   8. Mark referenced objections as 'resolved' if `rectifiesObjectionIds`
//   9. Notify clients
```

### 7.3 `addComment` (callable)
```typescript
// Input: { drawingId, revisionId, type, body, attachments?, parentCommentId? }
// Behavior:
//   1. Auth: member OR client of project
//   2. Enforce revision not approved (locked)
//   3. Create comment
//   4. If type='objection' → transition revision status to 'objection_raised' (if not already)
//   5. Notify opposite party (client commented → notify architect; architect replied → notify clients)
```

### 7.4 `resolveComment` (callable)
```typescript
// Input: { commentId, resolution: 'resolved'|'wont_fix', note? }
// Behavior:
//   1. Auth: architect/admin only (client cannot resolve own objection)
//   2. Update comment.status, resolvedBy, resolvedAt
//   3. If all objections on revision resolved → transition status to 'rectification_in_progress'
```

### 7.5 `approveRevision` (callable)
```typescript
// Input: { drawingId, revisionId, note? }
// Behavior:
//   1. Auth: client of project only
//   2. Enforce: no open objections on this revision (or client explicitly overrides)
//   3. Set status='approved', approvedAt, approvedBy
//   4. Update drawing.status
//   5. Event log
//   6. Notify architect + admin
//   7. Revision becomes immutable
```

### 7.6 `markRevisionOpened` (callable)
```typescript
// Input: { drawingId, revisionId }
// Triggered automatically when client opens viewer
// → transition 'pending_review' → 'under_review' (idempotent)
// → set firstOpenedByClientAt
```

### 7.7 `sendRevisionNotifications` (Firestore onCreate trigger)
```typescript
// On revisions/{r} create:
//   - Query project clients
//   - For each: create NotificationDoc + send FCM (data payload includes deepLink)
//   - Respect user prefs
//   - Retry with exponential backoff on failure (Pub/Sub + Cloud Tasks)
```

### 7.8 `reviewEscalationCron` (scheduled daily 09:00 Asia/Karachi)
```typescript
// Find revisions where:
//   status='pending_review' AND uploadedAt < now-3d  → nudge client
//   status='pending_review' AND uploadedAt < now-7d  → notify admin + set status='auto_escalated'
//   status='objection_raised' AND lastObjectionAt < now-3d → nudge architect
```

### 7.9 `virusScanRevision` (Storage finalize trigger)
```typescript
// On new object in tenants/{t}/projects/{p}/...:
//   - Download to temp, ClamAV scan
//   - If infected → delete, mark revision.files[].virusScanned=false, notify uploader
//   - If clean → set virusScanned=true
//   - Block client notification until all files scanned clean (sendRevisionNotifications checks)
```

---

## 8. Notification Deep Link Spec

**Custom scheme:** `archinvoice://project/{projectId}/drawing/{drawingId}/rev/{revisionId}`

**Android intent filter:**
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="archinvoice" />
</intent-filter>
```

**FCM payload example:**
```json
{
  "to": "<client-fcm-token>",
  "notification": {
    "title": "Drawing uploaded — Villa 12",
    "body": "Ground Floor Plan R2 is ready for your review."
  },
  "data": {
    "type": "drawing_uploaded",
    "projectId": "abc123",
    "drawingId": "d456",
    "revisionId": "r789",
    "deepLink": "archinvoice://project/abc123/drawing/d456/rev/r789"
  }
}
```

**App must:** parse `data.deepLink` on notification tap → navigate (cold-start safe via `PendingIntent` with unique request code per notification).

---

## 9. Android Screens — New

| # | Screen | Roles | Key behaviors |
|---|---|---|---|
| 16 | Project Clients (admin) | admin | Invite client by email, view status |
| 17 | Client Invite Accept (deep link) | client | Accept invite → auto-assign project access |
| 18 | Drawing List (architect + client) | both | Cards grouped by category, status badges, "R2 · Pending Review" |
| 19 | Upload Drawing (architect) | architect | Pick files, category, title, description → upload progress |
| 20 | Drawing Viewer | both | PDF/image pan-zoom; comment sidebar; status banner |
| 21 | Comments Thread | both | Threaded, add comment, reply, attach file |
| 22 | Add Objection Sheet | client | Type selector, body, optional pin (phase 2) |
| 23 | Approve Confirmation | client | Confirm approval (irreversible warning) |
| 24 | Upload Rectification | architect | Pre-fills rectified objections, note field |
| 25 | Version History | both | List of revisions with status + timestamps |
| 26 | Notification Center | both | All notifications, mark read, filter unread |
| 27 | Aging Report (admin) | admin | Revisions pending > 7 days, objections > 3 days |

**Client navigation:** Client uses a **separate bottom nav**: `Projects → Notifications → Profile`. No access to Billing, Company, Invoices.

---

## 10. Status State Machine — Enforced Transitions

```typescript
const ALLOWED_TRANSITIONS: Record<RevisionStatus, RevisionStatus[]> = {
  pending_review:            ['under_review', 'auto_escalated'],
  under_review:              ['objection_raised', 'approved'],
  objection_raised:          ['rectification_in_progress', 'approved'],  // approved = client accepts anyway
  rectification_in_progress: ['rectified'],
  rectified:                 ['pending_review'],   // new revision spawns
  approved:                  [],                   // terminal
  auto_escalated:            ['under_review', 'objection_raised', 'approved'],
};
```

Every transition goes through `transitionRevisionStatus()` Cloud Function — **client cannot write status directly** (rules enforce this).

---

## 11. Storage Path Convention

```
tenants/{tenantId}/projects/{projectId}/drawings/{drawingId}/
    revisions/{revisionId}/{fileId}-{originalFileName}

tenants/{tenantId}/projects/{projectId}/drawings/{drawingId}/
    revisions/{revisionId}/comments/{commentId}/{fileName}
```

All uploads via **signed URLs** issued by `getUploadUrl` callable (adds virus scan + quota enforcement at finalize time).

---

## 12. Additional Refinements (Proactive — Recommended)

Ye woh cheezein hain jo aap ne nahi kahi lekin **zaroori hain** taake app professional lage aur disputes na hon:

| # | Refinement | Why it matters |
|---|---|---|
| R1 | **Revision comparison view** (R1 vs R2 side-by-side with highlighted diff) | Client bina compare kiye approve nahi karta; reduces back-and-forth |
| R2 | **Pin comments on drawing** (tap location → comment attached to coordinates) | "Yahan beam galat hai" — text-only comments are ambiguous |
| R3 | **Approval certificate** — auto-generated PDF "Drawing R2 approved by Client on 2025-10-27" | Legal protection; ends "maine approve nahi kiya" disputes |
| R4 | **CAD → PDF auto-conversion** (Cloud Function) | Clients often can't open DWG; convert to PDF + thumbnail |
| R5 | **Drawing expiry / supersession** — old revision auto-marked "Superseded by R3" | Prevents client from reviewing wrong version |
| R6 | **Bulk download ZIP** of all approved drawings per project | Client handover pack at project end |
| R7 | **Signature/acknowledgment** on approval (typed name + timestamp + IP) | Stronger than tap-only |
| R8 | **Client feedback score** per architect (optional, private to admin) | Performance tracking |
| R9 | **"Seen by client" indicator** (blue tick) | Architect knows client actually saw it — reduces "aap ne bheja hi nahi" disputes |
| R10 | **WhatsApp/Email fallback notification** if client hasn't opened in 3 days | Reach clients who don't check app |
| R11 | **Phase-wise drawing tracker** (Foundation → Plinth → Roof → Finishing) | Aligns with construction stage payments — ties to invoice module |
| R12 | **Admin escalation button** ("Escalate to Admin") on any stalled thread | Client can complain without phone call |
| R13 | **Comment transcription for voice notes** (Urdu → text, Phase 2) | Clients prefer voice; transcription creates searchable record |
| R14 | **Revision linked to invoice** — e.g., R3 completion triggers "Supervision invoice due" | Integration with invoice module |
| R15 | **Contract terms in-app** — client can see what's in scope vs out of scope | Prevents scope-creep objections |
| R16 | **PDF transcript of full comment thread** per drawing (immutable) | Dispute resolution artifact |
| R17 | **Multi-reviewer approval** — approval threshold = 1 or 2 reviewers (configurable) | PMC scenarios |
| R18 | **Auto-reminder to architect** when client comment pending > 2 days | Balances the nudging |
| R19 | **Drawing title standards** (auto-suggest: "Ground Floor – Electrical Layout") | Consistency, searchability |
| R20 | **Project timeline view** — Gantt of drawings vs approval status | Client can see project health at a glance |

**Priority for MVP (Phase 1):** R3, R5, R9, R10, R12, R16
**Phase 2:** R1, R2, R4, R11, R13, R14, R17, R20

---

## 13. Pricing / Quota Impact (CRITICAL — Ties to ADR-001)

Drawings are **large files** (PDF 5–25 MB each, DWG 10–50 MB). This **blows the 1 GB base quota fast**:

| Activity | Typical size | Tenant impact |
|---|---|---|
| Ground floor plan PDF | 5 MB | 200 uploads = 1 GB |
| Full drawing set (10 files) | 40 MB | 25 revisions = 1 GB |
| Client download of all | 40 MB × 25 = 1 GB | **entire month egress budget** |

**Decision required:** Drawing storage uses a **different pack** than invoice PDFs.

### Recommended: **Drawing Storage Pack**
| Plan | Base (included) | Add-on |
|---|---|---|
| Drawing storage | **500 MB / project** included in base sub | **PKR 200/GB/month** (higher than invoice pack, because files bigger + more egress) |
| Egress (downloads) | 3 GB/mo (shared) | Overages at **PKR 40/GB**, cap 10 GB/mo |

**Update ADR-001 accordingly:** Split pricing into `invoice_storage_pack` (PKR 100/GB) and `drawing_storage_pack` (PKR 200/GB). Both prepaid, both subject to same egress meter.

**Guardrail:**
- Reject single file > **25 MB** (forces ZIP for bigger sets)
- Per-project drawing storage warning at 80% of 500 MB
- Hard block at 100% → admin must buy pack

---

## 14. Updated Acceptance Tests

| ID | Test |
|---|---|
| T-21 | Architect uploads drawing "Ground Floor R1" → client receives push with deep link; tap → opens viewer on R1 |
| T-22 | Client adds 2 objections → architect notified; revision status = objection_raised |
| T-23 | Architect uploads R2 rectifying both → both objections auto-resolved; clients notified; status = pending_review |
| T-24 | Client opens R2 → status = under_review, "seen" tick shows on architect side |
| T-25 | Client approves R2 → revision locked; PDF certificate generated |
| T-26 | Client attempts to add comment on approved revision → blocked |
| T-27 | After 7 days pending review → admin gets escalation, status = auto_escalated |
| T-28 | Upload 30 MB file → rejected (over 25 MB cap) |
| T-29 | Upload drawing that takes tenant over quota → blocked, "buy pack" prompt |
| T-30 | Client A cannot see Client B's project drawings (rules test) |
| T-31 | Architect cannot see firm's invoice module (role isolation) |
| T-32 | Comment thread exported as PDF transcript matches in-app history |
| T-33 | Deep link cold-start opens correct revision |
| T-34 | Virus-infected file → rejected, uploader notified, client never notified |
| T-35 | WhatsApp fallback: after 3 days no open → email sent |

---

## 15. Copilot Instructions (Additions to §14 of main spec)

> **Copilot: when generating this module, enforce:**

1. **Status transitions** are only written by Cloud Functions — never let the client write `revision.status`, `drawing.status`, or `comment.status`.
2. **Approved revisions are immutable** — no update/delete allowed once `status='approved'`.
3. **Every upload** creates a `storage_ledger` entry and increments `tenant.storage.usedBytes` atomically.
4. **Every notification** contains `deepLink` in data payload.
5. **Client role** must never appear in `/tenants/{t}/members` — only in `/projects/{p}/clients`.
6. **Every comment** stores `authorUid` and `authorRole` — no impersonation.
7. **Event log** is append-only — reject any update/delete.
8. **Virus scan must complete** before `sendRevisionNotifications` fires (query `files.every(virusScanned)`).
9. **Drawing file size cap**: 25 MB per file, 100 MB per revision set.
10. **Client auth token** must be re-verified on every callable — client role expires with project assignment.

---

## 16. New Analytics Events

| Event | Params |
|---|---|
| `drawing_uploaded` | `{project_id, drawing_id, revision_number, file_count, total_size_mb}` |
| `drawing_opened_by_client` | `{drawing_id, revision_id, time_since_upload_hours}` |
| `comment_added` | `{type, has_attachment}` |
| `revision_approved` | `{days_since_first_upload, revision_count}` |
| `revision_escalated` | `{days_pending}` |
| `rectification_uploaded` | `{objections_resolved_count}` |
| `client_invited` | `{project_id}` |
| `client_accepted` | `{days_since_invite}` |
| `quota_drawing_hit` | `{project_id, used_mb}` |

---

## 17. App Flow Diagram (Text)

```
ARCHITECT                                    CLIENT
   │                                           │
   │ 1. Upload drawing R1                      │
   ├────────────► [PENDING_REVIEW] ◄───────────┘ (push: "R1 uploaded")
   │                    │                      
   │                    │                      │ 2. Opens → [UNDER_REVIEW]
   │                    │                      ├── adds objection comment
   │                    │                      │
   │                [OBJECTION_RAISED] ◄───────┘ (push: "3 objections")
   │                    │
   │ 3. Views objections                       
   │    Resolves comments                      
   │    Uploads R2                             
   │                    ▼                      
   ├──────────► [RECTIFICATION_IN_PROGRESS]    
   │                    │                      
   │                    ▼                      
   │              [RECTIFIED] → new R2 → [PENDING_REVIEW]
   │                                           │
   │                                           │ 4. Opens R2 → [UNDER_REVIEW]
   │                                           │    Approves
   │                                           │
   │                [APPROVED] ◄───────────────┘ (push: "R2 approved")
   │                    │
   │ 5. PDF certificate generated
   │    Revision locked
   │    Invoice trigger (optional)
   ▼
```

---

## 18. Deliverables Summary (What to add to main spec)

- **New Firestore collections:** `projects/{p}/clients`, `drawings`, `revisions`, `comments`, `events`, `users/{u}/notifications`
- **New Cloud Functions (9):** `createDrawing`, `uploadRevision`, `addComment`, `resolveComment`, `approveRevision`, `markRevisionOpened`, `sendRevisionNotifications`, `reviewEscalationCron`, `virusScan