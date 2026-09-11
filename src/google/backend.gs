const GOOGLE_CONFIG_ = Object.freeze({
  spreadsheetId: '1-nk-U7L0qWkKvYBhg2bpnppTV6vNw2r16ZOoH9H9b74',
  sheetName: 'Sheet1',
  acceptingResponses: true,
  sessionSeconds: 1800,
  maxPerSessionMinute: 5,
  maxNewPerMinute: 30
});

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Personnel Information Update | NRCO')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getFormSession() {
  try {
    if (!GOOGLE_CONFIG_.acceptingResponses) return { ok: false, code: 'CLOSED', message: 'This form is not accepting submissions.' };
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    const expiresAt = Date.now() + GOOGLE_CONFIG_.sessionSeconds * 1000;
    CacheService.getScriptCache().put('nrco:session:' + token, JSON.stringify({ expiresAt }), GOOGLE_CONFIG_.sessionSeconds);
    return { ok: true, token, expiresAt };
  } catch (_) {
    return { ok: false, code: 'SERVICE_UNAVAILABLE', message: 'The form could not connect. Please try again later.' };
  }
}

function submitPersonnel(request) {
  try {
    if (!GOOGLE_CONFIG_.acceptingResponses) return { ok: false, code: 'CLOSED', message: 'This form is not accepting submissions.' };
    if (!isPlainRecord_(request) || Object.keys(request).some(k => !['requestId', 'token', 'website', 'data'].includes(k)) ||
        typeof request.requestId !== 'string' || !REQUEST_ID.test(request.requestId) ||
        typeof request.token !== 'string' || !/^[a-f0-9]{64}$/i.test(request.token) || request.website !== '' ||
        JSON.stringify(request).length > 8192) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'Use the form page to send your information.' };
    }
    const validation = validateSubmission_(request.data);
    if (!validation.ok) return { ok: false, code: 'VALIDATION', message: 'Please check the highlighted fields.', errors: validation.errors };
    return saveSubmission_(validation.data, request.requestId, request.token);
  } catch (error) {
    const messages = {
      SESSION_EXPIRED: 'Your session expired. Refresh the connection below; your entries will stay here.',
      RETRY_LATER: 'The form is busy. Wait one minute and retry with the same information.',
      IDEMPOTENCY_CONFLICT: 'This reference was used for different information. Check your entries before starting a new response.'
    };
    const code = Object.prototype.hasOwnProperty.call(messages, error.message) ? error.message : 'SERVICE_UNAVAILABLE';
    return { ok: false, code, message: messages[code] || 'We could not confirm that your information was saved. Keep this page open and retry with the same information.' };
  }
}

function hex_(bytes) { return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join(''); }
function generateSubmissionId_(requestId) {
  // Same deterministic identifier as the previous receiver; independent of sessions.
  return 'NRCO-' + hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'nrco:v1:' + requestId.toLowerCase(), Utilities.Charset.UTF_8)).slice(0, 32);
}
function getSheet_() {
  const sheet = SpreadsheetApp.openById(GOOGLE_CONFIG_.spreadsheetId).getSheetByName(GOOGLE_CONFIG_.sheetName);
  if (!sheet) throw new Error('SHEET_NOT_FOUND');
  return sheet;
}
function assertHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (JSON.stringify(current) !== JSON.stringify(HEADERS)) throw new Error('HEADER_MISMATCH');
}
function checkDuplicate_(data, rows) {
  return rows.find(row => String(row[7] || '').trim().toLowerCase() === data.email.toLowerCase() ||
    canonicalPhone_(String(row[8] || '').replace(/[ ()-]/g, '')) === canonicalPhone_(data.contactNumber));
}
function sameSubmission_(data, row) {
  return FIELD_NAMES.every((name, index) => String(row[index + 2] ?? '') === data[name]);
}
function assertSession_(cache, token) {
  const stored = cache.get('nrco:session:' + token);
  const session = stored ? JSON.parse(stored) : null;
  if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) throw new Error('SESSION_EXPIRED');
}
function throttleNewRecord_(cache, token) {

  const minute = Math.floor(Date.now() / 60000);
  const keys = ['nrco:new:' + minute, 'nrco:new:' + minute + ':' + token];
  const counts = keys.map(key => Number(cache.get(key) || 0));
  if (counts[0] >= GOOGLE_CONFIG_.maxNewPerMinute || counts[1] >= GOOGLE_CONFIG_.maxPerSessionMinute) throw new Error('RETRY_LATER');
  keys.forEach((key, index) => cache.put(key, String(counts[index] + 1), 120));
}
function saveSubmission_(data, requestId, token) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('RETRY_LATER');
  try {
    const cache = CacheService.getScriptCache();
    assertSession_(cache, token);
    const sheet = getSheet_(); assertHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues() : [];
    const id = generateSubmissionId_(requestId);
    const saved = rows.find(row => row[0] === id);
    if (saved) {
      if (!sameSubmission_(data, saved)) throw new Error('IDEMPOTENCY_CONFLICT');
      return { ok: true, submissionId: id, timestamp: saved[1] };
    }
    throttleNewRecord_(cache, token);
    const duplicate = checkDuplicate_(data, rows);
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', "yyyy-MM-dd'T'HH:mm:ss") + '+08:00';
    const row = [id, timestamp].concat(FIELD_NAMES.map(name => data[name]), [duplicate ? 'Needs review' : 'Received', duplicate ? duplicate[0] : '']);
    if (lastRow + 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
    const escaped = "'" + GOOGLE_CONFIG_.sheetName.replace(/'/g, "''") + "'";
    const target = escaped + '!A' + (lastRow + 1) + ':L' + (lastRow + 1);

    const write = Sheets.Spreadsheets.Values.update({ majorDimension: 'ROWS', values: [row] }, GOOGLE_CONFIG_.spreadsheetId, target, { valueInputOption: 'RAW' });
    if (write.updatedRows !== 1) throw new Error('WRITE_NOT_CONFIRMED');
    const confirm = Sheets.Spreadsheets.Values.get(GOOGLE_CONFIG_.spreadsheetId, target, { valueRenderOption: 'UNFORMATTED_VALUE' });
    const recorded = confirm.values && confirm.values[0];
    if (!recorded || row.some((value, i) => String(recorded[i] ?? '') !== value)) throw new Error('WRITE_NOT_CONFIRMED');

    return { ok: true, submissionId: id, timestamp };
  } finally { lock.releaseLock(); }
}

function setupSheet() {

  let active;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (_) { /* Not an editor context. */ }
  if (!active || active.getId() !== GOOGLE_CONFIG_.spreadsheetId) {
    throw new Error('Open the destination spreadsheet, choose Extensions > Apps Script, and run setupSheet from that editor.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('RETRY_LATER');
  try {
    const sheet = getSheet_();
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    assertHeaders_(sheet);
    // Verify the advanced Sheets service and authorization without inserting data.
    Sheets.Spreadsheets.Values.get(GOOGLE_CONFIG_.spreadsheetId, "'Sheet1'!A1:L1");
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#172d4b').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    sheet.setRowHeight(1, 48);
    if (sheet.getMaxRows() < 2) sheet.insertRowsAfter(1, 100);
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, HEADERS.length).setNumberFormat('@');
    if (!sheet.getFilter()) sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).createFilter();
    console.log('Setup complete. No personnel records were inserted. Deploy as a web app and open the /exec URL.');
  } finally { lock.releaseLock(); }
}
