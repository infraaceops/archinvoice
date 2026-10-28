interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APP_ORIGIN: string;
  SESSION_COOKIE_NAME?: string;
}

interface GoogleClaims {
  sub: string;
  email: string;
  email_verified: boolean | 'true';
  name?: string;
  picture?: string;
  aud: string;
  azp?: string;
  iss: string;
  exp: number;
  nbf?: number;
  nonce: string;
}

interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  tenantId: string | null;
  role: 'admin' | 'architect' | 'viewer' | 'client' | null;
  createdAt: string;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;
const encoder = new TextEncoder();

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get('Cookie') || '';
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function cookie(name: string, value: string, maxAge: number, path = '/'): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${path}; Secure; HttpOnly; SameSite=Lax`;
}

function sessionCookieName(env: Env): string {
  return env.SESSION_COOKIE_NAME || '__Host-archinvoice_session';
}

function validAppOrigin(env: Env): string {
  const origin = new URL(env.APP_ORIGIN);
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    throw new Error('APP_ORIGIN must use HTTPS.');
  }
  return origin.origin;
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== validAppOrigin(env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResponse(request: Request, env: Env, data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return json(data, status, { ...corsHeaders(request, env), ...headers });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkceChallenge(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json.');
  }
  try {
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > 256_000) throw new HttpError(413, 'Request body is too large.');
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Missing request body');
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalLength += value.byteLength;
      if (totalLength > 256_000) {
        await reader.cancel();
        throw new HttpError(413, 'Request body is too large.');
      }
      chunks.push(value);
    }
    const bodyBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.length;
    }
    const bodyText = new TextDecoder().decode(bodyBytes);
    const body: unknown = JSON.parse(bodyText);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error('Expected object');
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function assertMutationOrigin(request: Request, env: Env): Promise<void> {
  if (request.headers.get('Origin') !== validAppOrigin(env)) {
    throw new HttpError(403, 'Request origin is not allowed.');
  }
}

async function verifyGoogleIdToken(idToken: string, env: Env, expectedNonce: string): Promise<GoogleClaims> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Google returned an invalid identity token.');
  let header: { alg?: string; kid?: string };
  let claims: GoogleClaims;
  try {
    header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))) as { alg?: string; kid?: string };
    claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as GoogleClaims;
  } catch {
    throw new HttpError(401, 'Google returned an invalid identity token.');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'Google identity token algorithm is not accepted.');
  const jwksResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    cf: { cacheTtl: 3600, cacheEverything: true },
  } as RequestInit);
  if (!jwksResponse.ok) throw new HttpError(502, 'Google signing keys could not be fetched.');
  const jwks = await jwksResponse.json() as { keys: Array<JsonWebKey & { kid?: string }> };
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new HttpError(401, 'Google identity token uses an unknown signing key.');
  const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signature = decodeBase64Url(parts[2]);
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  const issuerValid = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  const nowSeconds = Date.now() / 1000;
  if (!verified || !issuerValid || claims.aud !== env.GOOGLE_CLIENT_ID ||
      (claims.azp !== undefined && claims.azp !== env.GOOGLE_CLIENT_ID) ||
      claims.exp <= nowSeconds - 30 || (claims.nbf !== undefined && claims.nbf > nowSeconds + 30) ||
      !safeEqual(claims.nonce, expectedNonce) || !claims.sub || !validEmail(claims.email) || !emailVerified) {
    throw new HttpError(401, 'Google identity could not be verified. Please retry sign-in.');
  }
  return claims;
}

async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  const token = cookieValue(request, sessionCookieName(env));
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.photo_url, u.tenant_id, u.role, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), new Date().toISOString()).first<{
    id: string; email: string; display_name: string; photo_url: string | null;
    tenant_id: string | null; role: SessionUser['role']; created_at: string;
  }>();
  if (!row) return null;
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name,
    photoUrl: row.photo_url || undefined,
    tenantId: row.tenant_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

async function requireSession(request: Request, env: Env): Promise<SessionUser> {
  const user = await getSessionUser(request, env);
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  return user;
}

async function requireAdmin(request: Request, env: Env): Promise<SessionUser> {
  const user = await requireSession(request, env);
  if (!user.tenantId || user.role !== 'admin') throw new HttpError(403, 'Only a company admin can perform this action.');
  return user;
}

async function startGoogleAuth(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, 'Google sign-in is not configured on the API.');
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const challenge = await createPkceChallenge(verifier);
  const expiry = new Date(Date.now() + OAUTH_STATE_TTL_SECONDS * 1000).toISOString();
  const requestedReturnTo = new URL(request.url).searchParams.get('returnTo') || '/';
  let returnTo = '/';
  if (requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//') && !requestedReturnTo.includes('\\')) {
    const parsedReturnTo = new URL(requestedReturnTo, validAppOrigin(env));
    if (parsedReturnTo.origin === validAppOrigin(env)) {
      returnTo = `${parsedReturnTo.pathname}${parsedReturnTo.search}`;
    }
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').bind(now),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare('INSERT INTO oauth_states (state_hash, nonce, code_verifier, return_to, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256(state), nonce, verifier, returnTo, expiry),
  ]);
  const callback = `${new URL(request.url).origin}/auth/google/callback`;
  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  google.searchParams.set('redirect_uri', callback);
  google.searchParams.set('response_type', 'code');
  google.searchParams.set('scope', 'openid email profile');
  google.searchParams.set('state', state);
  google.searchParams.set('nonce', nonce);
  google.searchParams.set('code_challenge', challenge);
  google.searchParams.set('code_challenge_method', 'S256');
  google.searchParams.set('prompt', 'select_account');
  return new Response(null, {
    status: 302,
    headers: {
      Location: google.toString(),
      'Cache-Control': 'no-store',
      'Set-Cookie': cookie('archinvoice_oauth_state', state, OAUTH_STATE_TTL_SECONDS, '/auth/google/callback'),
    },
  });
}

async function finishGoogleAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const stateCookie = cookieValue(request, 'archinvoice_oauth_state');
  if (!state || !code || !stateCookie || !safeEqual(state, stateCookie)) {
    throw new HttpError(400, 'Google sign-in state is missing or invalid.');
  }
  const stateHash = await sha256(state);
  const oauthState = await env.DB.prepare(
    'SELECT nonce, code_verifier, return_to FROM oauth_states WHERE state_hash = ? AND expires_at > ?',
  ).bind(stateHash, new Date().toISOString()).first<{ nonce: string; code_verifier: string; return_to: string }>();
  if (!oauthState) throw new HttpError(400, 'Google sign-in request expired. Please retry.');
  await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ?').bind(stateHash).run();

  const callback = `${url.origin}/auth/google/callback`;
  const tokensResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callback,
      grant_type: 'authorization_code',
      code_verifier: oauthState.code_verifier,
    }),
  });
  if (!tokensResponse.ok) throw new HttpError(401, 'Google could not complete sign-in. Verify the OAuth callback URL.');
  const tokens = await tokensResponse.json() as { id_token?: string };
  if (!tokens.id_token) throw new HttpError(401, 'Google did not return an identity token.');
  const claims = await verifyGoogleIdToken(tokens.id_token, env, oauthState.nonce);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, photo_url, tenant_id, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name,
     photo_url = excluded.photo_url, updated_at = excluded.updated_at`,
  ).bind(claims.sub, claims.email.toLowerCase(), claims.name || claims.email, claims.picture || null, now, now).run();
  const session = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(session), claims.sub, expiresAt, now).run();
  const responseHeaders = new Headers({
    Location: new URL(oauthState.return_to, validAppOrigin(env)).toString(),
    'Cache-Control': 'no-store',
    'Set-Cookie': cookie(sessionCookieName(env), session, SESSION_TTL_SECONDS),
  });
  responseHeaders.append('Set-Cookie', cookie('archinvoice_oauth_state', '', 0, '/auth/google/callback'));
  return new Response(null, { status: 302, headers: responseHeaders });
}

