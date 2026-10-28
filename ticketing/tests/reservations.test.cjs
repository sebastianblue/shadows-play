const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Core = require('../backend/Core.js');
function fixture() {
  const events = [], state = Core.initialState();
  const runtime = { now: () => '2026-10-28T20:00:00.000Z', random: n => crypto.randomBytes(n).toString('hex'),
    equal: (a, b) => Boolean(a) && a === b, checkPassword: p => p === 'correct password', issueSession: () => 'test-session',
    verifySession: s => s === 'test-session', commit: event => events.push(structuredClone(event)) };
  const call = (action, data = {}) => Core.perform(state, { action, ...data }, runtime);
  const issue = (tickets = 1, distribution = 'separate', extra = {}) => call('issue', { session: 'test-session', inviter: 'Vivi', tickets, distribution, requestId: crypto.randomBytes(16).toString('hex'), ...extra }).invitations;
  const reserve = (inv, performanceId = '2026-11-18', extra = {}) => call('reserve', { code: inv.code, performanceId, name: 'Test guest', email: 'guest@example.com', consent: true, requestId: crypto.randomBytes(16).toString('hex'), ...extra }).reservation;
  return { state, events, runtime, call, issue, reserve };
}
test('team password is checked before a session is issued', () => {
  const f = fixture();
  assert.throws(() => f.call('login', { password: 'wrong' }), { code: 'AUTH' });
  assert.equal(f.call('login', { password: 'correct password' }).session, 'test-session');
  assert.throws(() => f.issue(1, 'separate', { session: 'forged' }), { code: 'AUTH' });
  assert.throws(() => f.call('dashboard'), { code: 'AUTH' });
});
test('separate invitations are unique and can reserve different nights', () => {
  const f = fixture(), invs = f.issue(2, 'separate', { recipients: ['One', 'Two'] });
  assert.equal(new Set(invs.map(i => i.code)).size, 2);
  assert.deepEqual(invs.map(i => i.admissions), [1, 1]);
  f.reserve(invs[0]); f.reserve(invs[1], '2026-11-19');
  assert.deepEqual(Core.availability(f.state).map(p => p.reserved), [1, 1, 0]);
});
test('one shared card reserves all admissions together', () => {
  const f = fixture(), invs = f.issue(4, 'together');
  assert.equal(invs.length, 1);
  assert.equal(f.reserve(invs[0]).admissions, 4);
  assert.equal(Core.availability(f.state)[0].remaining, 31);
});
test('a group cannot exceed remaining capacity', () => {
  const f = fixture();
  f.reserve(f.issue(20, 'together')[0]);
  f.reserve(f.issue(14, 'together')[0]);
  const group = f.issue(2, 'together')[0];
  assert.throws(() => f.reserve(group), { code: 'FULL' });
  assert.equal(Core.availability(f.state)[0].reserved, 34);
  f.reserve(group, '2026-11-19');
});
test('a code is single-use and lookup never reveals guest details', () => {
  const f = fixture(), inv = f.issue()[0];
  f.reserve(inv);
  assert.throws(() => f.reserve(inv), { code: 'USED' });
  assert.throws(() => f.call('lookup', { code: inv.code }), { code: 'USED' });
});
test('safe retry does not issue duplicate invitations or bookings', () => {
  const f = fixture(), id = crypto.randomBytes(16).toString('hex');
  const inv = f.issue(2, 'separate', { requestId: id });
  assert.deepEqual(f.issue(2, 'separate', { requestId: id }), inv);
  const r = f.reserve(inv[0], '2026-11-18', { requestId: id });
  assert.equal(f.reserve(inv[0], '2026-11-18', { requestId: id }).id, r.id);
  assert.equal(f.state.reservations.length, 1);
});
test('codes accept spaces, missing separators, and lower case', () => {
  const f = fixture(), inv = f.issue()[0];
  for (const value of [inv.code.toUpperCase(), inv.code.replace(/\s/g, ''), inv.code.toUpperCase().replace(/ /g, '   '), inv.code.replace(/[ -]/g, '')])
    assert.equal(f.call('lookup', { code: value }).invitation.code, inv.code);
});
test('new codes use two words from the supplied adjective and noun lists', () => {
  const f = fixture(), words = require('../backend/Words.js');
  const invs = f.issue(20);
  for (const inv of invs) {
    const [a, n] = inv.code.split(' ');
    assert.equal(inv.code.split(' ').length, 2);
    assert.ok(words.adjectives1.includes(a));
    assert.ok(words.nouns.includes(n));
  }
});
test('three-word codes begin only after all two-word combinations have been used', () => {
  const f = fixture(), words = require('../backend/Words.js');
  for (const a of words.adjectives1) for (const n of words.nouns) f.state.invitations.push({ code: `${a} ${n}` });
  const invs = f.issue(2);
  for (const inv of invs) {
    const [a, b, n] = inv.code.split(' ');
    assert.equal(inv.code.split(' ').length, 3);
    assert.ok(words.adjectives1.includes(a)); assert.ok(words.adjectives2.includes(b)); assert.ok(words.nouns.includes(n));
  }
});
test('code and booking email control changes without private links', () => {
  const f = fixture(), r = f.reserve(f.issue(3, 'together')[0]);
  assert.throws(() => f.call('manage', { code: r.code, email: 'wrong@example.com' }), { code: 'AUTH' });
  assert.equal(f.call('manage', { code: r.code, email: r.email }).reservation.name, 'Test guest');
  f.call('change', { code: r.code, email: r.email, performanceId: '2026-11-20' });
  assert.deepEqual(Core.availability(f.state).map(p => p.reserved), [0, 0, 3]);
  const dashboard = f.call('dashboard', { session: 'test-session' });
  assert.equal(dashboard.reservations[0].manageToken, undefined);
  assert.equal(dashboard.reservations[0].requestId, undefined);
});
test('failed change retains the original booking', () => {
  const f = fixture(), r = f.reserve(f.issue(2, 'together')[0]);
  f.reserve(f.issue(20, 'together')[0], '2026-11-19'); f.reserve(f.issue(14, 'together')[0], '2026-11-19');
  assert.throws(() => f.call('change', { code: r.code, email: r.email, performanceId: '2026-11-19' }), { code: 'FULL' });
  assert.equal(f.state.reservations[0].performanceId, '2026-11-18');
});
test('guests can edit name, email, and access notes using their code and current email', () => {
  const f = fixture(), r = f.reserve(f.issue()[0]);
  assert.throws(() => f.call('change', { code: r.code, email: r.email, newEmail: 'invalid' }));
  assert.equal(f.state.reservations[0].email, r.email);
  const changed = f.call('change', { code: r.code.toUpperCase().replace(/[ -]/g, ''), email: r.email.toUpperCase(), newName: 'Updated name', newEmail: 'updated@example.com', accessNeeds: 'Please contact me about access.' }).reservation;
  assert.equal(changed.name, 'Updated name');
  assert.equal(changed.email, 'updated@example.com');
  assert.equal(changed.accessNeeds, 'Please contact me about access.');
  assert.throws(() => f.call('manage', { code: r.code, email: r.email }), { code: 'AUTH' });
  assert.equal(f.call('manage', { code: r.code, email: 'updated@example.com' }).reservation.id, r.id);
});
test('cancellation releases seats, remains idempotent, and does not reopen the code', () => {
  const f = fixture(), inv = f.issue(3, 'together')[0], r = f.reserve(inv);
  f.call('cancel', { code: r.code, email: r.email }); f.call('cancel', { code: r.code, email: r.email });
  assert.equal(Core.availability(f.state)[0].reserved, 0);
  assert.throws(() => f.reserve(inv), { code: 'USED' });
  assert.throws(() => f.call('change', { code: r.code, email: r.email, performanceId: '2026-11-20' }), { code: 'CANCELLED' });
});
test('voiding prevents redemption and cannot void an existing booking', () => {
  const f = fixture(), inv = f.issue()[0];
  f.call('void', { session: 'test-session', code: inv.code });
  assert.throws(() => f.reserve(inv), { code: 'CODE' });
  const booked = f.issue()[0]; f.reserve(booked);
  assert.throws(() => f.call('void', { session: 'test-session', code: booked.code }));
});
test('capacity cannot be lowered below booked admissions', () => {
  const f = fixture(); f.reserve(f.issue(4, 'together')[0]);
  assert.throws(() => f.call('performance', { session: 'test-session', id: '2026-11-18', capacity: 3, time: '19:30' }));
  f.call('performance', { session: 'test-session', id: '2026-11-18', capacity: 4, time: '20:00' });
  assert.equal(Core.availability(f.state)[0].remaining, 0);
  assert.equal(f.state.performances[0].time, '20:00');
});
test('event replay reproduces issued cards, changes, cancellations, and settings', () => {
  const f = fixture(), invs = f.issue(3);
  const a = f.reserve(invs[0]), b = f.reserve(invs[1]);
  f.call('change', { code: a.code, email: a.email, performanceId: '2026-11-19' });
  f.call('cancel', { code: b.code, email: b.email });
  f.call('void', { session: 'test-session', code: invs[2].code });
  f.call('performance', { session: 'test-session', id: '2026-11-20', capacity: 40, time: '20:00' });
  assert.deepEqual(Core.replay(f.events), f.state);
});
test('failed persistence never acknowledges or applies a reservation', () => {
  const f = fixture(), inv = f.issue()[0];
  f.runtime.commit = () => { throw new Error('storage unavailable'); };
  assert.throws(() => f.reserve(inv), /storage unavailable/);
  assert.equal(f.state.reservations.length, 0);
});
test('booking requires a name, valid email, consent, and bounded admissions', () => {
  const f = fixture(), inv = f.issue()[0];
  for (const extra of [{ name: '' }, { email: 'invalid' }, { consent: false }, { name: 'a'.repeat(101) }, { website: 'spam' }]) assert.throws(() => f.reserve(inv, '2026-11-18', extra));
  for (const n of [0, 21, 1.1, '2', null]) assert.throws(() => f.issue(n));
  assert.equal(f.state.reservations.length, 0);
});
test('booking closes at the configured Pacific start time', () => {
  const f = fixture(), inv = f.issue()[0];
  f.runtime.now = () => '2026-11-19T03:30:00.000Z';
  assert.throws(() => f.reserve(inv), { code: 'CLOSED' });
  f.reserve(inv, '2026-11-19');
});
