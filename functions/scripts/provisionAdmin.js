const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const authDomain = process.env.USERNAME_AUTH_DOMAIN || 'archinvoice.infraaceops.com';

if (!username || !/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/.test(username)) {
  throw new Error('Set ADMIN_USERNAME to a 3–32 character username using letters, numbers, dots, underscores, or hyphens.');
}
if (!password || password.length < 12 || password.length > 128) {
  throw new Error('Set ADMIN_PASSWORD to a password between 12 and 128 characters.');
}
if (!/^[a-z0-9.-]+$/.test(authDomain)) {
  throw new Error('USERNAME_AUTH_DOMAIN must be a valid hostname.');
}

initializeApp();

async function provisionAdmin() {
  const auth = getAuth();
  const email = `${username}@${authDomain}`;
  if (await auth.getUserByEmail(email).then(() => true, (error) => {
    if (error.code === 'auth/user-not-found') return false;
    throw error;
  })) {
    throw new Error('An account already exists for this username; no account was changed.');
  }

  const user = await auth.createUser({
    email,
    password,
    displayName: username,
  });
  try {
    await getFirestore().doc(`users/${user.uid}`).create({
      uid: user.uid,
      displayName: username,
      email,
      photoUrl: null,
      tenantId: null,
      role: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await auth.deleteUser(user.uid);
    throw error;
  }
  console.log(`Created the initial account for "${username}".`);
}

provisionAdmin().catch((error) => {
  console.error('Initial account provisioning failed:', error.message);
  process.exitCode = 1;
});