function tenantView(row: Record<string, unknown>): Record<string, unknown> {
  const currentDate = new Date();
  const expiry = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: row.id,
    name: row.name,
    ceoName: row.ceo_name,
    address: row.address,
    ntn: row.ntn,
    logoUrl: row.logo_url,
    sealUrl: row.seal_url,
    currency: 'PKR',
    subscription: {
      status: 'active', plan: 'core_monthly', pricePkr: 0, currentPeriodEnd: expiry,
      purchaseToken: `free_${row.id}`, productId: 'core_monthly',
    },
    storage: {
      includedGb: 0, purchasedGb: 0, usedBytes: 0, egressMonthBytes: 0,
      egressMonthKey: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
      lastMeteredAt: currentDate.toISOString(), throttled: false,
    },
    settings: {
      invoiceDefaults: {
        prefix: { architecture: 'ARCH', interior: 'INT', supervision: 'SUP' },
        startAt: { architecture: 1, interior: 1, supervision: 1 },
        financialYear: String(currentDate.getFullYear()),
      },
    },
    createdAt: row.created_at,
  };
}

async function routeApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/auth/session' && method === 'GET') {
    return jsonResponse(request, env, { user: await getSessionUser(request, env) });
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    await assertMutationOrigin(request, env);
    const token = cookieValue(request, sessionCookieName(env));
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return jsonResponse(request, env, { success: true }, 200, {
      'Set-Cookie': cookie(sessionCookieName(env), '', 0),
    });
  }
  if (path === '/api/tenants' && method === 'POST') {
    await assertMutationOrigin(request, env);
    const user = await requireSession(request, env);
    if (user.tenantId) throw new HttpError(409, 'Your account already belongs to a company.');
    const body = await bodyObject(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const ceoName = typeof body.ceoName === 'string' ? body.ceoName.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const ntn = typeof body.ntn === 'string' ? body.ntn.trim() : '';
    if (!name || name.length > 120 || !ceoName || ceoName.length > 120 || address.length > 500 || ntn.length > 40) {
      throw new HttpError(400, 'Company and CEO names are required. Check field length limits.');
    }
    const imageData = (key: string, mimeKey: string): string | null => {
      const base64 = body[key];
      const mimeType = body[mimeKey];
      if (base64 === undefined || base64 === null || base64 === '') return null;
      if (typeof base64 !== 'string' || base64.length > 66_668 ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(String(mimeType)) ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        throw new HttpError(400, `${key} must be a supported image smaller than 50 KB.`);
      }
      return `data:${mimeType};base64,${base64}`;
    };
    const logoUrl = imageData('logoBase64', 'logoMimeType');
    const sealUrl = imageData('sealBase64', 'sealMimeType');
    const tenantId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO tenants (id, name, ceo_name, address, ntn, logo_url, seal_url, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(tenantId, name, ceoName, address, ntn, logoUrl, sealUrl, user.uid, now),
      env.DB.prepare('INSERT INTO memberships (tenant_id, user_id, role, phone, invited_by, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(tenantId, user.uid, 'admin', '', 'self', now),
      env.DB.prepare('UPDATE users SET tenant_id = ?, role = ?, updated_at = ? WHERE id = ? AND tenant_id IS NULL')
        .bind(tenantId, 'admin', now, user.uid),
    ]);
    return jsonResponse(request, env, { tenantId, role: 'admin' }, 201);
  }
  const tenantMatch = path.match(/^\/api\/tenants\/([0-9a-f-]{36})$/i);
  if (tenantMatch && method === 'GET') {
    const user = await requireSession(request, env);
    if (user.tenantId !== tenantMatch[1]) throw new HttpError(403, 'You do not have access to this company.');
    const row = await env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantMatch[1]).first<Record<string, unknown>>();
    if (!row) throw new HttpError(404, 'Company record was not found.');
    return jsonResponse(request, env, tenantView(row));
  }
  const joinMatch = path.match(/^\/api\/tenants\/([0-9a-f-]{36})\/join$/i);
  if (joinMatch && method === 'POST') {
    await assertMutationOrigin(request, env);
    const user = await requireSession(request, env);
    if (user.tenantId) throw new HttpError(409, 'Your account already belongs to a company.');
    const body = await bodyObject(request);
    if (typeof body.inviteToken !== 'string' || !/^[0-9a-f]{64}$/.test(body.inviteToken)) {
      throw new HttpError(400, 'Invitation token is invalid.');
    }
    const inviteHash = await sha256(body.inviteToken);
    const invite = await env.DB.prepare(
      'SELECT id, email, phone, role FROM invites WHERE id = ? AND tenant_id = ? AND used_at IS NULL AND expires_at > ?',
    ).bind(inviteHash, joinMatch[1], new Date().toISOString()).first<{ id: string; email: string; phone: string; role: 'architect' | 'viewer' }>();
    if (!invite) throw new HttpError(404, 'Invitation link is invalid or has expired.');
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new HttpError(403, 'Sign in with the email address this invitation was created for.');
    }
    const now = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE invites SET used_at = ?, accepted_by = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?')
        .bind(now, user.uid, inviteHash, now),
      env.DB.prepare('INSERT INTO memberships (tenant_id, user_id, role, phone, invited_by, joined_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(joinMatch[1], user.uid, invite.role, invite.phone, 'invitation', now),
      env.DB.prepare('UPDATE users SET tenant_id = ?, role = ?, updated_at = ? WHERE id = ? AND tenant_id IS NULL')
        .bind(joinMatch[1], invite.role, now, user.uid),
    ]);
    if (!results[0].meta.changes) throw new HttpError(409, 'This invitation has already been accepted.');
    return jsonResponse(request, env, { tenantId: joinMatch[1], role: invite.role });
  }
  if (path === '/api/invites' && method === 'POST') {
    await assertMutationOrigin(request, env);
    const admin = await requireAdmin(request, env);
    const body = await bodyObject(request);
    if (!validEmail(body.email)) throw new HttpError(400, 'Enter a valid email address.');
    const role = body.role;
    if (role !== 'architect' && role !== 'viewer') throw new HttpError(400, 'Invitation role must be architect or viewer.');
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (phone.length > 40) throw new HttpError(400, 'Phone number must be 40 characters or fewer.');
    if (body.email.toLowerCase() === admin.email.toLowerCase()) throw new HttpError(409, 'You cannot invite your own email address.');
    const activeInvites = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM invites WHERE tenant_id = ? AND used_at IS NULL AND expires_at > ?',
    ).bind(admin.tenantId, new Date().toISOString()).first<{ count: number }>();
    if ((activeInvites?.count || 0) >= 50) throw new HttpError(429, 'This company has reached the limit of 50 active invitations.');
    const token = randomToken();
    const inviteId = await sha256(token);
    const now = new Date();
    const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await env.DB.prepare(
      'INSERT INTO invites (id, tenant_id, email, phone, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(inviteId, admin.tenantId, body.email.toLowerCase(), phone, role, admin.uid, now.toISOString(), expiry.toISOString()).run();
    const inviteLink = `${validAppOrigin(env)}/?invite=${token}&tenantId=${encodeURIComponent(admin.tenantId!)}`;
    return jsonResponse(request, env, { inviteToken: token, inviteLink, expiresAt: expiry.toISOString() }, 201);
  }
  if (path === '/api/team' && method === 'GET') {
    const admin = await requireAdmin(request, env);
    const [membersResult, invitesResult] = await Promise.all([
      env.DB.prepare(
        `SELECT u.id AS uid, u.display_name AS displayName, u.email, m.phone, m.role, m.invited_by AS invitedBy, m.joined_at AS joinedAt
         FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? ORDER BY m.joined_at`,
      ).bind(admin.tenantId).all<MemberDocRow>(),
      env.DB.prepare(
        `SELECT id, tenant_id AS tenantId, email, phone, role, created_by AS createdBy, expires_at AS expiresAt, 0 AS used
         FROM invites WHERE tenant_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC`,
      ).bind(admin.tenantId, new Date().toISOString()).all<InviteDocRow>(),
    ]);
    return jsonResponse(request, env, {
      members: membersResult.results.map((row) => ({
        uid: row.uid, displayName: row.displayName, email: row.email, phone: row.phone,
        role: row.role, invitedBy: row.invitedBy, joinedAt: row.joinedAt, status: 'active',
      })),
      invitations: invitesResult.results.map((row) => ({
        id: row.id, tenantId: row.tenantId, email: row.email, phone: row.phone, role: row.role,
        createdBy: row.createdBy, expiresAt: row.expiresAt, used: Boolean(row.used),
      })),
    });
  }
  const memberMatch = path.match(/^\/api\/team\/([^/]+)$/);
  if (memberMatch && method === 'DELETE') {
    await assertMutationOrigin(request, env);
    const admin = await requireAdmin(request, env);
    const targetUid = decodeURIComponent(memberMatch[1]);
    if (targetUid === admin.uid) throw new HttpError(400, 'The company owner cannot remove their own account.');
    const target = await env.DB.prepare(
      'SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?',
    ).bind(admin.tenantId, targetUid).first<{ role: string }>();
    if (!target) throw new HttpError(404, 'Team member was not found.');
    if (target.role === 'admin') throw new HttpError(403, 'Company admin access cannot be removed through this action.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?').bind(admin.tenantId, targetUid),
      env.DB.prepare('UPDATE users SET tenant_id = NULL, role = NULL, updated_at = ? WHERE id = ? AND tenant_id = ?')
        .bind(new Date().toISOString(), targetUid, admin.tenantId),
    ]);
    return jsonResponse(request, env, { success: true });
  }
  return jsonResponse(request, env, { error: 'Not found.' }, 404);
}

interface MemberDocRow {
  uid: string; displayName: string; email: string; phone: string; role: string; invitedBy: string; joinedAt: string;
}

interface InviteDocRow {
  id: string; tenantId: string; email: string; phone: string; role: string;
  createdBy: string; expiresAt: string; used: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }
      if (url.pathname === '/healthz' && request.method === 'GET') {
        await env.DB.prepare('SELECT 1').first();
        return json({ status: 'ok' });
      }
      if (url.pathname === '/auth/google/start' && request.method === 'GET') return await startGoogleAuth(request, env);
      if (url.pathname === '/auth/google/callback' && request.method === 'GET') return await finishGoogleAuth(request, env);
      if (!url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
      const response = await routeApi(request, env, url);
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'no-referrer');
      headers.set('Cache-Control', 'no-store');
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      if (error instanceof HttpError) return jsonResponse(request, env, { error: error.message }, error.status);
      console.error('Unhandled API request failure.', error);
      return jsonResponse(request, env, { error: 'The request could not be completed.' }, 500);
    }
  },
};
