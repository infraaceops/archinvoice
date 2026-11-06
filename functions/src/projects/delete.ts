import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

async function requireTenantAdmin(uid: string, tenantId: string): Promise<void> {
  const db = getFirestore();
  const [userSnap, memberSnap, tenantSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`tenants/${tenantId}/members/${uid}`).get(),
    db.doc(`tenants/${tenantId}`).get(),
  ]);
  if (userSnap.data()?.tenantId !== tenantId ||
      !memberSnap.exists ||
      memberSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only a company admin can delete company records.');
  }
  if (!tenantSnap.exists) throw new HttpsError('not-found', 'Company not found.');
  if (tenantSnap.data()?.archived === true) {
    throw new HttpsError('failed-precondition', 'This company is archived.');
  }
}

function validDocumentId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
}

async function deleteInvoicePdf(tenantId: string, invoiceId: string): Promise<number> {
  const file = getStorage().bucket().file(`tenants/${tenantId}/invoices/${invoiceId}.pdf`);
  let sizeBytes = 0;
  try {
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (Number.isFinite(size) && size > 0) sizeBytes = size;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
    if (code !== 404 && code !== '404' && code !== 'storage/object-not-found') throw error;
  }
  await file.delete({ ignoreNotFound: true });
  return sizeBytes;
}

async function decrementStorageUsage(tenantId: string, deletedBytes: number): Promise<void> {
  if (deletedBytes <= 0) return;
  const db = getFirestore();
  const tenantRef = db.doc(`tenants/${tenantId}`);
  await db.runTransaction(async (transaction) => {
    const tenantSnap = await transaction.get(tenantRef);
    if (!tenantSnap.exists) throw new HttpsError('not-found', 'Company not found.');
    const usedBytes = tenantSnap.data()?.storage?.usedBytes;
    const currentBytes = typeof usedBytes === 'number' ? usedBytes : 0;
    transaction.update(tenantRef, {
      'storage.usedBytes': Math.max(0, currentBytes - deletedBytes),
      'storage.lastMeteredAt': FieldValue.serverTimestamp(),
    });
  });
}

export const deleteProject = onCall(
  { region: 'us-central1', timeoutSeconds: 540 },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in before deleting a project.');
    if (req.auth?.token.email_verified !== true) {
      throw new HttpsError('permission-denied', 'Verify your Google account email before deleting records.');
    }
    const { tenantId, projectId } = req.data as {
      tenantId?: unknown;
      projectId?: unknown;
    };
    if (!validDocumentId(tenantId) || !validDocumentId(projectId)) {
      throw new HttpsError('invalid-argument', 'A valid company and project are required.');
    }

    await requireTenantAdmin(uid, tenantId);
    const db = getFirestore();
    const projectRef = db.doc(`tenants/${tenantId}/projects/${projectId}`);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) throw new HttpsError('not-found', 'Project not found.');

    const invoiceSnapshots = await db
      .collection(`tenants/${tenantId}/invoices`)
      .where('projectId', '==', projectId)
      .get();
    let deletedPdfBytes = 0;
    for (const invoiceSnap of invoiceSnapshots.docs) {
      deletedPdfBytes += await deleteInvoicePdf(tenantId, invoiceSnap.id);
      await db.recursiveDelete(invoiceSnap.ref);
    }
    await db.recursiveDelete(projectRef);
    await decrementStorageUsage(tenantId, deletedPdfBytes);

    return { deletedInvoiceIds: invoiceSnapshots.docs.map((invoice) => invoice.id) };
  },
);

export const deleteInvoice = onCall(
  { region: 'us-central1', timeoutSeconds: 540 },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in before deleting an invoice.');
    if (req.auth?.token.email_verified !== true) {
      throw new HttpsError('permission-denied', 'Verify your Google account email before deleting records.');
    }
    const { tenantId, invoiceId } = req.data as {
      tenantId?: unknown;
      invoiceId?: unknown;
    };
    if (!validDocumentId(tenantId) || !validDocumentId(invoiceId)) {
      throw new HttpsError('invalid-argument', 'A valid company and invoice are required.');
    }

    await requireTenantAdmin(uid, tenantId);
    const db = getFirestore();
    const invoiceRef = db.doc(`tenants/${tenantId}/invoices/${invoiceId}`);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) throw new HttpsError('not-found', 'Invoice not found.');

    const deletedPdfBytes = await deleteInvoicePdf(tenantId, invoiceId);
    await db.recursiveDelete(invoiceRef);
    await decrementStorageUsage(tenantId, deletedPdfBytes);

    return { deleted: true };
  },
);
