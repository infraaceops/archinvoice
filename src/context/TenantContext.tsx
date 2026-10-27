import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Category, InvoiceDoc, LineItem, MemberDoc, ProjectDoc, Role, TenantDoc } from '../types';
import { offlineStorage } from '../services/offlineStorage';
import { api } from '../services/api';
import { MOCK_MEMBERS, MOCK_TENANT } from '../services/mockData';
import { useToast } from './ToastContext';

export type ScreenName =
  | 'splash'
  | 'signin'
  | 'onboarding'
  | 'create_company'
  | 'join_company'
  | 'dashboard'
  | 'projects'
  | 'create_project'
  | 'project_detail'
  | 'create_invoice'
  | 'invoice_preview'
  | 'pdf_viewer'
  | 'history'
  | 'billing'
  | 'settings';

interface TenantContextType {
  tenant: TenantDoc;
  projects: ProjectDoc[];
  invoices: InvoiceDoc[];
  members: MemberDoc[];
  activeScreen: ScreenName;
  currentParams: any;
  navigateTo: (screen: ScreenName, params?: any) => void;
  refreshData: () => void;
  createProject: (data: Omit<ProjectDoc, 'id' | 'createdAt'>) => Promise<ProjectDoc>;
  createInvoice: (params: {
    projectId: string;
    category: Category;
    lineItems: LineItem[];
    taxRate?: number;
    clientName: string;
  }) => Promise<InvoiceDoc>;
  issueInvoice: (invoiceId: string) => Promise<InvoiceDoc>;
  updateInvoiceStatus: (invoiceId: string, status: InvoiceDoc['status']) => Promise<void>;
  buyStoragePack: (productId: 'storage_pack_1gb' | 'storage_pack_5gb') => Promise<void>;
  renewSubscription: () => Promise<void>;
  updateTenant: (updates: Partial<TenantDoc>) => void;
  generateInvite: (role: Role) => string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantDoc>(offlineStorage.loadTenant());
  const [projects, setProjects] = useState<ProjectDoc[]>(offlineStorage.loadProjects());
  const [invoices, setInvoices] = useState<InvoiceDoc[]>(offlineStorage.loadInvoices());
  const [members, setMembers] = useState<MemberDoc[]>(MOCK_MEMBERS);
  const [activeScreen, setActiveScreen] = useState<ScreenName>('dashboard');
  const [currentParams, setCurrentParams] = useState<any>(null);

  const { showToast } = useToast();

  const refreshData = () => {
    setTenant(offlineStorage.loadTenant());
    setProjects(offlineStorage.loadProjects());
    setInvoices(offlineStorage.loadInvoices());
  };

  const navigateTo = (screen: ScreenName, params: any = null) => {
    setActiveScreen(screen);
    setCurrentParams(params);
  };

  const createProject = async (data: Omit<ProjectDoc, 'id' | 'createdAt'>): Promise<ProjectDoc> => {
    const newProj = await api.createProject(data);
    setProjects((prev) => [newProj, ...prev]);
    showToast(`Project "${newProj.name}" created successfully!`, { type: 'success' });
    return newProj;
  };

  const createInvoice = async (params: {
    projectId: string;
    category: Category;
    lineItems: LineItem[];
    taxRate?: number;
    clientName: string;
  }): Promise<InvoiceDoc> => {
    const { serial, invoice } = await api.allocateSerialAndCreateInvoice({
      ...params,
      tenantId: tenant.id,
    });
    setInvoices((prev) => [invoice, ...prev]);
    refreshData();
    showToast(`Serial ${serial} allocated! Draft created.`, { type: 'success' });
    return invoice;
  };

  const issueInvoice = async (invoiceId: string): Promise<InvoiceDoc> => {
    const { invoice } = await api.issueInvoice(tenant.id, invoiceId);
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? invoice : inv)));
    refreshData();
    showToast(`Invoice ${invoice.serial} issued and PDF generated!`, { type: 'success' });
    return invoice;
  };

  const updateInvoiceStatus = async (invoiceId: string, status: InvoiceDoc['status']) => {
    const updated = await api.updateInvoiceStatus(invoiceId, status);
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? updated : inv)));
    showToast(`Invoice marked as ${status.toUpperCase()}`, { type: 'info' });
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

  const updateTenant = (updates: Partial<TenantDoc>) => {
    const updated = { ...tenant, ...updates };
    setTenant(updated);
    offlineStorage.saveTenant(updated);
    showToast('Company settings updated successfully', { type: 'success' });
  };

  const generateInvite = (role: Role): string => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prefix = role === 'admin' ? 'ADM' : role === 'architect' ? 'ARC' : 'VIW';
    const code = `${prefix}-${randomSuffix}`;
    const newMember: MemberDoc = {
      uid: `invite-${Date.now()}`,
      displayName: `Invited ${role.toUpperCase()}`,
      email: `pending@invitation.com`,
      role,
      invitedBy: tenant.ceoName,
      joinedAt: new Date().toISOString(),
    };
    setMembers((prev) => [...prev, newMember]);
    showToast(`Generated Invite Code: ${code} (Role: ${role})`, { type: 'success' });
    return code;
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        projects,
        invoices,
        members,
        activeScreen,
        currentParams,
        navigateTo,
        refreshData,
        createProject,
        createInvoice,
        issueInvoice,
        updateInvoiceStatus,
        buyStoragePack,
        renewSubscription,
        updateTenant,
        generateInvite,
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
