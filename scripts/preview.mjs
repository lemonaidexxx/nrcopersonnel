// Local visual preview only. No outgoing requests, credentials, or real submissions.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('../dist/', import.meta.url);
const allowed = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/styles.css', 'styles.css'], ['/app.mjs', 'app.mjs'], ['/scrollspy.mjs', 'scrollspy.mjs'], ['/validation.mjs', 'validation.mjs'], ['/assets/shirt-size-guide.webp', 'assets/shirt-size-guide.webp']]);
const mime = { html: 'text/html', css: 'text/css', mjs: 'text/javascript', webp: 'image/webp' };
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/api/config') { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return response.end(JSON.stringify({ enabled: false, preview: true })); }
  if (request.method !== 'GET' || !allowed.has(pathname)) { response.writeHead(404); return response.end('Not available in preview'); }
  try { const file = allowed.get(pathname); const body = await readFile(new URL(file, root)); response.writeHead(200, { 'Content-Type': mime[file.split('.').pop()], 'Cache-Control': 'no-store' }); response.end(body); }
  catch { response.writeHead(500); response.end('Run npm run build first.'); }
}).listen(4173, '127.0.0.1', () => console.log('Visual preview: http://127.0.0.1:4173 (submissions disabled)'));
