import type { Metadata } from "next";
import Link from "next/link";
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

/* ------------------------------ primitives ------------------------------ */

function Btn({
  children,
  variant = "primary",
  href = "#",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "outline";
  href?: string;
  className?: string;
}) {
  const base =
    "btn-press inline-flex items-center justify-center gap-2 h-11 px-5 text-[14px] font-medium leading-none whitespace-nowrap rounded-[6px]";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-foreground"
      : variant === "outline"
        ? "border border-border bg-transparent text-foreground hover:bg-secondary"
        : "text-foreground hover:bg-secondary";
  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--highlight)]" />;
}

/* --------------------------------- nav ---------------------------------- */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-6">
        <LedgrLogo />
        <nav className="hidden items-center gap-7 text-[13.5px] text-ink-soft md:flex">
          <a className="hover:text-foreground" href="#product">Product</a>
          <a className="hover:text-foreground" href="#deductions">Deductions</a>
          <a className="hover:text-foreground" href="#pricing">Pricing</a>
          <a className="hover:text-foreground" href="#faq">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Btn variant="ghost" href="/dashboard" className="hidden sm:inline-flex">Sign in</Btn>
          <Btn href="/dashboard">
            Open Ledgr <Arrow />
          </Btn>
        </div>
      </div>
    </header>
  );
}

/* --------------------------------- hero --------------------------------- */

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="container-x grid grid-cols-1 gap-12 py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-28">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 text-[12px] text-ink-soft">
            <Dot />
            <span className="eyebrow !text-ink-soft">FY 2025-26 &middot; ATO aligned</span>
          </div>
          <h1 className="headline mt-6 text-[52px] sm:text-[68px] lg:text-[78px]">
            Every Australian tax<br />
            deduction, <span className="italic font-serif text-ink-soft">on the record.</span>
          </h1>
          <p className="mt-7 max-w-xl text-[16.5px] leading-[1.65] text-ink-soft">
            Ledgr is the deduction system of record for Australian software engineers
            and remote workers. Expense capture, WFH hours at 67c, depreciation
            schedules, and a live refund estimate on the current ATO brackets.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Btn href="/dashboard">
              Open dashboard <Arrow />
            </Btn>
            <Btn variant="outline" href="#product">See how it works</Btn>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12.5px] text-ink-soft">
            <span className="flex items-center gap-2"><Dot /> Read-only bank import</span>
            <span className="flex items-center gap-2"><Dot /> myTax-ready exports</span>
            <span className="flex items-center gap-2"><Dot /> Data stays in Australia</span>
          </div>
        </div>

        <RefundCard />
      </div>
    </section>
  );
}

