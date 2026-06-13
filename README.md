# Ledgr

Every Aussie tax deduction, tracked. Built for software engineers and remote workers.

## Features

- **Dashboard** — overview of total deductions, estimated tax savings, category breakdown
- **Expense Tracker** — ATO categories for IT professionals, smart $300 threshold logic (full claim vs depreciation), AI receipt scanning via OpenRouter
- **Work From Home** — calendar-based WFH hour logging with ATO fixed rate (67c/hr) and actual cost method comparison
- **Depreciation Schedule** — asset tracking with ATO effective lives, diminishing value and prime cost methods
- **Reports** — exportable tax summary, expenses, WFH log, and depreciation schedule as CSV
- **Settings** — income details, financial year, data export/import backup

## ATO Rules Built In

- $300 instant deduction threshold for individuals
- Fixed rate method: 67c per WFH hour
- Depreciation: diminishing value (200% / effective life) and prime cost (100% / effective life)
- 2024-25 and 2025-26 Australian tax brackets with Medicare levy
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
