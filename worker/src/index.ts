interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  SESSION_COOKIE_NAME?: string;
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

const encoder = new TextEncoder();

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
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
        prefix: { architecture: 'ABS', interior: 'INT', supervision: 'SUP' },
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
  return jsonResponse(request, env, { error: 'Not found.' }, 404);
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