function RefundCard() {
  return (
    <div className="ring-card overflow-hidden rounded-[14px] bg-surface">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Live estimate</span>
        </div>
        <span className="num text-[12px] text-ink-soft">FY 25-26</span>
      </div>

      <div className="px-6 py-7">
        <div className="text-[12.5px] text-ink-soft">Projected refund</div>
        <div className="mt-2 flex items-baseline gap-3">
          <div className="num text-[56px] font-medium leading-none text-foreground">$2,184</div>
          <span className="num text-[13px] text-[color:var(--highlight)]">+ $312 vs last yr</span>
        </div>
        <div className="mt-1 num text-[12.5px] text-ink-soft">on $148,500 taxable income</div>

        <div className="mt-7 space-y-3.5">
          {[
            ["Computer equipment", 1840, 38],
            ["Software & SaaS", 612, 13],
            ["Home office (67c · 1,690 h)", 1132, 23],
            ["Internet & phone", 489, 10],
            ["Professional dev", 760, 16],
          ].map(([label, amt, pct]) => (
            <div key={label as string} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-foreground">{label}</span>
                  <span className="num text-ink-soft">${(amt as number).toLocaleString()}</span>
                </div>
                <div className="mt-1.5 h-[3px] w-full rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 grid grid-cols-3 gap-4 rule-soft pt-6">
          {[
            ["Deductions", "$4,833"],
            ["Marginal rate", "32.5%"],
            ["Effective", "23.4%"],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">{k}</div>
              <div className="num mt-1.5 text-[18px] text-foreground">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- trust strip ------------------------------- */

function TrustStrip() {
  return (
    <section className="border-b border-border bg-surface/60">
      <div className="container-x flex flex-wrap items-center justify-between gap-x-10 gap-y-4 py-6">
        <span className="eyebrow">Trusted by engineers at</span>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-[14px] font-medium text-ink-soft">
          {["Atlassian", "Canva", "Linktree", "SafetyCulture", "Culture Amp", "Octopus"].map((n) => (
            <span key={n} style={{ fontFamily: "var(--font-serif)" }}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ product --------------------------------- */

function Product() {
  const pillars = [
    {
      no: "01",
      title: "Expenses, classified the ATO way",
      body: "Forward a receipt, snap a photo, or import from your card. Ledgr classifies it into a real ATO category, flags the $300 instant-deduction threshold, and decides instant vs depreciate for you.",
      stat: "32 categories",
      sub: "with deductibility rules",
    },
    {
      no: "02",
      title: "WFH hours at 67c, without the spreadsheet",
      body: "Log a day, a week, or your whole calendar. Ledgr tracks hours under the fixed-rate method and runs an actual-cost comparison so you always claim the bigger number.",
      stat: "1,690 h",
      sub: "logged this FY",
    },
    {
      no: "03",
      title: "Depreciation, drawn up for you",
      body: "Anything over $300 gets a full schedule — diminishing value or prime cost, ATO effective lives, year-by-year claim already calculated.",
      stat: "DV + PC",
      sub: "with effective lives",
    },
    {
      no: "04",
      title: "Live refund on the current brackets",
      body: "Brackets, Medicare levy, marginal rate. The number at the top of your dashboard is what you’d actually get back if you lodged today.",
      stat: "2025-26",
      sub: "rates built-in",
    },
  ];

  return (
    <section id="product" className="band border-b border-border">
      <div className="container-x">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="eyebrow">The product</span>
            <h2 className="headline mt-5 text-[42px] sm:text-[52px]">
              A clean ledger,<br />not another shoebox.
            </h2>
            <p className="mt-5 max-w-md text-[15.5px] leading-[1.65] text-ink-soft">
              Ledgr replaces the receipts folder, the WFH spreadsheet, and the
              end-of-year scramble with one quiet system that&apos;s correct all year.
            </p>
          </div>

          <div className="grid grid-cols-1 divide-y divide-border border-y border-border md:grid-cols-2 md:divide-y-0 md:divide-x">
            {pillars.map((p, i) => (
              <article
                key={p.no}
                className={`p-7 ${i >= 2 ? "md:border-t md:border-border" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="num text-[12px] text-ink-soft">{p.no}</span>
                  <span className="eyebrow">{p.sub}</span>
                </div>
                <h3
                  className="mt-5 text-[22px] leading-[1.15] tracking-[-0.01em] text-foreground"
                  style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                >
                  {p.title}
                </h3>
                <p className="mt-3 text-[14.5px] leading-[1.65] text-ink-soft">{p.body}</p>
                <div className="num mt-6 text-[28px] text-foreground">{p.stat}</div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ deductions ------------------------------ */

function Deductions() {
  const rows = [
    ["Computer equipment", "Hardware over $300 routes to depreciation; under, claimed instantly.", "Instant + DV"],
    ["Software & SaaS", "JetBrains, Figma, GitHub Copilot, 1Password — pro-rated by work use.", "Instant"],
    ["Home office (67c)", "Fixed-rate hours covering power, internet, stationery, phone.", "Per-hour"],
    ["Home office (actual)", "Itemised running costs with floor-area + work-use apportionment.", "Itemised"],
    ["Internet & phone", "Default 80/20 work-use split, adjustable per line.", "Apportioned"],
    ["Professional dev", "Conferences, courses, certifications, technical books.", "Instant"],
    ["Furniture > $300", "Desks, chairs, monitor arms — schedules drawn automatically.", "DV / PC"],
    ["Vehicle (cents/km)", "Up to 5,000 km at the FY rate, logbook-ready beyond that.", "85c/km"],
  ];

  return (
    <section id="deductions" className="band border-b border-border bg-surface/60">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="eyebrow">What you can claim</span>
            <h2 className="headline mt-5 text-[42px] sm:text-[52px]">
              Every category the ATO<br />actually recognises.
            </h2>
          </div>
          <p className="max-w-sm text-[14.5px] leading-[1.65] text-ink-soft">
            Eight ledgers, one source of truth. Each row carries its own
            deductibility rule and feeds the refund estimate at the top of
            your dashboard.
          </p>
        </div>

        <div className="ring-card mt-10 overflow-hidden rounded-[12px] bg-surface">
          <div className="hidden grid-cols-[1.2fr_2fr_120px] items-center border-b border-border px-6 py-3.5 sm:grid">
            <span className="eyebrow">Category</span>
            <span className="eyebrow">How Ledgr handles it</span>
            <span className="eyebrow text-right">Method</span>
          </div>
          {rows.map(([cat, body, method], i) => (
            <div
              key={cat}
              className={`grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-[1.2fr_2fr_120px] sm:items-center sm:gap-4 ${i !== rows.length - 1 ? "border-b border-border" : ""}`}
            >
              <div
                className="text-[15px] text-foreground"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                {cat}
              </div>
              <div className="text-[13.5px] leading-[1.6] text-ink-soft">{body}</div>
              <div className="sm:text-right">
                <span className="num inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground">
                  {method}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- flow --------------------------------- */

function Flow() {
  const steps = [
    {
      no: "I.",
      title: "Capture",
      body: "Forward an invoice, snap a receipt, or connect your bank. Ledgr reads the line items and proposes a category.",
    },
    {
      no: "II.",
      title: "Classify",
      body: "Threshold check, work-use split, instant vs depreciate. You confirm with a single keystroke.",
    },
    {
      no: "III.",
      title: "Schedule",
      body: "Anything over $300 gets a depreciation schedule on the ATO effective life. WFH hours roll into the 67c method automatically.",
    },
    {
      no: "IV.",
      title: "Lodge",
      body: "Export an ATO-friendly summary, send it to your accountant, or copy the numbers straight into myTax.",
    },
  ];

  return (
    <section className="band border-b border-border">
      <div className="container-x">
        <div className="max-w-2xl">
          <span className="eyebrow">The flow</span>
          <h2 className="headline mt-5 text-[42px] sm:text-[52px]">
            Four steps. Same four,<br />every transaction.
          </h2>
        </div>

        <ol className="mt-12 grid grid-cols-1 divide-y divide-border border-y border-border md:grid-cols-4 md:divide-y-0 md:divide-x">
          {steps.map((s) => (
            <li key={s.no} className="p-7">
              <div className="num text-[12px] tracking-[0.18em] text-[color:var(--highlight)]">{s.no}</div>
              <h3
                className="mt-5 text-[22px] tracking-[-0.01em] text-foreground"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                {s.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.65] text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------- numbers ------------------------------- */

function Numbers() {
  const stats = [
    ["$4,833", "average deductions found in the first 90 days"],
    ["67c / h", "fixed-rate WFH method, calculated daily"],
    ["$300", "instant deduction threshold, enforced automatically"],
    ["2025-26", "ATO brackets and Medicare levy, built in"],
  ];
  return (
    <section className="border-b border-border bg-primary text-primary-foreground">
      <div className="container-x grid grid-cols-2 gap-y-10 py-16 md:grid-cols-4">
        {stats.map(([n, l]) => (
          <div key={n}>
            <div className="num text-[40px] leading-none">{n}</div>
            <div className="mt-3 max-w-[180px] text-[13px] leading-[1.55] text-primary-foreground/70">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- quote --------------------------------- */

function Quote() {
  return (
    <section className="band border-b border-border">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <span className="eyebrow">A note from the team</span>
        <figure>
          <blockquote
            className="text-[28px] leading-[1.25] tracking-[-0.015em] text-foreground sm:text-[36px]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
          >
            <span className="text-[color:var(--highlight)]">&ldquo;</span>
            Most of us are leaving money on the table because the ATO categories
            don&apos;t map cleanly to how engineers actually spend. Ledgr is the
            translation layer &mdash; quiet, correct, and on your side at tax time.
            <span className="text-[color:var(--highlight)]">&rdquo;</span>
          </blockquote>
          <figcaption className="mt-8 flex items-center gap-3 text-[13px] text-ink-soft">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground" style={{ fontFamily: "var(--font-serif)" }}>R</span>
            <div>
              <div className="text-foreground">Riley Chen</div>
              <div className="text-ink-soft">Founder, Ledgr &middot; ex-staff engineer</div>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* -------------------------------- pricing ------------------------------- */

function Pricing() {
  const tiers = [
    {
      name: "Solo",
      price: "$0",
      cadence: "free, forever",
      desc: "Track up to 50 deductions and a single WFH calendar.",
      features: ["50 deductions / yr", "WFH 67c method", "Refund estimate", "CSV export"],
      cta: "Start free",
      featured: false,
    },
    {
      name: "Pro",
      price: "$8",
      cadence: "per month, billed yearly",
      desc: "Everything an Aussie tech worker needs at tax time.",
      features: [
        "Unlimited deductions",
        "Depreciation schedules (DV + PC)",
        "Bank & email forwarding",
        "myTax-ready exports",
        "Receipt OCR + archive",
      ],
      cta: "Start 30-day trial",
      featured: true,
    },
    {
      name: "Household",
      price: "$14",
      cadence: "per month, billed yearly",
      desc: "Two earners, one ledger. Share categories and exports.",
      features: ["Everything in Pro", "Two filers", "Accountant share link", "Priority support"],
      cta: "Start trial",
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="band border-b border-border bg-surface/60">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="eyebrow">Pricing</span>
            <h2 className="headline mt-5 text-[42px] sm:text-[52px]">
              Less than a coffee.<br />Pays for itself in week one.
            </h2>
          </div>
          <p className="max-w-sm text-[14.5px] leading-[1.65] text-ink-soft">
            Pricing in AUD, incl. GST. Pro and Household come with a 30-day
            trial &mdash; no card required.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] bg-border md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`flex flex-col p-8 ${t.featured ? "bg-primary text-primary-foreground" : "bg-surface text-foreground"}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[18px]"
                  style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                >
                  {t.name}
                </span>
                {t.featured && (
                  <span className="num rounded-full bg-[color:var(--highlight)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#3a2a00]">
                    Most picked
                  </span>
                )}
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="num text-[44px] leading-none">{t.price}</span>
                <span className={`text-[12.5px] ${t.featured ? "text-primary-foreground/70" : "text-ink-soft"}`}>
                  {t.cadence}
                </span>
              </div>
              <p className={`mt-3 text-[13.5px] leading-[1.6] ${t.featured ? "text-primary-foreground/80" : "text-ink-soft"}`}>
                {t.desc}
              </p>
              <ul className="mt-7 space-y-2.5 text-[13.5px]">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${t.featured ? "bg-[color:var(--highlight)]" : "bg-foreground/60"}`} />
                    <span className={t.featured ? "text-primary-foreground/90" : "text-foreground"}>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <Link
                  href="/dashboard"
                  className={`btn-press inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] text-[14px] font-medium ${t.featured ? "bg-[color:var(--highlight)] text-[#3a2a00]" : "bg-primary text-primary-foreground"}`}
                >
                  {t.cta} <Arrow />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- FAQ --------------------------------- */

function FAQ() {
  const qs = [
    ["Is Ledgr ATO-aligned?", "Ledgr follows the ATO’s published deduction categories, the $300 instant-deduction threshold, the 67c fixed-rate WFH method, and the 2025-26 brackets. We update as the ATO updates."],
    ["Does Ledgr lodge my return?", "No. Ledgr prepares a clean, ATO-ready summary you can hand to your tax agent or copy straight into myTax."],
    ["Where does my data live?", "On Australian-region infrastructure. Your bank connection is read-only and you can revoke it at any time."],
    ["Can my accountant use it?", "Yes. Generate a share link and your accountant gets read-only access to your ledger, schedules, and exports."],
  ];
  return (
    <section id="faq" className="band border-b border-border">
      <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div>
          <span className="eyebrow">FAQ</span>
          <h2 className="headline mt-5 text-[42px] sm:text-[52px]">
            Short answers,<br />no fine print.
          </h2>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {qs.map(([q, a]) => (
            <details key={q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6">
                <span
                  className="text-[19px] tracking-[-0.01em] text-foreground"
                  style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                >
                  {q}
                </span>
                <span className="num text-[20px] text-ink-soft transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.7] text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- CTA --------------------------------- */

function CTA() {
  return (
    <section className="border-b border-border bg-primary text-primary-foreground">
      <div className="container-x grid grid-cols-1 items-end gap-10 py-20 lg:grid-cols-[2fr_1fr]">
        <h2
          className="text-[44px] leading-[0.98] tracking-[-0.02em] sm:text-[64px]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
        >
          Open Ledgr.<br />
          <span className="italic text-primary-foreground/60">Pay the right amount of tax.</span>
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link href="/dashboard" className="btn-press inline-flex h-12 items-center justify-center gap-2 rounded-[6px] bg-[color:var(--highlight)] px-6 text-[14px] font-medium text-[#3a2a00]">
            Open dashboard <Arrow />
          </Link>
          <a href="#pricing" className="btn-press inline-flex h-12 items-center justify-center gap-2 rounded-[6px] border border-primary-foreground/30 px-6 text-[14px] font-medium text-primary-foreground hover:bg-primary-foreground/10">
            See pricing
          </a>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- footer -------------------------------- */

function Footer() {
  return (
    <footer className="bg-background">
      <div className="container-x py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2">
            <LedgrLogo />
            <p className="mt-4 max-w-xs text-[13px] leading-[1.65] text-ink-soft">
              The tax deduction system of record, built for Australian software
              engineers and remote workers.
            </p>
          </div>
          {[
            ["Product", ["Dashboard", "Deductions", "Depreciation", "Reports"]],
            ["Company", ["About", "Privacy", "Terms", "Contact"]],
          ].map(([h, items]) => (
            <div key={h as string}>
              <div className="eyebrow">{h as string}</div>
              <ul className="mt-4 space-y-2.5 text-[13.5px] text-ink-soft">
                {(items as string[]).map((i) => (
                  <li key={i}><a href="#" className="hover:text-foreground">{i}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-[12px] text-ink-soft">
          <div>&copy; {new Date().getFullYear()} Ledgr Pty Ltd &middot; ABN 00 000 000 000</div>
          <div className="num">Made in Sydney &middot; Hosted in AU</div>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------- assembly ------------------------------ */

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <TrustStrip />
        <Product />
        <Deductions />
        <Flow />
        <Numbers />
        <Quote />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
