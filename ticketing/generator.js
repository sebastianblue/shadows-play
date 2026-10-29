(function () {
  'use strict';
  const T = Tickets, $ = id => document.getElementById(id);
  let session = sessionStorage.getItem('shadows-team-session') || '';
  let issued = [], dashboard = null, issueId = T.uid(), performanceRequest = null;
  let recipientDrafts = { separate: [], together: [] }, lastDistribution = 'separate';
  const form = $('generator-form');
  function distribution() { return form.elements.distribution.value; }
  function count() { return Math.max(1, Math.min(20, Number($('ticket-count').value) || 1)); }
  function saveNames() { recipientDrafts[lastDistribution] = Array.from($('recipient-fields').querySelectorAll('input'), input => input.value); }
  function refreshPreview(rebuild = false) {
    const together = distribution() === 'together', tickets = count(), number = together ? 1 : tickets;
    if (rebuild) {
      saveNames(); lastDistribution = distribution();
      $('recipient-fields').innerHTML = Array.from({ length: number }, (_, i) => `<label class="sr-only" for="recipient-${i}">${together ? 'Group name' : `Recipient ${i + 1}`}</label><input id="recipient-${i}" class="recipient-input" maxlength="100" placeholder="${together ? 'e.g. Vivi & friends' : `name on invitation ${i + 1}`}" value="${T.escape(recipientDrafts[lastDistribution][i] || '')}">`).join('');
    }
  }
  function ensurePerformances() {
    if (!performanceRequest) {
      performanceRequest = T.api('availability').then(status => {
        InvitationCards.setPerformances(status.performances);
        return status;
      }).catch(error => { performanceRequest = null; throw error; });
    }
    return performanceRequest;
  }
  function enter() {
    $('team-login').hidden = true; $('team-workspace').hidden = false;
    $('inviter').value = sessionStorage.getItem('shadows-inviter') || '';
    refreshPreview(true);
    // Public performance times can load while the cast member fills out the
    // form. Only the guest-list tab needs the protected dashboard request.
    ensurePerformances().catch(() => {});
  }
  if (!T.configured) { $('login-form').hidden = true; $('unconfigured').hidden = false; }
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault(); T.message('login-error', '');
    await T.busy(event.submitter, async () => {
      try {
        const result = await T.api('login', { password: $('team-password').value });
        session = result.session; sessionStorage.setItem('shadows-team-session', session); $('team-password').value = '';
        enter();
      } catch (error) { T.message('login-error', error.message, true); }
    });
  });
  $('logout').addEventListener('click', () => { sessionStorage.removeItem('shadows-team-session'); session = ''; dashboard = null; issued = []; performanceRequest = null; $('issued-cards').replaceChildren(); $('generated-results').hidden = true; $('reservations-table').replaceChildren(); $('invitations-table').replaceChildren(); $('team-workspace').hidden = true; $('team-login').hidden = false; $('team-password').focus(); });
  $('decrease').addEventListener('click', () => { $('ticket-count').value = Math.max(1, count() - 1); refreshPreview(true); });
  $('increase').addEventListener('click', () => { $('ticket-count').value = Math.min(20, count() + 1); refreshPreview(true); });
  $('ticket-count').addEventListener('change', () => refreshPreview(true));
  form.querySelectorAll('[name=distribution]').forEach(input => input.addEventListener('change', () => refreshPreview(true)));
  $('recipient-fields').addEventListener('input', () => refreshPreview());
  form.addEventListener('submit', async event => {
    event.preventDefault(); T.message('generator-error', '');
    await T.busy(event.submitter, async () => {
      try {
        await ensurePerformances();
        const inviter = $('inviter').value.trim();
        const result = await T.api('issue', { session, inviter, tickets: Number($('ticket-count').value), distribution: distribution(), recipients: Array.from($('recipient-fields').querySelectorAll('input'), i => i.value.trim()), requestId: issueId });
        issued = result.invitations; issueId = T.uid();
        sessionStorage.setItem('shadows-inviter', inviter);
        $('issued-cards').innerHTML = issued.map((i, index) => {
          const draft = InvitationCards.emailDraft(i), e = T.escape;
          return `<section>${InvitationCards.card(i)}<details class="email-invitation"><summary>email this invitation</summary><form class="email-draft-form" data-invitation="${index}"><label for="email-to-${index}">to</label><input type="email" id="email-to-${index}" name="recipient" required maxlength="254" autocomplete="email"><label for="email-subject-${index}">subject</label><input id="email-subject-${index}" name="subject" required value="${e(draft.subject)}"><label for="email-body-${index}">message</label><textarea id="email-body-${index}" name="body" rows="16" required>${e(draft.body)}</textarea><div class="button-row"><button type="submit">open email draft</button><button type="button" data-copy-email>copy message</button></div><p class="email-draft-status" role="status">Review this complete draft. It opens in your email app for you to send.</p></form></details></section>`;
        }).join('');
        $('issued-cards').querySelectorAll('.email-draft-form').forEach(emailForm => {
          emailForm.addEventListener('submit', event => {
            event.preventDefault();
            const recipient = emailForm.elements.recipient.value.trim();
            const subject = emailForm.elements.subject.value;
            const body = emailForm.elements.body.value;
            const link = document.createElement('a');
            link.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            document.body.append(link); link.click(); link.remove();
            emailForm.querySelector('.email-draft-status').textContent = 'Finish reviewing and send from your email app. Nothing was sent by this website.';
          });
          emailForm.querySelector('[data-copy-email]').addEventListener('click', async () => {
            try { await T.copy(`To: ${emailForm.elements.recipient.value}\nSubject: ${emailForm.elements.subject.value}\n\n${emailForm.elements.body.value}`); emailForm.querySelector('.email-draft-status').textContent = 'Draft copied. Nothing has been sent.'; }
            catch (error) { emailForm.querySelector('.email-draft-status').textContent = error.message; }
          });
        });
        $('generated-results').hidden = false;
        $('results-title').textContent = `${issued.length === 1 ? 'your invitation is' : 'your invitations are'} ready.`;
        T.message('results-message', T.isPreview ? 'Test invitations. These codes work only in this local preview.' : 'Codes saved.');
        $('generated-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) { T.message('generator-error', error.message, true); }
    }, 'generating…');
  });
  $('download-pdf').addEventListener('click', async event => {
    await T.busy(event.currentTarget, async () => {
      try { const bytes = await InvitationCards.createPDF(issued); T.download(new Blob([bytes], { type: 'application/pdf' }), 'shadows-personal-invitations.pdf'); }
      catch (error) { T.message('results-message', error.message, true); }
    }, 'preparing your PDF…');
  });
  $('copy-links').addEventListener('click', async () => {
    try { await T.copy(issued.map(i => `${i.recipient || 'An invitation for you'}\n${i.admissions} ${i.admissions === 1 ? 'entry' : 'entries'}\nGo to ${T.publicBase()}/reserve and enter: ${i.code}`).join('\n\n')); T.message('results-message', 'Codes copied.'); }
    catch (error) { T.message('results-message', error.message, true); }
  });
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', async () => {
    const isDashboard = button.dataset.tab === 'dashboard';
    $('generate-view').hidden = isDashboard; $('dashboard-view').hidden = !isDashboard;
    document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    if (isDashboard) await loadDashboard();
  }));
  async function loadDashboard() {
    T.message('dashboard-error', '');
    try {
      dashboard = await T.api('dashboard', { session });
      InvitationCards.setPerformances(dashboard.performances);
      if (dashboard.sheetWarning) T.message('dashboard-error', dashboard.sheetWarning, true);
      renderDashboard();
    } catch (error) { T.message('dashboard-error', error.message, true); }
  }
  function renderDashboard() {
    $('performance-stats').innerHTML = dashboard.performances.map(p => `<section class="stat-card"><p class="stat-date">${T.escape(p.label)}</p><p class="stat-number">${p.reserved}<span class="stat-caption"> / ${p.capacity}</span></p><p class="stat-caption">${p.remaining} places left, ${T.time(p.time)}</p><div class="capacity-track"><span style="width:${Math.min(100, p.reserved / p.capacity * 100)}%"></span></div><form class="performance-editor" data-performance="${p.id}"><label>capacity<input name="capacity" type="number" min="${Math.max(1, p.reserved)}" max="500" value="${p.capacity}" required></label><label>start time<input name="time" type="time" value="${p.time}" required></label><button type="submit" class="secondary">save</button></form></section>`).join('');
    $('performance-stats').querySelectorAll('form').forEach(editor => editor.addEventListener('submit', async event => {
      event.preventDefault();
      await T.busy(event.submitter, async () => {
        try { await T.api('performance', { session, id: editor.dataset.performance, capacity: Number(editor.elements.capacity.value), time: editor.elements.time.value }); await loadDashboard(); }
        catch (error) { T.message('dashboard-error', error.message, true); }
      });
    }));
    renderTables();
  }
  function table(headers, rows) { return rows.length ? `<table><thead><tr>${headers.map(h => `<th scope="col">${T.escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''; }
  function renderTables() {
    if (!dashboard) return;
    const q = $('guest-search').value.trim().toLowerCase();
    const invitations = dashboard.invitations.filter(i => [i.code, i.inviter, i.recipient, i.status].some(v => String(v).toLowerCase().includes(q)));
    const reservations = dashboard.reservations.filter(r => [r.name, r.email, r.code, r.id, r.status, dashboard.invitations.find(i => i.code === r.code)?.inviter].some(v => String(v || '').toLowerCase().includes(q)));
    const e = T.escape;
    $('reservations-table').innerHTML = table(['guest', 'email', 'night', 'people', 'invited by', 'status', 'access / notes'], reservations.map(r => [e(r.name), e(r.email), e(T.formatDate(r.performanceId, { weekday: 'short', month: 'short', day: 'numeric' })), r.admissions, e(dashboard.invitations.find(i => i.code === r.code)?.inviter || ''), `<span class="status-pill ${e(r.status)}">${e(r.status)}</span>`, e(r.accessNeeds)]));
    $('invitations-table').innerHTML = table(['code', 'invited by', 'for', 'admissions', 'status', ''], invitations.map(i => [e(i.code), e(i.inviter), e(i.recipient || '—'), i.admissions, `<span class="status-pill ${e(i.status)}">${e(i.status)}</span>`, i.status === 'issued' ? `<button class="text-button" data-void="${e(i.code)}" type="button">void</button>` : '']));
    $('invitations-table').querySelectorAll('[data-void]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm(`Void invitation ${button.dataset.void}? It will no longer be redeemable.`)) return;
      await T.busy(button, async () => { try { await T.api('void', { session, code: button.dataset.void }); await loadDashboard(); } catch (error) { T.message('dashboard-error', error.message, true); } });
    }));
  }
  $('guest-search').addEventListener('input', renderTables);
  $('refresh-dashboard').addEventListener('click', event => T.busy(event.currentTarget, loadDashboard));
  $('export-guests').addEventListener('click', () => {
    if (!dashboard) return;
    const rows = [['Booking reference', 'Name', 'Email', 'Performance', 'Start time (Pacific)', 'Admissions', 'Status', 'Invited by', 'Code', 'Access requests', 'Email status'], ...dashboard.reservations.map(r => [r.id, r.name, r.email, r.performanceId, dashboard.performances.find(p => p.id === r.performanceId)?.time, r.admissions, r.status, dashboard.invitations.find(i => i.code === r.code)?.inviter, r.code, r.accessNeeds, 'Not sent'])];
    T.download(new Blob(['\uFEFF' + rows.map(row => row.map(T.csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'shadows-guest-list.csv');
  });
  refreshPreview(true);
  if (session && T.configured) {
    // This expiry check only restores the public generator form. Every write
    // and every guest-list request still verifies the signed session server-side.
    if (Number(session.split('.')[0]) > Date.now()) enter();
    else { sessionStorage.removeItem('shadows-team-session'); session = ''; }
  }
})();
