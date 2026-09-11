const DESIGNATIONS = Object.freeze([
  'Undersecretary', 'Assistant Secretary', 'Director IV', 'Executive Assistant III',
  'Chief Labor and Employment Officer', 'Supervising Labor and Employment Officer',
  'Senior Labor and Employment Officer', 'Labor and Employment Officer III',
  'Labor and Employment Officer II', 'Labor and Employment Officer I',
  'Administrative Assistant V', 'Administrative Assistant III', 'Administrative Aide IV',
  'Highly Technical Staff', 'Technical Staff'
]);
const OFFICES = Object.freeze([
  'Office of the Assistant Secretary for Reintegration Services',
  'National Reintegration Center for OFWs - Office of the Director',
  'Electronic Reintegration Services Division', 'Partnership and Program Development Division',
  'Policy, Planning, and Technical Support Division', 'Program Development Unit'
]);
const SIZES = Object.freeze(['S', 'M', 'L', 'XL', 'XXL', 'XXXL']);
const FIELD_NAMES = Object.freeze(['firstName', 'middleName', 'lastName', 'designation', 'office', 'email', 'contactNumber', 'shirtSize']);
const HEADERS = Object.freeze(['Submission ID', 'Timestamp', 'First Name', 'Middle Name', 'Last Name', 'Designation', 'Office', 'Email Address', 'Contact Number', 'Shirt Size', 'Submission Status', 'Duplicate Of']);
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORD_ID = /^NRCO-[0-9a-f]{32}$/;
function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sanitizeInput(value) { return value.trim().replace(/\s+/gu, ' '); }
function canonicalPhone(value) { return value.replace(/^0/, '+63'); }
function validateSubmission(input) {
  const errors = {};
  const data = {};
  if (!isPlainRecord(input) || Object.keys(input).some(key => !FIELD_NAMES.includes(key))) {
    return { ok: false, data: null, errors: { form: 'The request contains unexpected fields.' } };
  }
  for (const name of FIELD_NAMES) {
    const value = input[name];
    if (value === undefined || value === null) {
      errors[name] = 'This field is required.'; continue;
    }
    const max = name === 'email' ? 254 : name === 'office' ? 160 : name === 'contactNumber' ? 32 : 100;
    if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f]/.test(value)) {
      errors[name] = 'Enter a valid value within the field length limit.'; continue;
    }
    const text = name === 'email' ? value.trim() : sanitizeInput(value);
    data[name] = text;
    if (!text) errors[name] = 'This field is required.';
  }
  if (data.designation && !DESIGNATIONS.includes(data.designation)) errors.designation = 'Select a designation from the list.';
  if (data.office && !OFFICES.includes(data.office)) errors.office = 'Select an office from the list.';
  if (data.shirtSize && !SIZES.includes(data.shirtSize)) errors.shirtSize = 'Select a shirt size from the list.';
  if (data.email && (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(data.email) || data.email.includes('..'))) {
    errors.email = 'Enter a valid email address.';
  }
  if (data.contactNumber) {
    const phone = data.contactNumber.replace(/[ ()-]/g, '');
    if (!/^(?:09\d{9}|\+639\d{9})$/.test(phone)) {
      errors.contactNumber = 'Use a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX.';
    } else data.contactNumber = phone;
  }
  return { ok: Object.keys(errors).length === 0, data, errors };
}

