# NRCO form: Google Sheets + GitHub only

**Use this folder, not the earlier Cloudflare files.** No Bash, Node.js installation,
Turnstile widget, relay secret, website-hosting account, or manual Script properties
are required to publish this version.

Google Apps Script hosts the actual form and saves its responses to the private
Google Sheet. GitHub keeps the editable source. The public form address is the
Google web-app `/exec` URL, not a GitHub Pages address. Source changes on GitHub do
not automatically update the deployed Apps Script project.

## Get the ready-to-paste files

Use the deployment ZIP supplied with this update, or open this repository's Actions
page, select a successful **Test personnel form** run, and download the
**NRCO-Google-Only** artifact. GitHub builds the three files automatically. You do
not install or run anything on your computer.

## Files to paste from that ZIP (only three)

| File here | Where to paste it |
| --- | --- |
| `Code.gs` | Replace the ENTIRE old Apps Script `Code.gs`. Do not append it. |
| `Index.html` | Apps Script: Files **+ > HTML**, name it **Index**, then replace its contents. |
| `appsscript.json` | Replace the existing manifest in the Apps Script editor. |

The complete Index already contains the CSS, browser JavaScript and scrollspy.
The public shirt-size image loads from a pinned image in this GitHub repository;
no personnel information is sent to GitHub. The form still uses the approved
filp/form-api model through the maintainer's build process.

## 1. Open your spreadsheet's editor

Open the supplied destination spreadsheet, then choose **Extensions > Apps Script**.
Use the project opened from that sheet. Do not create a standalone project.
The destination ID and `Sheet1` are already filled in on the server side.

Replace the old Code.gs with this folder's Code.gs. Add the HTML file named Index.
In Project Settings enable showing appsscript.json, then replace the manifest.
Save all three files. Do not paste the old Backend.gs alongside them.

Under Services, **Sheets** should appear. It was already present in the supplied
screenshot. The manifest declares Google Sheets API v4. If it is absent, use
Services **+ > Google Sheets API > v4 > Add**. Do not add a duplicate.
For a manually selected standard Google Cloud project, enable Google Sheets API
in that project too; the default Apps Script project handles this when the service
is added. No external hosting or API key is needed.

Old RELAY_SECRET, SPREADSHEET_ID and SHEET_NAME Script properties are ignored by
this version. They can remain in place; no secret generator is needed.

## 2. Run setupSheet

In the function dropdown choose **setupSheet**, then **Run**. Authorize the script
using the account that owns or can edit the destination. Read the permission
request before approving it. This version uses only the spreadsheets OAuth scope.
Google may warn about an unverified application; verify it is your own project and
follow your organization's policy rather than bypassing an administrative block.

The log should say **Setup complete**. Existing records are preserved, mismatched
headers are refused, and no test submission is inserted. Run setupSheet from the
editor, not from the form page. Its administrative action is blocked in web-app
calls. It does not read a relay secret and cannot produce the old NOT_CONFIGURED
error. Seeing that error means old code or an old deployment is still running.

## 3. Publish the form

Choose **Deploy > New deployment > Web app**:

- Execute as: **Me**.
- Who has access: **Anyone**, for the requested public-link form.

Deploy and copy the complete **Web app URL ending in /exec**. Open it in a private
browser window. It now displays the actual personnel form, not a JSON receiver.
The `/dev` test URL is only for script editors and is not the respondent link.

If replacing an existing deployment, use **Deploy > Manage deployments > Edit >
New version > Deploy** to keep that deployment's URL. Saving files alone does not
change a deployed version. Archive unused old deployments after verifying the new
one so respondents do not keep reaching the old receiver.

If **Anyone** is unavailable, your Google Workspace administrator may restrict
anonymous web apps. Do not make the Sheet public as a workaround. Ask the
administrator about permitted access. Respondents must not be granted Sheet access.

## 4. Test, then share

Complete one clearly labeled test response in a private browser window. All eight
fields are required, including Middle Name. Use a test email under example.invalid
and a mobile number under your control. No email or SMS is sent.

Verify a success reference appears and exactly one new row exists in Sheet1 with
that reference in column A. A retry of the unchanged request should not add another
row. A genuinely new submission with the same email or mobile is retained and
marked **Needs review** in K with the earlier ID in L. Earlier records remain intact.

Test missing Middle Name, invalid email, invalid Philippine mobile, the size-guide
dialog, mobile layout, and scrolling through the four navigation sections. Do not
distribute the link until a real test write succeeds. Approve test-data cleanup
before deleting anything from the spreadsheet.

Share only the Google `/exec` form URL. GitHub Pages is not required. Do not share
the spreadsheet, the repository, the Apps Script editor, or a local HTML file as
the respondent form. Opening Index.html locally is deliberately a non-saving preview.

## What stays the same

All eight respondent fields required; exactly 15 designations and six offices;
Philippine mobile formats 09XXXXXXXXX / +639XXXXXXXXX; size dropdown S through XXXL;
original guide image; solid navy shades; sticky On this page navigation with a
single aria-current="location" marker; A-J data plus K-L duplicate review; server
validation; serialized RAW writes; verified receipts; safe retry references.

No privacy notice was added, following the confirmed user instruction. Collection,
retention and authorized administrator access still need the organization's approval.

## Security and limits

The Sheet stays private. No endpoint lists existing personnel data, and receipts
contain only a new reference and timestamp. Helper functions are private to server
RPC; administrative setup requires bound-editor context. Google RPC calls use an
expiring session capability, a hidden honeypot, and best-effort session/shared burst
limits. RAW writes prevent spreadsheet formula interpretation of text input.

This public-link form does not authenticate staff. Session tokens and cache limits
are NOT CAPTCHA or strong bot/DDoS protection; a determined caller can obtain new
sessions, cache entries can be evicted, and Google execution quotas still apply.
It no longer has Cloudflare's edge rate limits or Turnstile. Restrict access or stop
collection if abuse becomes a problem. To close it, change acceptingResponses to
false in Code.gs and deploy a new version (or archive the web-app deployment).

The existing Google spreadsheets scope is broader than this one destination.
Deploy from an appropriate account and restrict spreadsheet editors. Never publish
personnel rows, authorization tokens, or credentials to GitHub. GitHub only hosts
source and the non-personal reference image.

## Verification performed

25 Google-only automated tests passed with mocked Google services. Eleven Chromium
checks passed in an isolated document, including required fields, scrollspy at
320/390/768/1280px, guide dialog, failed save, reconnect, idempotent retry and success.
The isolated insecure browser used a Python SHA256 bridge; production code uses
browser Web Crypto. No actual Google deployment, Google iframe behavior, account
permission flow, or live spreadsheet write has been tested here. Verify those in
step 4. Google-specific RPC and history calls require the deployed HTML Service.

## Maintaining the source

For text/layout changes, edit the shared web/ and src/ source, then regenerate the
complete google-only files using scripts/build-google.mjs after scripts/build.mjs.
This is a maintainer workflow only; the owner does NOT run Bash or npm to publish.
The complete files are generated from the version-controlled source and attached
to each successful GitHub Actions run as NRCO-Google-Only. The previous
Cloudflare implementation is retained for history/regression tests but is not used
by this deployment. Use only google-only/ files in Apps Script.

## Official references

- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/html/communication
- https://developers.google.com/apps-script/guides/html/restrictions
- https://developers.google.com/apps-script/guides/bound
- https://developers.google.com/apps-script/guides/services/advanced
- https://developers.google.com/apps-script/reference/cache/cache
- https://developers.google.com/apps-script/guides/services/quotas
