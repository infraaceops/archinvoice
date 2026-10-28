import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { InviteDoc } from '../types';
import { createHash, randomBytes } from 'crypto';

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

export const joinTenant = onCall({ region: 'us-central1' }, async (req) => {
  const { uid, email } = requireVerifiedEmail(req);
  const inviteToken = (req.data as { inviteToken?: unknown }).inviteToken;
  if (typeof inviteToken !== 'string' || inviteToken.length < 40 || inviteToken.length > 200) {
    throw new HttpsError('invalid-argument', 'A valid invitation link is required.');
  }
  const inviteId = createHash('sha256').update(inviteToken).digest('hex');
  const db = getFirestore();
  const inviteRef = db.doc(`teamInvitations/${inviteId}`);
  const userRef = db.doc(`users/${uid}`);
  const result = await db.runTransaction(async (transaction) => {
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invitation is invalid or has expired.');
    const invite = inviteSnap.data() as InviteDoc & { tenantId: string };
    const tenantId = invite.tenantId;
    if (typeof tenantId !== 'string' || !tenantId) {
      throw new HttpsError('internal', 'Invitation record is invalid.');
    }
    const memberRef = db.doc(`tenants/${tenantId}/members/${uid}`);
    const userSnap = await transaction.get(userRef);
    const memberSnap = await transaction.get(memberRef);
    if (invite.used) throw new HttpsError('already-exists', 'This invitation has already been used.');
    if (invite.expiresAt.toDate() <= new Date()) {
      throw new HttpsError('deadline-exceeded', 'This invitation has expired.');
    }
    if (invite.email?.trim().toLowerCase() !== email) {
      throw new HttpsError('permission-denied', 'Sign in with the email address this invitation was sent to.');
    }
    if (memberSnap.exists || (userSnap.exists && userSnap.data()?.tenantId)) {
      throw new HttpsError('already-exists', 'This account already belongs to a company.');
    }
    transaction.update(inviteRef, {
      used: true,
      acceptedBy: uid,
      acceptedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(memberRef, {
      uid,
      displayName: typeof req.auth?.token.name === 'string' ? req.auth.token.name : email,
      email,
      phone: invite.phone || '',
      role: invite.role,
      invitedBy: invite.createdBy,
      joinedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      userRef,
      {
        displayName: typeof req.auth?.token.name === 'string' ? req.auth.token.name : email,
        email,
        photoUrl: typeof req.auth?.token.picture === 'string' ? req.auth.token.picture : null,
        tenantId,
        role: invite.role,
        createdAt: userSnap.exists ? userSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { tenantId, role: invite.role };
  });
  return result;
});

async function requireTenantAdmin(uid: string): Promise<{ tenantId: string; member: FirebaseFirestore.DocumentData }> {
  const db = getFirestore();
  const userSnap = await db.doc(`users/${uid}`).get();
  const tenantId = userSnap.data()?.tenantId;
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new HttpsError('permission-denied', 'This account is not associated with a company.');
  }
  const memberSnap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only a company admin can manage team members.');
  }
  return { tenantId, member: memberSnap.data() || {} };
}

export const createTeamInvitation = onCall({ region: 'us-central1' }, async (req) => {
  const { uid } = requireVerifiedEmail(req);
  const { tenantId } = await requireTenantAdmin(uid);
  const { email, phone, role } = req.data as {
    email?: unknown;
    phone?: unknown;
    role?: unknown;
  };
  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.trim().length > 30)) ||
    (role !== 'architect' && role !== 'viewer')
  ) {
    throw new HttpsError('invalid-argument', 'Enter a valid email, optional phone number, and permitted team role.');
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === req.auth?.token.email?.toString().toLowerCase()) {
    throw new HttpsError('already-exists', 'You are already a member of this company.');
  }
  const db = getFirestore();
  const memberQuery = await db
    .collection(`tenants/${tenantId}/members`)
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();
  if (!memberQuery.empty) throw new HttpsError('already-exists', 'This email is already a team member.');
  const pendingQuery = await db.collection('teamInvitations').where('tenantId', '==', tenantId).get();
  if (pendingQuery.docs.some((invite) => {
    const data = invite.data();
    return data.email === normalizedEmail && !data.used && data.expiresAt.toDate() > new Date();
  })) {
    throw new HttpsError('already-exists', 'There is already an active invitation for this email.');
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const inviteRef = db.doc(`teamInvitations/${tokenHash}`);
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  await inviteRef.create({
    tenantId,
    email: normalizedEmail,
    phone: typeof phone === 'string' ? phone.trim() : '',
    role,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    used: false,
  });
  return {
    inviteToken: token,
    expiresAt: expiresAt.toDate().toISOString(),
    inviteLink: `archinvoice://join?token=${token}`,
  };
});

export const listTenantTeam = onCall({ region: 'us-central1' }, async (req) => {
  const { uid } = requireVerifiedEmail(req);
  const { tenantId } = await requireTenantAdmin(uid);
  const db = getFirestore();
  const [members, invites] = await Promise.all([
    db.collection(`tenants/${tenantId}/members`).get(),
    db.collection('teamInvitations').where('tenantId', '==', tenantId).get(),
  ]);
  return {
    members: members.docs.map((member) => {
      const data = member.data();
      return {
        uid: member.id,
        displayName: data.displayName || '',
        email: data.email || '',
        phone: data.phone || '',
        role: data.role,
        invitedBy: data.invitedBy || '',
        joinedAt: data.joinedAt?.toDate?.().toISOString() || '',
      };
    }),
    invitations: invites.docs
      .filter((invite) => !invite.data().used && invite.data().expiresAt.toDate() > new Date())
      .map((invite) => {
        const data = invite.data();
        return {
          id: invite.id,
          email: data.email,
          phone: data.phone || '',
          role: data.role,
          createdBy: data.createdBy,
          expiresAt: data.expiresAt.toDate().toISOString(),
          used: false,
        };
      }),
  };
});

export const removeTeamMember = onCall({ region: 'us-central1' }, async (req) => {
  const { uid } = requireVerifiedEmail(req);
  const { tenantId } = await requireTenantAdmin(uid);
  const targetUid = (req.data as { targetUid?: unknown }).targetUid;
  if (typeof targetUid !== 'string' || !targetUid || targetUid === uid) {
    throw new HttpsError('invalid-argument', 'Choose another team member to remove.');
  }
  const db = getFirestore();
  const targetRef = db.doc(`tenants/${tenantId}/members/${targetUid}`);
  const targetUserRef = db.doc(`users/${targetUid}`);
  await db.runTransaction(async (transaction) => {
    const targetSnap = await transaction.get(targetRef);
    if (!targetSnap.exists) throw new HttpsError('not-found', 'Team member not found.');
    if (targetSnap.data()?.role === 'admin') {
      const admins = await transaction.get(
        db.collection(`tenants/${tenantId}/members`).where('role', '==', 'admin')
      );
      if (admins.size <= 1) {
        throw new HttpsError('failed-precondition', 'The last company admin cannot be removed.');
      }
    }
    const targetUser = await transaction.get(targetUserRef);
    transaction.delete(targetRef);
    if (targetUser.exists && targetUser.data()?.tenantId === tenantId) {
      transaction.update(targetUserRef, {
        tenantId: null,
        role: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
  return { removed: true };
});
