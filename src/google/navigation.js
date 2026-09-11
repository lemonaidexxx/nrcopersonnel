// Google's iframe sandbox must not navigate away when a section link is selected.
// Keep actual fragment hrefs for semantics, and scroll inside this document.
function jumpTo(hash, focus = false) {
  const target = document.getElementById(String(hash).replace(/^#/, ''));
  if (!target) return;
  target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  if (focus) target.focus({ preventScroll: true });
}
document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault(); const hash = link.getAttribute('href').slice(1);
  jumpTo(hash, true);
  if (window.google?.script?.history) google.script.history.push({ section: hash }, {}, hash);
  else history.pushState({ section: hash }, '', '#' + hash);
}));
if (window.google?.script?.history) {
  google.script.history.setChangeHandler(event => jumpTo(event.location.hash));
  google.script.url.getLocation(location => { if (location.hash) requestAnimationFrame(() => jumpTo(location.hash)); });
} else window.addEventListener('popstate', () => jumpTo(location.hash));
