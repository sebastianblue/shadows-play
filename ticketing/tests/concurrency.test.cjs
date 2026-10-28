const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
test('40 simultaneous booking attempts fill exactly 35 places and survive a server restart', { timeout: 20000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shadows-test-'));
  const port = 4189;
  let child;
  async function start() {
    child = spawn(process.execPath, [path.resolve(__dirname, '../preview-server.cjs')], { env: { ...process.env, PORT: String(port), SHADOWS_PREVIEW_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { child.once('error', reject); child.stdout.once('data', resolve); child.once('exit', code => { if (code) reject(new Error('Preview server could not start.')); }); });
  }
  async function stop() { await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
  async function api(action, data = {}) { return fetch(`http://127.0.0.1:${port}/api/tickets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) }).then(r => r.json()); }
  const uid = () => crypto.randomBytes(16).toString('hex');
  try {
    await start();
    const { session } = await api('login', { password: 'forest-preview' });
    let invs = [];
    for (let i = 0; i < 2; i++) { const result = await api('issue', { session, inviter: 'Concurrency test', tickets: 20, distribution: 'separate', requestId: uid() }); assert.equal(result.ok, true); invs.push(...result.invitations); }
    const results = await Promise.all(invs.map((inv, i) => api('reserve', { code: inv.code, name: `Guest ${i}`, email: `guest${i}@example.com`, consent: true, performanceId: '2026-11-18', requestId: uid() })));
    assert.equal(results.filter(r => r.ok).length, 35);
    assert.equal(results.filter(r => r.code === 'FULL').length, 5);
    const accepted = results.find(r => r.ok);
    await stop(); await start();
    assert.equal((await api('availability')).performances[0].reserved, 35);
    assert.equal((await api('manage', { code: accepted.reservation.code, email: accepted.reservation.email })).reservation.id, accepted.reservation.id);
    assert.equal((await api('dashboard', { session: 'forged' })).code, 'AUTH');
    const denied = await fetch(`http://127.0.0.1:${port}/.preview/session-secret`);
    assert.equal(denied.status, 404);
  } finally { if (child && child.exitCode === null) await stop(); await fs.rm(dir, { recursive: true, force: true }); }
});
