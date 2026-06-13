# TaxLens

Australian tax deduction tracker built for software engineers and IT professionals.

## Features

- **Dashboard** -- overview of total deductions, estimated tax savings, category breakdown
- **Expense Tracker** -- full CRUD with ATO categories for IT professionals, smart $300 threshold logic (full claim vs depreciation), receipt upload
- **Work From Home** -- calendar-based WFH hour logging with ATO fixed rate (67c/hr) and actual cost method comparison
- **Depreciation Schedule** -- asset tracking with ATO effective lives, diminishing value and prime cost methods, work-use percentage split
- **Reports** -- exportable tax summary, expenses, WFH log, and depreciation schedule as CSV
- **Settings** -- income details, financial year, data export/import backup

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
- localStorage (no backend required)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data Storage

All data is stored in browser localStorage. Use Settings > Export Backup to save your data as JSON, and Import Backup to restore it.
