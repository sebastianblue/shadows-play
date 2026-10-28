(function () {
  'use strict';
  const T = window.Tickets;
  const DEER = [
    ' /|        |\\',
    '`__\\\\      //__\'',
    '  ||      ||',
    ' \\__`\\    /\'__/',
    '   `_\\\\  //_\'',
    '   _.,:---;,._',
    '   \\_:     :_/',
    '     |@. .@|',
    '     |     |',
    '      \\.-./',
    '       `-\''
  ];
  let performances = [];
  function setPerformances(value) { performances = value || []; }
  function timeLabel() {
    const times = [...new Set(performances.map(p => p.time))];
    return times.length === 1 ? T.time(times[0]) : times.length === 0 ? '7:30 pm' : 'times listed on the reservation page';
  }
  function card(invitation) {
    const e = T.escape;
    const title = invitation.recipient ? `${invitation.recipient}, join us in the forest` : 'join us in the forest';
    return `<article class="invitation-card" aria-label="Invitation ${e(invitation.code)}"><p class="card-title">${e(title)}</p><p class="card-date">${e(timeLabel())}, November 18, 19 &amp; 20</p><pre class="card-deer" aria-hidden="true">${e(DEER.join('\n'))}</pre><p class="card-admissions">${invitation.admissions} ${invitation.admissions === 1 ? 'entry' : 'entries'}</p><p class="card-instructions">to claim your spot, go to:<br>${e(T.publicBase().replace(/^https?:\/\//, ''))}/reserve<br>and type your special code: <span class="special-code">${e(invitation.code)}</span></p></article>`;
  }
  function emailDraft(invitation) {
    const recipient = invitation.recipient || '';
    const subject = 'an invitation to we’re still seeing shadows';
    const body = [
      ...(T.isPreview ? ['LOCAL PREVIEW — this is a test invitation.', ''] : []),
      recipient ? `${recipient},` : 'Hello,', '', 'join us in the forest.', '',
      'we’re still seeing shadows', `${timeLabel()}, November 18, 19 & 20, 2026`, '',
      `${invitation.admissions} ${invitation.admissions === 1 ? 'entry' : 'entries'}`,
      ...(invitation.admissions > 1 ? ['Everyone on this invitation reserves the same performance.'] : []), '',
      'to claim your spot, go to:', `${T.publicBase()}/reserve`,
      'and type your special code:', invitation.code, '',
      'Choose your night, subject to availability.', '', invitation.inviter
    ].join('\n');
    return { subject, body };
  }
  let fontBytes;
  async function createPDF(invitations) {
    const { PDFDocument, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    if (!fontBytes) {
      const response = await fetch(new URL('../ticketing/assets/SometypeMono.ttf', window.location.href));
      if (!response.ok) throw new Error('The print font could not be loaded. Please try again.');
      fontBytes = await response.arrayBuffer();
    }
    const mono = await pdf.embedFont(fontBytes, { subset: true });
    const glyphs = new Set(mono.getCharacterSet());
    pdf.setTitle('We’re Still Seeing Shadows — invitations');
    pdf.setAuthor('We’re Still Seeing Shadows');
    const green = rgb(39 / 255, 78 / 255, 19 / 255), white = rgb(244 / 255, 245 / 255, 239 / 255), neon = rgb(0, 1, 0);
    // Two 6 × 4.85 inch cards on US Letter, with trim marks outside the artwork.
    const w = 432, h = 349, x = 90, scale = w / 612;
    function centered(page, value, y, size = 20, color = white) {
      if ([...value].some(c => !glyphs.has(c.codePointAt(0)))) throw new Error('A name contains characters Sometype Mono cannot print. Use a name in the Latin alphabet or leave the personalization blank.');
      size *= scale;
      while (mono.widthOfTextAtSize(value, size) > w - 28 && size > 5) size -= .25;
      page.drawText(value, { x: (612 - mono.widthOfTextAtSize(value, size)) / 2, y, size, font: mono, color });
    }
    let page;
    for (let index = 0; index < invitations.length; index++) {
      if (index % 2 === 0) page = pdf.addPage([612, 792]);
      const inv = invitations[index], y = index % 2 === 0 ? 403 : 40;
      const fromTop = pixel => y + h - pixel * scale;
      page.drawRectangle({ x, y, width: w, height: h, color: green });
      centered(page, inv.recipient ? `${inv.recipient}, join us in the forest` : 'join us in the forest', fromTop(40));
      centered(page, `${timeLabel()}, November 18, 19 & 20`, fromTop(92));
      const deerSize = 14 * scale, deerWidth = mono.widthOfTextAtSize(DEER[1], deerSize);
      DEER.forEach((line, row) => page.drawText(line, { x: (612 - deerWidth) / 2, y: fromTop(140 + row * 16), size: deerSize, font: mono, color: neon }));
      centered(page, `${inv.admissions} ${inv.admissions === 1 ? 'entry' : 'entries'}`, fromTop(354));
      centered(page, 'to claim your spot, go to:', fromTop(405));
      centered(page, `${T.publicBase().replace(/^https?:\/\//, '')}/reserve`, fromTop(432));
      const finalLine = `and type your special code: ${inv.code}`;
      const fullSize = 20 * scale;
      if (mono.widthOfTextAtSize(finalLine, fullSize) <= w - 28) centered(page, finalLine, fromTop(459));
      else { centered(page, 'and type your special code:', fromTop(459), 17); centered(page, inv.code, fromTop(484), 17); }
      for (const cx of [x, x + w]) for (const cy of [y, y + h]) {
        const dx = cx === x ? -1 : 1, dy = cy === y ? -1 : 1;
        page.drawLine({ start: { x: cx + dx * 2, y: cy }, end: { x: cx + dx * 6, y: cy }, color: green, thickness: .4 });
        page.drawLine({ start: { x: cx, y: cy + dy * 2 }, end: { x: cx, y: cy + dy * 6 }, color: green, thickness: .4 });
      }
      if (T.isPreview) page.drawText('LOCAL PREVIEW ONLY', { x, y: y - 10, size: 5, font: mono, color: green });
    }
    return pdf.save();
  }
  window.InvitationCards = { card, createPDF, setPerformances, emailDraft };
})();
