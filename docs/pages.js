import { PUBLIC_FORM_URL, APPS_SCRIPT_URL } from './config.js';
import { isGoogleOrigin, belongsToFrame, validMessage, isPublicLocation } from './embed-protocol.js';
const panel = document.getElementById('loading-panel');
const heading = document.getElementById('loading-title');
const message = document.getElementById('loading-message');
const reload = document.getElementById('reload-form');
const slot = document.getElementById('frame-slot');
let frame = null, pending = null, timer = null;
const permitted = window.top === window.self && isPublicLocation(window.location, PUBLIC_FORM_URL);
const publicLink = document.getElementById('public-link');
publicLink.href = PUBLIC_FORM_URL;

function loadForm() {
  if (!permitted) return;
  pending = null;
  clearTimeout(timer);
  heading.textContent = 'Loading personnel form';
  message.textContent = 'Connecting to the form. Please wait.';
  panel.hidden = false; reload.hidden = true;
  slot.setAttribute('aria-busy', 'true');
  frame = document.createElement('iframe');
  frame.title = 'National Reintegration Center for OFWs - Personnel Information Update';
  frame.className = 'form-frame pending';
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox');
  frame.src = APPS_SCRIPT_URL;
  slot.replaceChildren(frame);
  timer = setTimeout(() => {
    heading.textContent = 'The form has not connected';
    message.textContent = 'Select Reload form to try again. If it still does not load, ask the form administrator to check the Google web-app deployment and its embedding update. No information has been submitted on this page.';
    reload.hidden = false; slot.setAttribute('aria-busy', 'false');
  }, 25000);
}
window.addEventListener('message', event => {
  if (!permitted || !frame || !isGoogleOrigin(event.origin) || !validMessage(event.data) ||
      !belongsToFrame(event.source, frame.contentWindow, window)) return;
  const { type, nonce } = event.data;
  if (type === 'nrco:embed:hello') {
    pending = { source: event.source, origin: event.origin, nonce };
    event.source.postMessage({ type: 'nrco:embed:approved', version: 1, nonce, page: PUBLIC_FORM_URL }, event.origin);
  } else if (pending && pending.source === event.source && pending.origin === event.origin && pending.nonce === nonce) {
    // This means the form UI loaded. It is NOT a submission/saved-row receipt.
    clearTimeout(timer);
    frame.classList.remove('pending');
    panel.hidden = true;
    slot.setAttribute('aria-busy', 'false');
  }
});
reload.addEventListener('click', loadForm);
if (permitted) loadForm();
else {
  heading.textContent = 'Open the official form page';
  message.textContent = 'This page must be opened directly at its GitHub address, not inside another website.';
  publicLink.hidden = false;
}
