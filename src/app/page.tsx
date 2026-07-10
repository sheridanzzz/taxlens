import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { LedgrLogo } from "@/components/LedgrLogo";

export const metadata: Metadata = {
  title: "Ledgr — Every Australian tax deduction, on the record.",
  description:
    "Ledgr is the tax deduction system of record for Australian software engineers and remote workers. ATO-aware categories, $300 threshold logic, WFH at 67c/hr, depreciation schedules, and a live refund estimate.",
  openGraph: {
    title: "Ledgr — Every Australian tax deduction, on the record.",
    description:
      "Built for Australian tech workers. Expense tracking, WFH hours, asset depreciation, and a live refund estimate on the 2025-26 brackets.",
  },
};

// Marketing page — illustrative numbers, the app itself is live data.
const ESTIMATE_ROWS: [string, number, number][] = [
  ["Computer equipment", 1840, 90],
  ["Software & SaaS", 612, 30],
  ["Home office (67c · 1,690 h)", 1132, 55],
  ["Internet & phone", 489, 24],
  ["Professional dev", 760, 37],
];

const PRODUCT_FEATURES = [
  {
    n: "01",
    tag: "with deductibility rules",
    title: "Expenses, classified the ATO way",
    body: "Snap a photo of a receipt and the AI reads it, classifies it into a real ATO category, flags the $300 threshold, and decides instant vs depreciate for you.",
    stat: "AI-read receipts",
  },
  {
    n: "02",
    tag: "logged this FY",
    title: "WFH hours at 67c, without the spreadsheet",
    body: "Log a day, a week, or a whole period at once. Ledgr tracks hours under the fixed-rate method and runs an actual-cost comparison so you always claim the bigger number.",
    stat: "67c / hour",
  },
  {
    n: "03",
    tag: "with effective lives",
    title: "Depreciation, drawn up for you",
    body: "Every asset over the threshold gets a schedule, effective life, and prime-cost or diminishing-value calc — carried across years without re-entry.",
    stat: "Auto schedules",
  },
];

