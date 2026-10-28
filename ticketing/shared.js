(function () {
  'use strict';
  const config = window.SHADOWS_TICKETS;
  const isPreview = window.SHADOWS_LOCAL_PREVIEW === true;
  if (isPreview) document.querySelectorAll('h1').forEach(heading => heading.append(' (preview)'));
  function uid() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); }
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  async function api(action, data = {}) {
    const payload = { ...data, action };
    let result;
    if (isPreview) {
      const response = await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
      if (!response.ok) throw new Error('The invitation desk is unavailable. Please try again.');
      result = await response.json();
    } else {
      if (!config.apiUrl) throw new Error('The invitation desk is being prepared. Reservations are not open yet.');
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.apiUrl)) throw new Error('The invitation desk needs its connection checked.');
      // Form + iframe works with Apps Script's sandbox and redirects without
      // assuming support for cross-origin fetch response headers.
      result = await new Promise((resolve, reject) => {
        const transportId = uid();
        const frame = document.createElement('iframe');
        frame.name = `shadows-${transportId}`;
        frame.hidden = true;
        frame.title = 'Saving your invitation request';
        const form = document.createElement('form');
        form.method = 'POST'; form.action = config.apiUrl; form.target = frame.name; form.hidden = true;
        const field = document.createElement('input');
        field.name = 'payload'; field.value = JSON.stringify({ ...payload, transportId });
        form.append(field);
        function clean() { clearTimeout(timer); window.removeEventListener('message', listener); form.remove(); frame.remove(); }
        function listener(event) {
          const trusted = event.origin === 'https://script.google.com' || /^https:\/\/[a-zA-Z0-9-]+\.googleusercontent\.com$/.test(event.origin);
          if (!trusted || !event.data || event.data.source !== 'shadows-tickets' || event.data.transportId !== transportId) return;
          clean(); resolve(event.data.result);
        }
        const timer = setTimeout(() => { clean(); reject(new Error('The forest is taking a moment. Please try again; repeating this request will not create a duplicate booking.')); }, 60000);
        window.addEventListener('message', listener);
        document.body.append(frame, form); form.submit();
      });
    }
    if (!result || result.ok !== true) {
      const error = new Error(result?.message || 'Something went wrong. Please try again.');
      error.code = result?.code; throw error;
    }
    return result;
  }
  function message(id, value, error = false) {
    const node = typeof id === 'string' ? document.getElementById(id) : id;
    node.textContent = value || ''; node.hidden = !value; node.classList.toggle('error', error);
  }
  async function busy(button, callback, label = 'one moment…') {
    const previous = button.innerHTML; button.disabled = true; button.textContent = label;
    try { return await callback(); } finally { button.disabled = false; button.innerHTML = previous; }
  }
  function time(value) {
    const [hours, minutes] = value.split(':').map(Number);
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'pm' : 'am'}`;
  }
  function formatDate(id, options) { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', ...options }).format(new Date(`${id}T12:00:00-08:00`)); }
  function closed(performance) { return Date.parse(`${performance.id}T${performance.time}:00-08:00`) <= Date.now(); }
  function performanceOptions(node, performances, admissions, name, selected, current) {
    node.innerHTML = performances.map(p => {
      const left = p.remaining + (p.id === current ? admissions : 0);
      const ended = closed(p), full = left < admissions;
      return `<label class="night-option"><input type="radio" name="${escape(name)}" value="${escape(p.id)}" required ${ended || full ? 'disabled' : ''} ${selected === p.id ? 'checked' : ''}><span class="performance-description">${escape(p.label)} · ${escape(time(p.time))} Pacific<span class="availability">${ended ? 'closed' : full ? (left === 0 ? 'full' : 'not enough places for your group') : `${left} places available`}</span></span></label>`;
    }).join('');
  }
  function publicBase() { return isPreview ? window.location.origin : config.publicUrl.replace(/\/$/, ''); }
  function download(blob, name) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); }
    catch { const field = document.createElement('textarea'); field.value = value; document.body.append(field); field.select(); const copied = document.execCommand('copy'); field.remove(); if (!copied) throw new Error('Please select and copy the link above.'); }
  }
  function csvCell(value) { const s = String(value ?? ''); return '"' + (/^\s*[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; }
  window.Tickets = { api, uid, escape, message, busy, time, formatDate, performanceOptions, closed, publicBase, download, copy, csvCell, isPreview, configured: isPreview || Boolean(config.apiUrl) };
})();
