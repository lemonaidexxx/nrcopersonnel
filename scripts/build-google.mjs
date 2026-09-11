// Maintainers only. Owners deploy the three prebuilt google-only files by copying.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
const path = name => new URL('../' + name, import.meta.url);
const read = name => readFile(path(name), 'utf8');
await mkdir(path('google-only/'), { recursive: true });
const validation = (await read('src/validation.mjs')).replace(/^export /gm, '');
const privateValidation = validation.replace(/\b(isPlainRecord|sanitizeInput|canonicalPhone|validateSubmission)\b/g, '$1_');
const backend = await read('src/google/backend.gs');
await writeFile(path('google-only/Code.gs'), '// COMPLETE GOOGLE-ONLY BACKEND. Replace old Code.gs, do not append.\n' + privateValidation + '\n' + backend);
let html = await read('dist/index.html');
const css = await read('web/styles.css');
html = html.replace('<link rel="stylesheet" href="/styles.css">', '<base target="_top">\n  <style>\n' + css + '\n  </style>');
html = html.replace(/\s*<script type="module" src="\/(?:app|scrollspy)\.mjs"><\/script>/g, '');
html = html.replace(/<div id="turnstile-container"><\/div><p id="verification-help" class="helper">[^<]*<\/p>/, '<p class="helper">Check all details before submitting. A reference will appear after your information is saved.</p>');
html = html.replace('<div id="availability" class="notice" role="status">Checking form availability...</div>', '<div id="availability" class="notice" role="status">Connecting to the form...</div>\n    <button id="reconnect" type="button" class="secondary" hidden>Refresh connection</button>');
// Public non-personal reference image, pinned to the existing GitHub commit.
html = html.replaceAll('/assets/shirt-size-guide.webp', 'https://raw.githubusercontent.com/lemonaidexxx/nrcopersonnel/389de1a0abb1417b42e23c579716bfbf6a777085/assets/shirt-size-guide.webp');
for (const source of [validation + '\n' + await read('src/google/app.js'), await read('src/scrollspy.mjs'), await read('src/google/navigation.js')]) {
  if (/<\/script/i.test(source)) throw new Error('Unsafe inline script delimiter');
  html = html.replace('</body>', '<script>\n(() => {\n' + source + '\n})();\n</script>\n</body>');
}
await writeFile(path('google-only/Index.html'), '<!-- COMPLETE GOOGLE-HOSTED FORM. Paste into an Apps Script HTML file named Index. -->\n' + html);
await cp(path('apps-script/appsscript.json'), path('google-only/appsscript.json'));
console.log('Built google-only/Code.gs, Index.html and appsscript.json. No Cloudflare configuration needed.');
