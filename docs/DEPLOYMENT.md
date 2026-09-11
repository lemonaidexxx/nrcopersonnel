# Deployment and maintenance

## 1. Destination Google Sheet

Use the approved private spreadsheet and its existing **Sheet1** tab. Keep sharing
restricted. Do not publish the spreadsheet or grant anonymous access.

The connected destination was initialized with the following headers, a frozen
header, filters, text formatting and Needs review highlighting. No personnel or
test records were inserted during implementation.

| Column | Header | Input and validation |
| --- | --- | --- |
| A | Submission ID | Server-derived stable unique identifier, not a row number |
| B | Timestamp | Server-generated ISO 8601 string with +08:00 Philippine time |
| C | First Name | Required text, trim spaces, preserve capitalization |
| D | Middle Name | Optional text, trim spaces, preserve capitalization |
| E | Last Name | Required text, trim spaces, preserve capitalization |
| F | Designation | Required dropdown, one of the 15 approved options |
| G | Office | Required dropdown, one of the six approved options |
| H | Email Address | Required email, trimmed, case retained for storage |
| I | Contact Number | Required Philippine mobile, stored as text |
| J | Shirt Size | Required dropdown: S, M, L, XL, XXL, XXXL |
| K | Submission Status | Received or Needs review |
| L | Duplicate Of | ID of the first prior matching email or mobile, otherwise blank |

No title, sharing permission or existing record was changed. The timestamp string
includes its timezone independently of the spreadsheet's display timezone.

## 2. Google Apps Script receiver

1. Open the approved spreadsheet and choose **Extensions > Apps Script**.
2. Give the project a descriptive name, such as NRCO Personnel Receiver.
3. Replace the editor's Code.gs with the COMPLETE `apps-script/Code.gs` from this
   repository. It already includes shared validation. Do not paste Backend.gs
   separately and do not duplicate the validation functions.
4. In Project Settings enable showing the appsscript.json manifest, then replace
   it with `apps-script/appsscript.json` from this project.
5. Confirm **Google Sheets API v4** is enabled under Services. The manifest declares
   the advanced service. For a standard Google Cloud project, also enable the
   Google Sheets API in that project's Cloud Console; default Apps Script projects
   manage the API activation when the advanced service is added.
6. In **Project Settings > Script properties**, add:

   | Property | Value |
   | --- | --- |
   | `SPREADSHEET_ID` | The approved spreadsheet's ID, not its full URL |
   | `SHEET_NAME` | `Sheet1` |
   | `RELAY_SECRET` | A new random 64-character hexadecimal secret |

   Generate the secret on your own computer and paste it directly into Google and
   Cloudflare settings. Do not commit it, send it in chat, or include it in screenshots.

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

7. Run `setupSheet` and authorize it with the account that owns or can edit the
   destination. It checks the existing headers and refuses a mismatched schema.
   Review the requested Sheets permission. The OAuth scope can access spreadsheets
   available to this account; the application is configured for one destination.
   A dedicated account with limited shared data reduces the impact of compromise.
8. Choose **Deploy > New deployment > Web app**. Set **Execute as: Me** and
   **Who has access: Anyone**. The relay has no Google browser sign-in session:
   Anyone with a Google account is NOT equivalent. Workspace administration may
   restrict anonymous deployments. Contact the administrator when the necessary
   option is unavailable; do not make the Sheet public as a workaround.
9. Deploy and retain the actual `/exec` URL. Do not use the `/dev` testing URL.

The public receiver rejects payloads without a valid, fresh signature. GET returns
METHOD_NOT_ALLOWED intentionally; opening the URL is not a successful write test.

## 3. Cloudflare connected to GitHub

1. In Cloudflare **Workers & Pages**, choose the option to create a Worker by
   importing an existing Git repository. Authorize the GitHub integration for
   `lemonaidexxx/nrcopersonnel` only where the authorization interface allows it.
