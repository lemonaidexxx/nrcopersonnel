// Shared by the browser, Worker, and generated Apps Script. Never trust the browser alone.
export const DESIGNATIONS = Object.freeze([
  'Undersecretary', 'Assistant Secretary', 'Director IV', 'Executive Assistant III',
  'Chief Labor and Employment Officer', 'Supervising Labor and Employment Officer',
  'Senior Labor and Employment Officer', 'Labor and Employment Officer III',
  'Labor and Employment Officer II', 'Labor and Employment Officer I',
  'Administrative Assistant V', 'Administrative Assistant III', 'Administrative Aide IV',
  'Highly Technical Staff', 'Technical Staff'
]);
export const OFFICES = Object.freeze([
  'Office of the Assistant Secretary for Reintegration Services',
  'National Reintegration Center for OFWs - Office of the Director',
  'Electronic Reintegration Services Division', 'Partnership and Program Development Division',
  'Policy, Planning, and Technical Support Division', 'Program Development Unit'
]);
export const SIZES = Object.freeze(['S', 'M', 'L', 'XL', 'XXL', 'XXXL']);
export const FIELD_NAMES = Object.freeze(['firstName', 'middleName', 'lastName', 'designation', 'office', 'email', 'contactNumber', 'shirtSize']);
export const HEADERS = Object.freeze(['Submission ID', 'Timestamp', 'First Name', 'Middle Name', 'Last Name', 'Designation', 'Office', 'Email Address', 'Contact Number', 'Shirt Size', 'Submission Status', 'Duplicate Of']);
export const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const RECORD_ID = /^NRCO-[0-9a-f]{32}$/;
export function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function sanitizeInput(value) { return value.trim().replace(/\s+/gu, ' '); }
export function canonicalPhone(value) { return value.replace(/^0/, '+63'); }
export function validateSubmission(input) {
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
