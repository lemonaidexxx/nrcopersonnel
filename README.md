# NRCO Personnel Information Update

Responsive personnel form for the **National Reintegration Center for OFWs**.
GitHub maintains the source; Cloudflare Workers serves the website and submission
API; a signed Google Apps Script receiver writes to a private Google Sheet.

**Status:** source implementation and destination Sheet structure are prepared.
Cloudflare and Apps Script account authorization, production configuration,
deployment, and a real submission test remain required. The application refuses
submissions while unconfigured. Local tests do not establish a live deployment.

## Quick start

Node.js 22 or newer is required. Building and testing need no npm dependencies.

```sh
npm run build
npm test
npm run preview
```

Open the local address printed by preview. This preview never saves information.
`dist/` contains the generated website. GitHub Pages alone cannot run its API.

## Approved behavior

- Public link access, no respondent sign-in. This is not employee identity verification.
- First and last names required; middle name optional. Whitespace is trimmed and
  legitimate name/email capitalization preserved.
- Exactly 15 designations and six offices from the supplied brief.
- Philippine mobile numbers: 09XXXXXXXXX or +639XXXXXXXXX. Common separators are
  removed; the chosen national/international prefix is retained and stored as text.
- Shirt-size dropdown: S, M, L, XL, XXL, XXXL. Uploaded guide is displayed nearby
  with an enlarged dialog and an accessible text table.
- A-J preserve the approved field order; K is Submission Status, L is Duplicate Of.
- A new response matching an earlier normalized email OR mobile is preserved and
  marked Needs review. Earlier records are never silently overwritten or deleted.
- Retrying unchanged information with the same request reference returns the
  previously saved ID without adding a second row.
- No privacy-notice/consent section or OpenAI API dependency is included.

## Architecture

```text
GitHub -> Cloudflare static assets + same-origin /api/submit
       -> Turnstile + validation + signed server-to-server request
       -> Google Apps Script -> private Google Sheet / Sheet1
```

The browser, Worker and Apps Script use the same validation source. The Worker
verifies origin, body size, rate limits, and Turnstile hostname/action. Apps Script
verifies the HMAC-SHA256 signature and request freshness, validates independently,
locks retry/duplicate checks and writes, writes one RAW row and reads it back before
confirming success. The browser receives only the reference and timestamp; there
is no public endpoint for reading personnel records.

## Complete source files

| Path | Purpose |
| --- | --- |
| `web/index.html` | Accessible page template, rendered by the build |
| `web/styles.css` | Responsive navy/teal layout |
| `src/app.mjs` | Browser validation, challenge, retry state and confirmation |
| `src/validation.mjs` | Shared field allowlists and validation |
| `src/form-definition.mjs` | Actual form model using the adapted upstream classes |
| `vendor/form-api/` | Attributed, hardened filp/form-api subset |
| `src/worker.mjs` | Same-origin API, rate limits, Turnstile and signed relay |
| `apps-script/Code.gs` | Complete generated backend; paste this file into Apps Script |
| `apps-script/Backend.gs` | Backend build source; not a standalone receiver |
| `apps-script/appsscript.json` | V8 runtime, timezone, Sheets API and OAuth scope |
| `scripts/build.mjs` | Generates the website and complete Code.gs |
| `scripts/preview.mjs` | Non-submitting local preview |
| `assets/shirt-size-guide.webp` | Web-optimized supplied 569 x 300 reference |
| `tests/application.test.mjs` | Validation, relay and mocked Google-service tests |
| `wrangler.jsonc` | Worker, static-asset and rate-limit configuration |
| `docs/DEPLOYMENT.md` | Google, Cloudflare and GitHub setup and maintenance |
| `docs/TESTING.md` | Verification scope and live acceptance checklist |
| `docs/SECURITY.md` | Controls, data handling and operational limitations |

## Upstream library

`vendor/form-api/model.mjs` is an explicitly adapted JavaScript subset of
`filp/form-api` at commit `c406e7f48b4e3788bf6c173a6312d6e0ef266b5f`.
The build actually uses Form, TextField, SelectField and SelectFieldChoice. The
upstream inverted select-value validation is fixed and tested; see NOTICE.md for
attribution and all changes. `jojoe77777/FormAPI` is excluded as approved because
it targets PocketMine/Minecraft clients, not browser forms.

## Primary references

- https://github.com/filp/form-api/tree/c406e7f48b4e3788bf6c173a6312d6e0ef266b5f
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/content
- https://developers.google.com/apps-script/guides/services/advanced
- https://developers.google.com/sheets/api/reference/rest/v4/ValueInputOption