2. Select that repository, the `main` production branch, and Worker name
   `nrcopersonnel`, matching wrangler.jsonc. Use the repository root directory.
3. Set the build command to `npm run build && npm test`. Set the deploy command to:

   ```sh
   npx --yes wrangler@4.94.0 deploy --keep-vars
   ```

   Node.js 22 or newer is needed. The build itself has no npm dependencies.
   `--keep-vars` preserves runtime variables configured in the dashboard on later
   deployments. Wrangler is version-pinned rather than implicitly using latest.
4. Deploy once to obtain the ACTUAL production URL. The unconfigured site displays
   that submissions are unavailable. Do not distribute it for personnel collection.
5. wrangler.jsonc declares the `SUBMISSION_LIMITER` binding. Its namespace_id is an
   application-chosen integer, not an existing account ID. Ensure `2026091101` is
   not shared with an unrelated limiter in the account; change it if necessary.
   The limit is 30 attempts/minute per IP per Cloudflare location, not globally strict.

## 4. Turnstile and runtime settings

1. Create a Cloudflare Turnstile widget in Managed mode. Allow only the exact
   production hostname obtained above, or your approved custom hostname.
2. Add the following under the Worker's **Settings > Variables and Secrets**.
   These must be runtime settings, not merely build-environment variables.

   | Name | Setting type | Value |
   | --- | --- | --- |
   | `APP_ORIGIN` | Text variable | Actual HTTPS origin, with no path or trailing slash |
   | `TURNSTILE_SITE_KEY` | Text variable | Actual public Turnstile site key |
   | `TURNSTILE_SECRET_KEY` | Secret | Actual private Turnstile secret key |
   | `APPS_SCRIPT_URL` | Secret | Actual Apps Script web app `/exec` URL |
   | `RELAY_SECRET` | Secret | EXACT same 64-character hex string used in Apps Script |

3. Save and redeploy. Production requests fail closed unless every required setting
   and binding is available. Turnstile test keys are deliberately rejected.
4. Verify `/api/config` on the deployed site returns enabled true and only the
   public site key. This confirms configuration, NOT a successful spreadsheet write.
5. Complete the live checklist in TESTING.md before distributing the form.

No account ID, production origin, endpoint, widget key or secret is invented in
this repository. These arise from the owner's account authorization and deployment.
Review plan limits and billing before approving any paid service change.

## 5. GitHub maintenance and updates

The source repository already exists, so no replacement repository is needed.
Keep code and the reference image in GitHub; never commit personnel records,
.env/.dev.vars, access tokens, service-account keys or production secrets.

For a small update in the GitHub website, open the relevant source file, choose
Edit, commit on a branch, open a pull request, review the test checks, and merge.
Cloudflare's connected build deploys the production branch after integration setup.

Command-line workflow:

```sh
git clone https://github.com/lemonaidexxx/nrcopersonnel.git
cd nrcopersonnel
git switch -c update/personnel-form
# Edit the appropriate source files.
npm run build
npm test
git add .
git commit -m "Update personnel form"
git push -u origin update/personnel-form
```

Open and merge the pull request after reviewing its changes and checks. For a
manual Cloudflare deployment from an authorized local computer, run
`npx --yes wrangler@4.94.0 login` followed by `npm run deploy`.

**Apps Script deploys separately.** When src/validation.mjs or Backend.gs changes,
run the build, copy the updated complete Code.gs into the editor, then choose
Deploy > Manage deployments > Edit > New version > Deploy. Updating the SAME
Google deployment preserves its `/exec` URL. A different deployment requires
updating APPS_SCRIPT_URL. Keep frontend and backend validation versions aligned.

For rollback, revert the bad Git commit and let Cloudflare rebuild, or select a
prior Cloudflare deployment. Restore the matching Apps Script version when the
protocol or validation changed. Back up the Sheet privately before schema changes.
Rotate both copies of RELAY_SECRET together; submission IDs do not depend on it.

GitHub Pages settings are not used for this architecture.
