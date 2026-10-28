(function () {
  'use strict';
  const T = Tickets, $ = id => document.getElementById(id);
  let invitation, reservation, performances = [], reserveId = T.uid();
  function step(name) { ['code-step', 'booking-step', 'confirmation-step'].forEach(id => { $(id).hidden = id !== name; }); }
  function credentials() { return { code: reservation.code, email: reservation.email }; }
  function updateIntent() {
    const manage = $('code-form').elements.intent.value === 'manage';
    $('manage-email-field').hidden = !manage;
    $('manage-email').required = manage;
    T.message('code-error', '');
  }
  document.querySelectorAll('[name=intent]').forEach(input => input.addEventListener('change', updateIntent));
  async function lookup() {
    const result = await T.api('lookup', { code: $('invitation-code').value });
    invitation = result.invitation; performances = result.performances;
    $('invitation-description').textContent = `${invitation.recipient ? `${invitation.recipient}, this` : 'This'} invitation admits ${invitation.admissions === 1 ? 'one person' : `${invitation.admissions} people, together at the same performance`}.`;
    $('guest-name').value = invitation.admissions === 1 ? invitation.recipient : '';
    T.performanceOptions($('performance-options'), performances, invitation.admissions, 'performance');
    step('booking-step'); $('guest-name').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('code-form').addEventListener('submit', async event => {
    event.preventDefault(); T.message('code-error', '');
    await T.busy(event.submitter, async () => {
      try {
        if ($('code-form').elements.intent.value === 'manage') {
          const result = await T.api('manage', { code: $('invitation-code').value, email: $('manage-email').value.trim() });
          reservation = result.reservation; performances = result.performances; renderConfirmation();
          if (reservation.status === 'confirmed') openEditor();
        } else await lookup();
      } catch (error) { T.message('code-error', error.message, true); }
    });
  });
  $('back-to-code').addEventListener('click', () => { step('code-step'); $('invitation-code').focus(); });
  $('booking-form').addEventListener('submit', async event => {
    event.preventDefault(); T.message('booking-error', '');
    await T.busy(event.submitter, async () => {
      try {
        const result = await T.api('reserve', { code: invitation.code, requestId: reserveId, performanceId: event.target.elements.performance.value,
          name: $('guest-name').value.trim(), email: $('guest-email').value.trim(), accessNeeds: $('access-needs').value.trim(), website: $('website').value, consent: $('booking-consent').checked });
        reservation = result.reservation; performances = result.performances;
        renderConfirmation();
      } catch (error) {
        T.message('booking-error', error.message, true);
        if (error.code === 'FULL' || error.code === 'CLOSED') {
          try { const result = await T.api('availability'); performances = result.performances; T.performanceOptions($('performance-options'), performances, invitation.admissions, 'performance'); } catch { /* Keep original booking error. */ }
        }
      }
    }, 'saving your place…');
  });
  function renderConfirmation() {
    const cancelled = reservation.status === 'cancelled', p = performances.find(perf => perf.id === reservation.performanceId);
    $('confirmation-title').textContent = (cancelled ? 'cancelled' : 'reserved') + (T.isPreview ? ' (preview)' : '');
    $('reservation-detail').innerHTML = `<p>${T.escape(p.label)}, 2026</p><p>${T.escape(T.time(p.time))} Pacific</p><p>${reservation.admissions} ${reservation.admissions === 1 ? 'person' : 'people'}</p><p>${T.escape(reservation.name)}</p><p>${T.escape(reservation.email)}</p><p>${T.escape(reservation.id)}</p>`;
    $('confirmation-note').textContent = cancelled ? 'Your places have been released.' : 'The team will send meeting details closer to the performance.';
    $('booking-code-reminder').textContent = `Your code: ${reservation.code}. To change this booking, return to /reserve and choose “change details” with this code and your booking email.`;
    $('manage-controls').hidden = cancelled || T.closed(p);
    $('change-panel').hidden = true; $('cancel-panel').hidden = true;
    step('confirmation-step'); $('confirmation-step').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('save-booking').addEventListener('click', () => {
    const p = performances.find(perf => perf.id === reservation.performanceId);
    const text = ['WE’RE STILL SEEING SHADOWS', '', `For: ${reservation.name}`, `${p.label}, 2026`, `${T.time(p.time)} Pacific`, `${reservation.admissions} ${reservation.admissions === 1 ? 'visitor' : 'visitors'} expected`, `Reference: ${reservation.id}`, `Special code: ${reservation.code}`, `Booking email: ${reservation.email}`, '', 'The team will contact you with arrival instructions.', '', `To change or cancel: ${T.publicBase()}/reserve`, 'Choose “change details” and enter your code and booking email.', '', 'An email confirmation has not been sent.', ...(T.isPreview ? ['', 'LOCAL PREVIEW ONLY. This is not a live reservation.'] : [])].join('\n');
    T.download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `shadows-booking-${reservation.id}.txt`);
  });
  function openEditor() {
    const p = performances.find(perf => perf.id === reservation.performanceId);
    if (reservation.status !== 'confirmed' || T.closed(p)) return;
    T.performanceOptions($('change-options'), performances, reservation.admissions, 'newPerformance', reservation.performanceId, reservation.performanceId);
    $('edit-name').value = reservation.name; $('edit-email').value = reservation.email; $('edit-access').value = reservation.accessNeeds || '';
    $('change-panel').hidden = false; $('cancel-panel').hidden = true; $('change-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('change-booking').addEventListener('click', async event => {
    await T.busy(event.currentTarget, async () => {
      try { const result = await T.api('manage', credentials()); reservation = result.reservation; performances = result.performances;
        if (reservation.status !== 'confirmed') { renderConfirmation(); return; }
        openEditor();
      } catch (error) { T.message('manage-message', error.message, true); }
    });
  });
  $('close-change').addEventListener('click', () => { $('change-panel').hidden = true; });
  $('change-form').addEventListener('submit', async event => {
    event.preventDefault();
    await T.busy(event.submitter, async () => {
      try { const result = await T.api('change', { ...credentials(), performanceId: event.target.elements.newPerformance.value, newName: $('edit-name').value.trim(), newEmail: $('edit-email').value.trim(), accessNeeds: $('edit-access').value.trim() }); reservation = result.reservation; performances = result.performances; renderConfirmation(); T.message('manage-message', 'Your changes are saved.'); }
      catch (error) { T.message('manage-message', error.message, true); }
    });
  });
  $('cancel-booking').addEventListener('click', () => { $('cancel-panel').hidden = false; $('change-panel').hidden = true; $('cancel-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  $('keep-booking').addEventListener('click', () => { $('cancel-panel').hidden = true; });
  $('confirm-cancel').addEventListener('click', async event => {
    await T.busy(event.currentTarget, async () => {
      try { const result = await T.api('cancel', credentials()); reservation = result.reservation; performances = result.performances; renderConfirmation(); T.message('manage-message', 'Your reservation has been cancelled.'); }
      catch (error) { T.message('manage-message', error.message, true); }
    });
  });
  $('back-to-start').addEventListener('click', () => { step('code-step'); $('invitation-code').value = reservation.code; $('code-form').elements.intent.value = 'manage'; $('manage-email').value = reservation.email; updateIntent(); });
  function init() {
    // Booking credentials are entered on the page, never stored in a URL.
    if (location.hash || location.search) history.replaceState(null, '', location.pathname);
    if (!T.configured) { $('code-form').hidden = true; T.message('code-error', 'The invitation desk is being prepared. Reservations are not open yet.'); }
  }
  init();
})();
