const PUBLIC_ORIGINS = new Set([
  'https://alpendregestao.netlify.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
]);
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains'
};
function cors(origin) {
  const headers = new Headers(JSON_HEADERS);
  if (origin && PUBLIC_ORIGINS.has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  headers.set('access-control-allow-methods', 'GET, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type, authorization, x-request-id');
  headers.set('access-control-max-age', '600');
  return headers;
}
function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), { status, headers: cors(origin) });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, origin);
    if (url.pathname === '/health') {
      try {
        const result = await env.DB.prepare('SELECT 1 AS ready').first();
        return json({ status: result?.ready === 1 ? 'ok' : 'degraded', service: 'alpendre-gestao-api', timestamp: new Date().toISOString() }, 200, origin);
      } catch {
        return json({ status: 'degraded', service: 'alpendre-gestao-api' }, 503, origin);
      }
    }
    if (url.pathname === '/api/demo/summary') {
      try {
        const org = await env.DB.prepare("SELECT id, name, plan_code FROM organizations WHERE slug = ? AND status = 'active'").bind('estudio-alpendre-demo').first();
        if (!org) return json({ error: 'demo_unavailable' }, 503, origin);
        const result = await env.DB.prepare('SELECT module, COUNT(*) AS count FROM demo_records WHERE organization_id = ? GROUP BY module ORDER BY module').bind(org.id).all();
        return json({ organization: { name: org.name, plan: org.plan_code }, records: result.results || [], demo: true }, 200, origin);
      } catch {
        return json({ error: 'demo_temporarily_unavailable' }, 503, origin);
      }
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'authentication_required' }, 401, origin);
    return json({ error: 'not_found' }, 404, origin);
  }
};
