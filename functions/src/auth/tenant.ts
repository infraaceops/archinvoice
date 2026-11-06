import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const MAX_BRANDING_IMAGE_BYTES = 128 * 1024;

function requireVerifiedEmail(req: CallableRequest<unknown>): { uid: string; email: string } {
  const uid = req.auth?.uid;
  const email = req.auth?.token.email;
  if (!uid || typeof email !== 'string') {
    throw new HttpsError('unauthenticated', 'Sign in with Google before continuing.');
  }
  if (req.auth?.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Verify your Google account email before continuing.');
  }
  return { uid, email: email.trim().toLowerCase() };
}

function imageFromBase64(value: unknown, mimeType: unknown, fieldName: string): {
  bytes: Buffer;
  mimeType: string;
  extension: string;
} | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || typeof mimeType !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName} must be a valid image.`);
  }
  const allowedTypes: Record<string, { extension: string; matches: (bytes: Buffer) => boolean }> = {
    'image/png': { extension: 'png', matches: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
    'image/jpeg': { extension: 'jpg', matches: (bytes) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
    'image/webp': {
      extension: 'webp',
      matches: (bytes) =>
        bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
        bytes.subarray(8, 12).toString('ascii') === 'WEBP',
    },
  };
  const imageType = allowedTypes[mimeType];
  if (!imageType) {
    throw new HttpsError('invalid-argument', `${fieldName} must be a PNG, JPEG, or WEBP image.`);
  }
  const encoded = value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new HttpsError('invalid-argument', `${fieldName} is not valid base64.`);
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_BRANDING_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', `${fieldName} must be no larger than 128 KB.`);
  }
  if (!imageType.matches(bytes)) {
    throw new HttpsError('invalid-argument', `${fieldName} content does not match its image type.`);
  }
  return { bytes, mimeType, extension: imageType.extension };
}

export const createTenant = onCall({ region: 'us-central1' }, async (req) => {
  const { uid, email } = requireVerifiedEmail(req);
  const { name, ceoName, logoBase64, logoMimeType, sealBase64, sealMimeType, address, ntn } = req.data as {
    name: string;
    ceoName: string;
    logoBase64?: string;
    logoMimeType?: string;
    sealBase64?: string;
    sealMimeType?: string;
    address?: string;
    ntn?: string;
  };

  if (
    typeof name !== 'string' ||
    typeof ceoName !== 'string' ||
    !name.trim() ||
    !ceoName.trim() ||
    name.trim().length > 120 ||
    ceoName.trim().length > 120 ||
    (address !== undefined && (typeof address !== 'string' || address.length > 300)) ||
    (ntn !== undefined && (typeof ntn !== 'string' || ntn.length > 40))
  ) {
    throw new HttpsError('invalid-argument', 'Company name and CEO name are required.');
  }

  const logo = imageFromBase64(logoBase64, logoMimeType, 'Company logo');
  const seal = imageFromBase64(sealBase64, sealMimeType, 'Company seal');
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;
  const imageDataUrl = (image: ReturnType<typeof imageFromBase64>): string | null =>
    image ? `data:${image.mimeType};base64,${image.bytes.toString('base64')}` : null;
  const logoUrl = imageDataUrl(logo);
  const sealUrl = imageDataUrl(seal);

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const tenantData = {
    name: name.trim(),
    ceoName: ceoName.trim(),
    logoUrl,
    sealUrl,
    address: typeof address === 'string' ? address.trim() : '',
    ntn: typeof ntn === 'string' ? ntn.trim() : '',
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

  try {
    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists && userSnap.data()?.tenantId) {
        throw new HttpsError('already-exists', 'This account already belongs to a company.');
      }
      transaction.create(tenantRef, { ...tenantData, logoUrl, sealUrl });
      transaction.set(
        userRef,
        {
          displayName: typeof req.auth?.token.name === 'string' ? req.auth.token.name : email,
          email,
          photoUrl: typeof req.auth?.token.picture === 'string' ? req.auth.token.picture : null,
          tenantId,
          role: 'admin',
          createdAt: userSnap.exists ? userSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      transaction.create(db.doc(`tenants/${tenantId}/members/${uid}`), {
        uid,
        displayName: typeof req.auth?.token.name === 'string' ? req.auth.token.name : email,
        email,
        phone: '',
        role: 'admin',
        invitedBy: 'self',
        joinedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Company creation failed.', error);
    throw new HttpsError('internal', 'Company creation failed. Please try again.');
  }

  return { tenantId, name: name.trim(), role: 'admin' };
});

export const archiveTenant = onCall({ region: 'us-central1', timeoutSeconds: 540 }, async (req) => {
  const { uid } = requireVerifiedEmail(req);
  const { expectedTenantId, confirmationName } = req.data as {
    expectedTenantId?: unknown;
    confirmationName?: unknown;
  };
  if (typeof expectedTenantId !== 'string' || !expectedTenantId ||
      !/^[A-Za-z0-9_-]{1,150}$/.test(expectedTenantId) ||
      typeof confirmationName !== 'string') {
    throw new HttpsError('invalid-argument', 'Confirm the company name before archiving.');
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const tenantRef = db.doc(`tenants/${expectedTenantId}`);
  const [userSnap, memberSnap, tenantSnap] = await Promise.all([
    userRef.get(),
    db.doc(`tenants/${expectedTenantId}/members/${uid}`).get(),
    tenantRef.get(),
  ]);
  if (userSnap.data()?.tenantId !== expectedTenantId ||
      !memberSnap.exists ||
      memberSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only a company admin can archive this company.');
  }
  if (!tenantSnap.exists) throw new HttpsError('not-found', 'Company not found.');
  const tenantName = tenantSnap.data()?.name;
  if (typeof tenantName !== 'string' || confirmationName.trim() !== tenantName) {
    throw new HttpsError('failed-precondition', 'The company name confirmation does not match.');
  }
  if (tenantSnap.data()?.archived === true) {
    throw new HttpsError('failed-precondition', 'This company is already archived.');
  }

  const memberSnapshots = await db.collection(`tenants/${expectedTenantId}/members`).get();
  const otherMemberRefs = memberSnapshots.docs
    .filter((member) => member.id !== uid)
    .map((member) => db.doc(`users/${member.id}`));

  for (let offset = 0; offset < otherMemberRefs.length; offset += 400) {
    const userRefs = otherMemberRefs.slice(offset, offset + 400);
    const userSnapshots = await db.getAll(...userRefs);
    const batch = db.batch();
    let updateCount = 0;
    userSnapshots.forEach((snapshot) => {
      if (snapshot.exists && snapshot.data()?.tenantId === expectedTenantId) {
        batch.update(snapshot.ref, {
          tenantId: null,
          role: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        updateCount += 1;
      }
    });
    if (updateCount > 0) await batch.commit();
  }

  const finalBatch = db.batch();
  finalBatch.update(userRef, {
    tenantId: null,
    role: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  finalBatch.update(tenantRef, {
    archived: true,
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy: uid,
  });
  await finalBatch.commit();

  return { archived: true };
});
