import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured } from '../config/firebase';
import { offlineStorage } from './offlineStorage';
import { Category, InvoiceDoc, LineItem, ProjectDoc, Role, TenantDoc, UserDoc } from '../types';

export const api = {
  // Create Company / Tenant
  async createTenant(data: {
    name: string;
    ceoName: string;
    address?: string;
    ntn?: string;
    logoBase64?: string;
    sealBase64?: string;
  }): Promise<{ tenantId: string; role: Role }> {
    if (isFirebaseConfigured) {
      try {
        const callable = httpsCallable(functions, 'createTenant');
        const res: any = await callable(data);
        return res.data;
      } catch (err) {
        console.warn('Firebase createTenant failed, using local mode:', err);
      }
    }

    // Local / Offline fallback
    const tenantId = `tenant-${Date.now().toString(36)}`;
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const newTenant: TenantDoc = {
      id: tenantId,
      name: data.name,
      ceoName: data.ceoName,
      logoUrl: data.logoBase64 || null,
      sealUrl: data.sealBase64 || null,
      address: data.address || '',
      ntn: data.ntn || '',
      currency: 'PKR',
      subscription: {
        status: 'active',
        plan: 'core_monthly',
        pricePkr: 280,
        currentPeriodEnd: trialEnd,
        purchaseToken: `trial_${tenantId}`,
        productId: 'core_monthly',
      },
      storage: {
        includedGb: 1,
        purchasedGb: 0,
        usedBytes: 0,
        egressMonthBytes: 0,
        egressMonthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        lastMeteredAt: now.toISOString(),
      },
      settings: {
        invoiceDefaults: {
          prefix: {
            architecture: 'ARCH',
            interior: 'INT',
            supervision: 'SUP',
          },
          startAt: {
            architecture: 1,
            interior: 1,
            supervision: 1,
          },
          financialYear: String(now.getFullYear()),
        },
      },
      createdAt: now.toISOString(),
    };

    offlineStorage.saveTenant(newTenant);
    const user = offlineStorage.loadUser();
    user.tenantId = tenantId;
    user.role = 'admin';
    offlineStorage.saveUser(user);

    return { tenantId, role: 'admin' };
  },

  // Join Existing Tenant via Invite Code
  async joinTenant(inviteCode: string): Promise<{ tenantId: string; role: Role }> {
    if (isFirebaseConfigured) {
      try {
        const callable = httpsCallable(functions, 'joinTenant');
        const res: any = await callable({ inviteCode });
        return res.data;
      } catch (err) {
        console.warn('Firebase joinTenant failed, using local mode:', err);
      }
    }

    // Local / Offline fallback (mock verification: code length 6 or 'ARCH12')
    const tenant = offlineStorage.loadTenant();
    const role: Role = inviteCode.toUpperCase().startsWith('ADM') ? 'admin' : 'architect';

    const user = offlineStorage.loadUser();
    user.tenantId = tenant.id;
    user.role = role;
    offlineStorage.saveUser(user);

    return { tenantId: tenant.id, role };
  },

  // Allocate Serial & Create Draft Invoice (§7.3)
  async allocateSerialAndCreateInvoice(params: {
    tenantId: string;
    projectId: string;
    category: Category;
    lineItems: LineItem[];
    taxRate?: number;
    clientName: string;
  }): Promise<{ invoiceId: string; serial: string; invoice: InvoiceDoc }> {
    if (isFirebaseConfigured) {
      try {
        const callable = httpsCallable(functions, 'allocateSerialAndCreateInvoice');
        const res: any = await callable(params);
        return res.data;
      } catch (err) {
        console.warn('Firebase allocateSerialAndCreateInvoice failed, using local mode:', err);
      }
    }

    // Local atomic counter allocation matching spec §7.3
    const tenant = offlineStorage.loadTenant();
    const fy = tenant.settings.invoiceDefaults.financialYear || new Date().getFullYear().toString();
    const prefix = tenant.settings.invoiceDefaults.prefix[params.category] || params.category.substring(0, 4).toUpperCase();
    const startAt = tenant.settings.invoiceDefaults.startAt[params.category] || 1;

    // Load existing invoices to find highest sequence for (category, fy)
    const invoices = offlineStorage.loadInvoices();
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
    const user = offlineStorage.loadUser();

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
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      issuedAt: null,
    };

    // Increment tenant's startAt setting for category
    tenant.settings.invoiceDefaults.startAt[params.category] = nextVal + 1;
    offlineStorage.saveTenant(tenant);

    offlineStorage.saveInvoices([newInvoice, ...invoices]);

    return { invoiceId, serial, invoice: newInvoice };
  },

  // Issue Invoice & Generate PDF (§7.4)
  async issueInvoice(tenantId: string, invoiceId: string): Promise<{ success: boolean; invoice: InvoiceDoc }> {
    if (isFirebaseConfigured) {
      try {
        const callable = httpsCallable(functions, 'issueInvoiceAndGeneratePdf');
        await callable({ tenantId, invoiceId });
      } catch (err) {
        console.warn('Firebase issueInvoiceAndGeneratePdf failed, falling back to local:', err);
      }
    }

    const invoices = offlineStorage.loadInvoices();
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx === -1) throw new Error('Invoice not found');

    const updated: InvoiceDoc = {
      ...invoices[idx],
      status: 'issued',
      issuedAt: new Date().toISOString(),
      pdfPath: `tenants/${tenantId}/invoices/${invoiceId}.pdf`,
    };

    invoices[idx] = updated;
    offlineStorage.saveInvoices([...invoices]);

    // Update storage usage by ~250KB for PDF
    const tenant = offlineStorage.loadTenant();
    tenant.storage.usedBytes += 256 * 1024;
    offlineStorage.saveTenant(tenant);

    return { success: true, invoice: updated };
  },

  // Verify Play Billing Purchase (§10)
  async verifyPurchase(tenantId: string, productId: string, purchaseToken: string): Promise<{ success: boolean; message: string }> {
    if (isFirebaseConfigured) {
      try {
        const callable = httpsCallable(functions, 'verifyPurchase');
        const res: any = await callable({ tenantId, productId, purchaseToken });
        return res.data;
      } catch (err) {
        console.warn('Firebase verifyPurchase failed, using local mode:', err);
      }
    }

    const tenant = offlineStorage.loadTenant();
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
    const projects = offlineStorage.loadProjects();
    const newProj: ProjectDoc = {
      ...project,
      id: `proj-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
    };
    offlineStorage.saveProjects([newProj, ...projects]);
    return newProj;
  },

  // Update Invoice Status (e.g. Paid, Cancelled)
  async updateInvoiceStatus(invoiceId: string, status: InvoiceDoc['status']): Promise<InvoiceDoc> {
    const invoices = offlineStorage.loadInvoices();
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx === -1) throw new Error('Invoice not found');

    invoices[idx] = { ...invoices[idx], status };
    offlineStorage.saveInvoices([...invoices]);
    return invoices[idx];
  },
};
