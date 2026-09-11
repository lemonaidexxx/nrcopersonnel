# NRCO Personnel Information Update

## Current setup: Google Sheets + GitHub only

**Cloudflare is no longer required.** Google Apps Script hosts the form and saves
responses in the private Google Sheet. GitHub keeps the source code and size guide.
The respondent address is the deployed Google web-app `/exec` URL.

**Start here: [google-only/README.md](google-only/README.md).**

Download the supplied deployment ZIP, or open **Actions > Test personnel form >
a successful run > Artifacts > NRCO-Google-Only**. GitHub builds the ready-to-paste
files automatically. From the ZIP, copy these three files into the Apps Script
project opened from **Extensions > Apps Script** in the spreadsheet:

1. Code.gs: replace the entire old Code.gs.
2. Index.html: create an HTML file named Index.
3. appsscript.json: replace the manifest.

The Google-specific source is in src/google/, shared form definitions and layout
are in src/ and web/, and scripts/build-google.mjs packages the complete files.

Run setupSheet, authorize, then deploy as a web app: Execute as Me; access Anyone.
Keep the Sheet private. No Bash, npm commands, relay secret, Turnstile widget,
Cloudflare account, or manual Script properties are needed for the owner setup.

All eight information fields are required, including Middle Name. The approved
15 designations, six offices, Philippine mobile validation, shirt-size dropdown,
reference guide, solid navy theme and sticky scroll-linked navigation are retained.
A-L mapping, duplicate review, RAW text writes and safe retries are unchanged.

**Status:** complete code and simulated tests are prepared. The owner must copy
these files into Apps Script, deploy, and verify a live submission before sharing.
Source changes in GitHub do not automatically update Apps Script.

The earlier Cloudflare files under apps-script/, src/worker.mjs and wrangler.jsonc
are retained only as legacy code and regression fixtures. Do not follow their old
setup or paste their receiver into the new project. See google-only/ for the active
instructions. No existing Cloudflare account or deployment has been changed here.

## Development only

The form model uses the attributed adaptation of filp/form-api under vendor/.
Build and regression tests have no npm dependencies and require Node.js 22+.
Owners deploying the ready-to-paste files do not need to run these commands.

```sh
npm run build
npm test
```

The build also generates legacy fixtures for regression tests; deploy only the
three google-only files. No automated deployment or credentials are configured.

Read the security limitations and live test checklist in google-only/README.md.
The public form has basic spam controls, not a CAPTCHA, staff identity verification,
or Cloudflare-grade edge protection. Do not put personnel data into GitHub.
