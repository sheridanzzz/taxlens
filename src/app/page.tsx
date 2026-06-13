import type { Metadata } from "next";
import Link from "next/link";
import { LedgrLogo } from "@/components/LedgrLogo";

export const metadata: Metadata = {
  title: "Ledgr — Every Aussie tax deduction, tracked.",
  description:
    "Ledgr is the tax deduction tracker built for Australian software engineers and remote workers. ATO-aware, $300 threshold logic, WFH at 67c/hr, depreciation, and a live refund estimate.",
};

function PillBtn({
  children,
  variant = "primary",
  href = "#",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  href?: string;
  className?: string;
}) {
  const base =
    "btn-press inline-flex items-center justify-center rounded-full px-5 py-3 text-[15px] font-semibold leading-none whitespace-nowrap";
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground"
      : variant === "secondary"
        ? "bg-secondary text-secondary-foreground"
        : "text-foreground hover:bg-secondary";
  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-mint-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {children}
    </span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <TrustStrip />
      <Features />
      <DashboardPreview />
      <HowItWorks />
      <CTASection />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <LedgrLogo />
        <nav className="hidden items-center gap-8 text-[15px] font-semibold text-foreground/80 md:flex">
          <a className="hover:text-foreground" href="#features">Features</a>
          <a className="hover:text-foreground" href="#how">How it works</a>
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
        </nav>
        <div className="flex items-center gap-2">
          <PillBtn variant="ghost" className="hidden sm:inline-flex" href="/dashboard">Open app</PillBtn>
          <PillBtn href="/dashboard">Get started</PillBtn>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
        <div className="max-w-[980px]">
          <Eyebrow>For Australian tech workers</Eyebrow>
          <h1 className="headline mt-6 text-[56px] sm:text-[88px] lg:text-[112px]">
            Track every<br />
            deduction.<br />
            Keep every<br />
            <span className="relative inline-block">
              <span className="relative z-10">dollar.</span>
              <span className="absolute inset-x-0 bottom-[0.08em] z-0 h-[0.28em] bg-primary" />
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-[18px] font-medium leading-[1.44] text-ink-soft sm:text-[20px]">
            Ledgr is the tax deduction tracker built for Australian software engineers
            and remote workers. ATO-aware categories, WFH at 67c/hr, depreciation done
            right, and a live refund estimate — so you walk into tax time already done.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <PillBtn href="/dashboard">Get started free</PillBtn>
            <PillBtn variant="secondary" href="#how">See how it works</PillBtn>
            <span className="ml-1 text-[14px] font-medium text-muted-foreground">
              Free · Data stays in your browser
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { k: "$300", v: "instant deduction threshold" },
    { k: "67c/hr", v: "ATO WFH fixed rate" },
    { k: "2025–26", v: "tax brackets + Medicare" },
    { k: "DV & PC", v: "depreciation methods" },
  ];
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-px overflow-hidden bg-border px-0 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.k} className="bg-card px-6 py-8 sm:px-8 sm:py-10">
            <div className="headline text-[40px] sm:text-[48px]">{it.k}</div>
            <div className="mt-2 text-[14px] font-semibold text-muted-foreground">
              {it.v}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const cards = [
    {
      tag: "01",
      title: "Smart expense tracking",
      body: "Auto-categorised against ATO classes — computer equipment, software, internet, professional development. The $300 threshold logic decides instant claim vs depreciation for you.",
      preview: <ExpensePreview />,
    },
    {
      tag: "02",
      title: "WFH, the ATO way",
      body: "Log hours and Ledgr calculates the fixed-rate method at 67c/hr or the actual cost method. Switch between them and see which one wins your year.",
      preview: <WfhPreview />,
    },
    {
      tag: "03",
      title: "Asset depreciation, done",
      body: "Diminishing value and prime cost schedules using ATO effective lives. Your laptop, monitor and desk on a real, defensible schedule.",
      preview: <DepreciationPreview />,
    },
    {
      tag: "04",
      title: "Live refund estimate",
      body: "Real-time savings against 2024–25 and 2025–26 brackets plus Medicare levy. Watch your refund grow as you add receipts.",
      preview: <RefundPreview />,
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
      <div className="max-w-[820px]">
        <Eyebrow>What it does</Eyebrow>
        <h2 className="headline mt-5 text-[44px] sm:text-[64px]">
          Built for the way<br />engineers actually work.
        </h2>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
        {cards.map((c) => (
          <article
            key={c.tag}
            className="ring-card group flex flex-col overflow-hidden rounded-[30px] bg-card p-7 transition-transform duration-300 hover:-translate-y-1 sm:p-9"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold tracking-[0.18em] text-muted-foreground">
                {c.tag}
              </span>
              <span className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <h3 className="headline mt-6 text-[32px] sm:text-[40px]">{c.title}</h3>
            <p className="mt-4 max-w-[46ch] text-[16px] font-medium leading-[1.5] text-ink-soft">
              {c.body}
            </p>
            <div className="mt-8">{c.preview}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExpensePreview() {
  const rows = [
    { name: "MacBook Pro 14\"", cat: "Computer equipment", amt: "$3,499", tag: "Depreciate", warm: true },
    { name: "JetBrains All Pack", cat: "Software subscription", amt: "$289", tag: "Instant", warm: false },
    { name: "Standing desk", cat: "Office furniture", amt: "$420", tag: "Depreciate", warm: true },
    { name: "Ergonomic chair", cat: "Office furniture", amt: "$249", tag: "Instant", warm: false },
  ];
  return (
    <div className="ring-card rounded-2xl bg-background p-3">
      <div className="flex flex-col divide-y divide-border">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{r.name}</div>
              <div className="truncate text-[12px] font-medium text-muted-foreground">{r.cat}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.warm ? "bg-secondary text-secondary-foreground" : "bg-mint text-mint-foreground"}`}>
                {r.tag}
              </span>
              <span className="text-[14px] font-bold tabular-nums">{r.amt}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WfhPreview() {
  return (
    <div className="ring-card rounded-2xl bg-background p-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">This week</div>
          <div className="headline mt-1 text-[36px]">38.5 hrs</div>
        </div>
        <div className="text-right">
          <div className="text-[12px] font-semibold text-muted-foreground">at 67c/hr</div>
          <div className="text-[18px] font-bold text-foreground">$25.79</div>
        </div>
      </div>
      <div className="mt-5 flex items-end gap-2">
        {[6, 8, 7.5, 8, 9, 0, 0].map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-md bg-primary/80" style={{ height: `${Math.max(h * 6, 4)}px` }} />
            <span className="text-[10px] font-semibold text-muted-foreground">{"MTWTFSS"[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepreciationPreview() {
  return (
    <div className="ring-card rounded-2xl bg-background p-5">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold">MacBook Pro 14&quot;</div>
        <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-mint-foreground">DV · 2 yrs</span>
      </div>
      <svg viewBox="0 0 320 100" className="mt-4 w-full">
        <defs>
          <linearGradient id="dv" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#9fe870" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#9fe870" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,18 C60,20 100,40 160,55 C220,70 260,82 320,90 L320,100 L0,100 Z" fill="url(#dv)" />
        <path d="M0,18 C60,20 100,40 160,55 C220,70 260,82 320,90" fill="none" stroke="#163300" strokeWidth="2" />
      </svg>
      <div className="mt-3 flex justify-between text-[12px] font-semibold text-muted-foreground">
        <span>Yr 1 · $1,166</span>
        <span>Yr 2 · $778</span>
        <span>Yr 3 · $519</span>
      </div>
    </div>
  );
}

function RefundPreview() {
  return (
    <div className="ring-card rounded-2xl bg-background p-5">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated refund · 2025–26</div>
      <div className="headline mt-2 text-[44px] tabular-nums">$2,184</div>
      <div className="mt-1 text-[13px] font-semibold text-muted-foreground">from $5,940 in claimed deductions · 37% bracket</div>
      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-[72%] rounded-full bg-primary" />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-muted-foreground">
        <span>Tracked</span>
        <span>72% of last year</span>
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="ring-card overflow-hidden rounded-[40px] bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#e8c547]" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <span className="text-[12px] font-semibold text-muted-foreground">ledgr.app / dashboard</span>
          <span className="text-[12px] font-semibold text-muted-foreground">FY 2025–26</span>
        </div>
        <div className="grid grid-cols-1 gap-6 p-6 sm:p-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Eyebrow>Year to date</Eyebrow>
            <div className="headline mt-4 text-[48px] sm:text-[72px]">$5,940</div>
            <div className="text-[14px] font-semibold text-muted-foreground">in tracked deductions across 32 receipts</div>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[["Equipment", "$3,920"], ["Software", "$612"], ["WFH", "$998"], ["Internet", "$410"]].map(([k, v]) => (
                <div key={k} className="ring-card rounded-2xl bg-background p-4">
                  <div className="text-[12px] font-semibold text-muted-foreground">{k}</div>
                  <div className="mt-1 text-[20px] font-bold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ring-card rounded-[24px] bg-background p-6">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Refund estimate</div>
            <div className="headline mt-2 text-[44px] tabular-nums">$2,184</div>
            <div className="mt-1 text-[13px] font-semibold text-muted-foreground">37% marginal · incl. Medicare</div>
            <div className="mt-6 space-y-3 text-[13px] font-medium">
              {[["Gross deductions", "$5,940"], ["WFH (67c/hr)", "$998"], ["Depreciation Yr1", "$1,166"], ["Net taxable saving", "$2,184"]].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-bold tabular-nums">{v}</span>
                </div>
              ))}
            </div>
            <Link href="/reports" className="btn-press mt-6 flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground">
              Export CSV for tax time
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Add expenses", body: "Snap a receipt or type it in. Ledgr categorises against ATO classes and decides instant vs depreciate." },
    { n: "02", title: "Log WFH hours", body: "Tap your hours each week. We compute both 67c/hr and actual cost so you claim whichever wins." },
    { n: "03", title: "Export at tax time", body: "Download a clean CSV — categorised, totalled, ATO-friendly. Hand it to your accountant or load it straight in." },
  ];
  return (
    <section id="how" className="bg-card">
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-[640px]">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="headline mt-5 text-[44px] sm:text-[64px]">
              Three steps.<br />One refund.
            </h2>
          </div>
          <p className="max-w-md text-[16px] font-medium leading-[1.5] text-ink-soft">
            No accounts. No upload to a server. Everything stays in your browser until you choose to export it.
          </p>
        </div>
        <ol className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.n} className="ring-card relative rounded-[30px] bg-background p-8">
              <div className="flex items-center justify-between">
                <span className="headline text-[56px] text-foreground/15">{s.n}</span>
                {i < steps.length - 1 && (
                  <span className="hidden text-foreground/30 md:block">
                    <svg width="32" height="14" viewBox="0 0 32 14" fill="none">
                      <path d="M1 7h28m0 0L23 1m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
              </div>
              <h3 className="headline mt-4 text-[28px]">{s.title}</h3>
              <p className="mt-3 text-[15px] font-medium leading-[1.5] text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-32">
      <div className="ring-card relative overflow-hidden rounded-[40px] bg-background px-6 py-16 sm:px-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Tax time, sorted</Eyebrow>
          <h2 className="headline mt-6 text-[52px] sm:text-[80px]">
            Stop leaving money<br />
            <span className="relative inline-block">
              <span className="relative z-10">on the table.</span>
              <span className="absolute inset-x-0 bottom-[0.08em] z-0 h-[0.28em] bg-primary" />
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[17px] font-medium leading-[1.5] text-ink-soft">
            Free forever for individuals. No sign-up wall. Your data stays in your browser — nothing leaves until you export it.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <PillBtn href="/dashboard">Start tracking free</PillBtn>
            <PillBtn variant="secondary" href="https://github.com/sheridanzzz/taxlens">View on GitHub</PillBtn>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <LedgrLogo />
          <p className="mt-4 max-w-sm text-[13px] font-medium leading-[1.55] text-muted-foreground">
            Made in Australia for Australian tech workers. Ledgr is an
            organisational tool — it is not financial, legal, or tax advice.
            Always confirm with a registered tax agent.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-[14px] font-semibold sm:grid-cols-3">
          {[
            ["Product", ["Features", "How it works", "Dashboard"]],
            ["Resources", ["ATO categories", "WFH guide", "Depreciation"]],
            ["About", ["GitHub", "Privacy", "Disclaimer"]],
          ].map(([h, items]) => (
            <div key={h as string}>
              <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{h as string}</div>
              <ul className="space-y-2">
                {(items as string[]).map((item) => (
                  <li key={item}>
                    <a className="text-foreground/85 hover:text-foreground" href="#">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-2 px-5 py-6 text-[12px] font-medium text-muted-foreground sm:flex-row sm:items-center sm:px-8">
          <span>&copy; {new Date().getFullYear()} Ledgr. Built for FY 2025–26.</span>
          <span>Not affiliated with the Australian Taxation Office.</span>
        </div>
      </div>
    </footer>
  );
}
