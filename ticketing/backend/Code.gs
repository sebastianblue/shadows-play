/**
 * Apps Script adapter. Add Core.js as Core.gs and Words.js as Words.gs.
 * No MailApp/GmailApp permissions or outbound messaging are used.
 */
function setupTickets() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open Apps Script from the reservation Google Sheet, then run setupTickets.');
  var password = props.getProperty('TEAM_PASSWORD');
  if (!password) throw new Error('Set TEAM_PASSWORD in Project Settings → Script properties.');
  props.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  if (!props.getProperty('SESSION_SECRET')) props.setProperty('SESSION_SECRET', Utilities.getUuid() + Utilities.getUuid());
  var salt = Utilities.getUuid();
  props.setProperties({ PASSWORD_SALT: salt, PASSWORD_HASH: digest_(salt + password) });
  props.deleteProperty('TEAM_PASSWORD');
  if (!props.getProperty('PUBLIC_ORIGIN')) props.setProperty('PUBLIC_ORIGIN', 'https://stillseeingshadows.com');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var events = spreadsheet.getSheetByName('Events') || spreadsheet.insertSheet('Events');
    if (events.getLastRow() === 0) events.appendRow(['Recorded at', 'Event JSON (source of truth; do not edit)']);
    syncSheets_(spreadsheet, loadState_(spreadsheet));
    events.hideSheet();
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}

function doGet() {
  return ContentService.createTextOutput('Shadows reservation endpoint. Submit requests through stillseeingshadows.com.');
}

function doPost(e) {
  var input = {}, result;
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var raw = String((e && e.parameter && e.parameter.payload) || '');
    if (!raw || raw.length > 20000) throw new Error('Invalid request size.');
    input = JSON.parse(raw);
    if (!/^[a-f0-9]{32}$/.test(input.transportId || '')) throw new Error('Invalid request.');
    lock.waitLock(30000); locked = true;
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty('PASSWORD_HASH')) throw new Error('Reservations are not open yet.');
    // Apps Script does not provide a trustworthy client IP. A bounded global
    // throttle limits password/code guessing for this small invitation-only show.
    if (['login', 'lookup', 'manage', 'change', 'cancel'].indexOf(input.action) >= 0) {
      var cache = CacheService.getScriptCache();
      var key = 'attempts:' + input.action + ':' + Math.floor(Date.now() / 60000);
      var count = Number(cache.get(key) || 0);
      if (count >= 60) throw new Error('Please wait a minute and try again.');
      cache.put(key, String(count + 1), 120);
    }
    var spreadsheet = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    var state = loadState_(spreadsheet);
    var changed = false;
    var runtime = {
      now: function () { return new Date().toISOString(); },
      random: function (bytes) {
        var value = '';
        while (value.length < bytes * 2) value += digest_(Utilities.getUuid() + Utilities.getUuid());
        return value.slice(0, bytes * 2);
      },
      equal: equal_,
      checkPassword: function (password) { return equal_(digest_(props.getProperty('PASSWORD_SALT') + password), props.getProperty('PASSWORD_HASH')); },
      issueSession: function () {
        var value = String(Date.now() + 8 * 60 * 60 * 1000) + '.' + Utilities.getUuid().replace(/-/g, '');
        return value + '.' + hmac_(value, props.getProperty('SESSION_SECRET'));
      },
      verifySession: function (token) {
        if (typeof token !== 'string' || token.length > 200) return false;
        var parts = token.split('.');
        return parts.length === 3 && Number(parts[0]) > Date.now() && equal_(parts[2], hmac_(parts.slice(0, 2).join('.'), props.getProperty('SESSION_SECRET')));
      },
      commit: function (event) {
        spreadsheet.getSheetByName('Events').appendRow([event.at, JSON.stringify(event)]);
        SpreadsheetApp.flush();
        changed = true;
      }
    };
    result = Object.assign({ ok: true }, ShadowsTickets.perform(state, input, runtime));
    if (changed || input.action === 'dashboard') {
      try { syncSheets_(spreadsheet, state); SpreadsheetApp.flush(); }
      catch (projectionError) {
        // The durable journal already contains the booking. Never invite a
        // duplicate retry by reporting a committed reservation as a failure.
        console.error('Guest list projection requires refresh: ' + projectionError.message);
        result.sheetWarning = 'Booking saved. Open the team dashboard to refresh the guest-list tabs.';
      }
    }
  } catch (error) {
    result = { ok: false, code: error.code || 'INVALID', message: error.message || 'Please try again.' };
  } finally { if (locked) lock.releaseLock(); }
  return reply_(input.transportId, result);
}

function loadState_(spreadsheet) {
  var events = spreadsheet.getSheetByName('Events');
  if (!events) throw new Error('Run setupTickets before opening reservations.');
  var count = events.getLastRow() - 1;
  var rows = count > 0 ? events.getRange(2, 2, count, 1).getValues() : [];
  return ShadowsTickets.replay(rows.map(function (row) { return JSON.parse(row[0]); }));
}

function syncSheets_(spreadsheet, state) {
  writeSheet_(spreadsheet, 'Invitations', ['Code', 'Invited by', 'Recipient', 'Admissions', 'Status', 'Created at'],
    state.invitations.map(function (i) { return [i.code, safeCell_(i.inviter), safeCell_(i.recipient), i.admissions, ShadowsTickets.invitationStatus(state, i), i.createdAt]; }));
  writeSheet_(spreadsheet, 'Reservations', ['Booking reference', 'Guest name', 'Email', 'Invitation code', 'Performance date', 'Admissions', 'Status', 'Access requests', 'Created at', 'Updated at', 'Email status'],
    state.reservations.map(function (r) { return [r.id, safeCell_(r.name), safeCell_(r.email), r.code, r.performanceId, r.admissions, r.status, safeCell_(r.accessNeeds), r.createdAt, r.updatedAt, 'Not sent']; }));
  writeSheet_(spreadsheet, 'Performances', ['Date', 'Performance', 'Start time (Pacific)', 'Capacity', 'Reserved', 'Remaining'],
    ShadowsTickets.availability(state).map(function (p) { return [p.id, p.label, p.time, p.capacity, p.reserved, p.remaining]; }));
}

function writeSheet_(spreadsheet, name, headers, rows) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  var values = [headers].concat(rows);
  if (sheet.getMaxRows() < values.length) sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  if (sheet.getLastRow() > values.length) sheet.getRange(values.length + 1, 1, sheet.getLastRow() - values.length, headers.length).clearContent();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground('#284e12').setFontColor('#f4f5ef').setFontWeight('bold');
  sheet.setColumnWidths(1, headers.length, 160);
}

function safeCell_(value) { var s = String(value || ''); return /^[\s]*[=+\-@\t\r]/.test(s) ? "'" + s : s; }
function digest_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function hmac_(value, secret) { return Utilities.computeHmacSha256Signature(value, secret, Utilities.Charset.UTF_8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function equal_(a, b) {
  var x = digest_(String(a || '')), y = digest_(String(b || '')), diff = 0;
  for (var i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function reply_(transportId, result) {
  var origin = PropertiesService.getScriptProperties().getProperty('PUBLIC_ORIGIN') || 'https://stillseeingshadows.com';
  // Fixed destination prevents another site from receiving a successful login
  // or a guest's private booking data. No JSONP and no wildcard postMessage.
  var payload = JSON.stringify({ source: 'shadows-tickets', transportId: transportId || '', result: result }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><p>Returning to the forest…</p><script>window.top.postMessage(' + payload + ',' + JSON.stringify(origin).replace(/</g, '\\u003c') + ');</script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
