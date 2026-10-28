import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Category, InviteDoc, InvoiceDoc, LineItem, MemberDoc, ProjectDoc, Role, TeamInvitationResult, TenantDoc } from '../types';
import { offlineStorage } from '../services/offlineStorage';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

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
  | 'collaboration'
  | 'notifications'
  | 'profile'
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
  invitations: InviteDoc[];
  activeScreen: ScreenName;
  currentParams: any;
  navigateTo: (screen: ScreenName, params?: any) => void;
  refreshData: () => void;
  refreshTeam: () => Promise<void>;
  inviteTeamMember: (data: { email: string; phone?: string; role: 'architect' | 'viewer' }) => Promise<TeamInvitationResult>;
  removeTeamMember: (uid: string) => Promise<void>;
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
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantDoc>(offlineStorage.loadTenant());
  const [projects, setProjects] = useState<ProjectDoc[]>(offlineStorage.loadProjects());
  const [invoices, setInvoices] = useState<InvoiceDoc[]>(offlineStorage.loadInvoices());
  const [members, setMembers] = useState<MemberDoc[]>([]);
  const [invitations, setInvitations] = useState<InviteDoc[]>([]);
  const [activeScreen, setActiveScreen] = useState<ScreenName>('dashboard');
  const [currentParams, setCurrentParams] = useState<any>(null);

  const { showToast } = useToast();
  const { user } = useAuth();

  const refreshTeam = async () => {
    if (!user?.tenantId || user.role !== 'admin') {
      setMembers([]);
      setInvitations([]);
      return;
    }
    const team = await api.listTenantTeam();
    setMembers(team.members.map((member) => ({ ...member, status: 'active' })));
    setInvitations(team.invitations);
  };

  useEffect(() => {
    let active = true;
    if (!user?.tenantId) return () => { active = false; };
    void api.loadTenant(user.tenantId)
      .then((loadedTenant) => {
        if (active) {
          setTenant(loadedTenant);
          offlineStorage.saveTenant(loadedTenant);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load company record.', error);
        if (active) showToast(error instanceof Error ? error.message : 'Unable to load company data.', { type: 'error' });
      });
    if (user.role === 'admin') {
      void refreshTeam().catch((error: unknown) => {
        console.error('Unable to load company team.', error);
        if (active) showToast(error instanceof Error ? error.message : 'Unable to load team members.', { type: 'error' });
      });
    }
    return () => { active = false; };
  }, [user?.tenantId, user?.role]);

  const refreshData = () => {
    setTenant(offlineStorage.loadTenant());
    setProjects(offlineStorage.loadProjects());
    setInvoices(offlineStorage.loadInvoices());
  };

  const navigateTo = useCallback((screen: ScreenName, params: any = null) => {
    setActiveScreen(screen);
    setCurrentParams(params);
  }, []);

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

  const inviteTeamMember = async (data: {
    email: string;
    phone?: string;
    role: 'architect' | 'viewer';
  }): Promise<TeamInvitationResult> => {
    const invitation = await api.createTeamInvitation(data);
    await refreshTeam();
    showToast(`A one-time invitation link was created for ${data.email}.`, { type: 'success' });
    return invitation;
  };

  const removeTeamMember = async (uid: string): Promise<void> => {
    await api.removeTeamMember(uid);
    await refreshTeam();
    showToast('Team member access was removed.', { type: 'success' });
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        projects,
        invoices,
        members,
        invitations,
        activeScreen,
        currentParams,
        navigateTo,
        refreshData,
        refreshTeam,
        inviteTeamMember,
        removeTeamMember,
        createProject,
        createInvoice,
        issueInvoice,
        updateInvoiceStatus,
        buyStoragePack,
        renewSubscription,
        updateTenant,
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
