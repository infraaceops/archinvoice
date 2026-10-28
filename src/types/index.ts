export type Role = 'admin' | 'architect' | 'viewer' | 'client';
export type CompanyRole = Exclude<Role, 'client'>;
export type Category = 'architecture' | 'interior' | 'supervision';
export type ProjectType = 'residential' | 'commercial';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';
export type SubStatus = 'active' | 'grace' | 'locked';

export interface UserDoc {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  tenantId: string | null;
  role: Role | null;
  fcmTokens?: string[];
  createdAt: string;
}

export interface TenantDoc {
  id: string;
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
    pricePkr: number;
    currentPeriodEnd: string;
    purchaseToken: string;
    productId: string;
  };
  storage: {
    includedGb: number;
    purchasedGb: number;
    usedBytes: number;
    egressMonthBytes: number;
    egressMonthKey: string;
    lastMeteredAt: string;
    throttled?: boolean;
  };
  settings: {
    invoiceDefaults: {
      prefix: Record<Category, string>;
      startAt: Record<Category, number>;
      financialYear: string;
    };
  };
  createdAt: string;
}

export interface MemberDoc {
  uid: string;
  displayName?: string;
  email?: string;
  phone?: string;
  role: CompanyRole;
  invitedBy: string;
  joinedAt: string;
  status?: 'active' | 'invited';
}

export interface InviteDoc {
  id: string;
  tenantId: string;
  email: string;
  phone?: string;
  role: Exclude<CompanyRole, 'admin'>;
  createdBy: string;
  expiresAt: string;
  used: boolean;
}

export interface TeamInvitationResult {
  inviteToken: string;
  inviteLink: string;
  expiresAt: string;
}

export interface ProjectDoc {
  id: string;
  tenantId: string;
  name: string;
  type: ProjectType;
  area: number;
  unit: 'sqft' | 'sqm';
  clientName: string;
  location?: string;
  assignedArchitects: string[];
  rateCard: Record<Category, number>;
  startDate: string;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: string;
}

export interface LineItem {
  id?: string;
  desc: string;
  category: Category;
  qty: number;
  rate: number;
  amount: number;
  pricingMode: 'per_sqft' | 'manual';
}

export interface InvoiceDoc {
  id: string;
  tenantId: string;
  serial: string;
  category: Category;
  financialYear: string;
  projectId: string;
  clientName: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  taxRate?: number;
  total: number;
  currency: 'PKR';
  status: InvoiceStatus;
  pdfPath: string | null;
  pdfSnapshotHash: string | null;
  createdBy: string;
  createdAt: string;
  issuedAt: string | null;
}

export interface StorageLedgerDoc {
  id: string;
  deltaBytes: number;
  egressBytes: number;
  reason: 'pdf_create' | 'pdf_download' | 'logo_upload' | 'seal_upload';
  refId: string;
  at: string;
}

export interface BillingMonthDoc {
  storageGb: number;
  egressGb: number;
  functionCalls: number;
  firestoreReads: number;
  computedCostPkr: number;
  revenuePkr: number;
  marginPkr: number;
  throttled: boolean;
}

export type RevisionStatus =
  | 'pending_review'
  | 'under_review'
  | 'objection_raised'
  | 'rectification_in_progress'
  | 'rectified'
  | 'approved'
  | 'auto_escalated';

export type CommentType = 'question' | 'objection' | 'approval_note' | 'reply';

export interface ProjectClientDoc {
  id: string;
  projectId: string;
  name: string;
  email: string;
  phone?: string;
  inviteStatus: 'invited' | 'accepted' | 'revoked';
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string;
}

export interface DrawingFile {
  name: string;
  uri: string;
  sizeBytes: number;
  mimeType: string;
}

export interface DrawingRevision {
  id: string;
  drawingId: string;
  revisionNumber: number;
  files: DrawingFile[];
  status: RevisionStatus;
  uploadedBy: string;
  uploadedAt: string;
  firstOpenedByClientAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface DrawingDoc {
  id: string;
  projectId: string;
  title: string;
  category: 'architecture' | 'interior' | 'supervision' | 'structural' | 'mep' | 'other';
  description?: string;
  currentRevisionId: string;
  currentRevisionNumber: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DrawingComment {
  id: string;
  drawingId: string;
  revisionId: string;
  authorUid: string;
  authorName: string;
  authorEmail: string;
  authorRole: 'client' | 'architect' | 'admin';
  type: CommentType;
  body: string;
  status: 'open' | 'resolved' | 'wont_fix';
  parentCommentId?: string;
  createdAt: string;
}

export interface RevisionEvent {
  id: string;
  revisionId: string;
  fromStatus: RevisionStatus | null;
  toStatus: RevisionStatus;
  actorUid: string;
  actorRole: Role;
  note?: string;
  at: string;
}

export interface CollaborationNotification {
  id: string;
  recipientEmail: string;
  type: 'drawing_uploaded' | 'comment_added' | 'approved' | 'invite';
  projectId: string;
  drawingId?: string;
  revisionId?: string;
  title: string;
  body: string;
  deepLink: string;
  read: boolean;
  createdAt: string;
}
