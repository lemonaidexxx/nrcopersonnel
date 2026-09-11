# NRCO Personnel Information Update

## Current respondent link: GitHub Pages

**Start here: [github-pages/README.md](github-pages/README.md).**

The public address to publish is **https://lemonaidexxx.github.io/nrcopersonnel/**.
GitHub Pages serves the container page; the existing Google Apps Script form runs
inside it and stores responses in the private Google Sheet. No Cloudflare, Bash,
Turnstile, or relay secret is required.

The supplied Google web-app URL is configured in docs/config.js. It is publicly
inspectable and is not a credential. Do not put private credentials or personnel
data in this public repository.

### Owner setup

1. Download the NRCO-GitHub-Pages package supplied in chat, or the artifact with
   that name in Actions > Test personnel form > a successful run.
2. Replace Code.gs AND Index.html in the existing NRCO Webform Apps Script project
   with that package's files. The included manifest matches the Google-only one.
3. In Apps Script update the SAME deployment: Manage deployments > Edit > New
   version > Deploy. The configured /exec address must remain unchanged.
4. In this repository's Settings > Pages select Deploy from a branch, main, /docs,
   then Save. This one-time action is separate from the test workflow.
5. Open the GitHub address in a private browser window and confirm one real test
   submission against Sheet1 before sharing the link.

All eight respondent fields remain required, including Middle Name. The approved
15 designations, six offices, Philippine mobile validation, shirt-size dropdown,
original guide, solid navy shades and sticky scroll-linked navigation remain.
The A-L spreadsheet mapping, duplicate review, RAW writes and safe retries are
unchanged. No Google Sheet records are modified by this hosting change.

### What changed

The matching Google files enable iframe embedding and keep the form hidden until
the expected GitHub top-level page replies to an origin/window/nonce check. This
is a client-side framing mitigation, not staff authentication or an HTTP
frame-ancestors allowlist. See the deployment guide for limitations and testing.

The standalone google-only/ package remains for reference. It does not support
this embedding handshake. Earlier apps-script/ and Cloudflare files are legacy
regression fixtures; do not use them for this deployment.

### Maintainers

Source: src/google/ and shared src/ and web/ files. Google-only packaging:
scripts/build-google.mjs. Embed packaging: scripts/build-pages.mjs. Public static
site: docs/. All owner instructions are point-and-click; no local tools needed.

Build/test commands for maintainers (Node.js 22+):

```sh
npm run build
node scripts/build-pages.mjs
npm test
```

GitHub Actions uploads both Google-only and GitHub-embed packages. It does not
update Apps Script or enable GitHub Pages. Keep the generated Google file pair in
sync when deploying. The model remains the attributed filp/form-api adaptation.
