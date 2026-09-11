import { FIELD_NAMES, validateSubmission, REQUEST_ID, RECORD_ID } from './validation.mjs';
const form = document.querySelector('#personnel-form');
const button = document.querySelector('#submit-button');
const label = document.querySelector('#submit-label');
const alert = document.querySelector('#form-error');
const availability = document.querySelector('#availability');
const status = document.querySelector('#submit-status');
const dialog = document.querySelector('#guide-dialog');
let widget = null, token = '', enabled = false, busy = false, memoryAttempt = null;
const STORAGE_KEY = 'nrco.pending.v1';
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
  busy = value;
  form.setAttribute('aria-busy', String(value));
  FIELD_NAMES.forEach(name => { form.elements.namedItem(name).disabled = value; });
  button.disabled = value || !enabled || !token;
  label.textContent = value ? 'Submitting...' : 'Submit information';
  status.textContent = value ? 'Please wait while your information is being saved.' : '';
}
function resetChallenge() {
  token = '';
  if (widget !== null && window.turnstile) window.turnstile.reset(widget);
  button.disabled = true;
}
async function attemptFor(data) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  let previous = memoryAttempt;
  try { previous = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || previous; } catch { /* Storage may be disabled. */ }
  if (!previous || previous.fingerprint !== fingerprint || !REQUEST_ID.test(previous.requestId || '')) {
    previous = { requestId: crypto.randomUUID(), fingerprint };
  }
  memoryAttempt = previous;
  // No names, email addresses or phone numbers are persisted to browser storage.
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(previous)); } catch { /* In-memory retry still works. */ }
  return previous.requestId;
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !enabled) return;
  alert.hidden = true;
  const raw = Object.fromEntries(FIELD_NAMES.map(name => [name, form.elements.namedItem(name).value]));
  const validation = validateSubmission(raw); errorsFor(validation.errors);
  if (!validation.ok) {
    showError('Please check the highlighted fields. Your information has not been sent.');
    form.querySelector('[aria-invalid="true"]')?.focus(); return;
  }
  if (!form.checkValidity()) { form.reportValidity(); return; }
  if (!token) { showError('Please complete the security verification.'); return; }
  setBusy(true);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const requestId = await attemptFor(validation.data);
    const response = await fetch('/api/submit', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controller.signal,
      body: JSON.stringify({ requestId, data: validation.data, turnstileToken: token, website: form.elements.namedItem('website').value }) });
    const result = await response.json();
    if (!response.ok || result.ok !== true || !RECORD_ID.test(result.submissionId || '')) {
      errorsFor(result.errors);
      throw new Error(typeof result.message === 'string' ? result.message : 'We could not confirm your submission. Please try again.');
    }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* No stored state. */ }
    memoryAttempt = null;
    form.reset(); form.hidden = true;
    document.querySelector('#reference').textContent = result.submissionId;
    const success = document.querySelector('#success'); success.hidden = false; success.focus();
  } catch (error) {
    showError(error.name === 'AbortError' ? 'Confirmation is taking longer than expected. Your entry may have been saved. Keep these details unchanged and retry safely.' :
      (error instanceof TypeError || error instanceof SyntaxError ? 'Connection interrupted. Your information is still here. Please try again.' : error.message));
  } finally { clearTimeout(timer); setBusy(false); resetChallenge(); }
});
FIELD_NAMES.forEach(name => form.elements.namedItem(name).addEventListener('input', () => {
  form.elements.namedItem(name).setAttribute('aria-invalid', 'false'); document.getElementById(name + '-error').hidden = true;
}));
document.querySelector('#open-guide').addEventListener('click', () => dialog.showModal());
document.querySelector('#close-guide').addEventListener('click', () => dialog.close());
document.querySelector('#start-over').addEventListener('click', () => {
  document.querySelector('#success').hidden = true; form.hidden = false; alert.hidden = true; errorsFor();
  resetChallenge(); form.elements.namedItem('firstName').focus();
});
window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
async function initialize() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok || !config.enabled || !config.siteKey) {
      availability.textContent = config.preview ? 'Design preview only. Submissions are disabled and no information is saved.' : 'This form is not accepting submissions yet. Please return after setup is complete.';
      return;
    }
    enabled = true;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.onload = resolve; script.onerror = reject; document.head.append(script);
    });
    widget = window.turnstile.render('#turnstile-container', {
      sitekey: config.siteKey, action: 'personnel_update', theme: 'light', size: 'flexible',
      callback(value) { token = value; button.disabled = busy; document.querySelector('#verification-help').textContent = 'Security verification complete.'; },
      'expired-callback'() { token = ''; button.disabled = true; document.querySelector('#verification-help').textContent = 'Verification expired. Please verify again.'; },
      'error-callback'() { token = ''; button.disabled = true; document.querySelector('#verification-help').textContent = 'Verification could not load. Reload this page and try again.'; }
    });
    availability.hidden = true;
    document.querySelector('#verification-help').textContent = 'Complete the security verification before submitting.';
  } catch {
    enabled = false; button.disabled = true;
    availability.textContent = 'The form could not connect. Check your connection and reload this page.';
  }
}
initialize();
