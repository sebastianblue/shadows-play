/* Local-only preview. Production is handled by the Apps Script adapter. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Core = require('./backend/Core.js');
const root = path.resolve(__dirname, '..');
const dataDir = path.resolve(process.env.SHADOWS_PREVIEW_DIR || path.join(root, '.preview'));
fs.mkdirSync(dataDir, { recursive: true });
const journal = path.join(dataDir, 'invitations.jsonl');
const secretFile = path.join(dataDir, 'session-secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const secret = fs.readFileSync(secretFile, 'utf8');
const passwordFile = path.join(dataDir, 'admin-password');
const password = process.env.SHADOWS_PREVIEW_PASSWORD || (fs.existsSync(passwordFile) ? fs.readFileSync(passwordFile, 'utf8').trim() : 'forest-preview');
const port = Number(process.env.PORT || 4177);
const origin = `http://127.0.0.1:${port}`;
const attempts = new Map();
function equal(a, b) {
  const x = crypto.createHash('sha256').update(String(a || '')).digest();
  const y = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(x, y);
}
function sign(value) { return crypto.createHmac('sha256', secret).update(value).digest('hex'); }
const runtime = {
  now: () => new Date().toISOString(), random: n => crypto.randomBytes(n).toString('hex'), equal,
  checkPassword: value => equal(value, password),
  issueSession() { const value = `${Date.now() + 8 * 60 * 60 * 1000}.${crypto.randomBytes(16).toString('hex')}`; return `${value}.${sign(value)}`; },
  verifySession(token) {
    if (typeof token !== 'string' || token.length > 200) return false;
    const parts = token.split('.');
    return parts.length === 3 && Number(parts[0]) > Date.now() && equal(parts[2], sign(parts.slice(0, 2).join('.')));
  },
  commit(event) {
    const fd = fs.openSync(journal, 'a', 0o600);
    try { fs.writeSync(fd, JSON.stringify(event) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
};
function load() { return Core.replay(fs.existsSync(journal) ? fs.readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []); }
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, origin).pathname); } catch { res.writeHead(400).end(); return; }
  if (pathname === '/api/tickets') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'POST') { res.writeHead(405).end(JSON.stringify({ ok: false, message: 'Use POST.' })); return; }
    if (req.headers.origin && req.headers.origin !== origin && req.headers.origin !== `http://localhost:${port}`) { res.writeHead(403).end(); return; }
    try {
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 20000) throw new Error('Request is too large.'); }
      const input = JSON.parse(body);
      if (['login', 'lookup', 'manage', 'change', 'cancel'].includes(input.action)) {
        const key = `${req.socket.remoteAddress}:${input.action}`;
        const now = Date.now();
        const recent = (attempts.get(key) || []).filter(t => now - t < 60000);
        if (recent.length >= 30) throw new Error('Please wait a minute and try again.');
        recent.push(now); attempts.set(key, recent);
      }
      // No awaits between replay, capacity validation, and the durable append.
      const result = Core.perform(load(), input, runtime);
      res.end(JSON.stringify({ ok: true, preview: true, ...result }));
    } catch (error) { res.end(JSON.stringify({ ok: false, code: error.code || 'INVALID', message: error.message })); }
    return;
  }
  if (pathname === '/ticketing/runtime.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(`window.SHADOWS_LOCAL_PREVIEW = true;`); return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let filename = path.resolve(root, '.' + pathname);
  if (filename !== root && !filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (pathname.split('/').some(p => p.startsWith('.') || p === '*archive') || /^\/ticketing\/(backend|tests|output|tmp)(\/|$)/.test(pathname)) { res.writeHead(404).end(); return; }
  try {
    if (fs.statSync(filename).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(302, { Location: pathname + '/' + new URL(req.url, origin).search }).end(); return; }
      filename = path.join(filename, 'index.html');
    }
    const type = mime[path.extname(filename)];
    if (!type) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', type);
    res.end(req.method === 'HEAD' ? '' : fs.readFileSync(filename));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('The path disappears here.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Shadows invitation preview: ${origin}/ticket-gen/\nBookings are stored only on this computer.`));
