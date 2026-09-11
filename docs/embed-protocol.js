// Check both the sender origin AND the frame tree. Google may sandbox the form
// inside a second iframe, so event.source is not always the outer contentWindow.
export function isGoogleOrigin(origin) {
  return /^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+-script\.googleusercontent\.com)$/.test(origin);
}
export function belongsToFrame(source, frameWindow, topWindow) {
  try {
    for (let depth = 0; source && depth < 5; depth++) {
      if (source === frameWindow) return true;
      if (source === topWindow || source.parent === source) return false;
      source = source.parent;
    }
  } catch (_) { /* An inaccessible or detached window is not approved. */ }
  return false;
}
export function validMessage(data) {
  return data !== null && typeof data === 'object' && !Array.isArray(data) &&
    data.version === 1 && /^[a-f0-9]{32}$/.test(data.nonce || '') &&
    ['nrco:embed:hello', 'nrco:embed:ready'].includes(data.type);
}
export function isPublicLocation(location, canonical) {
  const expected = new URL(canonical);
  return location.origin === expected.origin &&
    [expected.pathname, expected.pathname + 'index.html'].includes(location.pathname);
}
