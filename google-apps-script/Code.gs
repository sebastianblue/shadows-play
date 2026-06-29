/**
 * Google Apps Script endpoint for the We're Still Seeing Shadows interest form.
 * Bind this script to the Google Sheet that should receive responses.
 */

const SETTINGS = Object.freeze({
  SHEET_NAME: 'Responses',
  FORM_KEY: 'shadows-2026', // Must match config.js
  NOTIFICATION_EMAIL: 'shochman@stanford.edu'   // Emailed on each new response
});

const HEADERS = [
  'Server Timestamp',
  'Name',
  'Email',
  'Phone',
  'Pronouns',
  'Affiliation / Year',
  'Location',
  'Portfolio',
  'Primary Role',
  'All Roles',
  'Other Role',
  'Leadership Experience',
  'Collaboration Approach',
  'Weekly Commitment',
  'Design Experience',
  'Design Tools',
  'Design Portfolio',
  'Site-Specific Experience',
  'Puppetry / Movement / Intimacy Experience',
  'Consent & Trust Approach',
  'Fabrication Skills',
  'Build Availability',
  'Operator Experience',
  'QLab Experience',
  'Console Experience',
  'Marketing / Photography / Graphic Experience',
  'Communications Tools',
  'House / Audience Experience',
  'Additional Experience',
  'Date Availability',
  'General Availability',
  'Conflicts',
  'Why Interested',
  'Referral Source',
  'Access Needs',
  'Follow-up Status',
  'Internal Notes',
  'Raw JSON'
];

function setupSheet() {
  const sheet = getResponseSheet_();
  ensureHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#10382f')
    .setFontColor('#f0ead8');
  sheet.autoResizeColumns(1, Math.min(HEADERS.length, 12));
  sheet.setColumnWidth(30, 480); // Date availability
  sheet.setColumnWidth(38, 500); // Raw JSON
}

function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><title>Shadows Form Endpoint</title>' +
    '<body style="font-family:monospace;background:#10382f;color:#f0ead8;padding:40px">' +
    '<h1>Shadows form endpoint is active.</h1><p>Responses should be sent with POST requests.</p></body>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    const formKey = String((e && e.parameter && e.parameter.formKey) || '');
    if (SETTINGS.FORM_KEY && formKey !== SETTINGS.FORM_KEY) {
      throw new Error('Form key did not match.');
    }

    const raw = String((e && e.parameter && e.parameter.payload) || '');
    if (!raw) throw new Error('No response payload was received.');

    const data = JSON.parse(raw);

    // Honeypot: bots often fill hidden fields. Return success without storing the spam.
    if (data.website) return responsePage_('success', 'Response received.');

    validate_(data);

    lock.waitLock(15000);
    const sheet = getResponseSheet_();
    ensureHeaders_(sheet);

    const experience = data.experience || {};
    const dateAvailability = (data.availability || [])
      .map(item => `${item.date} — ${item.event} [${item.importance}]: ${item.response}`)
      .join('\n');

    sheet.appendRow([
      new Date(),
      safe_(data.fullName),
      safe_(data.email),
      safe_(data.phone),
      safe_(data.pronouns),
      safe_(data.affiliation),
      safe_(data.location),
      safe_(data.portfolioUrl),
      safe_(data.primaryRoleLabel),
      (data.roleLabels || []).join(', '),
      safe_(data.otherRole),
      safe_(experience.leadershipExperience),
      safe_(experience.collaborationApproach),
      safe_(experience.weeklyCommitment),
      safe_(experience.designExperience),
      safe_(experience.designTools),
      safe_(experience.designPortfolioUrl),
      safe_(experience.siteSpecificExperience),
      safe_(experience.practiceExperience),
      safe_(experience.consentApproach),
      safe_(experience.fabricationSkills),
      safe_(experience.buildAvailability),
      safe_(experience.operatorExperience),
      safe_(experience.qlabExperience),
      safe_(experience.consoleExperience),
      safe_(experience.communicationsExperience),
      safe_(experience.communicationsTools),
      safe_(experience.audienceExperience),
      safe_(experience.additionalExperience),
      dateAvailability,
      (data.generalAvailability || []).join(', '),
      safe_(data.conflicts),
      safe_(data.whyInterested),
      safe_(data.referralSource),
      safe_(data.accessNeeds),
      'New',
      '',
      raw
    ]);

    SpreadsheetApp.flush();

    if (SETTINGS.NOTIFICATION_EMAIL) {
      MailApp.sendEmail({
        to: SETTINGS.NOTIFICATION_EMAIL,
        subject: `New Shadows interest form: ${safe_(data.fullName)}`,
        body: [
          `Name: ${safe_(data.fullName)}`,
          `Email: ${safe_(data.email)}`,
          `Primary role: ${safe_(data.primaryRoleLabel)}`,
          `All roles: ${(data.roleLabels || []).join(', ')}`,
          '',
          'Open the response spreadsheet to review the full submission.'
        ].join('\n')
      });
    }

    return responsePage_('success', 'Response saved.');
  } catch (error) {
    console.error(error);
    return responsePage_('error', error && error.message ? error.message : 'Submission failed.');
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function getResponseSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SETTINGS.SHEET_NAME) || spreadsheet.insertSheet(SETTINGS.SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => existing[index] !== header);
  if (needsHeaders) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function validate_(data) {
  if (!data.fullName) throw new Error('Name is required.');
  if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) throw new Error('A valid email is required.');
  if (!Array.isArray(data.roles) || data.roles.length === 0) throw new Error('At least one role is required.');
  if (!data.primaryRole) throw new Error('A first-choice role is required.');
  if (!data.consent) throw new Error('Consent is required.');
}

function safe_(value) {
  const text = value == null ? '' : String(value);
  // Prevent formulas from being evaluated when arbitrary user text enters a sheet.
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function responsePage_(type, message) {
  const payload = JSON.stringify({
    source: 'shadows-interest-form',
    type: type,
    message: message
  });

  const visibleMessage = String(message || '').replace(/[&<>"']/g, function(char) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char];
  });

  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><body style="font-family:monospace">' +
    '<p>' + visibleMessage + '</p>' +
    '<script>window.top.postMessage(' + payload + ', "*");</script>' +
    '</body>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
