const form = document.querySelector('#personnel-form');
const button = document.querySelector('#submit-button');
const label = document.querySelector('#submit-label');
const alert = document.querySelector('#form-error');
const availability = document.querySelector('#availability');
const status = document.querySelector('#submit-status');
const dialog = document.querySelector('#guide-dialog');
const reconnect = document.querySelector('#reconnect');
let token = '', expiresAt = 0, enabled = false, busy = false, connecting = false, memoryAttempt = null;
const STORAGE_KEY = 'nrco.pending.google.v1';

function rpc(method, value) {
  return new Promise((resolve, reject) => {
    if (!window.google?.script?.run) { reject(new Error('NOT_GOOGLE_HOSTED')); return; }
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error('NO_CONFIRMATION')); }, 60000);
    const runner = google.script.run.withSuccessHandler(result => {
      if (settled) return; settled = true; clearTimeout(timer); resolve(result);
    }).withFailureHandler(() => {
      if (settled) return; settled = true; clearTimeout(timer); reject(new Error('NO_CONFIRMATION'));
    });
    try {
      if (method === 'session') runner.getFormSession();
      else runner.submitPersonnel(value);
    } catch (error) { clearTimeout(timer); settled = true; reject(error); }
  });
}
function showError(message) { alert.textContent = message; alert.hidden = false; alert.focus(); }
function errorsFor(errors = {}) {
  FIELD_NAMES.forEach(name => {
    const element = form.elements.namedItem(name);
    const error = document.getElementById(name + '-error');
    element.setAttribute('aria-invalid', errors[name] ? 'true' : 'false');
    error.textContent = errors[name] || ''; error.hidden = !errors[name];
  });
}
function setBusy(value) {
  busy = value; form.setAttribute('aria-busy', String(value));
  FIELD_NAMES.forEach(name => { form.elements.namedItem(name).disabled = value; });
  button.disabled = value || !enabled || connecting;
  reconnect.disabled = value || connecting;
  label.textContent = value ? 'Submitting...' : 'Submit information';
  status.textContent = value ? 'Please wait while your information is being saved.' : '';
}
async function attemptFor(data) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  let previous = memoryAttempt;
  try { previous = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || previous; } catch (_) { /* Storage can be unavailable. */ }
  if (!previous || previous.fingerprint !== fingerprint || !REQUEST_ID.test(previous.requestId || '')) {
    previous = { requestId: crypto.randomUUID(), fingerprint };
  }
  memoryAttempt = previous;
  // Never store entered names, email, or phone in browser storage.
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(previous)); } catch (_) { /* Memory fallback remains. */ }
  return previous.requestId;
}
async function connect() {
  if (connecting || busy) return;
  connecting = true; enabled = false; setBusy(false);
  availability.hidden = false; availability.textContent = 'Connecting to the form...'; reconnect.hidden = true;
  try {
    if (!window.google?.script?.run) {
      availability.textContent = 'Preview only. Open the deployed Google web-app link to submit. No information is saved here.';
      return;
    }
    const result = await rpc('session');
    if (result?.ok !== true || !/^[a-f0-9]{64}$/i.test(result.token || '') || !Number.isFinite(result.expiresAt)) {
      throw new Error(result?.code === 'CLOSED' ? 'CLOSED' : 'NO_CONFIRMATION');
    }
    token = result.token; expiresAt = result.expiresAt; enabled = true;
    availability.hidden = true;
  } catch (error) {
    availability.textContent = error.message === 'CLOSED' ? 'This form is not accepting submissions.' : 'The form could not connect. Your entries are unchanged. Try connecting again.';
    reconnect.hidden = false;
  } finally { connecting = false; setBusy(false); }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !enabled || connecting) return;
  alert.hidden = true;
  const raw = Object.fromEntries(FIELD_NAMES.map(name => [name, form.elements.namedItem(name).value]));
  const validation = validateSubmission(raw); errorsFor(validation.errors);
  if (!validation.ok) {
    showError('Please check the highlighted fields. Your information has not been sent.');
    form.querySelector('[aria-invalid="true"]')?.focus(); return;
  }
  if (!form.checkValidity()) { form.reportValidity(); return; }
  if (Date.now() >= expiresAt) {
    await connect();
    if (enabled) showError('Connection refreshed. Your details are unchanged. Select Submit information again.');
    return;
  }
  setBusy(true);
  try {
    const requestId = await attemptFor(validation.data);
    const result = await rpc('submit', { requestId, token, data: validation.data, website: form.elements.namedItem('website').value });
    if (result?.ok !== true || !RECORD_ID.test(result.submissionId || '') || !Number.isFinite(Date.parse(result.timestamp))) {
      errorsFor(result?.errors);
      if (result?.code === 'SESSION_EXPIRED') { enabled = false; reconnect.hidden = false; }
      throw new Error(result?.message || 'We could not confirm your submission. Keep these details unchanged and retry.');
    }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* No stored state. */ }
    memoryAttempt = null; form.reset(); form.hidden = true;
    document.querySelector('#reference').textContent = result.submissionId;
    const success = document.querySelector('#success'); success.hidden = false; success.focus();
    reconnect.hidden = true;
  } catch (error) {
    showError(error.message === 'NO_CONFIRMATION' ? 'No confirmation was received. Your entry may already be saved. Keep this page open and retry with the same information; the same reference prevents an accidental duplicate.' : error.message);
  } finally { setBusy(false); }
});
FIELD_NAMES.forEach(name => form.elements.namedItem(name).addEventListener('input', () => {
  form.elements.namedItem(name).setAttribute('aria-invalid', 'false'); document.getElementById(name + '-error').hidden = true;
}));
document.querySelector('#open-guide').addEventListener('click', () => dialog.showModal());
document.querySelector('#close-guide').addEventListener('click', () => dialog.close());
reconnect.addEventListener('click', connect);
document.querySelector('#start-over').addEventListener('click', async () => {
  document.querySelector('#success').hidden = true; form.hidden = false; alert.hidden = true; errorsFor();
  await connect(); form.elements.namedItem('firstName').focus();
});
window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
connect();
