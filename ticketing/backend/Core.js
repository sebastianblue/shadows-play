/* Shared reservation engine. Also add this file as Core.gs in Apps Script. */
var ShadowsTickets = (function () {
  'use strict';
  var DEFAULT_PERFORMANCES = [
    { id: '2026-11-18', label: 'Wednesday, November 18', time: '19:30', capacity: 35 },
    { id: '2026-11-19', label: 'Thursday, November 19', time: '19:30', capacity: 35 },
    { id: '2026-11-20', label: 'Friday, November 20', time: '19:30', capacity: 35 }
  ];
  function fail(message, code) { var e = new Error(message); e.code = code || 'INVALID'; throw e; }
  function text(value, max, required) {
    if (value != null && typeof value !== 'string') fail('Please use text for this field.');
    var s = String(value || '').trim();
    if ((required && !s) || s.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) fail('Please check the information you entered.');
    return s;
  }
  function integer(value, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) fail('Please choose a number from ' + min + ' to ' + max + '.');
    return value;
  }
  function code(value) { return text(value, 100, true).normalize('NFKC').toLowerCase().replace(/[\s-]/g, ''); }
  function requestId(value) {
    var s = text(value, 100, true);
    if (!/^[a-zA-Z0-9_-]{20,100}$/.test(s)) fail('Please refresh and try again.');
    return s;
  }
  function initialState() { return { invitations: [], reservations: [], performances: JSON.parse(JSON.stringify(DEFAULT_PERFORMANCES)) }; }
  function apply(state, event) {
    if (event.type === 'issued') state.invitations = state.invitations.concat(event.data);
    else if (event.type === 'reserved') state.reservations.push(event.data);
    else if (event.type === 'reservationUpdated') {
      var index = state.reservations.findIndex(function (r) { return r.id === event.data.id; });
      if (index < 0) fail('Reservation history is incomplete.', 'STORAGE');
      state.reservations[index] = event.data;
    } else if (event.type === 'voided') {
      var invitation = state.invitations.find(function (i) { return i.code === event.data.code; });
      if (!invitation) fail('Invitation history is incomplete.', 'STORAGE');
      invitation.voided = true;
    } else if (event.type === 'performanceUpdated') {
      var p = state.performances.findIndex(function (item) { return item.id === event.data.id; });
      if (p < 0) fail('Performance history is incomplete.', 'STORAGE');
      state.performances[p] = event.data;
    } else fail('Unknown journal event.', 'STORAGE');
    return state;
  }
  function replay(events) { return events.reduce(apply, initialState()); }
  function availability(state) {
    return state.performances.map(function (p) {
      var reserved = state.reservations.filter(function (r) { return r.performanceId === p.id && r.status === 'confirmed'; })
        .reduce(function (total, r) { return total + r.admissions; }, 0);
      return Object.assign({}, p, { reserved: reserved, remaining: p.capacity - reserved });
    });
  }
  function invitationStatus(state, invitation) {
    if (invitation.voided) return 'void';
    var booking = state.reservations.find(function (r) { return r.code === invitation.code; });
    return booking ? (booking.status === 'cancelled' ? 'cancelled' : 'redeemed') : 'issued';
  }
  function perform(state, input, runtime) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid request.');
    var action = text(input.action, 30, true);
    function commit(type, data) {
      var event = { type: type, at: runtime.now(), data: data };
      // Persist the event before acknowledging it. Replay is the source of truth.
      runtime.commit(event);
      apply(state, event);
    }
    function admin() { if (!runtime.verifySession(input.session)) fail('Please sign in to the team page again.', 'AUTH'); }
    function findInvitation() {
      var c = code(input.code);
      var found = state.invitations.find(function (i) { return code(i.code) === c; });
      if (!found || found.voided) fail('That invitation could not be found. Check the code on your card.', 'CODE');
      return found;
    }
    function privateReservation() {
      var enteredCode = code(input.code);
      var enteredEmail = text(input.email, 254, true).toLowerCase();
      var found = state.reservations.find(function (r) { return code(r.code) === enteredCode && runtime.equal(r.email, enteredEmail); });
      if (!found) fail('Check your special code and the email used for your booking.', 'AUTH');
      return found;
    }
    function publicReservation(r) {
      return { id: r.id, name: r.name, email: r.email, admissions: r.admissions, performanceId: r.performanceId,
        status: r.status, accessNeeds: r.accessNeeds, code: r.code };
    }
    function choosePerformance(id, admissions, excludeId) {
      var p = state.performances.find(function (item) { return item.id === id; });
      if (!p) fail('Please choose a performance.');
      var booked = state.reservations.filter(function (r) { return r.id !== excludeId && r.status === 'confirmed' && r.performanceId === id; })
        .reduce(function (n, r) { return n + r.admissions; }, 0);
      if (booked + admissions > p.capacity) fail('There are not enough places left for your group on that night. Please choose another performance.', 'FULL');
      // Performance dates are interpreted explicitly in America/Los_Angeles.
      var offset = id >= '2026-11-01' ? '-08:00' : '-07:00';
      if (Date.parse(id + 'T' + p.time + ':00' + offset) <= Date.parse(runtime.now())) fail('Reservations for that performance have closed.', 'CLOSED');
      return p;
    }
    if (action === 'availability') return { performances: availability(state) };
    if (action === 'login') {
      if (!runtime.checkPassword(text(input.password, 200, true))) fail('That team password does not match.', 'AUTH');
      return { session: runtime.issueSession() };
    }
    if (action === 'lookup') {
      var i = findInvitation();
      if (invitationStatus(state, i) !== 'issued') fail('This code already has a booking. Choose “change details” and enter your booking email.', 'USED');
      return { invitation: { code: i.code, recipient: i.recipient, admissions: i.admissions }, performances: availability(state) };
    }
    if (action === 'issue') {
      admin();
      var rid = requestId(input.requestId);
      var existing = state.invitations.filter(function (inv) { return inv.requestId === rid; });
      if (existing.length) return { invitations: existing };
      var tickets = integer(input.tickets, 1, 20);
      if (input.distribution !== 'separate' && input.distribution !== 'together') fail('Choose how to distribute the tickets.');
      var inviter = text(input.inviter, 100, true);
      var count = input.distribution === 'separate' ? tickets : 1;
      var names = input.recipients || [];
      if (!Array.isArray(names) || names.length > 20) fail('Please check the recipient names.');
      var issued = [];
      var words = typeof module !== 'undefined' ? require('./Words.js') : ShadowsTicketWords;
      function pick(list) {
        var number, ceiling = Math.floor(4294967296 / list.length) * list.length;
        do { number = parseInt(runtime.random(4), 16); } while (number >= ceiling);
        return list[number % list.length];
      }
      var usedCodes = new Set(state.invitations.map(function (inv) { return code(inv.code); }));
      var availablePairs = [];
      words.adjectives1.forEach(function (adjective) {
        words.nouns.forEach(function (noun) {
          var pair = adjective + ' ' + noun;
          if (!usedCodes.has(code(pair))) availablePairs.push(pair);
        });
      });
      for (var n = 0; n < count; n++) {
        var newCode;
        if (availablePairs.length) {
          newCode = pick(availablePairs);
          var pairIndex = availablePairs.indexOf(newCode);
          availablePairs[pairIndex] = availablePairs[availablePairs.length - 1];
          availablePairs.pop();
        } else {
          var tries = 0;
          do {
            if (++tries > 1000) fail('Please try generating these invitations again.');
            newCode = pick(words.adjectives1) + ' ' + pick(words.adjectives2) + ' ' + pick(words.nouns);
          } while (usedCodes.has(code(newCode)));
        }
        usedCodes.add(code(newCode));
        issued.push({ code: newCode, inviter: inviter, recipient: text(names[n], 100, false), admissions: input.distribution === 'separate' ? 1 : tickets,
          createdAt: runtime.now(), requestId: rid, voided: false });
      }
      commit('issued', issued);
      return { invitations: issued };
    }
    if (action === 'reserve') {
      var invite = findInvitation();
      var reserveRequestId = requestId(input.requestId);
      var previous = state.reservations.find(function (r) { return r.code === invite.code; });
      if (previous) {
        if (previous.requestId === reserveRequestId) return { reservation: publicReservation(previous), performances: availability(state) };
        fail('This code already has a booking. Choose “change details” and enter your booking email.', 'USED');
      }
      var name = text(input.name, 100, true);
      var email = text(input.email, 254, true).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Please enter a valid email address.');
      if (input.consent !== true) fail('Please agree to the booking information notice.');
      if (text(input.website, 200, false)) fail('We could not save this booking. Please try again.');
      choosePerformance(input.performanceId, invite.admissions);
      var record = { id: 'SS-' + runtime.random(6).toUpperCase(), code: invite.code, name: name, email: email,
        accessNeeds: text(input.accessNeeds, 1000, false), admissions: invite.admissions, performanceId: input.performanceId,
        createdAt: runtime.now(), updatedAt: runtime.now(), status: 'confirmed', requestId: reserveRequestId };
      commit('reserved', record);
      return { reservation: publicReservation(record), performances: availability(state) };
    }
    if (action === 'manage') return { reservation: publicReservation(privateReservation()), performances: availability(state) };
    if (action === 'change') {
      var change = privateReservation();
      if (change.status !== 'confirmed') fail('This reservation has been cancelled.', 'CANCELLED');
      choosePerformance(change.performanceId, 0, change.id);
      var nextPerformance = input.performanceId || change.performanceId;
      choosePerformance(nextPerformance, change.admissions, change.id);
      var nextName = input.newName == null ? change.name : text(input.newName, 100, true);
      var nextEmail = input.newEmail == null ? change.email : text(input.newEmail, 254, true).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) fail('Please enter a valid email address.');
      var nextAccess = input.accessNeeds == null ? change.accessNeeds : text(input.accessNeeds, 1000, false);
      var updated = Object.assign({}, change, { name: nextName, email: nextEmail, accessNeeds: nextAccess, performanceId: nextPerformance, updatedAt: runtime.now() });
      commit('reservationUpdated', updated);
      return { reservation: publicReservation(updated), performances: availability(state) };
    }
    if (action === 'cancel') {
      var cancel = privateReservation();
      if (cancel.status !== 'cancelled') {
        choosePerformance(cancel.performanceId, 0, cancel.id);
        cancel = Object.assign({}, cancel, { status: 'cancelled', updatedAt: runtime.now() });
        commit('reservationUpdated', cancel);
      }
      return { reservation: publicReservation(cancel), performances: availability(state) };
    }
    if (action === 'dashboard') {
      admin();
      return { performances: availability(state),
        invitations: state.invitations.map(function (inv) { return Object.assign({}, inv, { status: invitationStatus(state, inv) }); }),
        reservations: state.reservations.map(function (r) { var result = Object.assign({}, r); delete result.manageToken; delete result.requestId; return result; }) };
    }
    if (action === 'void') {
      admin();
      var voidInvitation = findInvitation();
      if (invitationStatus(state, voidInvitation) !== 'issued') fail('Only unused invitations can be voided.');
      commit('voided', { code: voidInvitation.code });
      return { success: true };
    }
    if (action === 'performance') {
      admin();
      var perf = availability(state).find(function (p) { return p.id === input.id; });
      if (!perf) fail('Performance not found.');
      var cap = integer(input.capacity, 1, 500);
      if (cap < perf.reserved) fail('Capacity cannot be lower than the number already reserved.');
      if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) fail('Please use a valid start time.');
      commit('performanceUpdated', { id: perf.id, label: perf.label, time: input.time, capacity: cap });
      return { performances: availability(state) };
    }
    fail('Unknown action.');
  }
  return { perform: perform, replay: replay, initialState: initialState, availability: availability, invitationStatus: invitationStatus };
})();
if (typeof module !== 'undefined') module.exports = ShadowsTickets;
