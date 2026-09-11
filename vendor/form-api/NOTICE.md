# Upstream attribution

Adapted from **filp/form-api**, by Filipe Dobreira:
https://github.com/filp/form-api/tree/c406e7f48b4e3788bf6c173a6312d6e0ef266b5f

Source files: `src/index.ts`, `src/field.ts`, `src/fieldTypes/textField.ts`, and
`src/fieldTypes/selectField.ts`. Upstream package.json declares the MIT license;
that snapshot does not contain a standalone LICENSE file. The accompanying MIT
text records the declared license and attributes the upstream author.

This is an explicitly adapted, dependency-free JavaScript subset, not an
unmodified installation or a claim of upstream endorsement. It builds the actual
form fields and choices through `src/form-definition.mjs`.

Changes: removed TypeScript-only types; omitted unused boolean/file/conditional
field and default/archival-management APIs; added field ownership and duplicate-ID
checks; added a runtime string check in TextField. Upstream SelectField.isValidValue
returns true when its index equals -1; this adaptation instead accepts only
existing, unarchived choices. Application-level validation independently checks
allowed values and email/mobile formats on the client, Worker and Apps Script.

`jojoe77777/FormAPI` is not included: it targets PocketMine/Minecraft clients,
not browser forms, as confirmed and approved in the project requirements.
