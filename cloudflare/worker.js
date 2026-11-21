const PUBLIC_ORIGINS = new Set([
  'https://alpendregestao.netlify.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
]);
const DEMO_ORG = 'estudio-alpendre-demo';
const DEMO_MODULES = new Set([
  'crm','propostas','clientes','briefing','projetos','agenda','documentos','aprovacoes',
  'rrt','financeiro','obras','fornecedores','riscos','entregas','equipe','automacoes','relatorios','marca','plataforma'
]);
const MAX_BODY_BYTES = 8192;
const MAX_SESSION_WRITES = 500;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains'
};
function responseHeaders(origin = '') {
  const headers = new Headers(JSON_HEADERS);
  if (PUBLIC_ORIGINS.has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
    headers.set('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    headers.set('access-control-allow-headers', 'content-type, x-demo-session, x-request-id');
    headers.set('access-control-max-age', '600');
  }
  return headers;
}
function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(origin) });
}
function isTrustedOrigin(origin) {
  return PUBLIC_ORIGINS.has(origin);
}
async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function parseBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) throw new Error('payload_too_large');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('payload_too_large');
  try { return JSON.parse(raw); } catch { throw new Error('invalid_json'); }
}
function boundedText(value, max, required = false) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && text.length < 2) throw new Error('invalid_input');
  if (text.length > max) throw new Error('invalid_input');
  return text;
}
function cleanRecord(input, fallback = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const module = boundedText(source.module || fallback.module, 32, true);
  if (!DEMO_MODULES.has(module)) throw new Error('invalid_module');
  const title = boundedText(source.title ?? source.name ?? fallback.title, 120, true);
  const status = boundedText(source.status ?? fallback.status ?? 'Em andamento', 40, true);
  const subtitle = boundedText(source.subtitle ?? fallback.subtitle, 160);
  const description = boundedText(source.description ?? fallback.description, 600);
  const value = boundedText(source.value ?? fallback.value, 60);
  const amount = source.amount_cents ?? fallback.amount_cents ?? null;
  const amountCents = amount === null || amount === '' ? null : Number(amount);
  if (amountCents !== null && (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > 10000000000)) throw new Error('invalid_input');
  const payload = { fictional: true, subtitle, description, value };
  return { module, title, status, amountCents, payloadJson: JSON.stringify(payload) };
}
function decodeRecord(row) {
  let payload = {};
  try { payload = JSON.parse(row.payload_json || '{}'); } catch {}
  return {
    id: row.record_id || row.id,
    name: row.title,
    subtitle: payload.subtitle || 'Registro do escritório · Estúdio Alpendre',
    description: payload.description || 'Acompanhar próximo passo e atualizar a etapa do processo.',
    status: row.status,
    value: payload.value || (row.amount_cents == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.amount_cents / 100)),
    amount_cents: row.amount_cents == null ? null : Number(row.amount_cents),
    created: row.created_at,
    updated: row.updated_at || row.created_at
  };
}
async function getDemoOrg(env) {
  return env.DB.prepare("SELECT id FROM organizations WHERE slug = ? AND status = 'active'").bind(DEMO_ORG).first();
}
async function requireSession(request, env) {
  const token = request.headers.get('x-demo-session') || '';
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const tokenHash = await digest(token);
  const session = await env.DB.prepare("SELECT token_hash FROM demo_sessions WHERE token_hash = ? AND expires_at > datetime('now')").bind(tokenHash).first();
  if (!session) return null;
  await env.DB.prepare("UPDATE demo_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?").bind(tokenHash).run();
  return tokenHash;
}
async function createSession(request, env, origin) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const hour = new Date().toISOString().slice(0, 13);
  const ipHash = await digest(`${ip}:${hour}`);
  await env.DB.prepare("DELETE FROM demo_session_issuance WHERE created_at < datetime('now', '-1 hour')").run();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS total FROM demo_session_issuance WHERE ip_hash = ? AND created_at >= datetime('now', '-1 hour')").bind(ipHash).first();
  if (Number(recent?.total || 0) >= 30) throw new Error('demo_rate_limit');
  await env.DB.prepare('INSERT INTO demo_session_issuance (ip_hash) VALUES (?)').bind(ipHash).run();
  const token = randomToken();
  const tokenHash = await digest(token);
  const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().replace('T', ' ').slice(0, 19);
  await env.DB.prepare("DELETE FROM demo_sessions WHERE expires_at <= datetime('now')").run();
  await env.DB.prepare('INSERT INTO demo_sessions (token_hash, expires_at) VALUES (?, ?)').bind(tokenHash, expiry).run();
  return json({ token, expiresAt: expiry, demo: true }, 201, origin);
}
async function listRecords(env, sessionHash, module) {
  const org = await getDemoOrg(env);
  if (!org) throw new Error('demo_unavailable');
  const base = await env.DB.prepare('SELECT id, module, title, status, amount_cents, payload_json, created_at FROM demo_records WHERE organization_id = ? AND module = ? ORDER BY created_at DESC, title LIMIT 100').bind(org.id, module).all();
  const changes = await env.DB.prepare('SELECT record_id, module, action, title, status, amount_cents, payload_json, created_at, updated_at FROM demo_session_records WHERE token_hash = ? AND module = ? ORDER BY updated_at DESC').bind(sessionHash, module).all();
  const overrideMap = new Map((changes.results || []).map(row => [row.record_id, row]));
  const records = [];
  for (const row of base.results || []) {
    const override = overrideMap.get(row.id);
    if (override?.action === 'delete') continue;
    records.push(decodeRecord(override?.action === 'upsert' ? override : row));
    overrideMap.delete(row.id);
  }
  for (const row of overrideMap.values()) if (row.action === 'upsert') records.push(decodeRecord(row));
  return records;
}
async function writeRecord(env, sessionHash, recordId, record, action) {
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM demo_session_records WHERE token_hash = ?').bind(sessionHash).first();
  const isExistingOverride = await env.DB.prepare('SELECT record_id FROM demo_session_records WHERE token_hash = ? AND record_id = ?').bind(sessionHash, recordId).first();
  if (!isExistingOverride && Number(count?.total || 0) >= MAX_SESSION_WRITES) throw new Error('demo_write_limit');
  await env.DB.prepare(`INSERT INTO demo_session_records (token_hash, record_id, module, action, title, status, amount_cents, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_hash, record_id) DO UPDATE SET module=excluded.module, action=excluded.action, title=excluded.title, status=excluded.status, amount_cents=excluded.amount_cents, payload_json=excluded.payload_json, updated_at=CURRENT_TIMESTAMP`)
    .bind(sessionHash, recordId, record.module, action, record.title, record.status, record.amountCents, record.payloadJson).run();
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(origin) });
    if (url.pathname === '/health' && request.method === 'GET') {
      try {
        const result = await env.DB.prepare('SELECT 1 AS ready').first();
        return json({ status: result?.ready === 1 ? 'ok' : 'degraded', service: 'alpendre-gestao-api', timestamp: new Date().toISOString() }, 200, origin);
      } catch {
        return json({ status: 'degraded', service: 'alpendre-gestao-api' }, 503, origin);
      }
    }
    if (url.pathname === '/api/demo/summary' && request.method === 'GET') {
      try {
        const org = await getDemoOrg(env);
        if (!org) return json({ error: 'demo_unavailable' }, 503, origin);
        const result = await env.DB.prepare('SELECT module, COUNT(*) AS count FROM demo_records WHERE organization_id = ? GROUP BY module ORDER BY module').bind(org.id).all();
        return json({ organization: { name: 'Estúdio Alpendre', plan: 'essencial' }, records: result.results || [], demo: true }, 200, origin);
      } catch {
        return json({ error: 'demo_temporarily_unavailable' }, 503, origin);
      }
    }
    if (url.pathname.startsWith('/api/demo/')) {
      if (!isTrustedOrigin(origin)) return json({ error: 'origin_not_allowed' }, 403, origin);
      if (url.pathname === '/api/demo/session' && request.method === 'POST') {
        try { return await createSession(request, env, origin); }
        catch (error) { return json({ error: error.message === 'demo_rate_limit' ? 'rate_limited' : 'demo_unavailable' }, error.message === 'demo_rate_limit' ? 429 : 503, origin); }
      }
      const sessionHash = await requireSession(request, env);
      if (!sessionHash) return json({ error: 'demo_session_required' }, 401, origin);
      if (url.pathname === '/api/demo/records' && request.method === 'GET') {
        const module = url.searchParams.get('module') || '';
        if (!DEMO_MODULES.has(module)) return json({ error: 'invalid_module' }, 400, origin);
        try { return json({ records: await listRecords(env, sessionHash, module), module, demo: true }, 200, origin); }
        catch { return json({ error: 'demo_temporarily_unavailable' }, 503, origin); }
      }
      if (url.pathname === '/api/demo/records' && request.method === 'POST') {
        try {
          const body = await parseBody(request);
          const record = cleanRecord(body);
          const org = await getDemoOrg(env);
          if (!org) return json({ error: 'demo_unavailable' }, 503, origin);
          const extra = await env.DB.prepare('SELECT COUNT(*) AS total FROM demo_session_records WHERE token_hash = ? AND record_id NOT IN (SELECT id FROM demo_records WHERE organization_id = ?)').bind(sessionHash, org.id).first();
          if (Number(extra?.total || 0) >= 80) return json({ error: 'demo_module_limit' }, 429, origin);
          const recordId = crypto.randomUUID();
          await writeRecord(env, sessionHash, recordId, record, 'upsert');
          return json({ record: { id: recordId, name: record.title, subtitle: JSON.parse(record.payloadJson).subtitle, description: JSON.parse(record.payloadJson).description, status: record.status, value: JSON.parse(record.payloadJson).value, created: new Date().toISOString() }, demo: true }, 201, origin);
        } catch (error) {
          const message = error.message || 'invalid_input';
          const status = message === 'demo_write_limit' || message === 'demo_module_limit' ? 429 : message === 'payload_too_large' ? 413 : 400;
          return json({ error: message }, status, origin);
        }
      }
      const match = url.pathname.match(/^\/api\/demo\/records\/([A-Za-z0-9_-]{8,80})$/);
      if (match && ['PATCH','DELETE'].includes(request.method)) {
        try {
          const recordId = match[1];
          const org = await getDemoOrg(env);
          if (!org) return json({ error: 'demo_unavailable' }, 503, origin);
          const base = await env.DB.prepare('SELECT id, module, title, status, amount_cents, payload_json, created_at FROM demo_records WHERE organization_id = ? AND id = ?').bind(org.id, recordId).first();
          const overlay = await env.DB.prepare('SELECT record_id, module, action, title, status, amount_cents, payload_json, created_at, updated_at FROM demo_session_records WHERE token_hash = ? AND record_id = ?').bind(sessionHash, recordId).first();
          if ((!base && !overlay) || overlay?.action === 'delete') return json({ error: 'record_not_found' }, 404, origin);
          const current = overlay?.action === 'upsert' ? overlay : base;
          if (request.method === 'DELETE') {
            await writeRecord(env, sessionHash, recordId, { module: current.module, title: current.title, status: current.status, amountCents: current.amount_cents, payloadJson: current.payload_json }, 'delete');
            return json({ deleted: true, id: recordId, demo: true }, 200, origin);
          }
          const body = await parseBody(request);
          const record = cleanRecord({ ...JSON.parse(current.payload_json || '{}'), ...body, module: current.module }, { module: current.module, title: current.title, status: current.status, amount_cents: current.amount_cents, ...JSON.parse(current.payload_json || '{}') });
          await writeRecord(env, sessionHash, recordId, record, 'upsert');
          return json({ record: decodeRecord({ record_id: recordId, ...record, amount_cents: record.amountCents, payload_json: record.payloadJson, created_at: current.created_at, updated_at: new Date().toISOString() }), demo: true }, 200, origin);
        } catch (error) {
          const message = error.message || 'invalid_input';
          const status = message === 'demo_write_limit' ? 429 : message === 'payload_too_large' ? 413 : 400;
          return json({ error: message }, status, origin);
        }
      }
      return json({ error: 'not_found' }, 404, origin);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'authentication_required' }, 401, origin);
    return json({ error: 'not_found' }, 404, origin);
  }
};
