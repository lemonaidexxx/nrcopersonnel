# Security and operational boundaries

This is a public submission form, not employee authentication. Anyone who obtains
the link may attempt a submission. Personnel details are self-reported; mobile and
email syntax checks do not prove ownership, employment or successful delivery.

## Implemented controls

- Shared validation on browser, Worker and Apps Script; allowlisted fields and
  options, string types, control-character rejection, length and payload-size limits.
- Same-origin JSON endpoint, exact Origin check, no permissive CORS, security
  headers, no public Sheet exposure or personnel lookup endpoint.
- Mandatory server-side Turnstile verification including hostname and action;
  per-IP rate limiting and a honeypot. No production challenge bypass switch.
- Server-only HMAC secret, signed payload and request reference, five-minute
  freshness window, and no credentials in browser files.
- LockService protects retry/duplicate checks and one complete row write. A stable
  server-derived reference makes unchanged retries idempotent. The initial success
  is confirmed only after a RAW write and read-back.
- RAW strings preserve leading zeroes/plus signs and prevent formula evaluation
  in Google Sheets. This does not make future CSV exports safe in every application;
  apply export-specific escaping before opening untrusted cells from a CSV.
- Possible duplicates are preserved and flagged internally. Public responses do
  not disclose existing email/mobile matches, prior records or spreadsheet row numbers.
- Browser sessionStorage holds only the pending UUID and a payload digest, not raw
  personnel fields. Storage failures fall back to memory. A retry after a reload
  without saved state may create a review-flagged duplicate. Changing details after
  an uncertain save is a new response, not permission to overwrite an earlier one.
- Application code does not log request bodies, personal fields or secrets. Worker
  observability and Apps Script exception logging are disabled in this configuration.
  Provider infrastructure logging and retention remain account responsibilities.

## Data handling and review

Cloudflare handles submitted fields in transit; Google stores the records in the
private Sheet. Turnstile performs browser verification. Review organizational
approval of these providers. No OpenAI service, model or key is involved.

Limit access to the spreadsheet, Apps Script project properties, and Cloudflare
secrets to authorized administrators. Keep the Sheet restricted even though the
form and signed receiving endpoint are public. The application cannot prevent an
administrator from changing permissions later.

No privacy notice or consent section was added, as requested. This is not a legal
or organizational-policy compliance certification. Publication, authorized use,
retention, deletion and staff communication require owner review. No official DPO
contact or retention period has been invented.

## Scale, quotas and integrity limits

Rate limiting is per Cloudflare location and shared office IPs may throttle several
staff together. It is not globally strict accounting or guaranteed DDoS protection.
The public Apps Script endpoint can still consume execution capacity while rejecting
invalid requests. Monitor quotas, traffic, and billing before a large rollout.

Duplicate scans are linear in existing row count and Apps Script has execution
limits. This design is for a modest personnel register, not unbounded high-volume
collection. Load-test expected bursts and migrate to a database if volume,
throughput, auditing or stronger transaction semantics require it.

Use one Apps Script receiver project for this destination so its script lock
coordinates writes. Avoid manual edits to identity/data columns during collection;
manage review status separately. Deleting or changing recorded data, or using other
independent writers, can defeat retry and duplicate guarantees. ScriptLock is not
a transaction across unrelated scripts or manual spreadsheet edits.

The attributed filp/form-api adaptation is not an upstream security endorsement.
Its form model is not the receiving backend, and model-only validation would not
be sufficient for a public form.
