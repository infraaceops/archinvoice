import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Category, LineItem, TenantDoc } from '../types';

export const allocateSerialAndCreateInvoice = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  const { tenantId, projectId, category, lineItems, taxRate, clientName } = req.data as {
    tenantId: string;
    projectId: string;
    category: Category;
    lineItems: LineItem[];
    taxRate?: number;
    clientName: string;
  };

  if (!tenantId || !projectId || !category || !Array.isArray(lineItems) || !clientName) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  const db = getFirestore();

  // Validate membership
  const memberSnap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'User is not a member of this tenant.');
  }
  const role = memberSnap.data()?.role;
  if (!['admin', 'architect'].includes(role)) {
    throw new HttpsError('permission-denied', 'Only admin or architect roles can issue invoices.');
  }

  // Validate tenant & subscription
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) {
    throw new HttpsError('not-found', 'Tenant not found.');
  }
  const tenant = tenantSnap.data() as TenantDoc;
  if (tenant.subscription?.status === 'locked') {
    throw new HttpsError('failed-precondition', 'Tenant subscription is locked. Invoices cannot be created.');
  }

  const fy = tenant.settings?.invoiceDefaults?.financialYear || new Date().getFullYear().toString();
  const prefix = tenant.settings?.invoiceDefaults?.prefix?.[category] || category.substring(0, 4).toUpperCase();
  const startAt = tenant.settings?.invoiceDefaults?.startAt?.[category] ?? 1;

  const counterId = `${category}_${fy}`;
  const counterRef = db.doc(`tenants/${tenantId}/counters/${counterId}`);
  const invoiceRef = db.collection(`tenants/${tenantId}/invoices`).doc();

  return db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const next = counterSnap.exists ? counterSnap.data()!.nextValue : startAt;
    const serial = `${prefix}-${fy}-${String(next).padStart(4, '0')}`;

    const subtotal = Math.round(
      lineItems.reduce((s: number, i: LineItem) => s + (i.amount || 0), 0) * 100
    ) / 100;
    const effectiveTaxRate = taxRate && taxRate > 0 ? taxRate : 0;
    const tax = Math.round((subtotal * (effectiveTaxRate / 100)) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    tx.set(
      counterRef,
      {
        category,
        financialYear: fy,
        prefix,
        nextValue: next + 1,
        lastIssuedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(invoiceRef, {
      serial,
      category,
      financialYear: fy,
      projectId,
      clientName,
      lineItems,
      subtotal,
      tax,
      total,
      currency: 'PKR',
      status: 'draft',
      pdfPath: null,
      pdfSnapshotHash: null,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      issuedAt: null,
    });

    return { invoiceId: invoiceRef.id, serial, subtotal, tax, total };
  });
});
