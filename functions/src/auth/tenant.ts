import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { InviteDoc } from '../types';

export const createTenant = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'User must be authenticated.');

  const { name, ceoName, logoBase64, sealBase64, address, ntn } = req.data as {
    name: string;
    ceoName: string;
    logoBase64?: string;
    sealBase64?: string;
    address?: string;
    ntn?: string;
  };

  if (!name || !ceoName) {
    throw new HttpsError('invalid-argument', 'Company name and CEO name are required.');
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();

  if (userSnap.exists && userSnap.data()?.tenantId) {
    throw new HttpsError('already-exists', 'User is already associated with a tenant.');
  }

  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;

  let logoUrl: string | null = null;
  let sealUrl: string | null = null;

  const bucket = getStorage().bucket();

  if (logoBase64) {
    try {
      const buffer = Buffer.from(logoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const logoFile = bucket.file(`tenants/${tenantId}/branding/logo.png`);
      await logoFile.save(buffer, { metadata: { contentType: 'image/png' } });
      const [signedLogo] = await logoFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
      });
      logoUrl = signedLogo;
    } catch (e) {
      console.warn('Failed to upload logo:', e);
    }
  }

  if (sealBase64) {
    try {
      const buffer = Buffer.from(sealBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const sealFile = bucket.file(`tenants/${tenantId}/branding/seal.png`);
      await sealFile.save(buffer, { metadata: { contentType: 'image/png' } });
      const [signedSeal] = await sealFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
      });
      sealUrl = signedSeal;
    } catch (e) {
      console.warn('Failed to upload seal:', e);
    }
  }

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const tenantData = {
    name,
    ceoName,
    logoUrl,
    sealUrl,
    address: address || '',
    ntn: ntn || '',
    currency: 'PKR',
    subscription: {
      status: 'active',
      plan: 'core_monthly',
      pricePkr: 280,
      currentPeriodEnd: Timestamp.fromDate(trialEnd),
      purchaseToken: 'trial_' + tenantId,
      productId: 'core_monthly',
    },
    storage: {
      includedGb: 1,
      purchasedGb: 0,
      usedBytes: 0,
      egressMonthBytes: 0,
      egressMonthKey: currentMonthKey,
      lastMeteredAt: FieldValue.serverTimestamp(),
      throttled: false,
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
    createdAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  batch.set(tenantRef, tenantData);
  batch.set(
    userRef,
    {
      tenantId,
      role: 'admin',
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(db.doc(`tenants/${tenantId}/members/${uid}`), {
    role: 'admin',
    invitedBy: 'self',
    joinedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { tenantId, name, role: 'admin' };
});

export const joinTenant = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'User must be authenticated.');

  const { inviteCode } = req.data as { inviteCode: string };
  if (!inviteCode) throw new HttpsError('invalid-argument', 'Invite code is required.');

  const db = getFirestore();

  // Find invite across tenants collection group or specific code query
  const querySnap = await db
    .collectionGroup('invites')
    .where(FieldPath_documentId(), '==', inviteCode.trim())
    .limit(1)
    .get();

  if (querySnap.empty) {
    throw new HttpsError('not-found', 'Invalid invite code.');
  }

  const inviteDoc = querySnap.docs[0];
  const inviteData = inviteDoc.data() as InviteDoc;

  if (inviteData.used) {
    throw new HttpsError('failed-precondition', 'Invite code has already been used.');
  }

  if (inviteData.expiresAt.toDate() < new Date()) {
    throw new HttpsError('deadline-exceeded', 'Invite code has expired.');
  }

  // Tenant ID is 2 steps up in path: tenants/{tenantId}/invites/{code}
  const tenantId = inviteDoc.ref.parent.parent?.id;
  if (!tenantId) {
    throw new HttpsError('internal', 'Malformed invite reference.');
  }

  const batch = db.batch();
  batch.update(inviteDoc.ref, { used: true });
  batch.set(db.doc(`tenants/${tenantId}/members/${uid}`), {
    role: inviteData.role,
    invitedBy: inviteData.createdBy,
    joinedAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    db.doc(`users/${uid}`),
    {
      tenantId,
      role: inviteData.role,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  return { tenantId, role: inviteData.role };
});

function FieldPath_documentId() {
  const { FieldPath } = require('firebase-admin/firestore');
  return FieldPath.documentId();
}
