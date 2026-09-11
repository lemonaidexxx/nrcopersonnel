// UI framing mitigation, NOT staff authentication, CAPTCHA, or an HTTP
// frame-ancestors policy. Never send personnel data or session tokens to a parent.
(() => {
  const PAGE = '__PUBLIC_FORM_URL__';
  const ORIGIN = new URL(PAGE).origin;
  const content = document.getElementById('nrco-form-app');
  const gate = document.getElementById('nrco-embedding-gate');
  const link = document.getElementById('nrco-official-link');
  link.href = PAGE;
  if (window.top === window.self || !window.crypto?.getRandomValues) return;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  let approved = false, attempts = 0, interval;
  window.addEventListener('message', event => {
    if (approved || event.source !== window.top || event.origin !== ORIGIN ||
        event.data?.type !== 'nrco:embed:approved' || event.data.version !== 1 ||
        event.data.nonce !== nonce || event.data.page !== PAGE) return;
    approved = true; clearInterval(interval);
    window.nrcoEmbeddingVerified = true;
    content.hidden = false; content.inert = false; gate.hidden = true;
    window.dispatchEvent(new Event('nrco:embedding-verified'));
    window.dispatchEvent(new Event('resize'));
    window.top.postMessage({ type: 'nrco:embed:ready', version: 1, nonce }, ORIGIN);
  });
  function hello() {
    if (approved || ++attempts > 30) { clearInterval(interval); return; }
    window.top.postMessage({ type: 'nrco:embed:hello', version: 1, nonce }, ORIGIN);
  }
  interval = setInterval(hello, 750);
  hello();
})();
