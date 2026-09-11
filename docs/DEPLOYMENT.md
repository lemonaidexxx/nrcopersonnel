# Current deployment: Google Sheets + GitHub only

The Cloudflare setup has been replaced by a Google-hosted form. Use the complete
instructions in [../google-only/README.md](../google-only/README.md).

Only google-only/Code.gs, google-only/Index.html and google-only/appsscript.json
are pasted into the Apps Script project. The spreadsheet and tab are preconfigured.
Run setupSheet from the sheet-bound editor, then deploy as a web app executing as
Me with access Anyone. Share the Google /exec URL after verifying a real test write.

No Bash, external hosting, Turnstile keys, relay secret, or manual Script properties
are required. The legacy Cloudflare files remain for regression testing, not use.
GitHub stores source; it does not automatically publish Apps Script changes.
