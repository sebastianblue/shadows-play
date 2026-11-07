(function () {
  'use strict';
  const T = Tickets, $ = id => document.getElementById(id);
  let session = sessionStorage.getItem('shadows-team-session') || '';
  let issued = [], dashboard = null, issueId = T.uid(), performanceRequest = null;
  let teamNames = [], matchingNames = [], activeName = -1;
  let recipientDrafts = { separate: [], together: [] }, lastDistribution = 'separate';
  const form = $('generator-form');
  const inviterInput = $('inviter');
  const nameOptions = $('team-names');
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const tableSort = {};
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
  function setTeamNames(names) {
    teamNames = names;
    matchingNames = [];
    nameOptions.replaceChildren();
    closeNameOptions();
    inviterInput.disabled = $('generate-button').disabled = names.length === 0;
  }
  function closeNameOptions() {
    nameOptions.hidden = true;
    activeName = -1;
    inviterInput.setAttribute('aria-expanded', 'false');
    inviterInput.removeAttribute('aria-activedescendant');
  }
  function searchName(value) { return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase(); }
  function showNameOptions() {
    closeNameOptions();
    const words = searchName(inviterInput.value).split(/\s+/);
    matchingNames = teamNames.filter(name => words.every(word => searchName(name).includes(word)));
    nameOptions.innerHTML = matchingNames.map((name, index) => `<li id="team-name-${index}" role="option" aria-selected="false" data-name-index="${index}">${T.escape(name)}</li>`).join('');
    nameOptions.hidden = matchingNames.length === 0;
    inviterInput.setAttribute('aria-expanded', String(!nameOptions.hidden));
  }
  function selectName(index) {
    inviterInput.value = matchingNames[index];
    inviterInput.setCustomValidity('');
    closeNameOptions();
  }
  function enter(names) {
    $('team-login').hidden = true; $('team-workspace').hidden = false;
    inviterInput.value = sessionStorage.getItem('shadows-inviter') || '';
    inviterInput.setCustomValidity('');
    refreshPreview(true);
    const activeSession = session;
    const roster = names ? Promise.resolve(names) : T.api('roster', { session }).then(result => result.teamNames);
    roster.then(list => {
      if (session !== activeSession) return;
      if (!Array.isArray(list) || !list.length) throw new Error('The team name list is empty.');
      setTeamNames(list.slice().sort(collator.compare));
    }).catch(error => {
      if (session === activeSession) T.message('generator-error', `${error.message} Sign out and back in to reload names.`, true);
    });
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
        enter(result.teamNames);
      } catch (error) { T.message('login-error', error.message, true); }
    });
  });
  $('logout').addEventListener('click', () => {
    sessionStorage.removeItem('shadows-team-session'); session = ''; dashboard = null; issued = []; performanceRequest = null;
    setTeamNames([]);
    inviterInput.value = '';
    T.message('generator-error', '');
    $('issued-cards').replaceChildren(); $('generated-results').hidden = true; $('reservations-table').replaceChildren(); $('invitations-table').replaceChildren(); $('team-workspace').hidden = true; $('team-login').hidden = false; $('team-password').focus();
  });
  $('decrease').addEventListener('click', () => { $('ticket-count').value = Math.max(1, count() - 1); refreshPreview(true); });
  $('increase').addEventListener('click', () => { $('ticket-count').value = Math.min(20, count() + 1); refreshPreview(true); });
  $('ticket-count').addEventListener('change', () => refreshPreview(true));
  form.querySelectorAll('[name=distribution]').forEach(input => input.addEventListener('change', () => refreshPreview(true)));
  $('recipient-fields').addEventListener('input', () => refreshPreview());
  inviterInput.addEventListener('input', () => {
    inviterInput.setCustomValidity('');
    showNameOptions();
  });
  inviterInput.addEventListener('focus', showNameOptions);
  inviterInput.addEventListener('blur', closeNameOptions);
  inviterInput.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !nameOptions.hidden) {
      event.preventDefault();
      closeNameOptions();
    }
    if (event.key === 'Enter' && !nameOptions.hidden && (activeName >= 0 || matchingNames.length === 1)) {
      event.preventDefault();
      selectName(Math.max(0, activeName));
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (nameOptions.hidden) showNameOptions();
    if (nameOptions.hidden) return;
    event.preventDefault();
    nameOptions.children[activeName]?.setAttribute('aria-selected', 'false');
    const last = matchingNames.length - 1;
    activeName = event.key === 'ArrowDown' ? Math.min(activeName + 1, last) : activeName <= 0 ? last : activeName - 1;
    const option = nameOptions.children[activeName];
    option.setAttribute('aria-selected', 'true');
    inviterInput.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  });
  nameOptions.addEventListener('mousedown', event => {
    if (event.target.closest('[data-name-index]')) event.preventDefault();
  });
  nameOptions.addEventListener('click', event => {
    const option = event.target.closest('[data-name-index]');
    if (option) selectName(Number(option.dataset.nameIndex));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); T.message('generator-error', '');
    const inviter = teamNames.find(name => name.toLowerCase() === inviterInput.value.trim().toLowerCase());
    if (!inviter) {
      inviterInput.setCustomValidity('Choose your name from the team list.');
      inviterInput.reportValidity();
      return;
    }
    await T.busy(event.submitter, async () => {
      try {
        await ensurePerformances();
        const result = await T.api('issue', { session, inviter, tickets: Number($('ticket-count').value), distribution: distribution(), recipients: Array.from($('recipient-fields').querySelectorAll('input'), i => i.value.trim()), requestId: issueId });
        issueId = T.uid();
        sessionStorage.setItem('shadows-inviter', inviter);
        showInvitations(result.invitations, T.isPreview ? 'Test invitations. These codes work only in this local preview.' : 'Codes saved.');
      } catch (error) { T.message('generator-error', error.message, true); }
    }, 'generating…');
  });
  function showInvitations(invitations, message) {
    issued = invitations;
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
    T.message('results-message', message);
    $('generated-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('download-pdf').addEventListener('click', async event => {
    await T.busy(event.currentTarget, async () => {
      try {
        const invitations = issued;
        const bytes = await InvitationCards.createPDF(invitations);
        T.download(new Blob([bytes], { type: 'application/pdf' }), InvitationCards.filename(invitations));
      }
      catch (error) { T.message('results-message', error.message, true); }
    }, 'preparing your PDF…');
  });
  $('copy-links').addEventListener('click', async () => {
    try { await T.copy(issued.map(i => `${i.recipient || 'An invitation for you'}\n${i.admissions} ${i.admissions === 1 ? 'entry' : 'entries'}\nGo to ${T.publicBase()}/reserve and enter: ${i.code}`).join('\n\n')); T.message('results-message', 'Codes copied.'); }
    catch (error) { T.message('results-message', error.message, true); }
  });
  function showTab(tab) {
    const isDashboard = tab === 'dashboard';
    $('generate-view').hidden = isDashboard; $('dashboard-view').hidden = !isDashboard;
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    showTab(button.dataset.tab);
    if (button.dataset.tab === 'dashboard') loadDashboard();
  }));
  async function loadDashboard() {
    T.message('dashboard-error', '');
    try {
      const activeSession = session;
      const result = await T.api('dashboard', { session });
      if (session !== activeSession) return;
      dashboard = result;
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
  function renderTable(id, columns, rows, actions) {
    const sort = tableSort[id];
    if (sort) {
      const [, key] = columns[sort.column];
      rows.sort((a, b) => sort.direction * collator.compare(a[key] ?? '', b[key] ?? ''));
    }
    const headers = columns.map(([label], index) => {
      const direction = sort?.column === index ? sort.direction : 0;
      const ariaSort = direction ? ` aria-sort="${direction > 0 ? 'ascending' : 'descending'}"` : '';
      const arrow = direction ? `<span aria-hidden="true"> ${direction > 0 ? '↑' : '↓'}</span>` : '';
      return `<th scope="col"${ariaSort}><button type="button" class="text-button" data-sort="${index}">${T.escape(label)}${arrow}</button></th>`;
    });
    if (actions) headers.push('<th scope="col">actions</th>');
    const body = rows.map(row => {
      const cells = columns.map(([, key, format = T.escape]) => `<td>${format(row[key])}</td>`);
      if (actions) cells.push(`<td>${actions(row)}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    });
    $(id).innerHTML = rows.length ? `<table><thead><tr>${headers.join('')}</tr></thead><tbody>${body.join('')}</tbody></table>` : '';
  }
  function renderTables() {
    if (!dashboard) return;
    const q = $('guest-search').value.trim().toLowerCase();
    const matches = values => values.some(value => String(value ?? '').toLowerCase().includes(q));
    const inviters = new Map(dashboard.invitations.map(i => [i.code, i.inviter]));
    const invitations = dashboard.invitations.filter(i => matches([i.code, i.inviter, i.recipient, i.status]));
    const reservations = dashboard.reservations.map(r => ({ ...r, inviter: inviters.get(r.code) })).filter(r => matches([r.name, r.email, r.code, r.id, r.status, r.inviter, r.natureMemory]));
    const e = T.escape;
    const status = value => `<span class="status-pill ${e(value)}">${e(value)}</span>`;
    const date = id => e(T.formatDate(id, { weekday: 'short', month: 'short', day: 'numeric' }));
    renderTable('reservations-table', [
      ['guest', 'name'], ['email', 'email'], ['night', 'performanceId', date], ['people', 'admissions'],
      ['invited by', 'inviter'], ['status', 'status', status], ['access / notes', 'accessNeeds'],
      ['nature memory', 'natureMemory', value => value ? `<div class="guest-memory">${e(value)}</div>` : '']
    ], reservations);
    renderTable('invitations-table', [
      ['code', 'code'], ['invited by', 'inviter'], ['for', 'recipient', value => e(value || '—')],
      ['admissions', 'admissions'], ['status', 'status', status]
    ], invitations, invitation => {
      if (!['issued', 'redeemed'].includes(invitation.status)) return '';
      const code = e(invitation.code);
      const voidButton = invitation.status === 'issued' ? `<button class="text-button" data-void="${code}" type="button">void</button>` : '';
      return `<div class="invitation-actions"><button class="text-button" data-regenerate="${code}" type="button">regenerate</button>${voidButton}</div>`;
    });
  }
  for (const id of ['reservations-table', 'invitations-table']) {
    $(id).addEventListener('click', event => {
      const button = event.target.closest('[data-sort]');
      if (!button) return;
      const column = Number(button.dataset.sort);
      const current = tableSort[id];
      tableSort[id] = { column, direction: current?.column === column ? -current.direction : 1 };
      renderTables();
      $(id).querySelector(`[data-sort="${column}"]`).focus({ preventScroll: true });
    });
  }
  $('invitations-table').addEventListener('click', async event => {
    const button = event.target.closest('[data-regenerate], [data-void]');
    if (!button || !dashboard) return;
    if (button.dataset.regenerate) {
      const invitation = dashboard.invitations.find(i => i.code === button.dataset.regenerate);
      if (!invitation) return;
      InvitationCards.setPerformances(dashboard.performances);
      showTab('generate');
      showInvitations([invitation], 'Using the original invitation code.');
    } else {
      if (!confirm(`Void invitation ${button.dataset.void}? It will no longer be redeemable.`)) return;
      await T.busy(button, async () => { try { await T.api('void', { session, code: button.dataset.void }); await loadDashboard(); } catch (error) { T.message('dashboard-error', error.message, true); } });
    }
  });
  $('guest-search').addEventListener('input', renderTables);
  $('refresh-dashboard').addEventListener('click', event => T.busy(event.currentTarget, loadDashboard));
  $('export-guests').addEventListener('click', () => {
    if (!dashboard) return;
    const rows = [['Booking reference', 'Name', 'Email', 'Performance', 'Start time (Pacific)', 'Admissions', 'Status', 'Invited by', 'Code', 'Access requests', 'Email status', 'Nature memory'], ...dashboard.reservations.map(r => [r.id, r.name, r.email, r.performanceId, dashboard.performances.find(p => p.id === r.performanceId)?.time, r.admissions, r.status, dashboard.invitations.find(i => i.code === r.code)?.inviter, r.code, r.accessNeeds, 'Not sent', r.natureMemory])];
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
