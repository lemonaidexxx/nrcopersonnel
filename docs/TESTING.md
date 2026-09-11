# Verification and acceptance tests

## Automated verification

Run the current build and automated suite using the commands below. Tests cover
the form model and approved choices, all eight required respondent fields, name
casing and Unicode, email handling, Philippine mobile formats, malformed and
oversized requests, Worker/Apps Script HMAC agreement, stale/tampered signatures,
duplicate review, retry IDs, conflict rejection, RAW write mode, lost confirmation,
lock/header failures, origin checks, rate limiting, Turnstile hostname/action,
Content Service redirects, and rejection of unconfirmed success.

Required-field regression tests reject omitted, null, empty and whitespace-only
values for every respondent field, including Middle Name, in shared validation,
the Worker endpoint and independently in the signed Apps Script receiver. Invalid
submissions must not call upstream services or write a Sheet row. Generated HTML
must mark all eight respondent controls as required, show no optional labels, and
keep the anti-spam honeypot non-required. GitHub Actions also verifies that the
committed Code.gs exactly matches the build output.

The actual complete Apps Script receiver runs in a Node VM with mocked Google
services. A local integration simulation connects the actual Worker and signed
receiver to the mocked Sheet. No live personnel data or destination test rows
are used by these tests.

## Initial browser verification

Seven browser checks passed for the initial implementation in Chromium using the
built HTML/CSS and actual browser application, with mocked network requests and
Turnstile. Checks covered correct dropdowns/image, no horizontal page overflow at
320/375/768/1280 pixels, opening and dismissing the enlarged guide with Escape,
missing-field errors without a request, preserving values after a failed save,
reusing a retry ID, clearing only on confirmed success, and starting another
response. No browser JavaScript errors occurred. The isolated document's digest
was substituted because it lacked a secure network origin; actual cryptographic
compatibility is tested in Node. These initial browser checks predate the change
to require Middle Name; repeat browser acceptance testing after deployment.

**These are not live deployment tests.** Authenticated Cloudflare/Apps Script
setup, production permissions, real Turnstile/redirect behavior and a public-network
end-to-end write have not been verified. A passing automated suite does not mean the
website is deployed or ready for personnel collection.

Run locally:

```sh
npm run build
npm test
npm run preview
```

The preview intentionally does not accept submissions. The repository also includes
a GitHub Actions workflow to run build and tests on pushes and pull requests.

## Live acceptance checklist: not yet performed

1. Deploy the matching Apps Script and Worker versions; keep the Sheet restricted.
2. Open the real HTTPS form in an incognito browser without Google sign-in. Check
   the guide, all dropdowns and Turnstile on the approved hostname.
3. Submit a clearly labeled test entry with all eight fields completed, including
   Middle Name. Use an address under example.invalid and a test mobile number under
   your control. The form sends no email or SMS.
4. Confirm success appears only after exactly one new row exists. Match its reference
   to column A; inspect every field in A-L, including the +08:00 timestamp and TEXT
   phone with its original 0 or +63 prefix.
5. Submit a NEW response using the same email in different casing. Confirm the new
   row is preserved and marked Needs review, L points to the earlier ID, and the
   earlier row is unchanged. Duplicate details must not appear in the browser.
6. Use a different email with the same phone in the other 09/+639 format. Confirm
   the same preserve-and-flag behavior.
7. Simulate an interrupted response, then retry unchanged details in the same
   browser. Confirm one row and the same returned reference, not a second insertion.
8. Leave each respondent field blank in turn, including Middle Name; test spaces-only
   values and omitted request fields. Also test invalid email, non-Philippine/landline
   numbers, forged dropdown values, oversized requests, invalid signatures and stale
   timestamps. No invalid entry should be written.
9. Test failed/expired verification, an unapproved hostname/action and rate limiting
   without real personal data. Confirm refusal rather than false success.
10. Check Android/iOS browsers, keyboard navigation, screen-reader labels, 200% zoom,
    long office labels, 320px width, dialog focus, slow and interrupted connections.
11. Confirm browser assets expose no Sheet ID, receiver URL or server secret, and
    logs contain no submitted fields. Changing a required secret should fail closed.
12. Review provider quotas, sharing permissions, administrator access and approved
    collection/retention procedures before distributing the link.
13. Remove test records only after approving cleanup; preserve any required audit
    evidence. Do not mix test entries with production collection.

The approved office names are retained exactly. Verify their official current
wording with the owner before release; this project does not silently rename units.
