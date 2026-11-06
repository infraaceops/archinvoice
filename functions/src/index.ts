import { initializeApp } from 'firebase-admin/app';
import { assertPricingSafety } from './config/guard';

// Assert pricing safety at startup before any exports
assertPricingSafety();

// Initialize Firebase Admin
initializeApp();

// Export all Cloud Functions
export {
  createTenant,
  archiveTenant,
  joinTenant,
  createTeamInvitation,
  listTenantTeam,
  removeTeamMember,
} from './auth/tenant';
export { deleteProject, deleteInvoice } from './projects/delete';
export { allocateSerialAndCreateInvoice } from './counters/serial';
export { issueInvoiceAndGeneratePdf, getSignedPdfUrl } from './invoices/issue';
export { playRTDNWebhook, verifyPurchase } from './billing/play';
export { dailyMeteringCron, gracePeriodEnforcer } from './metering/cron';
