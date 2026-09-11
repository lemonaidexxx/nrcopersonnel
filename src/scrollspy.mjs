// Same-document navigation, independent of submission availability.
// IO observes each fragment target; a small rAF-throttled fallback handles fast
// jumps, gaps, and the bottom of the page where the last heading cannot reach the top.
const nav = document.querySelector('#section-nav');
const header = document.querySelector('#sticky-header');
const form = document.querySelector('#personnel-form');
const links = Array.from(nav?.querySelectorAll('a[href^="#"]') || []);
const targets = links.map(link => document.getElementById(link.hash.slice(1)));
const compact = matchMedia('(max-width: 900px)');
let activation = 0, observer, frame = 0, measureFrame = 0;

function activate(index) {
  links.forEach((link, i) => {
    if (i === index) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function update() {
  frame = 0;
  if (!targets.length || form.hidden) return;
  const rects = targets.map(target => target.getBoundingClientRect());
  let index = 0;
  for (let i = 0; i < rects.length; i++) if (rects[i].top <= activation + 1) index = i;
  const atBottom = window.scrollY > 0 && Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
  if (atBottom) index = targets.length - 1;
  activate(index);
}
function schedule() { if (!frame) frame = requestAnimationFrame(update); }
function measure() {
  measureFrame = 0;
  const headerHeight = Math.ceil(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--header-height', headerHeight + 'px');
  const railHeight = compact.matches && !nav.hidden ? Math.ceil(nav.getBoundingClientRect().height) : 0;
  activation = Math.min(headerHeight + railHeight + 24, Math.max(0, window.innerHeight - 2));
  document.documentElement.style.setProperty('--anchor-offset', activation + 'px');
  observer?.disconnect();
  if ('IntersectionObserver' in window) {
    // A narrow activation band directly below the measured sticky UI.
    const bottom = Math.max(0, window.innerHeight - activation - 2);
    observer = new IntersectionObserver(schedule, {
      root: null, rootMargin: `-${activation}px 0px -${bottom}px 0px`, threshold: 0
    });
    targets.forEach(target => observer.observe(target));
  }
  schedule();
}
function scheduleMeasure() { if (!measureFrame) measureFrame = requestAnimationFrame(measure); }
if (nav && header && form && targets.length && targets.every(Boolean)) {
  activate(0);
  measure();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pageshow', scheduleMeasure);
  compact.addEventListener('change', scheduleMeasure);
  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(scheduleMeasure);
    resize.observe(header); resize.observe(nav);
  }
  // Hide links to an unavailable form after success; restore them for a new entry.
  new MutationObserver(() => {
    nav.hidden = form.hidden;
    scheduleMeasure();
  }).observe(form, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('load', () => {
    measure();
    const index = links.findIndex(link => link.hash === location.hash);
    if (index !== -1) targets[index].scrollIntoView({ behavior: 'instant', block: 'start' });
    schedule();
  }, { once: true });
}
