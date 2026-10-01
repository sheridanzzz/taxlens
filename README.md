# Ledgr

Every Aussie tax deduction, tracked. Built for software engineers and remote workers.

## Features

- **Dashboard** — overview of total deductions, estimated tax savings, category breakdown
- **Receipt review** — swipe right to confirm a saved scan, left to mark it personal, or edit in place. Includes undo, keyboard controls, and reduced-motion support.
- **Expense Tracker** — ATO categories for IT professionals, smart $300 threshold logic (full claim vs depreciation), AI receipt scanning via OpenRouter
- **Work From Home** — calendar-based WFH hour logging with ATO fixed rate (70c/hr) and actual cost method comparison
- **Depreciation Schedule** — asset tracking with ATO effective lives, diminishing value and prime cost methods
- **Reports** — exportable tax summary, expenses, WFH log, and depreciation schedule as CSV
- **Settings** — income details, financial year, data export/import backup

## ATO Rules Built In

- $300 instant deduction threshold for individuals
- Fixed rate method: 70c per WFH hour
- Depreciation: diminishing value (200% / effective life) and prime cost (100% / effective life)
- 2024–25 through 2026–27 tax brackets, LITO, Medicare and HELP estimates
- Pre-loaded effective lives for common IT assets (laptops, monitors, desks, etc.)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- Shadcn/UI (base-ui)
- Recharts
- Supabase (auth + database) or localStorage fallback
- OpenRouter (free AI models for receipt scanning)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data Storage

Without Supabase configured, all data is stored in browser localStorage. Use Settings > Export Backup to save your data as JSON.

With Supabase configured (`.env.local`), data is stored in Postgres with row-level security per user.

Receipt review progress is remembered per account in this browser; editing a checked expense brings it back for review. Marking an expense personal saves 0% work use and a $0 claim through the normal storage backend while keeping its receipt. Undo is available during the current review session. Linked depreciating receipts update the asset work use too. Undo restores both records. Original images and PDFs are retained in receipt viewing and backups.


## Updating an existing cloud database

Apply `supabase/migrations/005_linked_claims.sql` in your Neon or Supabase SQL editor **before deploying this code**. Existing databases must already have migrations 001–004 (or the equivalent Neon base schema). Migration 005 is transactional and safe to rerun. It adds receipt/asset links, car metadata and tax options; installs atomic claim-save/delete functions; and enables the missing CGT row-level security policy on Supabase.

The migration links old receipts only when exactly one asset matches the same owner, description, purchase date and amount. Ambiguous records remain unlinked: select the matching asset when editing that receipt. Receipts discarded by older scanner versions cannot be reconstructed from asset metadata.

New ownership foreign keys enforce all subsequent writes without discarding historical rows. After reviewing any historical cross-account links, validate them with:

```sql
alter table expenses validate constraint expenses_owned_asset;
alter table rental_transactions validate constraint rental_transactions_owned_property;
```

Neon authenticates server actions and explicitly checks ownership on conflicting record IDs. Supabase uses invoker-security functions and row-level policies. Database access failures are shown as errors; pending forms remain available to retry.

## Checks

```bash
npm run check
npx tsc --noEmit
npm run lint
npm run build -- --webpack
npm audit
```

`npm run check` covers the tax regressions and runs actual PostgreSQL migration, ownership, rollback and receipt-preservation scenarios in an in-memory PGlite database. It does not connect to a live database. The installed PDF.js worker is copied into `public/` during install, development and builds so PDF parsing does not depend on a third-party CDN.

See [calculation scope and source rates](docs/calculation-scope.md) for the supported assumptions and remaining tax-model limitations.
