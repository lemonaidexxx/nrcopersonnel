import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { APPS_SCRIPT_URL, PUBLIC_FORM_URL } from '../docs/config.js';
import { isGoogleOrigin, belongsToFrame, validMessage, isPublicLocation } from '../docs/embed-protocol.js';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
test('pages: exact user deployment URL and canonical GitHub address', () => {
  assert.equal(PUBLIC_FORM_URL, 'https://lemonaidexxx.github.io/nrcopersonnel/');
  assert.equal(APPS_SCRIPT_URL, 'https://script.google.com/macros/s/AKfycbysQffhzFH21bFGY2-b30vGUYXhrtTEE4PagNXyPUEKeEJunzWjtdJ6C1ErcPu90NAOhw/exec');
});
test('pages: only the expected top-level paths qualify', () => {
  assert.ok(isPublicLocation(new URL(PUBLIC_FORM_URL), PUBLIC_FORM_URL));
  assert.ok(isPublicLocation(new URL(PUBLIC_FORM_URL + 'index.html'), PUBLIC_FORM_URL));
  for (const value of ['https://evil.invalid/nrcopersonnel/', 'http://lemonaidexxx.github.io/nrcopersonnel/', 'https://lemonaidexxx.github.io/another/']) assert.equal(isPublicLocation(new URL(value), PUBLIC_FORM_URL), false);
});
test('pages: restricted Google origins, not lookalikes or opaque origins', () => {
  for (const value of ['https://script.google.com', 'https://script.googleusercontent.com', 'https://n-test-0lu-script.googleusercontent.com']) assert.ok(isGoogleOrigin(value));
  for (const value of ['null', 'http://script.google.com', 'https://script.google.com.evil.invalid', 'https://attacker.googleusercontent.com', 'https://evil.invalid']) assert.equal(isGoogleOrigin(value), false);
});
test('pages: messages must belong to the loaded iframe, including nested Google frame', () => {
  const top = {}; top.parent = top; const frame = { parent: top }; const inner = { parent: frame };
  assert.ok(belongsToFrame(frame, frame, top)); assert.ok(belongsToFrame(inner, frame, top));
  assert.equal(belongsToFrame({ parent: top }, frame, top), false);
  assert.equal(belongsToFrame(null, frame, top), false);
  assert.equal(belongsToFrame({ get parent() { throw new Error('closed'); } }, frame, top), false);
});
test('pages: only versioned nonces and two public message types are accepted', () => {
  const data = {type: 'nrco:embed:hello', version: 1, nonce: 'a'.repeat(32)};
  assert.ok(validMessage(data)); assert.ok(validMessage({...data,type:'nrco:embed:ready'}));
  for (const bad of [null, [], {}, {...data,version:2}, {...data,nonce:'short'}, {...data,type:'submit'}]) assert.equal(validMessage(bad), false);
});
test('pages: generated backend only changes frame mode, not validation or saves', () => {
  const expected = '// GITHUB PAGES EMBED VERSION. Deploy with its matching Index.html.\n' + read('google-only/Code.gs').replace(".setTitle('Personnel Information Update | NRCO')", ".setTitle('Personnel Information Update | NRCO')\n    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)");
  assert.equal(read('github-pages/Code.gs'),expected);
});
test('pages: all eight required controls stay behind hidden inert gate', () => {
  const html = read('github-pages/Index.html');
  assert.match(html, /id="nrco-form-app" hidden inert/);
  assert.equal((html.match(/<(?:input|select)\b[^>]*\brequired\b/g)||[]).length,8);
  assert.match(html,/addEventListener\("nrco:embedding-verified", connect/);
  assert.doesNotMatch(html,/SPREADSHEET_ID|RELAY_SECRET|__PUBLIC_FORM_URL__/);
});
test('pages: wrapper has no arbitrary endpoint override and no submission API', () => {
  const js = read('docs/pages.js');
  assert.doesNotMatch(js, /URLSearchParams|location\.search|fetch\(|submitPersonnel|no-cors/);
  assert.match(js,/window\.top === window\.self/);
  assert.match(js,/frame\.src = APPS_SCRIPT_URL/);
  assert.match(read('docs/index.html'),/script-src 'self'/);
});
function gate() {
  const top = { messages: [], postMessage(data, origin) { this.messages.push({data,origin}); } };
  const content = { hidden:true, inert:true }, box = {hidden:false}, link = {};
  const handlers = {};
  const window = { top, self:{}, crypto:webcrypto, addEventListener(name,fn) { handlers[name]=fn; }, dispatchEvent() {} };
  const ctx = vm.createContext({window, document:{getElementById:id=>({'nrco-form-app':content,'nrco-embedding-gate':box,'nrco-official-link':link}[id])}, crypto:webcrypto, URL, Uint8Array, Event:class {constructor(type){this.type=type;}}, setInterval:()=>1,clearInterval:()=>{}});
  vm.runInContext(read('src/pages/embed-guard.js').replace('__PUBLIC_FORM_URL__', PUBLIC_FORM_URL), ctx);
  const nonce=top.messages[0].data.nonce;
  return {window,top,content,box,handlers,nonce};
}
test('pages: form stays hidden on wrong origin, source, nonce or page', () => {
  const g=gate(); const good={source:g.top,origin:new URL(PUBLIC_FORM_URL).origin,data:{type:'nrco:embed:approved',version:1,nonce:g.nonce,page:PUBLIC_FORM_URL}};
  for (const event of [{...good,origin:'https://evil.invalid'}, {...good,source:{}}, {...good,data:{...good.data,nonce:'b'.repeat(32)}}, {...good,data:{...good.data,page:'https://evil.invalid'}}]) g.handlers.message(event);
  assert.ok(g.content.hidden); assert.ok(g.content.inert); assert.equal(g.top.messages.length,1);
});
test('pages: correct top-level approval reveals form and sends no personal data', () => {
  const g=gate(); g.handlers.message({source:g.top,origin:new URL(PUBLIC_FORM_URL).origin,data:{type:'nrco:embed:approved',version:1,nonce:g.nonce,page:PUBLIC_FORM_URL}});
  assert.equal(g.content.hidden,false); assert.equal(g.content.inert,false); assert.equal(g.box.hidden,true);
  assert.equal(g.window.nrcoEmbeddingVerified,true);
  assert.deepEqual(Object.keys(g.top.messages[1].data).sort(),['nonce','type','version']);
  assert.equal(g.top.messages[1].origin,new URL(PUBLIC_FORM_URL).origin);
});
