import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { appConfig, buildApiUrl } from '../config/app';
import { auth, db, functions, isFirebaseConfigured } from '../config/firebase';
import { offlineStorage } from './offlineStorage';
import { Category, InvoiceDoc, LineItem, ProjectDoc, Role, TenantDoc } from '../types';

const shouldUseRemoteApi = () => Boolean(appConfig.apiBaseUrl && appConfig.authProvider === 'cloudflare');

async function requestRemoteApi<T>(path: string, init?: RequestInit): Promise<T> {
  if (!shouldUseRemoteApi()) {
    throw new Error('Remote API is not configured. Set EXPO_PUBLIC_API_BASE_URL to enable the Cloudflare Worker endpoint.');
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === 'string') message = parsed.error;
    } catch {
      // Non-JSON proxy and network errors are shown as their response text.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function dateString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === 'string' ? value : new Date().toISOString();
}

function projectFromSnapshot(snapshot: { id: string; data: () => Record<string, unknown> }, tenantId: string): ProjectDoc {
  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    tenantId,
    createdAt: dateString(data.createdAt),
  } as ProjectDoc;
}

function invoiceFromSnapshot(snapshot: { id: string; data: () => Record<string, unknown> }, tenantId: string): InvoiceDoc {
  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    tenantId,
    createdAt: dateString(data.createdAt),
    issuedAt: data.issuedAt == null ? null : dateString(data.issuedAt),
  } as InvoiceDoc;
}

