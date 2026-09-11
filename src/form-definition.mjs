import { Form, TextField, SelectField, SelectFieldChoice } from '../vendor/form-api/model.mjs';
import { DESIGNATIONS, OFFICES, SIZES } from './validation.mjs';
export const personnelForm = new Form({ id: 'nrco-personnel-v1', title: 'Personnel Information Update' });
const definitions = [
  ['firstName', 'First Name', 'personal', 'text', 100, 'given-name'],
  ['middleName', 'Middle Name', 'personal', 'text', 100, 'additional-name'],
  ['lastName', 'Last Name', 'personal', 'text', 100, 'family-name'],
  ['designation', 'Designation', 'appointment', DESIGNATIONS],
  ['office', 'Office', 'appointment', OFFICES],
  ['email', 'Email Address', 'contact', 'email', 254, 'email'],
  ['contactNumber', 'Contact Number', 'contact', 'tel', 32, 'tel'],
  ['shirtSize', 'Shirt Size', 'shirt', SIZES]
];
for (const [name, label, section, kind, maxLength, autocomplete] of definitions) {
  const common = { id: name, formId: personnelForm.id, fieldPropertiesId: name + '-properties', name, label,
    required: name !== 'middleName', type: Array.isArray(kind) ? 'select' : 'text' };
  let field;
  if (Array.isArray(kind)) {
    field = new SelectField(common, {});
    kind.forEach(value => field.addChoice(new SelectFieldChoice({ id: value, fieldPropertiesId: common.fieldPropertiesId, label: value })));
  } else field = new TextField(common, { format: kind === 'email' ? 'email' : 'text', maxLength });
  field.ui = { section, inputType: Array.isArray(kind) ? 'select' : kind, autocomplete };
  personnelForm.addField(field);
}
