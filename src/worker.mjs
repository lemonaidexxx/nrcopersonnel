import { validateSubmission, isPlainRecord, REQUEST_ID, RECORD_ID } from './validation.mjs';
const MAX_BODY = 8192;
const enc = new TextEncoder();
const CSP = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function protect(response) {
  const result = new Response(response.body, response);
  result.headers.set('Content-Security-Policy', CSP);
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('Referrer-Policy', 'no-referrer');
  result.headers.set('X-Frame-Options', 'DENY');
  result.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  result.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return result;
}
function settings(env, request) {
  try {
    const origin = new URL(env.APP_ORIGIN);
    const endpoint = new URL(env.APPS_SCRIPT_URL);
    const here = new URL(request.url);
    if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN || here.origin !== origin.origin ||
        endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hostname !== 'script.google.com' || endpoint.search || endpoint.hash ||
        !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint.pathname) ||
        !/^[0-9a-f]{64}$/i.test(env.RELAY_SECRET || '') ||
        !env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY ||
        /^[123]x0{10}/.test(env.TURNSTILE_SITE_KEY) || /^[123]x0{10}/.test(env.TURNSTILE_SECRET_KEY) ||
        typeof env.SUBMISSION_LIMITER?.limit !== 'function') return null;
    return { origin: origin.origin, hostname: origin.hostname, endpoint: endpoint.href };
  } catch { return null; }
}
async function limitedText(message, limit) {
  const reader = message.body?.getReader();
  if (!reader) throw new ApiError(400, 'The request is empty.');
  let total = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new ApiError(413, 'The request is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new ApiError(400, 'The request could not be read.'); }
}
export async function signEnvelope(data, requestId, secret, issuedAt = Date.now()) {
  const payload = JSON.stringify(data);
  const message = `v1\n${issuedAt}\n${requestId}\n${payload}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const signature = Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
  return { version: 1, issuedAt, requestId, payload, signature };
}
async function forward(endpoint, envelope, fetcher) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
  try {
    let response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope), redirect: 'manual', signal: controller.signal });
    // Content Service responds via a one-time GET URL. Never resend the signed POST body to a redirect.
    for (let hop = 0; [301, 302, 303].includes(response.status) && hop < 3; hop++) {
      const next = new URL(response.headers.get('Location') || '', endpoint);
      if (next.protocol !== 'https:' || next.hostname !== 'script.googleusercontent.com' || next.username || next.password) {
        throw new Error('Unexpected upstream redirect');
      }
      response = await fetcher(next.href, { method: 'GET', redirect: 'manual', signal: controller.signal });
    }
    if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Upstream response invalid');
    return JSON.parse(await limitedText(response, 4096));
  } finally { clearTimeout(timer); }
}
export async function handleRequest(request, env, fetcher = fetch) {
  try {
    const path = new URL(request.url).pathname;
    if (path === '/api/config' && request.method === 'GET') {
      const config = settings(env, request);
      return protect(json({ enabled: Boolean(config), siteKey: config ? env.TURNSTILE_SITE_KEY : null }));
    }
    if (path !== '/api/submit') {
      if (path.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method)) return protect(json({ ok: false, message: 'Not found.' }, 404));
      return protect(await env.ASSETS.fetch(request));
    }
    if (request.method !== 'POST') return protect(json({ ok: false, message: 'Use POST to submit.' }, 405));
    const config = settings(env, request);
    if (!config) throw new ApiError(503, 'Submissions are not available yet. Please try again later.');
    if (request.headers.get('Origin') !== config.origin) throw new ApiError(403, 'Submit using the official form page.');
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw new ApiError(415, 'Use the form to submit your information.');
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) throw new ApiError(503, 'The request could not be verified.');
    const rate = await env.SUBMISSION_LIMITER.limit({ key: 'nrco:v1:' + ip });
    if (!rate.success) throw new ApiError(429, 'Too many attempts. Please wait one minute and try again.');
    let body;
    try { body = JSON.parse(await limitedText(request, MAX_BODY)); }
    catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(400, 'The request is not valid JSON.'); }
    if (!isPlainRecord(body) || Object.keys(body).some(k => !['data', 'requestId', 'turnstileToken', 'website'].includes(k)) ||
        typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId) || body.website !== '' ||
        typeof body.turnstileToken !== 'string' || !body.turnstileToken || body.turnstileToken.length > 2048) {
      throw new ApiError(400, 'The request could not be verified. Reload the form and try again.');
    }
    const validation = validateSubmission(body.data);
    if (!validation.ok) return protect(json({ ok: false, message: 'Please check the highlighted fields.', errors: validation.errors }, 422));
    const challenge = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: body.turnstileToken }),
      signal: AbortSignal.timeout(10000)
    });
    if (!challenge.ok) throw new ApiError(503, 'The verification service is temporarily unavailable.');
    const verification = await challenge.json();
    if (verification.success !== true || verification.hostname !== config.hostname || verification.action !== 'personnel_update') {
      throw new ApiError(403, 'Please complete the security verification again.');
    }
    const envelope = await signEnvelope(validation.data, body.requestId, env.RELAY_SECRET);
    const result = await forward(config.endpoint, envelope, fetcher);
    if (result?.ok !== true || result.requestId !== body.requestId || !RECORD_ID.test(result.submissionId || '') ||
        typeof result.timestamp !== 'string' || !Number.isFinite(Date.parse(result.timestamp))) {
      if (result?.code === 'IDEMPOTENCY_CONFLICT') throw new ApiError(409, 'This submission reference was already used for different information. Reload before submitting a new entry.');
      throw new ApiError(503, 'We could not confirm that your information was saved. Keep this page open and retry with the same information.');
    }
    return protect(json({ ok: true, submissionId: result.submissionId, timestamp: result.timestamp }));
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 503;
    const message = error instanceof ApiError ? error.message : 'We could not confirm your submission. Keep this page open and try again.';
    return protect(json({ ok: false, message }, status));
  }
}
export default { fetch(request, env) { return handleRequest(request, env); } };