// Build source. Paste the generated Code.gs into Apps Script, NOT this partial source file.
function getConfig_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  if (!properties.SPREADSHEET_ID || !properties.SHEET_NAME || !/^[0-9a-f]{64}$/i.test(properties.RELAY_SECRET || '')) {
    throw new Error('NOT_CONFIGURED');
  }
  return properties;
}
function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
function hex_(bytes) { return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join(''); }
function constantTimeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function verifyEnvelope_(envelope, config) {
  if (!isPlainRecord(envelope) || Object.keys(envelope).some(k => !['version', 'issuedAt', 'requestId', 'payload', 'signature'].includes(k)) ||
      envelope.version !== 1 || !Number.isSafeInteger(envelope.issuedAt) || Math.abs(Date.now() - envelope.issuedAt) > 300000 ||
      typeof envelope.requestId !== 'string' || !REQUEST_ID.test(envelope.requestId) ||
      typeof envelope.payload !== 'string' || envelope.payload.length > 4096 || !/^[0-9a-f]{64}$/.test(envelope.signature || '')) {
    throw new Error('INVALID_REQUEST');
  }
  const message = 'v1\n' + envelope.issuedAt + '\n' + envelope.requestId + '\n' + envelope.payload;
  const expected = hex_(Utilities.computeHmacSha256Signature(message, config.RELAY_SECRET, Utilities.Charset.UTF_8));
  if (!constantTimeEqual_(expected, envelope.signature)) throw new Error('INVALID_REQUEST');
  const result = validateSubmission(JSON.parse(envelope.payload));
  if (!result.ok) throw new Error('INVALID_REQUEST');
  return result.data;
}
function generateSubmissionId(requestId) {
  // Stable server-derived ID: retries remain idempotent, even after relay-secret rotation.
  return 'NRCO-' + hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'nrco:v1:' + requestId.toLowerCase(), Utilities.Charset.UTF_8)).slice(0, 32);
}
function getSheet_(config) {
  const spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(config.SHEET_NAME);
  if (!sheet) throw new Error('SHEET_NOT_FOUND');
  return sheet;
}
function assertHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (JSON.stringify(current) !== JSON.stringify(HEADERS)) throw new Error('HEADER_MISMATCH');
}
function checkDuplicate(data, rows) {
  return rows.find(row => String(row[7]).trim().toLowerCase() === data.email.toLowerCase() ||
    canonicalPhone(String(row[8]).replace(/[ ()-]/g, '')) === canonicalPhone(data.contactNumber));
}
function sameSubmission_(data, row) {
  return FIELD_NAMES.every((name, index) => String(row[index + 2]) === data[name]);
}
function saveSubmission(data, requestId, config) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('RETRY_LATER');
  try {
    const sheet = getSheet_(config); assertHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues() : [];
    const id = generateSubmissionId(requestId);
    const saved = rows.find(row => row[0] === id);
    if (saved) {
      if (!sameSubmission_(data, saved)) throw new Error('IDEMPOTENCY_CONFLICT');
      return { ok: true, requestId, submissionId: id, timestamp: saved[1] };
    }
    const duplicate = checkDuplicate(data, rows);
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', "yyyy-MM-dd'T'HH:mm:ss") + '+08:00';
    const row = [id, timestamp].concat(FIELD_NAMES.map(name => data[name]), [duplicate ? 'Needs review' : 'Received', duplicate ? duplicate[0] : '']);
    if (lastRow + 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
    const escaped = "'" + config.SHEET_NAME.replace(/'/g, "''") + "'";
    const target = escaped + '!A' + (lastRow + 1) + ':L' + (lastRow + 1);
    // RAW writes strings literally: leading 0/+, capitalization and formula-like text stay text.
    // This single write stores the ID and all fields together. Never use USER_ENTERED here.
    const write = Sheets.Spreadsheets.Values.update({ majorDimension: 'ROWS', values: [row] }, config.SPREADSHEET_ID, target, { valueInputOption: 'RAW' });
    if (write.updatedRows !== 1) throw new Error('WRITE_NOT_CONFIRMED');
    const confirm = Sheets.Spreadsheets.Values.get(config.SPREADSHEET_ID, target, { valueRenderOption: 'UNFORMATTED_VALUE' });
    const recorded = confirm.values && confirm.values[0];
    if (!recorded || row.some((value, index) => String(recorded[index] ?? '') !== value)) throw new Error('WRITE_NOT_CONFIRMED');
    return { ok: true, requestId, submissionId: id, timestamp };
  } finally { lock.releaseLock(); }
}
function doPost(e) {
  try {
    if (!e || !e.postData || e.postData.type !== 'application/json' || e.postData.contents.length > 8192) throw new Error('INVALID_REQUEST');
    const config = getConfig_();
    const envelope = JSON.parse(e.postData.contents);
    const data = verifyEnvelope_(envelope, config);
    return json_(saveSubmission(data, envelope.requestId, config));
  } catch (error) {
    const exposed = ['INVALID_REQUEST', 'IDEMPOTENCY_CONFLICT', 'RETRY_LATER'];
    return json_({ ok: false, code: exposed.includes(error.message) ? error.message : 'SERVICE_UNAVAILABLE' });
  }
}
function doGet() { return json_({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
function setupSheet() {
  const config = getConfig_(); const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('RETRY_LATER');
  try {
    const sheet = getSheet_(config);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    assertHeaders_(sheet); // Refuse to overwrite a mismatched header or existing records.
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#17354b').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
    sheet.setRowHeight(1, 48);
    sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), HEADERS.length).setNumberFormat('@');
    sheet.setColumnWidths(1, HEADERS.length, 180);
    sheet.setColumnWidth(1, 330); sheet.setColumnWidth(2, 235); sheet.setColumnWidth(6, 300); sheet.setColumnWidth(7, 430);
    sheet.setColumnWidth(8, 250); sheet.setColumnWidth(10, 100); sheet.setColumnWidth(12, 330);
    if (!sheet.getFilter()) sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).createFilter();
  } finally { lock.releaseLock(); }
}
