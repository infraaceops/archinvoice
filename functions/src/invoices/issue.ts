import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as crypto from 'crypto';
import puppeteer from 'puppeteer';
import { renderInvoiceHtml } from '../pdf/template';
import { TenantDoc, InvoiceDoc, ProjectDoc } from '../types';
import pricing from '../../../config/pricing.json';

export const issueInvoiceAndGeneratePdf = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'User must be signed in.');

  const { tenantId, invoiceId } = req.data as { tenantId: string; invoiceId: string };
  if (!tenantId || !invoiceId) {
    throw new HttpsError('invalid-argument', 'Missing tenantId or invoiceId.');
  }

  const db = getFirestore();

  // Validate membership
  const memberSnap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
  if (!memberSnap.exists) throw new HttpsError('permission-denied', 'Not a tenant member.');
  const role = memberSnap.data()?.role;
  if (!['admin', 'architect'].includes(role)) {
    throw new HttpsError('permission-denied', 'Only admin or architect can issue invoices.');
  }

  // Load tenant
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) throw new HttpsError('not-found', 'Tenant not found.');
  const tenant = tenantSnap.data() as TenantDoc;

  // Check storage quota: total allowed = (includedGb + purchasedGb) * 1e9
  const totalStorageQuotaBytes = ((tenant.storage?.includedGb || 1) + (tenant.storage?.purchasedGb || 0)) * 1024 * 1024 * 1024;
  const currentUsedBytes = tenant.storage?.usedBytes || 0;
  if (currentUsedBytes >= totalStorageQuotaBytes) {
    throw new HttpsError('resource-exhausted', 'Storage quota exceeded. Please buy a storage pack.');
  }

  // Load invoice
  const invoiceRef = db.doc(`tenants/${tenantId}/invoices/${invoiceId}`);
  const invoiceSnap = await invoiceRef.get();
  if (!invoiceSnap.exists) throw new HttpsError('not-found', 'Invoice not found.');
  const invoice = invoiceSnap.data() as InvoiceDoc;

  // Load project
  const projectSnap = await db.doc(`tenants/${tenantId}/projects/${invoice.projectId}`).get();
  const project = (projectSnap.exists ? projectSnap.data() : {
    name: 'General Project',
    type: 'commercial',
    area: 0,
    unit: 'sqft',
  }) as ProjectDoc;

  // Calculate tax rate percentage
  const taxRate = invoice.subtotal > 0 ? Math.round((invoice.tax / invoice.subtotal) * 100) : 0;
  const issueDate = new Date().toISOString().split('T')[0];

  // Render HTML
  const html = renderInvoiceHtml({
    logoUrl: tenant.logoUrl,
    sealUrl: tenant.sealUrl,
    companyName: tenant.name,
    companyAddress: tenant.address,
    companyNtn: tenant.ntn,
    ceoName: tenant.ceoName,
    serial: invoice.serial,
    issueDate,
    category: invoice.category,
    clientName: invoice.clientName,
    clientLocation: project.location,
    projectName: project.name,
    projectType: project.type,
    projectArea: project.area,
    projectUnit: project.unit,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    taxRate,
    tax: invoice.tax,
    total: invoice.total,
  });

  // Puppeteer to PDF
  let pdfBuffer: Buffer;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    });
    pdfBuffer = Buffer.from(pdfUint8Array);
  } finally {
    if (browser) await browser.close();
  }

  const pdfSnapshotHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  const deltaBytes = pdfBuffer.length;
  const pdfPath = `tenants/${tenantId}/invoices/${invoiceId}.pdf`;

  // Upload to Storage
  const bucket = getStorage().bucket();
  const file = bucket.file(pdfPath);
  await file.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        tenantId,
        invoiceId,
        serial: invoice.serial,
        hash: pdfSnapshotHash,
      },
    },
  });

  // Batch / Transaction updates
  const batch = db.batch();

  // 1. Update invoice
  batch.update(invoiceRef, {
    status: 'issued',
    pdfPath,
    pdfSnapshotHash,
    issuedAt: FieldValue.serverTimestamp(),
  });

  // 2. Append storage ledger
  const ledgerRef = db.collection(`tenants/${tenantId}/storage_ledger`).doc();
  batch.set(ledgerRef, {
    deltaBytes,
    egressBytes: 0,
    reason: 'pdf_create',
    refId: invoiceId,
    at: FieldValue.serverTimestamp(),
  });

  // 3. Increment tenant storage used bytes
  const tenantRef = db.doc(`tenants/${tenantId}`);
  batch.update(tenantRef, {
    'storage.usedBytes': FieldValue.increment(deltaBytes),
    'storage.lastMeteredAt': FieldValue.serverTimestamp(),
  });

  await batch.commit();

  const newUsedBytes = currentUsedBytes + deltaBytes;
  const isNearLimit = newUsedBytes / totalStorageQuotaBytes >= 0.85;

  return {
    success: true,
    pdfPath,
    pdfSnapshotHash,
    sizeBytes: deltaBytes,
    warning: isNearLimit ? 'Storage usage is above 85%.' : null,
  };
});

export const getSignedPdfUrl = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'User must be signed in.');

  const { tenantId, invoiceId } = req.data as { tenantId: string; invoiceId: string };
  if (!tenantId || !invoiceId) {
    throw new HttpsError('invalid-argument', 'Missing tenantId or invoiceId.');
  }

  const db = getFirestore();

  // Validate membership
  const memberSnap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
  if (!memberSnap.exists) throw new HttpsError('permission-denied', 'Not a tenant member.');

  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) throw new HttpsError('not-found', 'Tenant not found.');
  const tenant = tenantSnap.data() as TenantDoc;

  // Check egress hard cap
  const hardCapBytes = (pricing.egress.hardCapGbPerMonth || 10) * 1024 * 1024 * 1024;
  const currentEgress = tenant.storage?.egressMonthBytes || 0;
  if (currentEgress >= hardCapBytes) {
    throw new HttpsError('resource-exhausted', 'Monthly egress quota cap reached. Downloads throttled.');
  }

  const invoiceSnap = await db.doc(`tenants/${tenantId}/invoices/${invoiceId}`).get();
  if (!invoiceSnap.exists) throw new HttpsError('not-found', 'Invoice not found.');
  const invoice = invoiceSnap.data() as InvoiceDoc;

  if (!invoice.pdfPath) {
    throw new HttpsError('failed-precondition', 'PDF has not been generated for this invoice yet.');
  }

  const bucket = getStorage().bucket();
  const file = bucket.file(invoice.pdfPath);

  // Signed URL valid for 15 minutes
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  });

  const estimatedBytes = 250 * 1024; // 250 KB estimate

  // Log egress to storage ledger
  const ledgerRef = db.collection(`tenants/${tenantId}/storage_ledger`).doc();
  await ledgerRef.set({
    deltaBytes: 0,
    egressBytes: estimatedBytes,
    reason: 'pdf_download',
    refId: invoiceId,
    at: FieldValue.serverTimestamp(),
  });

  // Increment tenant monthly egress
  await db.doc(`tenants/${tenantId}`).update({
    'storage.egressMonthBytes': FieldValue.increment(estimatedBytes),
  });

  return { url, estimatedBytes };
});
