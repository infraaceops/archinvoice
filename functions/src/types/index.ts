import { Timestamp } from 'firebase-admin/firestore';

export type Role = 'admin' | 'architect' | 'viewer';
export type Category = 'architecture' | 'interior' | 'supervision';
export type ProjectType = 'residential' | 'commercial';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';
export type SubStatus = 'active' | 'grace' | 'locked';

export interface UserDoc {
  displayName: string;
  email: string;
  photoUrl: string;
  tenantId: string | null;
  role: Role | null;
  fcmTokens: string[];
  createdAt: Timestamp;
}

export interface TenantDoc {
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
    currentPeriodEnd: Timestamp;
    purchaseToken: string;
    productId: string;
  };
  storage: {
    includedGb: number;
    purchasedGb: number;
    usedBytes: number;
    egressMonthBytes: number;
    egressMonthKey: string;
    lastMeteredAt: Timestamp;
    throttled?: boolean;
  };
  settings: {
    invoiceDefaults: {
      prefix: Record<Category, string>;
      startAt: Record<Category, number>;
      financialYear: string;
    };
  };
  createdAt: Timestamp;
}

export interface MemberDoc {
  role: Role;
  invitedBy: string;
  joinedAt: Timestamp;
}

export interface InviteDoc {
  email: string;
  phone: string;
  role: Exclude<Role, 'admin'>;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
  acceptedBy?: string;
  acceptedAt?: Timestamp;
}

export interface ProjectDoc {
  name: string;
  type: ProjectType;
  area: number;
  unit: 'sqft' | 'sqm';
  clientName: string;
  location?: string;
  assignedArchitects: string[];
  rateCard: Record<Category, number>;
  startDate: Timestamp;
  status: 'active' | 'archived';
  createdBy: string;
  createdAt: Timestamp;
}

export interface CounterDoc {
  category: Category;
  financialYear: string;
  prefix: string;
  nextValue: number;
  lastIssuedAt: Timestamp;
}

export interface LineItem {
  desc: string;
  category: Category;
  qty: number;
  rate: number;
  amount: number;
  pricingMode: 'per_sqft' | 'manual';
}

export interface InvoiceDoc {
  serial: string;
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

export interface StorageLedgerDoc {
  deltaBytes: number;
  egressBytes: number;
  reason: 'pdf_create' | 'pdf_download' | 'logo_upload' | 'seal_upload';
  refId: string;
  at: Timestamp;
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
