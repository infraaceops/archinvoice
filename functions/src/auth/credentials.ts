import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const USERNAME_AUTH_DOMAIN = process.env.USERNAME_AUTH_DOMAIN || 'archinvoice.infraaceops.com';
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;

export const changeAccountCredentials = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  const currentEmail = request.auth?.token.email;
  const authTime = request.auth?.token.auth_time;
  if (!uid || typeof currentEmail !== 'string') {
    throw new HttpsError('unauthenticated', 'Sign in before changing account credentials.');
  }
  if (typeof authTime !== 'number' || Date.now() / 1000 - authTime > 300) {
    throw new HttpsError('failed-precondition', 'Re-enter your previous username and password before continuing.');
  }

  if (typeof request.data !== 'object' || request.data === null) {
    throw new HttpsError('invalid-argument', 'New account credentials are required.');
  }
  const { newUsername, newPassword } = request.data as {
    newUsername?: unknown;
    newPassword?: unknown;
  };
  if (typeof newUsername !== 'string' || !USERNAME_PATTERN.test(newUsername.trim().toLowerCase())) {
    throw new HttpsError('invalid-argument', 'Username must be 3–32 characters and use letters, numbers, dots, underscores, or hyphens.');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
    throw new HttpsError('invalid-argument', 'New password must be between 12 and 128 characters.');
  }
  const normalizedUsername = newUsername.trim().toLowerCase();
  const newEmail = `${normalizedUsername}@${USERNAME_AUTH_DOMAIN}`;
  if (!currentEmail.toLowerCase().endsWith(`@${USERNAME_AUTH_DOMAIN}`)) {
    throw new HttpsError('failed-precondition', 'This account is not configured for username sign-in.');
  }

  const auth = getAuth();
  const previousAccount = await auth.getUser(uid);
  if (previousAccount.email?.toLowerCase() !== currentEmail.toLowerCase()) {
    throw new HttpsError('unauthenticated', 'Your sign-in session is out of date. Sign in again.');
  }
  if (newEmail !== currentEmail.toLowerCase()) {
    try {
      const existingAccount = await auth.getUserByEmail(newEmail);
      if (existingAccount.uid !== uid) {
        throw new HttpsError('already-exists', 'That username is already in use.');
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (!(typeof error === 'object' && error !== null && 'code' in error &&
          error.code === 'auth/user-not-found')) {
        throw error;
      }
    }
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    throw new HttpsError('failed-precondition', 'Your account profile is missing.');
  }
  const userProfile = userSnapshot.data()!;
  if (typeof userProfile.email !== 'string' ||
      userProfile.email.toLowerCase() !== currentEmail.toLowerCase()) {
    throw new HttpsError('failed-precondition', 'Your account profile is out of date. Sign in again.');
  }
  const tenantId = typeof userProfile.tenantId === 'string' ? userProfile.tenantId : null;
  const memberRef = tenantId ? db.doc(`tenants/${tenantId}/members/${uid}`) : null;
  const memberSnapshot = memberRef ? await memberRef.get() : null;
  if (memberRef && !memberSnapshot?.exists) {
    throw new HttpsError('failed-precondition', 'Your company membership could not be verified.');
  }

  await db.runTransaction(async (transaction) => {
    const currentProfile = await transaction.get(userRef);
    const currentProfileEmail = currentProfile.data()?.email;
    if (!currentProfile.exists ||
        typeof currentProfileEmail !== 'string' ||
        currentProfileEmail.toLowerCase() !== currentEmail.toLowerCase()) {
      throw new HttpsError('failed-precondition', 'Your account credentials have changed. Sign in again.');
    }
    if (memberRef) {
      const currentMember = await transaction.get(memberRef);
      const currentMemberEmail = currentMember.data()?.email;
      if (!currentMember.exists ||
          typeof currentMemberEmail !== 'string' ||
          currentMemberEmail.toLowerCase() !== currentEmail.toLowerCase()) {
        throw new HttpsError('failed-precondition', 'Your company membership could not be verified.');
      }
    }
    transaction.update(userRef, {
      username: normalizedUsername,
      displayName: normalizedUsername,
      email: newEmail,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (memberRef) {
      transaction.update(memberRef, {
        displayName: normalizedUsername,
        email: newEmail,
      });
    }
  });

  try {
    await auth.updateUser(uid, {
      email: newEmail,
      password: newPassword,
      displayName: normalizedUsername,
    });
  } catch (error) {
    try {
      const rollback = db.batch();
      rollback.update(userRef, {
        username: userProfile.username || currentEmail.split('@')[0],
        displayName: userProfile.displayName || currentEmail.split('@')[0],
        email: currentEmail,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (memberRef && memberSnapshot?.exists) {
        rollback.update(memberRef, {
          displayName: memberSnapshot.data()?.displayName || currentEmail.split('@')[0],
          email: currentEmail,
        });
      }
      await rollback.commit();
    } catch (rollbackError) {
      console.error('Account credential rollback failed after Firebase Auth update failure.', rollbackError);
      throw new HttpsError('internal', 'Account credentials could not be updated. Contact support before retrying.');
    }
    if (typeof error === 'object' && error !== null && 'code' in error &&
        error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'That username is already in use.');
    }
    throw new HttpsError('internal', 'Account credentials could not be updated. Please try again.');
  }

  return { username: normalizedUsername };
});
