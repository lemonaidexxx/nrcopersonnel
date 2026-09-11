import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { validateSubmission, HEADERS, DESIGNATIONS, OFFICES, SIZES } from '../src/validation.mjs';
import { personnelForm } from '../src/form-definition.mjs';
import { handleRequest, signEnvelope } from '../src/worker.mjs';
const SECRET = 'a'.repeat(64); // TEST FIXTURE ONLY; never used as deployed configuration.
const sample = () => ({ firstName: 'Test', middleName: '', lastName: 'Person', designation: 'Technical Staff', office: 'Program Development Unit', email: 'TEST@example.invalid', contactNumber: '09999999999', shirtSize: 'M' });
const env = () => ({ APP_ORIGIN: 'https://unit-test.invalid', APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec', RELAY_SECRET: SECRET,
  TURNSTILE_SITE_KEY: 'unit-site-key', TURNSTILE_SECRET_KEY: 'unit-secret-key', SUBMISSION_LIMITER: { limit: async () => ({ success: true }) } });
function request(body, extraHeaders = {}) {
  return new Request('https://unit-test.invalid/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unit-test.invalid', 'CF-Connecting-IP': '192.0.2.1', ...extraHeaders }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
const body = () => ({ requestId: randomUUID(), data: sample(), turnstileToken: 'unit-token', website: '' });
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function gas() {
  const state = { rows: [[...HEADERS]], writes: 0, acquired: false, released: 0, lockAvailable: true, readFailure: false };
  const sheet = { getLastRow: () => state.rows.length, getMaxRows: () => 1000,
    getRange(row, column, count, width) { return { getDisplayValues: () => state.rows.slice(row - 1, row - 1 + count).map(r => r.slice(column - 1, column - 1 + width)) }; } };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ SPREADSHEET_ID: 'test-sheet', SHEET_NAME: 'Sheet1', RELAY_SECRET: SECRET }) }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { state.acquired = state.lockAvailable; return state.lockAvailable; }, releaseLock: () => { state.acquired = false; state.released++; } }) },
    Utilities: { Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (kind, text) => [...createHash('sha256').update(text).digest()],
      computeHmacSha256Signature: (text, secret) => [...createHmac('sha256', secret).update(text).digest()],
      formatDate: () => '2026-09-11T12:00:00' },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    Sheets: { Spreadsheets: { Values: {
      update(value, id, range, options) {
        assert.equal(state.acquired, true); assert.equal(options.valueInputOption, 'RAW');
        const index = Number(range.match(/!A(\d+)/)[1]) - 1;
        state.rows[index] = [...value.values[0]]; state.writes++; return { updatedRows: 1 };
      },
      get(id, range) { if (state.readFailure) { state.readFailure = false; throw new Error('lost confirmation'); }
        const index = Number(range.match(/!A(\d+)/)[1]) - 1; return { values: [state.rows[index]] }; }
    } } }
  });
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context);
  return { state, context, post(envelope) { return JSON.parse(context.doPost({ postData: { type: 'application/json', contents: JSON.stringify(envelope) } }).text); } };
}
test('form uses the adapted upstream model with exactly 8 fields and approved choices', () => {
  assert.equal(personnelForm.getFields().length, 8);
  for (const [name, values] of [['designation', DESIGNATIONS], ['office', OFFICES], ['shirtSize', SIZES]]) {
    const field = personnelForm.getFields().find(f => f.id === name);
    assert.deepEqual(field.getChoices().map(c => c.id), values);
    assert.equal(field.isValidValue(values[0]), true); assert.equal(field.isValidValue('unknown'), false);
  }
});
test('normalizes whitespace without changing legitimate name/email capitalization', () => {
  const result = validateSubmission({ ...sample(), firstName: '  Maria   Ana  ', lastName: 'de la Cruz', email: '  Person@Example.invalid  ' });
  assert.equal(result.ok, true); assert.equal(result.data.firstName, 'Maria Ana'); assert.equal(result.data.email, 'Person@Example.invalid');
});
for (const [value, expected] of [['09171234567', '09171234567'], ['+639171234567', '+639171234567'], ['0917 123-4567', '09171234567'], ['(+63) 917 123 4567', '+639171234567']]) {
  test('accepts Philippine mobile format ' + value, () => {
    const result = validateSubmission({ ...sample(), contactNumber: value }); assert.equal(result.ok, true); assert.equal(result.data.contactNumber, expected);
  });
}
for (const phone of ['+14155552671', '0212345678', '0917123456', '091712345678', '639171234567', 'abc', '09+171234567', '09171234567 ext1', 9171234567]) {
  test('rejects invalid/non-Philippine mobile ' + phone, () => assert.equal(validateSubmission({ ...sample(), contactNumber: phone }).ok, false));
}
for (const change of [{firstName:''}, {office:'Other'}, {shirtSize:'XS'}, {designation:'Admin'}, {email:'bad@'}, {email:'a b@c.com'}, {firstName:'a'.repeat(101)}, {firstName:'A\u0000B'}, {timestamp:'forged'}]) {
  test('rejects malformed field ' + JSON.stringify(change), () => assert.equal(validateSubmission({ ...sample(), ...change }).ok, false));
}
test('permits optional middle name and legitimate Unicode names', () => {
  const value = sample(); delete value.middleName; value.firstName = '\u00d1ina'; assert.equal(validateSubmission(value).ok, true);
});
test('Worker and Apps Script agree on signed payload; saves one complete RAW row', async () => {
  const system = gas(); const id = randomUUID(); const signed = await signEnvelope(sample(), id, SECRET);
  const result = system.post(signed); assert.equal(result.ok, true); assert.equal(result.requestId, id);
  assert.equal(system.state.rows.length, 2); assert.equal(system.state.rows[1].length, 12);
  assert.equal(system.state.rows[1][8], '09999999999'); assert.equal(system.state.rows[1][10], 'Received'); assert.equal(system.state.released, 1);
});
test('retries the same request without a second row or timestamp change', async () => {
  const system = gas(); const signed = await signEnvelope(sample(), randomUUID(), SECRET);
  const first = system.post(signed); const second = system.post(signed);
  assert.deepEqual(first, second); assert.equal(system.state.writes, 1);
});
test('preserves and flags a separate duplicate using case-insensitive email', async () => {
  const system = gas(); const first = system.post(await signEnvelope(sample(), randomUUID(), SECRET));
  const data = { ...sample(), email: 'test@example.invalid', contactNumber: '09888888888' };
  const second = system.post(await signEnvelope(data, randomUUID(), SECRET));
  assert.equal(second.ok, true); assert.notEqual(first.submissionId, second.submissionId);
  assert.equal(system.state.rows[2][10], 'Needs review'); assert.equal(system.state.rows[2][11], first.submissionId);
});
test('flags a normalized mobile duplicate across 09 and +639 formats', async () => {
  const system = gas(); system.post(await signEnvelope(sample(), randomUUID(), SECRET));
  system.post(await signEnvelope({ ...sample(), email: 'other@example.invalid', contactNumber: '+639999999999' }, randomUUID(), SECRET));
  assert.equal(system.state.rows[2][10], 'Needs review');
});
test('same request ID with different data is refused without overwriting', async () => {
  const system = gas(); const id = randomUUID(); system.post(await signEnvelope(sample(), id, SECRET));
  const result = system.post(await signEnvelope({ ...sample(), shirtSize: 'XL' }, id, SECRET));
  assert.equal(result.code, 'IDEMPOTENCY_CONFLICT'); assert.equal(system.state.rows[1][9], 'M'); assert.equal(system.state.writes, 1);
});
test('a write followed by lost read-back is safe to retry', async () => {
  const system = gas(); system.state.readFailure = true;
  const signed = await signEnvelope(sample(), randomUUID(), SECRET);
  assert.equal(system.post(signed).ok, false); assert.equal(system.post(signed).ok, true); assert.equal(system.state.writes, 1);
});
test('formula-like strings are written in RAW mode, with no apostrophe or value changes', async () => {
  const system = gas(); const data = { ...sample(), firstName: '=1+1', lastName: '@literal', contactNumber: '+639999999999' };
  assert.equal(system.post(await signEnvelope(data, randomUUID(), SECRET)).ok, true);
  assert.equal(system.state.rows[1][2], '=1+1'); assert.equal(system.state.rows[1][8], '+639999999999');
});
test('invalid signature, tampered payload and stale timestamp cannot write', async () => {
  const system = gas(); const signed = await signEnvelope(sample(), randomUUID(), SECRET);
  assert.equal(system.post({ ...signed, signature: '0'.repeat(64) }).ok, false);
  assert.equal(system.post({ ...signed, payload: JSON.stringify({ ...sample(), firstName: 'changed' }) }).ok, false);
  assert.equal(system.post(await signEnvelope(sample(), randomUUID(), SECRET, Date.now() - 301000)).ok, false);
  assert.equal(system.state.writes, 0);
});
test('Apps Script independently rejects signed invalid field data', async () => {
  const system = gas(); assert.equal(system.post(await signEnvelope({ ...sample(), office: 'Fake' }, randomUUID(), SECRET)).ok, false); assert.equal(system.state.writes, 0);
});
test('lock contention and changed headers fail without writes', async () => {
  const system = gas(); const signed = await signEnvelope(sample(), randomUUID(), SECRET);
  system.state.lockAvailable = false; assert.equal(system.post(signed).code, 'RETRY_LATER');
  system.state.lockAvailable = true; system.state.rows[0][0] = 'Wrong header'; assert.equal(system.post(signed).ok, false);
  assert.equal(system.state.writes, 0);
});
test('unconfigured Worker is disabled and leaks no server config', async () => {
  const response = await handleRequest(new Request('https://unit-test.invalid/api/config'), {});
  assert.deepEqual(await response.json(), { enabled: false, siteKey: null });
  assert.equal((await handleRequest(request(body()), {})).status, 503);
});
test('rejects wrong origin, content type, honeypot, oversized or invalid body', async () => {
  assert.equal((await handleRequest(request(body(), {Origin:'https://evil.invalid'}), env())).status, 403);
  assert.equal((await handleRequest(request(body(), {'Content-Type':'text/plain'}), env())).status, 415);
  assert.equal((await handleRequest(request({...body(), website:'spam'}), env())).status, 400);
  assert.equal((await handleRequest(request('{'), env())).status, 400);
  assert.equal((await handleRequest(request('x'.repeat(8193)), env())).status, 413);
});
test('rate limiting returns an error before forwarding any personal data', async () => {
  const e = env(); e.SUBMISSION_LIMITER.limit = async () => ({success:false});
  const response = await handleRequest(request(body()), e, () => { throw new Error('Must not call upstream'); }); assert.equal(response.status, 429);
});
test('unapproved Turnstile hostname/action fails closed', async () => {
  for (const verification of [{success:true,hostname:'evil.invalid',action:'personnel_update'}, {success:true,hostname:'unit-test.invalid',action:'other'}]) {
    const response = await handleRequest(request(body()), env(), async () => json(verification)); assert.equal(response.status, 403);
  }
});
test('end-to-end local simulation: Worker -> signed Apps Script -> mocked Sheet', async () => {
  const system = gas();
  const response = await handleRequest(request(body()), env(), async (url, init) => {
    if (url.includes('siteverify')) return json({success:true,hostname:'unit-test.invalid',action:'personnel_update'});
    return json(system.post(JSON.parse(init.body)));
  });
  const result = await response.json(); assert.equal(result.ok, true); assert.equal(system.state.writes, 1);
  assert.deepEqual(Object.keys(result).sort(), ['ok','submissionId','timestamp']); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
});
test('Content Service redirect is followed with GET, without the signed POST body', async () => {
  const value = body(); let calls = 0;
  const response = await handleRequest(request(value), env(), async (url, init) => {
    calls++;
    if (url.includes('siteverify')) return json({success:true,hostname:'unit-test.invalid',action:'personnel_update'});
    if (url.includes('script.google.com')) return new Response(null, {status:302,headers:{Location:'https://script.googleusercontent.com/macros/echo?test=1'}});
    assert.equal(init.method,'GET'); assert.equal(init.body,undefined);
    return json({ok:true,requestId:value.requestId,submissionId:'NRCO-'+'f'.repeat(32),timestamp:'2026-09-11T12:00:00+08:00'});
  });
  assert.equal(response.status,200); assert.equal(calls,3);
});
test('unsafe redirects and unconfirmed success are never reported as saved', async () => {
  for (const upstream of [new Response(null,{status:302,headers:{Location:'https://evil.invalid'}}), json({ok:true}), new Response('<html>Login</html>', {headers:{'Content-Type':'text/html'}})]) {
    const response = await handleRequest(request(body()), env(), async url => url.includes('siteverify') ? json({success:true,hostname:'unit-test.invalid',action:'personnel_update'}) : upstream);
    assert.equal(response.status,503); assert.equal((await response.json()).ok,false);
  }
});
test('built assets contain no endpoint or spreadsheet ID and resolve every field', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url),'utf8');
  assert.equal(html.includes('{{'),false); assert.equal(html.includes('script.google.com'),false);
  assert.equal((html.match(/<select /g)||[]).length,3);
  for (const name of ['firstName','middleName','lastName','designation','office','email','contactNumber','shirtSize']) assert.ok(html.includes(`id="${name}"`));
});
