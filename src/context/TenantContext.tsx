import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Category, InvoiceDoc, LineItem, ProjectDoc, Role, TenantDoc } from '../types';
import { emptyTenant, offlineStorage } from '../services/offlineStorage';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

export type ScreenName =
  | 'splash'
  | 'signin'
  | 'create_company'
  | 'dashboard'
  | 'projects'
  | 'create_project'
  | 'project_detail'
  | 'profile'
  | 'create_invoice'
  | 'invoice_preview'
  | 'pdf_viewer'
  | 'history'
  | 'settings';

interface TenantContextType {
  tenant: TenantDoc;
  projects: ProjectDoc[];
  invoices: InvoiceDoc[];
  activeScreen: ScreenName;
  currentParams: any;
  navigateTo: (screen: ScreenName, params?: any) => void;
  refreshData: () => void;
  createProject: (data: Omit<ProjectDoc, 'id' | 'createdAt'>) => Promise<ProjectDoc>;
  deleteProject: (projectId: string) => Promise<void>;
  createInvoice: (params: {
    projectId: string;
    category: Category;
    lineItems: LineItem[];
    taxRate?: number;
    clientName: string;
    description?: string;
  }) => Promise<InvoiceDoc>;
  issueInvoice: (invoiceId: string) => Promise<InvoiceDoc>;
  updateInvoiceStatus: (invoiceId: string, status: InvoiceDoc['status']) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  buyStoragePack: (productId: 'storage_pack_1gb' | 'storage_pack_5gb') => Promise<void>;
  renewSubscription: () => Promise<void>;
  updateTenant: (updates: Partial<TenantDoc>) => Promise<void>;
  archiveTenant: (confirmationName: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

function isPermissionDenied(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return error.code === 'permission-denied' || error.code === 'firestore/permission-denied';
}

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantDoc>(emptyTenant());
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [loadedTenantId, setLoadedTenantId] = useState<string | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenName>('dashboard');
  const [currentParams, setCurrentParams] = useState<any>(null);

  const { showToast } = useToast();
  const { user, refreshUser } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.uid || null;
    if (previousUserId.current === userId) return;

    previousUserId.current = userId;

    setCurrentParams(null);
    setActiveScreen(userId ? 'dashboard' : 'signin');
  }, [user?.uid]);

  useEffect(() => {
    let active = true;
    if (!user?.tenantId) {
      setTenant(emptyTenant());
      setProjects([]);
      setInvoices([]);
      setLoadedTenantId(null);
      return () => { active = false; };
    }

    const tenantId = user.tenantId;
    setTenant(offlineStorage.loadTenant(tenantId));
    setProjects(offlineStorage.loadProjects(tenantId));
    setInvoices(offlineStorage.loadInvoices(tenantId));

    void api.loadTenant(tenantId)
      .then((loadedTenant) => {
        if (active) {
          setTenant(loadedTenant);
          setLoadedTenantId(tenantId);
          offlineStorage.saveTenant(loadedTenant);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load company record.', error);
        if (active) {
          if (isPermissionDenied(error)) {
            setLoadedTenantId(null);
            setTenant(emptyTenant());
            setProjects([]);
            setInvoices([]);
          }
          showToast(error instanceof Error ? error.message : 'Unable to load company data.', { type: 'error' });
        }
      });

    void api.listProjects(tenantId)
      .then((loadedProjects) => {
        if (active) setProjects(loadedProjects);
      })
      .catch((error: unknown) => {
        console.error('Unable to load company projects.', error);
        if (active) {
          if (isPermissionDenied(error)) {
            setLoadedTenantId(null);
            setTenant(emptyTenant());
            setProjects([]);
            setInvoices([]);
          }
          showToast(error instanceof Error ? error.message : 'Unable to load company projects.', { type: 'error' });
        }
      });

    void api.listInvoices(tenantId)
      .then((loadedInvoices) => {
        if (active) setInvoices(loadedInvoices);
      })
      .catch((error: unknown) => {
        console.error('Unable to load company invoices.', error);
        if (active) {
          if (isPermissionDenied(error)) {
            setLoadedTenantId(null);
            setTenant(emptyTenant());
            setProjects([]);
            setInvoices([]);
          }
          showToast(error instanceof Error ? error.message : 'Unable to load company invoices.', { type: 'error' });
        }
      });

    return () => { active = false; };
  }, [user?.uid, user?.tenantId, user?.role]);

  const refreshData = () => {
    if (!user?.tenantId) {
      setTenant(emptyTenant());
      setProjects([]);
      setInvoices([]);
      return;
    }
    setTenant(offlineStorage.loadTenant(user.tenantId));
    setProjects(offlineStorage.loadProjects(user.tenantId));
    setInvoices(offlineStorage.loadInvoices(user.tenantId));
  };

  const navigateTo = useCallback((screen: ScreenName, params: any = null) => {
    setActiveScreen(screen);
    setCurrentParams(params);
  }, []);

  const createProject = async (data: Omit<ProjectDoc, 'id' | 'createdAt'>): Promise<ProjectDoc> => {
    if (!user?.tenantId || user.tenantId !== tenant.id) {
      throw new Error('Set up your company before creating a project.');
    }
    if (user.role !== 'admin' && user.role !== 'architect') {
      throw new Error('Only company admins and architects can create projects.');
    }
    const newProj = await api.createProject(data);
    setProjects((prev) => [newProj, ...prev]);
    showToast(`Project "${newProj.name}" created successfully!`, { type: 'success' });
    return newProj;
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    if (!user?.tenantId || user.tenantId !== tenant.id || user.role !== 'admin') {
      throw new Error('Only a company admin can delete projects.');
    }
    await api.deleteProject(tenant.id, projectId);
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setInvoices((current) => current.filter((invoice) => invoice.projectId !== projectId));
    showToast('Project and its invoices were deleted.', { type: 'success' });
  };

  const createInvoice = async (params: {
    projectId: string;
    category: Category;
    lineItems: LineItem[];
    taxRate?: number;
    clientName: string;
    description?: string;
  }): Promise<InvoiceDoc> => {
    if (!user?.tenantId || user.tenantId !== tenant.id) {
      throw new Error('Join a company before creating an invoice.');
    }
    if (user.role !== 'admin' && user.role !== 'architect') {
      throw new Error('Only company admins and architects can create invoices.');
    }
    const { serial, invoice } = await api.allocateSerialAndCreateInvoice({
      ...params,
      tenantId: tenant.id,
      createdBy: user.uid,
    });
    setInvoices((prev) => [invoice, ...prev]);
    refreshData();
    showToast(`Serial ${serial} allocated! Draft created.`, { type: 'success' });
    return invoice;
  };

  const issueInvoice = async (invoiceId: string): Promise<InvoiceDoc> => {
    if (!user?.tenantId || user.tenantId !== tenant.id) {
      throw new Error('Join a company before issuing an invoice.');
    }
    if (user.role !== 'admin' && user.role !== 'architect') {
      throw new Error('Only company admins and architects can issue invoices.');
    }
    const { invoice } = await api.issueInvoice(tenant.id, invoiceId);
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? invoice : inv)));
    refreshData();
    showToast(`Invoice ${invoice.serial} issued and PDF generated!`, { type: 'success' });
    return invoice;
  };

  const updateInvoiceStatus = async (invoiceId: string, status: InvoiceDoc['status']) => {
    if (!user?.tenantId || user.tenantId !== tenant.id) {
      throw new Error('Join a company before updating an invoice.');
    }
    if (user.role !== 'admin' && user.role !== 'architect') {
      throw new Error('Only company admins and architects can update invoices.');
    }
    const updated = await api.updateInvoiceStatus(tenant.id, invoiceId, status);
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? updated : inv)));
    showToast(`Invoice marked as ${status.toUpperCase()}`, { type: 'info' });
  };

  const deleteInvoice = async (invoiceId: string): Promise<void> => {
    if (!user?.tenantId || user.tenantId !== tenant.id || user.role !== 'admin') {
      throw new Error('Only a company admin can delete invoices.');
    }
    await api.deleteInvoice(tenant.id, invoiceId);
    setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceId));
    showToast('Invoice and its PDF were deleted.', { type: 'success' });
  };

  const buyStoragePack = async (productId: 'storage_pack_1gb' | 'storage_pack_5gb') => {
    const purchaseToken = `token_${Date.now()}`;
    const res = await api.verifyPurchase(tenant.id, productId, purchaseToken);
    refreshData();
    showToast(res.message, { type: 'success' });
  };

  const renewSubscription = async () => {
    const purchaseToken = `token_sub_${Date.now()}`;
    const res = await api.verifyPurchase(tenant.id, 'core_monthly', purchaseToken);
    refreshData();
    showToast(res.message, { type: 'success' });
  };

  const updateTenant = async (updates: Partial<TenantDoc>) => {
    if (!user?.tenantId || user.tenantId !== tenant.id || user.role !== 'admin') {
      throw new Error('Only a company admin can update company settings.');
    }
    const updated = await api.updateTenant(tenant.id, updates);
    setTenant(updated);
    offlineStorage.saveTenant(updated);
    showToast('Company settings updated successfully', { type: 'success' });
  };

  const archiveTenant = async (confirmationName: string): Promise<void> => {
    if (!user?.tenantId || user.tenantId !== tenant.id || user.role !== 'admin') {
      throw new Error('Only a company admin can archive the company.');
    }
    await api.archiveTenant(tenant.id, confirmationName);
    setTenant(emptyTenant());
    setProjects([]);
    setInvoices([]);
    setLoadedTenantId(null);
    await refreshUser();
    navigateTo('create_company');
    showToast('Company archived. Its records are preserved and member access has been removed.', {
      type: 'success',
    });
  };

  const hasLoadedTenant = Boolean(user?.tenantId) && loadedTenantId === user?.tenantId;

  return (
    <TenantContext.Provider
      value={{
        tenant: hasLoadedTenant ? tenant : emptyTenant(user?.tenantId || ''),
        projects: hasLoadedTenant ? projects : [],
        invoices: hasLoadedTenant ? invoices : [],
        activeScreen,
        currentParams,
        navigateTo,
        refreshData,
        createProject,
        deleteProject,
        createInvoice,
        issueInvoice,
        updateInvoiceStatus,
        deleteInvoice,
        buyStoragePack,
        renewSubscription,
        updateTenant,
        archiveTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
};
