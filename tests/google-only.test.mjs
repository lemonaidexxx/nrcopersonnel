import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { FIELD_NAMES, HEADERS } from '../src/validation.mjs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const valid = () => ({ firstName:'Test', middleName:'Example', lastName:'Person', designation:'Technical Staff', office:'Program Development Unit', email:'TEST@example.invalid', contactNumber:'09171234567', shirtSize:'M' });
function receiver() {
  const state = { rows:[[...HEADERS]], writes:0, lock:false, allowLock:true, readFailure:false, active:false, formatted:0, maxRows:1000 };
  const cache = new Map();
  let context;
  const configId = '1-nk-U7L0qWkKvYBhg2bpnppTV6vNw2r16ZOoH9H9b74';
  const sheet = {
    getLastRow:()=>state.rows.length, getMaxRows:()=>state.maxRows,
    insertRowsAfter:(n,count)=>{ state.maxRows+=count; },
    getFilter:()=>true, setFrozenRows(){}, setRowHeight(){},
    getRange(row,col,n,width) {
      const range={ getDisplayValues:()=>state.rows.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+width)),
        setValues(values){ state.rows=values; return range; },
        setBackground(){ state.formatted++; return range; }, setFontColor(){return range;}, setFontWeight(){return range;}, setWrap(){return range;}, setNumberFormat(){return range;}, createFilter(){return range;} };
      return range;
    }
  };
  context = vm.createContext({
    console:{log(){}},
    SpreadsheetApp:{openById:id=>{assert.equal(id,configId);return {getSheetByName:name=>{assert.equal(name,'Sheet1');return sheet;}};},getActiveSpreadsheet:()=>state.active?{getId:()=>configId}:null},
    LockService:{getScriptLock:()=>({tryLock(){state.lock=state.allowLock;return state.allowLock;},releaseLock(){state.lock=false;}})},
    CacheService:{getScriptCache:()=>({get:key=>cache.get(key)??null,put:(key,value)=>cache.set(key,value)})},
    Utilities:{getUuid:randomUUID,Charset:{UTF_8:'UTF-8'},DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,str)=>[...createHash('sha256').update(str).digest()],formatDate:()=> '2026-09-11T12:00:00'},
    HtmlService:{createHtmlOutputFromFile(name){assert.equal(name,'Index');const output={setTitle(){return output;},addMetaTag(){return output;}};return output;}},
    Sheets:{Spreadsheets:{Values:{
      update(value,id,range,options){assert.equal(state.lock,true);assert.equal(options.valueInputOption,'RAW');const row=Number(range.match(/!A(\d+)/)[1])-1;state.rows[row]=[...value.values[0]];state.writes++;return {updatedRows:1};},
      get(id,range){if(state.readFailure){state.readFailure=false;throw new Error('Simulated lost acknowledgement');}const row=Number(range.match(/!A(\d+)/)[1])-1;return {values:[state.rows[row]]};}
    }}}
  });
  vm.runInContext(read('google-only/Code.gs'),context);
  const session = () => context.getFormSession();
  return { state,cache,context,session,request(data=valid(),token=session().token,id=randomUUID()){ return {data,token,requestId:id,website:''}; }, submit(request){return JSON.parse(JSON.stringify(context.submitPersonnel(request)));} };
}
test('google-only: complete files use RPC, not relay configuration or external JavaScript',()=>{
  const code=read('google-only/Code.gs'),html=read('google-only/Index.html');
  assert.doesNotMatch(code,/RELAY_SECRET|PropertiesService|TURNSTILE|NOT_CONFIGURED|function doPost/);
  assert.doesNotMatch(html,/turnstile|\/api\/submit|fetch\(|<script[^>]*src=|<link[^>]*stylesheet/);
  assert.match(html,/google\.script\.run/);assert.match(code,/HtmlService\.createHtmlOutputFromFile\('Index'\)/);
  assert.doesNotMatch(html,/1-nk-U7L0qWkKvYBhg2bpnppTV6vNw2r16ZOoH9H9b74/);
  const publicNames=[...code.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map(m=>m[1]).filter(n=>!n.endsWith('_'));
  assert.deepEqual(publicNames,['doGet','getFormSession','submitPersonnel','setupSheet']);
});
test('google-only: generated Code.gs matches private shared validation',()=>{
 const validation=read('src/validation.mjs').replace(/^export /gm,'').replace(/\b(isPlainRecord|sanitizeInput|canonicalPhone|validateSubmission)\b/g,'$1_');
 assert.equal(read('google-only/Code.gs'),'// COMPLETE GOOGLE-ONLY BACKEND. Replace old Code.gs, do not append.\n'+validation+'\n'+read('src/google/backend.gs'));
});
for (const field of FIELD_NAMES) test('google-only: rejects missing/null/blank '+field+' before any write',()=>{
  const gas=receiver();const token=gas.session().token;
  for(const value of [undefined,null,'','   ','\u00a0\u2003']){
    const data={...valid(),[field]:value};if(value===undefined)delete data[field];
    const result=gas.submit(gas.request(data,token));
    assert.equal(result.ok,false);assert.equal(result.errors[field],'This field is required.');
  }
  assert.equal(gas.state.writes,0);
  assert.match(read('google-only/Index.html'),new RegExp('<(?:input|select)\\b[^>]*id="'+field+'"[^>]*\\brequired\\b'));
});
test('google-only: session token missing, malformed, expired or evicted refuses writes',()=>{
  const gas=receiver();const request=gas.request();
  for(const token of ['',null,'forged','f'.repeat(64)]) assert.equal(gas.submit({...request,token}).ok,false);
  gas.cache.set('nrco:session:'+request.token,JSON.stringify({expiresAt:Date.now()-1}));
  assert.equal(gas.submit(request).code,'SESSION_EXPIRED');
  gas.cache.clear();assert.equal(gas.submit(request).code,'SESSION_EXPIRED');assert.equal(gas.state.writes,0);
});
test('google-only: malformed requests and honeypot never write',()=>{
  const gas=receiver();const req=gas.request();
  for(const input of [null,[],{}, {...req,website:'bot'}, {...req,requestId:'forged'}, {...req,unexpected:true}, {...req,data:{...valid(),office:'Fake'}}, {...req,data:{...valid(),firstName:'x'.repeat(9000)}}]) assert.equal(gas.submit(input).ok,false);
  assert.equal(gas.state.writes,0);
});
test('google-only: successful save is one RAW row with a private minimal receipt',()=>{
  const gas=receiver();const result=gas.submit(gas.request());assert.equal(result.ok,true);
  assert.deepEqual(Object.keys(result).sort(),['ok','submissionId','timestamp']);
  assert.match(result.submissionId,/^NRCO-[0-9a-f]{32}$/);assert.match(result.timestamp,/\+08:00$/);
  assert.equal(gas.state.rows[1].length,12);assert.equal(gas.state.rows[1][8],'09171234567');assert.equal(gas.state.lock,false);
});
test('google-only: normalized text and international mobile remain literal text',()=>{
  const gas=receiver();const result=gas.submit(gas.request({...valid(),firstName:' =1+1 ',middleName:' Mu\u00f1oz ',lastName:'de la Cruz',email:' Person@Example.invalid ',contactNumber:'(+63) 917 123-4567'}));
  assert.equal(result.ok,true);assert.equal(gas.state.rows[1][2],'=1+1');assert.equal(gas.state.rows[1][3],'Mu\u00f1oz');assert.equal(gas.state.rows[1][7],'Person@Example.invalid');assert.equal(gas.state.rows[1][8],'+639171234567');
});
test('google-only: invalid mobile, email, designation and size rejected',()=>{
  const gas=receiver();const token=gas.session().token;
  for(const fields of [{contactNumber:'+14155552671'},{contactNumber:'0212345678'},{email:'broken@'},{designation:'fake'},{shirtSize:'XS'}])assert.equal(gas.submit(gas.request({...valid(),...fields},token)).ok,false);
  assert.equal(gas.state.writes,0);
});
test('google-only: same retry after reconnect returns original record',()=>{
  const gas=receiver();const request=gas.request();const first=gas.submit(request);
  gas.cache.clear();request.token=gas.session().token;
  assert.deepEqual(gas.submit(request),first);assert.equal(gas.state.writes,1);
});
test('google-only: separate duplicate preserves prior record and flags only internally',()=>{
  const gas=receiver();const first=gas.submit(gas.request());const saved=JSON.stringify(gas.state.rows[1]);
  const second=gas.submit(gas.request({...valid(),email:'test@example.invalid',contactNumber:'09888888888'}));
  assert.equal(second.ok,true);assert.equal(gas.state.rows[2][10],'Needs review');assert.equal(gas.state.rows[2][11],first.submissionId);
  assert.equal(JSON.stringify(gas.state.rows[1]),saved);assert.equal(second.duplicate,undefined);
  gas.submit(gas.request({...valid(),email:'different@example.invalid',contactNumber:'+639171234567'}));assert.equal(gas.state.rows[3][10],'Needs review');
});
test('google-only: retry ID cannot silently replace an existing record',()=>{
  const gas=receiver();const req=gas.request();gas.submit(req);req.data={...valid(),shirtSize:'XL'};
  assert.equal(gas.submit(req).code,'IDEMPOTENCY_CONFLICT');assert.equal(gas.state.rows[1][9],'M');assert.equal(gas.state.writes,1);
});
test('google-only: saved row with lost acknowledgement is safe to retry',()=>{
  const gas=receiver();const req=gas.request();gas.state.readFailure=true;
  assert.equal(gas.submit(req).ok,false);assert.equal(gas.state.writes,1);
  assert.equal(gas.submit(req).ok,true);assert.equal(gas.state.writes,1);
});
test('google-only: lock contention and changed headers do not write or expose technical errors',()=>{
  const gas=receiver();const req=gas.request();gas.state.allowLock=false;
  assert.equal(gas.submit(req).code,'RETRY_LATER');gas.state.allowLock=true;gas.state.rows[0][0]='Wrong';
  const result=gas.submit(req);assert.equal(result.ok,false);assert.equal(result.code,'SERVICE_UNAVAILABLE');assert.equal(gas.state.writes,0);assert.equal(gas.state.lock,false);
});
test('google-only: session throttle blocks new rows, but never blocks an unchanged retry',()=>{
  const gas=receiver();const req=gas.request();const first=gas.submit(req);
  for(let i=0;i<4;i++) assert.equal(gas.submit({...req,requestId:randomUUID()}).ok,true);
  assert.equal(gas.submit({...req,requestId:randomUUID()}).code,'RETRY_LATER');assert.equal(gas.state.writes,5);
  assert.deepEqual(gas.submit(req),first);
});
test('google-only: shared burst counter covers different sessions',()=>{
  const gas=receiver();
  gas.cache.set('nrco:new:'+Math.floor(Date.now()/60000),'30');
  assert.equal(gas.submit(gas.request()).code,'RETRY_LATER');assert.equal(gas.state.writes,0);
});
test('google-only: administrative setup refuses public web-app context',()=>{
  const gas=receiver();assert.throws(()=>gas.context.setupSheet(),/Extensions > Apps Script/);assert.equal(gas.state.formatted,0);assert.equal(gas.state.writes,0);
  gas.state.active=true;gas.context.setupSheet();assert.equal(gas.state.formatted,1);assert.equal(gas.state.writes,0);
});
test('google-only: owner can close submissions without a secret or external service',()=>{
  const gas=receiver();const code=read('google-only/Code.gs').replace('acceptingResponses: true','acceptingResponses: false');
  const context=vm.createContext({HtmlService:{}});vm.runInContext(code,context);
  assert.equal(context.getFormSession().code,'CLOSED');assert.equal(context.submitPersonnel({}).code,'CLOSED');
});
test('google-only: four scroll-linked sections and one initial current location',()=>{
  const html=read('google-only/Index.html');const nav=html.match(/<nav\b[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/aria-current="location"/g)||[]).length,1);
  assert.equal((nav.match(/href="#/g)||[]).length,4);
  assert.match(html,/new IntersectionObserver/);assert.match(html,/rootMargin/);assert.match(html,/google\.script\.history\.push/);
  assert.doesNotMatch(html,/linear-gradient|radial-gradient/);
});
