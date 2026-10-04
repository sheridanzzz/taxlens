# Airtail receipt connector

Ledgr connects to an existing Airtail account. Airtail continues to own the Gmail and Yahoo connections, provider credentials, transaction discovery and sync. Ledgr receives a separate receipt-only token and proxies every retrieval through its own authenticated server routes.

## Setup

1. Apply `supabase/migrations/006_airtail_connector.sql` to the Ledgr database after migrations 001–005. The migration supports Neon and Supabase, adds account-owned encrypted connector storage, and allows original MIME email evidence in atomic expense saves. It can be rerun.
2. Set these **server environment variables in Ledgr**:

   ```dotenv
   AIRTAIL_URL=https://your-airtail-host.example
   LEDGR_APP_URL=https://your-ledgr-host.example
   AIRTAIL_CONNECTOR_SECRET=<random secret of at least 32 characters>
   ```

   Ledgr's `AUTH_SECRET` is used if `AIRTAIL_CONNECTOR_SECRET` is omitted. Keep the encryption secret stable; changing it requires reconnecting. Generate a secret with `openssl rand -base64 32` and store it in server configuration. Never expose it as a `NEXT_PUBLIC_` variable.

3. Set `LEDGR_APP_URL` to the same Ledgr origin on Airtail. These values must be origins only: no credentials, path, query or fragment. Production uses HTTPS; localhost HTTP is allowed for development.
4. For local development, use separate ports: Ledgr `http://localhost:3118`, Airtail `http://localhost:3119`. Configure Airtail's existing `NEXT_PUBLIC_APP_URL` to its own origin and allow its `/auth/callback` URL in Supabase. Each app still needs its normal cloud auth/database configuration. Browser-only local storage cannot retain a server connector.
5. Deploy both apps, then sign in to Ledgr and open **Settings → Connections → Connect Airtail**. Sign in to Airtail if necessary, approve receipt access, and return to Ledgr.

## First receipt test

1. Connect Gmail and Yahoo in Airtail and sync their transactions using Airtail's existing controls.
2. In Ledgr Connections choose the year being prepared, for example **2025–26 (1 July 2025–30 June 2026)**. The API uses the transaction purchase date and an inclusive start/exclusive end range.
3. Click **Retrieve receipts**, then **Review receipt**. Inspect the email body, original `.eml` and any PDF/image attachments. Email HTML is never rendered in the application.
4. For a non-AUD transaction, enter the actual AUD amount from the payment record. No current exchange rate is applied automatically.
5. Click **Review in Ledgr**. Check the purchase date, item, category and work use. Work use starts at 0%. For a depreciating asset, select its type, effective life and method. Then save the expense or mark it personal.
6. Open the saved expense's receipt and download the `.eml`. Its MIME source contains all original headers, bodies and attachments. Export a backup and verify the same evidence is included.
7. Retrieve the same receipt again: its deterministic expense ID prevents a second import. Original evidence remains available after disconnecting Airtail.

## Boundaries

- Retrieval lists Gmail/Yahoo expense transactions already extracted by Airtail, excluding rejected transactions. It does not scan the entire mailbox or start a background sync. Emails missed by Airtail's extraction, including an attachment-only invoice without an extracted transaction, will not appear here.
- Evidence is fetched on demand from the mailbox. The source email must still exist and its account must remain connected in Airtail. Original source emails are limited to 1.5 MB to keep email and attachment responses within hosted function payload limits; supported PDF/image attachments can be downloaded separately, while all attachments remain in the original MIME email. Larger messages need a future object-storage download path.
- Older Airtail transactions without an `emailAccountId` fail with a clear mailbox-reference error; they cannot be guessed across accounts. Yahoo uses the existing INBOX UID identifiers and verifies the stored subject before download. A removed/moved email or a changed UID requires recovery in Airtail; no unrelated mailbox is used as a fallback.
- Airtail's extraction confidence is not tax approval. Retrieving or previewing a receipt creates no Ledgr expense and changes no deduction totals. The existing tax/storage validation runs only after the user saves.
- Consent uses one-time authorization codes, S256 PKCE, a state cookie bound to the initiating Ledgr account, a registered callback and same-origin consent. Receipt tokens expire after 90 days, are hashed in Airtail, and are encrypted at rest in Ledgr. Provider credentials and connector tokens never enter Ledgr's browser storage.
- Disconnect first revokes Airtail's token and then removes the encrypted local connection. A failed revocation keeps the connection available to retry. Reconnecting replaces the stored token and attempts to revoke the previous token.

