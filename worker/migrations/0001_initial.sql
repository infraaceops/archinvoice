CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  tenant_id TEXT,
  role TEXT CHECK (role IN ('admin', 'architect', 'viewer', 'client')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ceo_name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  ntn TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  seal_url TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'architect', 'viewer', 'client')),
  phone TEXT NOT NULL DEFAULT '',
  invited_by TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('architect', 'viewer')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  accepted_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS invites_tenant_idx ON invites(tenant_id, used_at, expires_at);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_single_tenant_idx ON memberships(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
