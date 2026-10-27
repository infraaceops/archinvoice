export type Role = 'admin' | 'architect' | 'viewer';
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
  role: Role;
  invitedBy: string;
  joinedAt: string;
}

export interface InviteDoc {
  code: string;
  email?: string;
  role: Role;
  createdBy: string;
  expiresAt: string;
  used: boolean;
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
