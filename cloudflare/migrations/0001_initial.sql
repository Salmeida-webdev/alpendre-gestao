PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
  slug TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL DEFAULT 'starter' CHECK(plan_code IN ('starter','essencial','equipe','studio','enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','trial','past_due','suspended','closed')),
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  brand_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 2 AND 120),
  password_hash TEXT,
  email_verified_at TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK(mfa_enabled IN (0,1)),
  status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','locked','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','architect','assistant','finance','client','platform_operator')),
  permissions_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('invited','active','suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  start_date TEXT,
  due_date TEXT,
  budget_cents INTEGER CHECK(budget_cents IS NULL OR budget_cents >= 0),
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type TEXT NOT NULL DEFAULT 'person',
  source TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('task','event','approval','change','risk','rrt','permit','delivery','maintenance')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  due_at TEXT,
  assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('receivable','payable')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  category TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  object_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  version INTEGER NOT NULL DEFAULT 1,
  checksum_sha256 TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, object_key)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes_json TEXT NOT NULL DEFAULT '{}',
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config_json TEXT NOT NULL DEFAULT '{}',
  secret_ref TEXT,
  connected_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, provider)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT,
  provider_customer_ref TEXT,
  provider_subscription_ref TEXT,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS demo_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_cents INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_org_status ON clients(organization_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_projects_org_status_due ON projects(organization_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_work_org_due ON work_items(organization_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_financial_org_due ON financial_entries(organization_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_files_org_project ON files(organization_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org_entity ON audit_events(organization_id, entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_demo_org_module ON demo_records(organization_id, module, created_at);