export const api = {
  // Create Company / Tenant
  async createTenant(data: {
    name: string;
    ceoName: string;
    address?: string;
    ntn?: string;
    logoBase64?: string;
    logoMimeType?: string;
    sealBase64?: string;
    sealMimeType?: string;
  }): Promise<{ tenantId: string; role: Role }> {
    if (shouldUseRemoteApi()) {
      return requestRemoteApi<{ tenantId: string; role: Role }>('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          ceoName: data.ceoName,
          address: data.address,
          ntn: data.ntn,
          logoBase64: data.logoBase64,
          logoMimeType: data.logoMimeType,
          sealBase64: data.sealBase64,
          sealMimeType: data.sealMimeType,
        }),
      });
    }

    if (!isFirebaseConfigured) {
      throw new Error('Firebase is not configured. Company creation is disabled until a Firebase project is configured.');
    }
    const user = auth?.currentUser;
    if (!user?.email || !user.emailVerified) {
      throw new Error('Sign in with a verified Google email before creating a company.');
    }
    if (!data.name.trim() || data.name.trim().length > 120 || !data.ceoName.trim() || data.ceoName.trim().length > 120) {
      throw new Error('Company and CEO names are required and must be 120 characters or fewer.');
    }
    const tenantRef = doc(collection(db, 'tenants'));
    const memberRef = doc(db, 'tenants', tenantRef.id, 'members', user.uid);
    const userRef = doc(db, 'users', user.uid);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const batch = writeBatch(db);
    batch.set(tenantRef, {
      name: data.name.trim(),
      ceoName: data.ceoName.trim(),
      logoUrl: data.logoBase64 && data.logoMimeType ? `data:${data.logoMimeType};base64,${data.logoBase64}` : null,
      sealUrl: data.sealBase64 && data.sealMimeType ? `data:${data.sealMimeType};base64,${data.sealBase64}` : null,
      address: data.address?.trim() || '',
      ntn: data.ntn?.trim() || '',
      currency: 'PKR',
      subscription: {
        status: 'active',
        plan: 'core_monthly',
        pricePkr: 280,
        currentPeriodEnd: Timestamp.fromDate(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)),
        purchaseToken: `trial_${tenantRef.id}`,
        productId: 'core_monthly',
      },
      storage: {
        includedGb: 1,
        purchasedGb: 0,
        usedBytes: 0,
        egressMonthBytes: 0,
        egressMonthKey: monthKey,
        lastMeteredAt: serverTimestamp(),
        throttled: false,
      },
      settings: {
        invoiceDefaults: {
          prefix: { architecture: 'ARCH', interior: 'INT', supervision: 'SUP' },
          startAt: { architecture: 1, interior: 1, supervision: 1 },
          financialYear: String(now.getFullYear()),
        },
      },
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    batch.set(memberRef, {
      uid: user.uid,
      displayName: user.displayName || user.email,
      email: user.email.trim().toLowerCase(),
      phone: '',
      role: 'admin',
      invitedBy: 'self',
      joinedAt: serverTimestamp(),
    });
    batch.set(userRef, {
      uid: user.uid,
      displayName: user.displayName || user.email,
      email: user.email.trim().toLowerCase(),
      photoUrl: user.photoURL || null,
      tenantId: tenantRef.id,
      role: 'admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return { tenantId: tenantRef.id, role: 'admin' };
  },

  async loadTenant(tenantId: string): Promise<TenantDoc> {
    if (shouldUseRemoteApi()) {
      return requestRemoteApi<TenantDoc>(`/api/tenants/${tenantId}`);
    }
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    const snapshot = await getDoc(doc(db, 'tenants', tenantId));
    if (!snapshot.exists()) throw new Error('Your company record could not be found.');
    const data = snapshot.data() as Omit<TenantDoc, 'id'> & {
      createdAt?: { toDate?: () => Date };
      archivedAt?: unknown;
      storage: TenantDoc['storage'] & { lastMeteredAt?: { toDate?: () => Date } };
      subscription: TenantDoc['subscription'] & { currentPeriodEnd?: { toDate?: () => Date } };
    };
    return {
      ...data,
      id: snapshot.id,
      createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
      archivedAt: data.archivedAt == null ? undefined : dateString(data.archivedAt),
      storage: {
        ...data.storage,
        lastMeteredAt: data.storage.lastMeteredAt?.toDate?.().toISOString() || new Date().toISOString(),
      },
      subscription: {
        ...data.subscription,
        currentPeriodEnd:
          data.subscription.currentPeriodEnd?.toDate?.().toISOString() || new Date().toISOString(),
      },
    } as TenantDoc;
  },

  async listProjects(tenantId: string): Promise<ProjectDoc[]> {
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      const snapshots = await getDocs(collection(db, 'tenants', tenantId, 'projects'));
      const projects = snapshots.docs
        .map((snapshot) => projectFromSnapshot(snapshot, tenantId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      offlineStorage.saveProjects(tenantId, projects);
      return projects;
    }
    return offlineStorage.loadProjects(tenantId);
  },

  async listInvoices(tenantId: string): Promise<InvoiceDoc[]> {
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      const snapshots = await getDocs(collection(db, 'tenants', tenantId, 'invoices'));
      const invoices = snapshots.docs
        .map((snapshot) => invoiceFromSnapshot(snapshot, tenantId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      offlineStorage.saveInvoices(tenantId, invoices);
      return invoices;
    }
    return offlineStorage.loadInvoices(tenantId);
  },

  async updateTenant(tenantId: string, updates: Partial<TenantDoc>): Promise<TenantDoc> {
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      await updateDoc(doc(db, 'tenants', tenantId), updates);
      return api.loadTenant(tenantId);
    }
    const updated = { ...offlineStorage.loadTenant(tenantId), ...updates, id: tenantId };
    offlineStorage.saveTenant(updated);
    return updated;
  },

  async archiveTenant(tenantId: string, confirmationName: string): Promise<void> {
    if (shouldUseRemoteApi()) {
      throw new Error('Company archiving is not available in Cloudflare mode.');
    }
    if (!isFirebaseConfigured) throw new Error('Firebase is required to archive a company safely.');
    const callable = httpsCallable<
      { expectedTenantId: string; confirmationName: string },
      { archived: boolean }
    >(functions, 'archiveTenant');
    await callable({ expectedTenantId: tenantId, confirmationName });
    offlineStorage.clearTenantData(tenantId);
  },

  async deleteProject(tenantId: string, projectId: string): Promise<string[]> {
    let deletedInvoiceIds: string[];
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      const callable = httpsCallable<
        { tenantId: string; projectId: string },
        { deletedInvoiceIds: string[] }
      >(functions, 'deleteProject');
      const result = await callable({ tenantId, projectId });
      deletedInvoiceIds = result.data.deletedInvoiceIds;
    } else {
      deletedInvoiceIds = offlineStorage
        .loadInvoices(tenantId)
        .filter((invoice) => invoice.projectId === projectId)
        .map((invoice) => invoice.id);
    }

    offlineStorage.saveProjects(
      tenantId,
      offlineStorage.loadProjects(tenantId).filter((project) => project.id !== projectId),
    );
    offlineStorage.saveInvoices(
      tenantId,
      offlineStorage.loadInvoices(tenantId).filter((invoice) => invoice.projectId !== projectId),
    );
    return deletedInvoiceIds;
  },

  async deleteInvoice(tenantId: string, invoiceId: string): Promise<void> {
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      const callable = httpsCallable<
        { tenantId: string; invoiceId: string },
        { deleted: boolean }
      >(functions, 'deleteInvoice');
      await callable({ tenantId, invoiceId });
    }
    offlineStorage.saveInvoices(
      tenantId,
      offlineStorage.loadInvoices(tenantId).filter((invoice) => invoice.id !== invoiceId),
    );
  },

  // Allocate Serial & Create Draft Invoice (§7.3)
  async allocateSerialAndCreateInvoice(params: {
    tenantId: string;
    projectId: string;
    category: Category;
    lineItems: LineItem[];
    taxRate?: number;
    clientName: string;
    createdBy: string;
  }): Promise<{ invoiceId: string; serial: string; invoice: InvoiceDoc }> {
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      const callable = httpsCallable<
        Omit<typeof params, 'createdBy'>,
        { invoiceId: string; serial: string; subtotal: number; tax: number; total: number }
      >(functions, 'allocateSerialAndCreateInvoice');
      const result = await callable({
        tenantId: params.tenantId,
        projectId: params.projectId,
        category: params.category,
        lineItems: params.lineItems,
        taxRate: params.taxRate,
        clientName: params.clientName,
      });
      const invoiceSnapshot = await getDoc(
        doc(db, 'tenants', params.tenantId, 'invoices', result.data.invoiceId),
      );
      if (!invoiceSnapshot.exists()) throw new Error('The saved invoice could not be loaded.');
      const invoice = invoiceFromSnapshot(invoiceSnapshot, params.tenantId);
      offlineStorage.saveInvoices(params.tenantId, [
        invoice,
        ...offlineStorage.loadInvoices(params.tenantId).filter((item) => item.id !== invoice.id),
      ]);
      return { invoiceId: invoice.id, serial: invoice.serial, invoice };
    }

    // Local atomic counter allocation matching spec §7.3
    const tenant = offlineStorage.loadTenant(params.tenantId);
    const fy = tenant.settings.invoiceDefaults.financialYear || new Date().getFullYear().toString();
    const prefix = tenant.settings.invoiceDefaults.prefix[params.category] || params.category.substring(0, 4).toUpperCase();
    const startAt = tenant.settings.invoiceDefaults.startAt[params.category] || 1;

    // Load existing invoices to find highest sequence for (category, fy)
    const invoices = offlineStorage.loadInvoices(params.tenantId);
    const matchingInvoices = invoices.filter(
      (inv) => inv.category === params.category && inv.financialYear === fy
    );

    const nextVal = Math.max(startAt, matchingInvoices.length + 1);
    const serial = `${prefix}-${fy}-${String(nextVal).padStart(4, '0')}`;

    const subtotal = Math.round(
      params.lineItems.reduce((acc, item) => acc + (item.amount || 0), 0) * 100
    ) / 100;
    const taxRate = params.taxRate || 0;
    const tax = Math.round((subtotal * (taxRate / 100)) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const invoiceId = `inv-${Date.now().toString(36)}`;
    const newInvoice: InvoiceDoc = {
      id: invoiceId,
      tenantId: params.tenantId,
      serial,
      category: params.category,
      financialYear: fy,
      projectId: params.projectId,
      clientName: params.clientName,
      lineItems: params.lineItems,
      subtotal,
      tax,
      taxRate,
      total,
      currency: 'PKR',
      status: 'draft',
      pdfPath: null,
      pdfSnapshotHash: null,
      createdBy: params.createdBy,
      createdAt: new Date().toISOString(),
      issuedAt: null,
    };

    // Increment tenant's startAt setting for category
    tenant.settings.invoiceDefaults.startAt[params.category] = nextVal + 1;
    offlineStorage.saveTenant(tenant);

    offlineStorage.saveInvoices(params.tenantId, [newInvoice, ...invoices]);

    return { invoiceId, serial, invoice: newInvoice };
  },

  // Issue Invoice & Generate PDF (§7.4)
  async issueInvoice(tenantId: string, invoiceId: string): Promise<{ success: boolean; invoice: InvoiceDoc }> {
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      const callable = httpsCallable(functions, 'issueInvoiceAndGeneratePdf');
      await callable({ tenantId, invoiceId });
      const invoiceSnapshot = await getDoc(doc(db, 'tenants', tenantId, 'invoices', invoiceId));
      if (!invoiceSnapshot.exists()) throw new Error('The issued invoice could not be loaded.');
      const invoice = invoiceFromSnapshot(invoiceSnapshot, tenantId);
      offlineStorage.saveInvoices(tenantId, [
        invoice,
        ...offlineStorage.loadInvoices(tenantId).filter((item) => item.id !== invoice.id),
      ]);
      return { success: true, invoice };
    }

    const invoices = offlineStorage.loadInvoices(tenantId);
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx === -1) throw new Error('Invoice not found');

    const updated: InvoiceDoc = {
      ...invoices[idx],
      status: 'issued',
      issuedAt: new Date().toISOString(),
      pdfPath: `tenants/${tenantId}/invoices/${invoiceId}.pdf`,
    };

    invoices[idx] = updated;
    offlineStorage.saveInvoices(tenantId, invoices);

    // Update storage usage by ~250KB for PDF
    const tenant = offlineStorage.loadTenant(tenantId);
    tenant.storage.usedBytes += 256 * 1024;
    offlineStorage.saveTenant(tenant);

    return { success: true, invoice: updated };
  },

  // Verify Play Billing Purchase (§10)
  async verifyPurchase(tenantId: string, productId: string, purchaseToken: string): Promise<{ success: boolean; message: string }> {
    if (shouldUseRemoteApi()) {
      throw new Error('Paid subscriptions and storage packs are not enabled in the Cloudflare free-tier deployment.');
    }
    if (isFirebaseConfigured) {
      try {
        const callable = httpsCallable(functions, 'verifyPurchase');
        const res: any = await callable({ tenantId, productId, purchaseToken });
        return res.data;
      } catch (err) {
        console.warn('Firebase verifyPurchase failed, using local mode:', err);
      }
    }

    const tenant = offlineStorage.loadTenant(tenantId);
    const now = new Date();

    if (productId === 'core_monthly') {
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      tenant.subscription.status = 'active';
      tenant.subscription.currentPeriodEnd = periodEnd;
      tenant.subscription.purchaseToken = purchaseToken;
      offlineStorage.saveTenant(tenant);
      return { success: true, message: 'Core Monthly subscription renewed successfully!' };
    } else if (productId === 'storage_pack_1gb') {
      tenant.storage.purchasedGb = (tenant.storage.purchasedGb || 0) + 1;
      offlineStorage.saveTenant(tenant);
      return { success: true, message: '1 GB Storage Pack added successfully!' };
    } else if (productId === 'storage_pack_5gb') {
      tenant.storage.purchasedGb = (tenant.storage.purchasedGb || 0) + 5;
      offlineStorage.saveTenant(tenant);
      return { success: true, message: '5 GB Storage Pack added successfully!' };
    }

    return { success: false, message: 'Unknown product' };
  },

  // Create Project
  async createProject(project: Omit<ProjectDoc, 'id' | 'createdAt'>): Promise<ProjectDoc> {
    const projectId = isFirebaseConfigured && !shouldUseRemoteApi()
      ? doc(collection(db, 'tenants', project.tenantId, 'projects')).id
      : `proj-${Date.now().toString(36)}`;
    const newProj: ProjectDoc = {
      ...project,
      id: projectId,
      createdAt: new Date().toISOString(),
    };
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      const { id: _id, createdAt: _createdAt, ...projectData } = newProj;
      await setDoc(doc(db, 'tenants', project.tenantId, 'projects', projectId), {
        ...projectData,
        createdAt: serverTimestamp(),
      });
    }
    const projects = offlineStorage.loadProjects(project.tenantId);
    offlineStorage.saveProjects(project.tenantId, [newProj, ...projects]);
    return newProj;
  },

  // Update Invoice Status (e.g. Paid, Cancelled)
  async updateInvoiceStatus(tenantId: string, invoiceId: string, status: InvoiceDoc['status']): Promise<InvoiceDoc> {
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
      const invoiceRef = doc(db, 'tenants', tenantId, 'invoices', invoiceId);
      await updateDoc(invoiceRef, { status });
      const snapshot = await getDoc(invoiceRef);
      if (!snapshot.exists()) throw new Error('Invoice not found.');
      const invoice = invoiceFromSnapshot(snapshot, tenantId);
      offlineStorage.saveInvoices(tenantId, [
        invoice,
        ...offlineStorage.loadInvoices(tenantId).filter((item) => item.id !== invoice.id),
      ]);
      return invoice;
    }

    const invoices = offlineStorage.loadInvoices(tenantId);
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx === -1) throw new Error('Invoice not found');

    invoices[idx] = { ...invoices[idx], status };
    offlineStorage.saveInvoices(tenantId, invoices);
    return invoices[idx];
  },
};
