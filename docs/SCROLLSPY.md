# Scroll-linked navigation and monochrome interface

The page now includes an On this page nav with four same-document links. Each
fieldset is the matching fragment target. A sticky desktop rail becomes a compact
sticky panel on small screens. Exactly one link carries aria-current="location",
a dark vertical bar and stronger text. The application interface uses solid navy
shades, with no gradients; the supplied reference image retains its original colors.

src/scrollspy.mjs uses IntersectionObserver for each target. Its rootMargin is
calculated from the measured sticky header height plus the compact navigation
height when applicable. ResizeObserver recalculates offsets. CSS scroll margins
keep headings visible below sticky elements. A requestAnimationFrame-throttled
scroll handler also handles gaps, rapid jumps and the last section at page bottom.
Native links keep fragment/history behavior; scrolling does not move keyboard
focus. Reduced-motion and forced-colors styles are included. The navigation hides
when the form is replaced by its success state and returns for another response.

All eight respondent fields remain required in the model, generated HTML, Worker
and generated Apps Script. No spreadsheet schema or receiver protocol changed.
Build/preview scripts now also copy/serve scrollspy.mjs.

Verification: 15 focused release tests passed locally. Eight Chromium checks passed
in an isolated document with no live network, covering required controls, disabled
preview submissions, layout and navigation at 320/390/768/1280px in both directions,
a single current link, the guide dialog, and navigation visibility changes. No
browser JavaScript errors were observed. Google services in code tests are mocks.
These checks do not establish production deployment or successful live Sheet writes.

Use docs/DEPLOYMENT.md to configure Google Apps Script and Cloudflare. After setup,
share the Cloudflare website URL, not the Sheet or Apps Script receiver URL. The
complete generated apps-script/Code.gs must be deployed in Google; GitHub/Cloudflare
deployment does not update Apps Script automatically.
