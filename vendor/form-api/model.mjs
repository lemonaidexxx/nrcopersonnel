/* Adapted from filp/form-api, commit c406e7f48b4e3788bf6c173a6312d6e0ef266b5f.
 * Copyright Filipe Dobreira. MIT. See NOTICE.md and LICENSE in this directory.
 * This ES-module subset retains Form/Field/TextField/SelectField/SelectFieldChoice.
 * See NOTICE.md for the upstream validation fixes and intentionally omitted APIs.
 */
export class Field {
  constructor(data) { this.data = { ...data, archived: data.archived ?? false }; }
  get id() { return this.data.id; }
  get archived() { return this.data.archived; }
  setArchived() { this.data.archived = true; }
}
export class TextField extends Field {
  constructor(data, properties) { super(data); this.properties = properties; }
  isValidValue(value) {
    const { minLength, maxLength } = this.properties;
    return typeof value === 'string' &&
      (minLength === undefined || value.length >= minLength) &&
      (maxLength === undefined || value.length <= maxLength);
  }
}
export class SelectFieldChoice {
  constructor(data) { this.data = { ...data, archived: data.archived ?? false }; }
  get id() { return this.data.id; }
  get archived() { return this.data.archived; }
  setArchived() { this.data.archived = true; }
}
export class SelectField extends Field {
  constructor(data, properties = {}) { super(data); this.properties = properties; this.choices = []; }
  getChoices(options = {}) { return options.includeArchived ? this.choices : this.choices.filter(c => !c.archived); }
  addChoice(choice) {
    if (choice.archived || this.choices.some(c => c.id === choice.id)) throw new Error('Invalid or duplicate choice');
    this.choices.push(choice); return choice;
  }
  isValidValue(id) { return this.getChoices().some(choice => choice.id === id); }
}
export class Form {
  constructor(data) { this.data = { ...data, archived: data.archived ?? false }; this.fields = []; }
  get id() { return this.data.id; }
  addField(field) {
    if (field.archived || field.data.formId !== this.id || this.fields.some(f => f.id === field.id)) {
      throw new Error('Invalid or duplicate field');
    }
    this.fields.push(field);
  }
  getFields(options = {}) { return options.includeArchived ? this.fields : this.fields.filter(f => !f.archived); }
}