const DEDUCTIONS: [string, string][] = [
  ["Home office", "67c fixed-rate method with hour logs and actual-cost comparison"],
  ["Computer & peripherals", "Instant write-off under $300, depreciation above"],
  ["Software & SaaS", "GitHub, JetBrains, AWS, Figma — 100% work-use presumption"],
  ["Internet & phone", "Automatic apportionment with a work-use %"],
  ["Professional development", "Courses, conferences, books, memberships"],
  ["Travel", "Client sites, coworking, off-site work"],
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="h-16 border-b border-border">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <LedgrLogo />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#deductions" className="hover:text-foreground">Deductions</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Open Ledgr <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div>
          <div className="eyebrow mb-5">
            <span className="text-gold">•</span> FY 2025-26 · ATO aligned
          </div>
          <h1 className="font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">
            Every Australian tax deduction,{" "}
            <em className="text-muted-foreground">on the record.</em>
          </h1>
          <p className="mt-6 max-w-lg leading-relaxed text-muted-foreground">
            Ledgr is the deduction system of record for Australian software
            engineers and remote workers. AI receipt capture, WFH hours at 67c,
            depreciation schedules, and a live refund estimate on the current
            ATO brackets.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-5 text-sm hover:bg-surface"
            >
              See dashboard
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {["AI receipt scanning", "myTax-ready exports", "Data stays in Australia"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-gold">•</span> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Live estimate card */}
        <div className="surface p-6 md:p-8">
          <div className="eyebrow flex items-center justify-between">
            <span>Live estimate</span>
            <span>FY 25-26</span>
          </div>
          <div className="mt-6">
            <div className="text-xs text-muted-foreground">Projected refund</div>
            <div className="mt-1 flex items-baseline gap-3">
              <div className="font-serif text-6xl tabular">$2,184</div>
              <span className="text-sm tabular text-gold">+ $312 vs last yr</span>
            </div>
            <div className="mt-1 text-xs tabular text-muted-foreground">
              on <span className="font-mono">$148,500</span> taxable income
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {ESTIMATE_ROWS.map(([label, amt, pct]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-mono tabular text-muted-foreground">
                    ${amt.toLocaleString()}
                  </span>
                </div>
                <div className="relative mt-1.5 h-px bg-border">
                  <div
                    className="absolute inset-y-0 left-0 h-px bg-gold"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              ["Deductions", "$4,833"],
              ["Marginal", "32.5%"],
              ["Effective", "23.4%"],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="eyebrow">{label}</div>
                <div className="mt-1 font-serif text-2xl tabular">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product */}
      <section id="product" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="eyebrow mb-3">
            <span className="text-gold">•</span> The product
          </div>
          <h2 className="max-w-3xl font-serif text-4xl leading-tight md:text-6xl">
            A clean ledger, <em className="text-muted-foreground">not another shoebox.</em>
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Ledgr replaces the receipts folder, the WFH spreadsheet, and the
            end-of-year scramble with one quiet system that&apos;s correct all year.
          </p>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PRODUCT_FEATURES.map((f) => (
              <div key={f.n} className="surface flex flex-col p-6">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono">{f.n}</span>
                  <span>{f.tag}</span>
                </div>
                <h3 className="mt-6 font-serif text-2xl leading-snug">{f.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
                <div className="mt-6 border-t border-border pt-6">
                  <div className="font-serif text-3xl tabular">{f.stat}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deductions */}
      <section id="deductions" className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-20 md:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="eyebrow mb-3">
              <span className="text-gold">•</span> What you can claim
            </div>
            <h2 className="font-serif text-4xl leading-tight md:text-5xl">
              Written for the ATO, priced for the way engineers actually work.
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Ledgr maps every expense to a real ATO category with the current
              rules baked in — apportionment, thresholds, effective life, the lot.
            </p>
          </div>
          <ul className="space-y-4">
            {DEDUCTIONS.map(([t, d]) => (
              <li key={t} className="grid grid-cols-[auto_1fr] gap-4 border-b border-border pb-4">
                <Check className="mt-1 h-4 w-4 text-gold" />
                <div>
                  <div className="font-medium">{t}</div>
                  <div className="text-sm text-muted-foreground">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="eyebrow mb-3">
            <span className="text-gold">•</span> Pricing
          </div>
          <h2 className="max-w-2xl font-serif text-4xl leading-tight md:text-5xl">
            One price. Every deduction. <em className="text-muted-foreground">Every year.</em>
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { name: "Solo", price: "$9", per: "/ month", features: ["Unlimited expenses", "WFH hour tracking", "myTax export"] },
              { name: "Pro", price: "$14", per: "/ month", features: ["Everything in Solo", "AI receipt scanning", "Depreciation schedules", "Priority support"], featured: true },
              { name: "Team", price: "Custom", per: "", features: ["Multi-user", "Accountant seat", "Consolidated returns"] },
            ].map((p) => (
              <div key={p.name} className={`surface p-6 ${p.featured ? "border-gold/50" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <div className="font-serif text-2xl">{p.name}</div>
                  {p.featured && <span className="eyebrow text-gold">Popular</span>}
                </div>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-serif text-5xl tabular">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.per}</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-gold" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium ${
                    p.featured
                      ? "bg-gold text-primary-foreground hover:opacity-90"
                      : "border border-border hover:bg-surface"
                  }`}
                >
                  Start
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <h2 className="mx-auto max-w-3xl font-serif text-4xl leading-tight md:text-6xl">
            Start the FY on the record.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Set up in three minutes. Scan your first receipt in one.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-gold px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Set up Ledgr <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <LedgrLogo size="sm" />
            <span>© {new Date().getFullYear()} Ledgr. Data stays in Australia.</span>
          </div>
          <div className="flex gap-6">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
