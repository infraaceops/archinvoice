import { InvoiceDoc, ProjectDoc, TenantDoc } from '../types';

const STORAGE_KEYS = {
  TENANT: '@arch_tenant',
  PROJECTS: '@arch_projects',
  INVOICES: '@arch_invoices',
  OFFLINE_DRAFTS: '@arch_offline_drafts',
};

const memoryCache: Record<string, string> = {};

function scopedKey(key: string, tenantId: string): string {
  if (!tenantId.trim()) throw new Error('A company ID is required to access company data.');
  return `${key}:${encodeURIComponent(tenantId)}`;
}

function setItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
  memoryCache[key] = value;
}

function getItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const value = window.localStorage.getItem(key);
      if (value !== null) return value;
    }
  } catch {
    // Use the in-memory copy when browser storage is unavailable.
  }
  return memoryCache[key] || null;
}

function removeItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Keep cleanup best-effort when browser storage is unavailable.
  }
  delete memoryCache[key];
}

export function emptyTenant(id = ''): TenantDoc {
  const now = new Date().toISOString();
  return {
    id,
    name: '',
    ceoName: '',
    logoUrl: null,
    sealUrl: null,
    address: '',
    ntn: '',
    currency: 'PKR',
    subscription: {
      status: 'active',
      plan: 'core_monthly',
      pricePkr: 0,
      currentPeriodEnd: now,
      purchaseToken: '',
      productId: 'core_monthly',
    },
    storage: {
      includedGb: 0,
      purchasedGb: 0,
      usedBytes: 0,
      egressMonthBytes: 0,
      egressMonthKey: now.slice(0, 7),
      lastMeteredAt: now,
      throttled: false,
    },
    settings: {
      invoiceDefaults: {
        prefix: { architecture: 'ABS', interior: 'INT', supervision: 'SUP' },
        startAt: { architecture: 1, interior: 1, supervision: 1 },
        financialYear: String(new Date().getFullYear()),
      },
    },
    createdAt: now,
  };
}

function readArray<T>(key: string): T[] {
  const raw = getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export const offlineStorage = {
  loadTenant(tenantId: string): TenantDoc {
    const raw = getItem(scopedKey(STORAGE_KEYS.TENANT, tenantId));
    if (!raw) return emptyTenant(tenantId);
    try {
      const tenant = JSON.parse(raw) as TenantDoc;
      return tenant.id === tenantId ? tenant : emptyTenant(tenantId);
    } catch {
      return emptyTenant(tenantId);
    }
  },

  saveTenant(tenant: TenantDoc): void {
    setItem(scopedKey(STORAGE_KEYS.TENANT, tenant.id), JSON.stringify(tenant));
  },

  clearTenantData(tenantId: string): void {
    Object.values(STORAGE_KEYS).forEach((key) => removeItem(scopedKey(key, tenantId)));
  },

  loadProjects(tenantId: string): ProjectDoc[] {
    return readArray<ProjectDoc>(scopedKey(STORAGE_KEYS.PROJECTS, tenantId))
      .filter((project) => project.tenantId === tenantId);
  },

  saveProjects(tenantId: string, projects: ProjectDoc[]): void {
    setItem(
      scopedKey(STORAGE_KEYS.PROJECTS, tenantId),
      JSON.stringify(projects.filter((project) => project.tenantId === tenantId)),
    );
  },

  loadInvoices(tenantId: string): InvoiceDoc[] {
    return readArray<InvoiceDoc>(scopedKey(STORAGE_KEYS.INVOICES, tenantId))
      .filter((invoice) => invoice.tenantId === tenantId);
  },

  saveInvoices(tenantId: string, invoices: InvoiceDoc[]): void {
    setItem(
      scopedKey(STORAGE_KEYS.INVOICES, tenantId),
      JSON.stringify(invoices.filter((invoice) => invoice.tenantId === tenantId)),
    );
  },

  saveDraft(tenantId: string, draft: Partial<InvoiceDoc>): void {
    const draftsKey = scopedKey(STORAGE_KEYS.OFFLINE_DRAFTS, tenantId);
    const drafts = readArray<Partial<InvoiceDoc>>(draftsKey);
    setItem(
      draftsKey,
      JSON.stringify([draft, ...drafts.filter((existing) => existing.id !== draft.id)]),
    );
  },

  loadDrafts(tenantId: string): Array<Partial<InvoiceDoc>> {
    return readArray<Partial<InvoiceDoc>>(scopedKey(STORAGE_KEYS.OFFLINE_DRAFTS, tenantId));
  },
};
