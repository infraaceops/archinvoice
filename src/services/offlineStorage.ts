import { InvoiceDoc, ProjectDoc, TenantDoc, UserDoc } from '../types';
import { MOCK_INVOICES, MOCK_PROJECTS, MOCK_TENANT, MOCK_USER } from './mockData';

const STORAGE_KEYS = {
  USER: '@arch_user',
  TENANT: '@arch_tenant',
  PROJECTS: '@arch_projects',
  INVOICES: '@arch_invoices',
  OFFLINE_DRAFTS: '@arch_offline_drafts',
};

// Cross-platform in-memory and web storage fallback
const memoryCache: Record<string, string> = {};

function setItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
  memoryCache[key] = value;
}

function getItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {}
  return memoryCache[key] || null;
}

export const offlineStorage = {
  loadUser(): UserDoc {
    const raw = getItem(STORAGE_KEYS.USER);
    if (!raw) {
      setItem(STORAGE_KEYS.USER, JSON.stringify(MOCK_USER));
      return MOCK_USER;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return MOCK_USER;
    }
  },

  saveUser(user: UserDoc | null): void {
    if (!user) {
      setItem(STORAGE_KEYS.USER, '');
      return;
    }
    setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  loadTenant(): TenantDoc {
    const raw = getItem(STORAGE_KEYS.TENANT);
    if (!raw) {
      setItem(STORAGE_KEYS.TENANT, JSON.stringify(MOCK_TENANT));
      return MOCK_TENANT;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return MOCK_TENANT;
    }
  },

  saveTenant(tenant: TenantDoc): void {
    setItem(STORAGE_KEYS.TENANT, JSON.stringify(tenant));
  },

  loadProjects(): ProjectDoc[] {
    const raw = getItem(STORAGE_KEYS.PROJECTS);
    if (!raw) {
      setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(MOCK_PROJECTS));
      return MOCK_PROJECTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return MOCK_PROJECTS;
    }
  },

  saveProjects(projects: ProjectDoc[]): void {
    setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  },

  loadInvoices(): InvoiceDoc[] {
    const raw = getItem(STORAGE_KEYS.INVOICES);
    if (!raw) {
      setItem(STORAGE_KEYS.INVOICES, JSON.stringify(MOCK_INVOICES));
      return MOCK_INVOICES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return MOCK_INVOICES;
    }
  },

  saveInvoices(invoices: InvoiceDoc[]): void {
    setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },

  saveDraft(draft: Partial<InvoiceDoc>): void {
    const raw = getItem(STORAGE_KEYS.OFFLINE_DRAFTS);
    let list: Array<Partial<InvoiceDoc>> = [];
    try {
      list = raw ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
    list = [draft, ...list.filter((d) => d.id !== draft.id)];
    setItem(STORAGE_KEYS.OFFLINE_DRAFTS, JSON.stringify(list));
  },

  loadDrafts(): Array<Partial<InvoiceDoc>> {
    const raw = getItem(STORAGE_KEYS.OFFLINE_DRAFTS);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
};
