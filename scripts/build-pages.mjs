import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { PUBLIC_FORM_URL } from '../docs/config.js';
const path = name => new URL('../' + name, import.meta.url);
const read = name => readFile(path(name), 'utf8');
const replaceOnce = (text, find, replacement) => {
  if (!text.includes(find) || text.indexOf(find) !== text.lastIndexOf(find)) throw new Error('Build marker missing or duplicated: ' + find);
  return text.replace(find, replacement);
};
await mkdir(path('github-pages/'), { recursive: true });
let backend = await read('google-only/Code.gs');
backend = replaceOnce(backend, ".setTitle('Personnel Information Update | NRCO')", ".setTitle('Personnel Information Update | NRCO')\n    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)");
await writeFile(path('github-pages/Code.gs'), '// GITHUB PAGES EMBED VERSION. Deploy with its matching Index.html.\n' + backend);
let html = await read('google-only/Index.html');
const gateCss = '<style>#nrco-form-app[hidden],#nrco-embedding-gate[hidden]{display:none!important}#nrco-embedding-gate{max-width:620px;margin:12vh auto;padding:28px;border:1px solid #ccd5e1;border-top:6px solid #172d4b;border-radius:12px;background:#fff;color:#172d4b;font:16px/1.6 system-ui}#nrco-embedding-gate a{color:#172d4b;font-weight:700}</style>';
html = replaceOnce(html, '</head>', gateCss + '\n</head>');
html = replaceOnce(html, '<body>', '<body>\n<section id="nrco-embedding-gate" aria-labelledby="nrco-gate-title"><h1 id="nrco-gate-title">Open the official NRCO form</h1><p>The form will appear here when opened through its verified GitHub page.</p><a id="nrco-official-link" href="' + PUBLIC_FORM_URL + '" target="_blank" rel="noopener noreferrer">Open the form on GitHub</a><noscript><p>JavaScript is required to use this form.</p></noscript></section>\n<div id="nrco-form-app" hidden inert>');
// Wait to establish a Google form session until the expected top-level page replies.
html = replaceOnce(html, '\nconnect();\n', '\nif (window.nrcoEmbeddingVerified) connect();\nelse window.addEventListener("nrco:embedding-verified", connect, { once: true });\n');
const guard = (await read('src/pages/embed-guard.js')).replace('__PUBLIC_FORM_URL__', PUBLIC_FORM_URL);
if (/<\/script/i.test(guard)) throw new Error('Unsafe guard delimiter');
html = replaceOnce(html, '</body>', '</div>\n<script>\n' + guard + '\n</script>\n</body>');
await writeFile(path('github-pages/Index.html'), '<!-- GITHUB PAGES EMBED VERSION: replace the complete Apps Script Index.html. -->\n' + html);
await cp(path('google-only/appsscript.json'), path('github-pages/appsscript.json'));
console.log('Built github-pages/Code.gs, Index.html and appsscript.json. Publish docs/ through GitHub Pages.');
