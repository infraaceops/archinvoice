import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { appConfig, buildApiUrl } from '../config/app';
import { auth, db, functions, isFirebaseConfigured } from '../config/firebase';
import { offlineStorage } from './offlineStorage';
import { MOCK_USER } from './mockData';
import { Category, CompanyRole, InviteDoc, InvoiceDoc, LineItem, MemberDoc, ProjectDoc, Role, TeamInvitationResult, TenantDoc } from '../types';

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

  async joinTenant(tenantId: string, inviteToken: string): Promise<{ tenantId: string; role: Role }> {
    if (shouldUseRemoteApi()) {
      return requestRemoteApi<{ tenantId: string; role: Role }>(`/api/tenants/${tenantId}/join`, {
        method: 'POST',
        body: JSON.stringify({ inviteToken }),
      });
    }
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    const user = auth?.currentUser;
    if (!user?.email || !user.emailVerified) {
      throw new Error('Sign in with a verified Google email before accepting an invitation.');
    }
    const inviteId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, inviteToken);
    const inviteRef = doc(db, 'tenants', tenantId, 'invites', inviteId);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Invitation link is invalid or has expired.');
    const invite = inviteSnap.data();
    if (invite.used || invite.expiresAt?.toDate?.() <= new Date()) {
      throw new Error('This invitation has already been used or has expired.');
    }
    if (invite.email !== user.email.trim().toLowerCase()) {
      throw new Error('Sign in with the Google email address this invitation was sent to.');
    }
    if (!['architect', 'viewer'].includes(invite.role)) {
      throw new Error('This invitation has an invalid team role.');
    }
    const memberRef = doc(db, 'tenants', tenantId, 'members', user.uid);
    const userRef = doc(db, 'users', user.uid);
    const batch = writeBatch(db);
    batch.update(inviteRef, { used: true, acceptedBy: user.uid, acceptedAt: serverTimestamp() });
    batch.set(memberRef, {
      uid: user.uid,
      displayName: user.displayName || user.email,
      email: user.email.trim().toLowerCase(),
      phone: invite.phone || '',
      role: invite.role,
      invitedBy: invite.createdBy,
      joinedAt: serverTimestamp(),
      inviteId,
    });
    batch.set(userRef, {
      uid: user.uid,
      displayName: user.displayName || user.email,
      email: user.email.trim().toLowerCase(),
      photoUrl: user.photoURL || null,
      tenantId,
      role: invite.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return { tenantId, role: invite.role };
  },

  async createTeamInvitation(data: {
    email: string;
    phone?: string;
    role: Exclude<CompanyRole, 'admin'>;
  }): Promise<TeamInvitationResult> {
    if (shouldUseRemoteApi()) {
      return requestRemoteApi<TeamInvitationResult>('/api/invites', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    const user = auth?.currentUser;
    if (!user?.email || !user.emailVerified) throw new Error('Sign in with a verified Google email first.');
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const tenantId = userSnap.data()?.tenantId;
    if (typeof tenantId !== 'string' || userSnap.data()?.role !== 'admin') {
      throw new Error('Only a company admin can invite team members.');
    }
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    const token = Array.from(await Crypto.getRandomBytesAsync(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const inviteId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const inviteRef = doc(db, 'tenants', tenantId, 'invites', inviteId);
    await setDoc(inviteRef, {
      tenantId,
      email,
      phone: data.phone?.trim() || '',
      role: data.role,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      expiresAt,
      used: false,
    });
    return {
      inviteToken: token,
      expiresAt: expiresAt.toDate().toISOString(),
      inviteLink: `archinvoice://join?tenantId=${tenantId}&token=${token}`,
    };
  },

  async listTenantTeam(): Promise<{ members: MemberDoc[]; invitations: InviteDoc[] }> {
    if (shouldUseRemoteApi()) {
      return requestRemoteApi<{ members: MemberDoc[]; invitations: InviteDoc[] }>('/api/team');
    }
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    const user = auth?.currentUser;
    if (!user) throw new Error('Sign in to view the company team.');
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const tenantId = userSnap.data()?.tenantId;
    if (typeof tenantId !== 'string' || userSnap.data()?.role !== 'admin') {
      throw new Error('Only a company admin can view the full team.');
    }
    const [memberSnaps, inviteSnaps] = await Promise.all([
      getDocs(collection(db, 'tenants', tenantId, 'members')),
      getDocs(query(collection(db, 'tenants', tenantId, 'invites'), where('used', '==', false))),
    ]);
    const members = memberSnaps.docs.map((snapshot) => ({
      ...snapshot.data(),
      uid: snapshot.id,
      joinedAt: snapshot.data().joinedAt?.toDate?.().toISOString() || '',
    })) as MemberDoc[];
    const invitations = inviteSnaps.docs
      .map((snapshot) => ({
        ...snapshot.data(),
        id: snapshot.id,
        expiresAt: snapshot.data().expiresAt?.toDate?.().toISOString() || '',
      }))
      .filter((invite) => Date.parse(invite.expiresAt) > Date.now()) as InviteDoc[];
    return { members, invitations };
  },

  async removeTeamMember(targetUid: string): Promise<void> {
    if (shouldUseRemoteApi()) {
      await requestRemoteApi<void>(`/api/team/${targetUid}`, { method: 'DELETE' });
      return;
    }
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    const user = auth?.currentUser;
    if (!user) throw new Error('Sign in to manage company members.');
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const tenantId = userSnap.data()?.tenantId;
    if (typeof tenantId !== 'string' || userSnap.data()?.role !== 'admin') {
      throw new Error('Only a company admin can remove team members.');
    }
    const targetMemberRef = doc(db, 'tenants', tenantId, 'members', targetUid);
    const targetSnap = await getDoc(targetMemberRef);
    if (!targetSnap.exists()) throw new Error('Team member not found.');
    if (targetSnap.data().role === 'admin') throw new Error('Company admin accounts cannot be removed by this action.');
    const batch = writeBatch(db);
    batch.delete(targetMemberRef);
    batch.update(doc(db, 'users', targetUid), {
      tenantId: null,
      role: null,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
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
      storage: TenantDoc['storage'] & { lastMeteredAt?: { toDate?: () => Date } };
      subscription: TenantDoc['subscription'] & { currentPeriodEnd?: { toDate?: () => Date } };
    };
    return {
      ...data,
      id: snapshot.id,
      createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
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

  // Allocate Serial & Create Draft Invoice (§7.3)
  async allocateSerialAndCreateInvoice(params: {
    tenantId: string;
    projectId: string;
    category: Category;
    lineItems: LineItem[];
    taxRate?: number;
    clientName: string;
  }): Promise<{ invoiceId: string; serial: string; invoice: InvoiceDoc }> {
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
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
    const user = offlineStorage.loadUser() || MOCK_USER;

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
    if (isFirebaseConfigured && !shouldUseRemoteApi()) {
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