## Verification

```bash
# Ledgr
npm run check
npx tsc --noEmit
npm run lint
npm run build -- --webpack

# Airtail
npm run check:connector
npx tsc --noEmit
npm run lint
npm run build
```

Connector checks use production code with synthetic email fixtures, database doubles, and disposable PostgreSQL. They cover consent, PKCE/code replay, token expiry/revocation, account ownership, Gmail/Yahoo MIME preservation, encryption, foreign currency handling, repeatable migration and Supabase row isolation. Browser verification can use intercepted synthetic receipts to exercise the complete review/save flow without accessing a real mailbox. These checks do not confirm deployed account connectivity; the first receipt procedure above is the live acceptance test.

### Local verification on 2 October 2026

- Both production builds and TypeScript checks passed. Ledgr's full lint and tax/password/storage suite passed, including 15 existing storage scenarios and 6 connector checks. Airtail's 7 connector checks and lint on all connector changes passed.
- Playwright exercised synthetic Gmail/Yahoo receipts at 1440, 390 and 320 pixels: pagination, a failed retrieval and retry, explicit AUD entry, review/save, asset metadata, duplicate blocking across years, retention of the original MIME email and disconnect preserving saved evidence. No page errors or horizontal overflow occurred. The expected console 503 was injected for the retry case.
- Browser artifacts are in Ledgr's `output/playwright/airtail-*.png`, `airtail-flow.js`, `airtail-browser-run.log` and `airtail-browser-results.json`. They contain synthetic data only.
- Airtail's existing full lint still reports 17 errors and 4 warnings in unrelated files. Its dependency audit still reports 26 issues, including 2 critical issues. The Yahoo IMAP client was upgraded within its existing major version to remove three high-severity transitive findings; the new MIME parser is not listed as vulnerable by the audit. Existing build warnings about the exchange-rate model's duplicate index and the Node loader remain.
- Live mailbox retrieval, deployed OAuth callbacks and production migrations were not run. The connector must be configured and deployed before the live acceptance test.

## Protocol references

- [Gmail message retrieval](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get)
- [Gmail attachment access and scopes](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get)
- [ImapFlow API](https://imapflow.com/module-imapflow-ImapFlow.html)
- [MailParser MIME parsing](https://nodemailer.com/extras/mailparser)

## Current production setup

Ledgr runs at https://ledgr-alphav2.vercel.app and Airtail at https://airtail.vercel.app. Both project configurations register these origins in `vercel.json`; Ledgr encrypts connector tokens with its existing server-only `AUTH_SECRET` unless `AIRTAIL_CONNECTOR_SECRET` is configured. Migration 006 and Airtail grant indexes were applied on 2 October 2026. Start in Ledgr Settings → Connections → Connect Airtail, sign into your existing Airtail account, then allow receipt access. Select a financial year, retrieve receipts, and review before saving.
# Smart receipt shortlist

In web Settings → Connections, retrieval requests an occupation-aware shortlist. Possible work expenses and receipts needing details appear by default; likely personal purchases remain accessible through the personal and all-receipts filters. The selected financial year and pagination still govern retrieval. Update the occupation in Profile and refresh to reassess the shortlist.

Known ordinary personal purchases are sorted using conservative rules. Other summaries can use Ledgr's existing AI provider fallback chain. Only bounded merchant, subject, category, purchase date, amount/currency and the work profile are sent; original emails, attachments and mailbox credentials are excluded. Output must match the supplied receipt IDs and allowed categories. Invalid output, timeouts or provider failures return rule suggestions, labelled as rule sorting in the UI. Missing saved occupation never inherits a sample occupation.

Suggestions do not change totals, save expenses or infer work-use percentages. Review the original receipt and confirm work use, reimbursement and any asset treatment before saving. WFH running-cost suggestions flag possible overlap with the fixed-rate method. See the [ATO's work-related expense conditions](https://www.ato.gov.au/myTax25Deductions) and [WFH expense guidance](https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/working-from-home-expenses).

Run `npm run check` for shortlist parsing, classification safeguards and provider-failure checks alongside connector import and storage regressions. Browser fixtures cover default filtering, access to all receipts, pagination, year changes, failed refreshes and review starting at 0% work use.
