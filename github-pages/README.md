# Publish the NRCO form at its GitHub address

Public address after Pages is enabled:
https://lemonaidexxx.github.io/nrcopersonnel/

GitHub serves a static container page. The Google Apps Script form runs inside it
and writes to the existing private Google Sheet. The normal browser address stays
on GitHub; the Google endpoint is still visible to someone inspecting the code.
No Cloudflare, Bash, relay secret, or new Google project is required.

## 1. Update the existing Apps Script deployment

Use the three files in the NRCO-GitHub-Pages deployment package. Alternatively,
download the NRCO-GitHub-Pages artifact from a successful GitHub Actions test run.

- Replace the complete Code.gs in the existing NRCO Webform project.
- Replace the complete HTML file Index.html (Files > + > HTML > name Index).
- The supplied appsscript.json is unchanged from the Google-only version. Keep
  the existing matching manifest and Sheets service; do not add a duplicate.

Use Code.gs AND Index.html from the same package. Code.gs enables embedding, and
Index.html checks the expected top-level GitHub page before revealing the form.
Do not make only the one-line ALLOWALL change and omit the matching Index.html.
Do not paste Backend.gs. Old relay properties are not used.

Choose Deploy > Manage deployments > select the deployment matching the /exec URL
already supplied > Edit (pencil) > Version: New version > Deploy.
Keep Execute as: Me and Who has access: Anyone, where organizational policy allows.
This updates the SAME deployment URL; do not create another deployment by mistake.
No setupSheet rerun or spreadsheet schema change is needed for this embedding update.

The already configured endpoint is:
https://script.google.com/macros/s/AKfycbysQffhzFH21bFGY2-b30vGUYXhrtTEE4PagNXyPUEKeEJunzWjtdJ6C1ErcPu90NAOhw/exec

If a new URL is intentionally created, update APPS_SCRIPT_URL in docs/config.js.
It is a public endpoint, not a password. Never put credentials in docs/.

## 2. Enable GitHub Pages once

Open https://github.com/lemonaidexxx/nrcopersonnel/settings/pages
Under Build and deployment choose:

| Setting | Value |
| --- | --- |
| Source | Deploy from a branch |
| Branch | main |
| Folder | /docs |

Click Save. Wait for the Pages deployment to succeed; use Visit site when shown.
No custom domain, workflow template, build command, or terminal is needed.
The docs/ folder already contains index.html, configuration, CSS, scripts and
.nojekyll. Do not choose the repository root or dist as the publishing folder.
The Test personnel form workflow builds downloadable Google files; it does NOT
turn on or publish GitHub Pages. The separate Pages build handles publishing.

## 3. Verify the GitHub address

Open https://lemonaidexxx.github.io/nrcopersonnel/ in a private browser window.
The form should appear and the address bar should remain on github.io. All eight
respondent fields remain required. Confirm the sticky section navigation and guide.

Submit a clearly marked test entry using test information under your control.
Check that one row appears in Sheet1, with the same reference as the confirmation.
This is the live acceptance test; do not distribute the link before it succeeds.
No personnel or test rows were inserted while preparing this update.

## Troubleshooting

- GitHub 404: enable Pages using main and /docs, and check the Pages deployment.
- Loading or connection message persists: deploy BOTH new Google files as a new
  version of the SAME Apps Script deployment. Confirm anonymous access is allowed.
- A direct /exec visit offers a GitHub link: intentional in this embed version.
  The actual inputs only appear after the GitHub page is verified.
- Google sign-in/permission screen: verify Execute as Me, access Anyone, and your
  organization's policy. Do not publish the spreadsheet to bypass permissions.
- Blocked frames, strict browser privacy settings, or disabled JavaScript: browser
  or organization policy may prevent the Google frame/RPC from loading. Do not
  treat a loaded iframe as proof of a successful spreadsheet write.
- Old Google-only package: it does not have the required embedding handshake.
  Use the package explicitly named NRCO-GitHub-Pages.

## Data and framing safeguards

The GitHub page does not collect, relay, or receive the respondent's field values,
Google session token, or saved receipt. The form sends those through Google's RPC
inside its Google-hosted frame. The parent/child messages contain only a version,
random nonce, message type and the canonical public page address.

Google ALLOWALL permits framing by any website at the HTTP level. The generated
Index remains hidden and inert until an exact-origin, exact-source nonce reply
from the expected TOP window is received. The GitHub page refuses to load Google
when GitHub itself is framed. Its receiver verifies the Google origin AND frame
ancestry (including Google's nested sandbox iframe), and never uses wildcard
postMessage targets. No user-provided query parameter changes the loaded endpoint.

This is a browser-side clickjacking mitigation, NOT a server-enforced
frame-ancestors allowlist, an identity check or a guarantee against all attacks.
Compromise of the trusted GitHub origin is outside its protection. Existing
public-link spam/quota limitations still apply. The Google deployment still
accepts properly formed submissions without authenticating staff. Keep the Sheet
restricted. Review the public-collection arrangement with the organization.

Do not remove the gate because of a loading issue. Resolve deployment/version,
allowed-origin, or browser policy problems. Google may display its own Apps Script
banner inside the frame; GitHub's URL is not a promise of white-label Google UI.

## Verification scope

Ten focused Node tests cover deployment configuration, origin/window/nonce checks,
the generated pair of Google files, all required fields, and absence of a separate
GitHub submission API. Existing Google-only and legacy regression suites remain.
Actual Google framing, deployment access, and live writes still require the owner
acceptance test. The local browser disallowed network navigation in this build
environment, so no live browser/iframe success is claimed for this release.

## Maintenance

Edit docs/config.js to change the known endpoint; docs/ commits publish when Pages
is configured as above. UI/backend source changes must be rebuilt and the updated
Google files pasted into Apps Script, then deployed as a new version there.
GitHub commits cannot update a Google deployment automatically.

Sources:
https://developers.google.com/apps-script/reference/html/x-frame-options-mode
https://developers.google.com/apps-script/guides/html/restrictions
https://developers.google.com/apps-script/concepts/deployments
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
