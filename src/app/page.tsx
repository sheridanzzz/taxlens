import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  CandlestickChart,
  Check,
  ChevronLeft,
  Clock3,
  Coffee,
  Headphones,
  Laptop,
  Menu,
  Shirt,
  X,
} from "lucide-react";
import { LedgrLogo } from "@/components/LedgrLogo";

export const metadata: Metadata = {
  title: "Ledgr — your refund, filling up all year",
  description:
    "Chuck your work receipts in as you go, swipe to sort them, and watch your refund pot grow. Built on the ATO's rules for Australian employees.",
  openGraph: {
    title: "Ledgr — your refund, filling up all year",
    description:
      "Receipts, work-from-home hours and depreciation, sorted into the labels myTax asks for.",
  },
};

const NAV = [
  ["How it works", "#how"],
  ["What counts", "#claim"],
] as const;

const STEPS = [
  ["bg-butter", "Chuck it in", "Snap a receipt at the counter. The AI reads the shop, the date and what you bought."],
  ["bg-mint", "Swipe to sort", "Check what it read. Claim it, fix it, or bin it if it’s personal."],
  ["bg-pink", "Copy into myTax", "Every figure lands on the label myTax asks for, so October takes minutes."],
] as const;

// what counts — and, honestly, what doesn't
const TILES = [
  ["bg-butter text-plum", Laptop, "Laptop", "Over $300? We spread it over its life for you.", true],
  ["bg-mint text-plum", Clock3, "Hours at home", "70c for every hour you work from home.", true],
  ["bg-pink text-plum", BookOpen, "Courses", "If they’re for the job you have now.", true],
  ["bg-sky text-plum", Headphones, "Headset", "Under $300, so claim it all this year.", true],
  ["bg-plum text-white", CandlestickChart, "Shares & crypto", "We work out the capital gains.", true],
  ["bg-gold text-plum", Building2, "Rental", "Interest, rates, repairs, the lot.", true],
  ["", Coffee, "Coffee", "Nice try.", false],
  ["", Shirt, "Work clothes", "Only if it’s actually a uniform.", false],
] as const;

// Decorative phone mocks for the hero — plain markup, hidden from assistive tech.
const PhoneFrame = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    aria-hidden="true"
    className={`w-[270px] overflow-hidden rounded-[40px] border-[9px] border-[#140a1c] shadow-[0_40px_70px_-30px_rgba(0,0,0,0.6)] ${className}`}
  >
    {children}
  </div>
);

const PhoneHome = () => (
  <div className="relative h-[560px] bg-background px-4 pt-5 text-plum">
    <div className="flex items-center justify-between">
      <span className="text-xl font-black tracking-tight">Hey Sam</span>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-pink text-xs font-extrabold">S</span>
    </div>
    <div className="mt-3 rounded-[22px] bg-plum p-4 text-white">
      <div className="text-xs font-bold text-butter">Refund pot · 2025-26</div>
      <div className="mt-1 text-[40px] font-black leading-none tracking-tight">$2,184</div>
      <span className="mt-3 inline-block rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-extrabold text-plum">
        +$113 this week
      </span>
    </div>
    <div className="mt-4 text-sm font-extrabold">This week</div>
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between rounded-[18px] bg-butter p-3">
        <div>
          <div className="text-[13px] font-extrabold">3 receipts to sort</div>
          <div className="text-[11px] font-medium">Takes about a minute</div>
        </div>
        <span className="rounded-full bg-plum px-3 py-1.5 text-[11px] font-extrabold text-white">Sort now</span>
      </div>
      <div className="flex items-center gap-2.5 rounded-[18px] bg-mint p-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-white"><Clock3 className="h-4 w-4" /></span>
        <div>
          <div className="text-[13px] font-extrabold">30 h at home</div>
          <div className="text-[11px] font-medium">$21 claimed at 70c an hour</div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 rounded-[18px] bg-pink p-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-white"><Laptop className="h-4 w-4" /></span>
        <div>
          <div className="text-[13px] font-extrabold">Laptop, sorted</div>
          <div className="text-[11px] font-medium">$1,840 this year, $239 next</div>
        </div>
      </div>
    </div>
  </div>
);

const PhoneSort = () => (
  <div className="relative h-[560px] bg-plum px-4 pt-5 text-white">
    <div className="flex items-center justify-between text-sm font-extrabold">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-plum-2"><ChevronLeft className="h-4 w-4" /></span>
      Sort your receipts
      <span className="text-xs text-lav">1 of 3</span>
    </div>
    <div className="relative mx-2 mt-6 h-[330px]">
      <div className="absolute inset-x-2 top-4 bottom-0 rotate-6 rounded-[24px] bg-mint" />
      <div className="absolute inset-x-1 top-2 bottom-0 -rotate-3 rounded-[24px] bg-pink" />
      <div className="absolute inset-0 -rotate-1 rounded-[24px] bg-white p-5 text-plum">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-plum text-sm font-black text-white">U</span>
          <div>
            <div className="text-[15px] font-extrabold">Uber</div>
            <div className="text-[11px] font-medium text-muted-foreground">11 Jun · home to the office</div>
          </div>
        </div>
        <div className="mt-5 text-[40px] font-black leading-none tracking-tight">$24.60</div>
        <div className="mt-4 text-[22px] font-black leading-tight">Work trip, or getting to work?</div>
        <div className="mt-2 -rotate-2 font-hand text-xl text-gold">getting to work doesn’t count, sorry</div>
      </div>
    </div>
    <div className="mt-7 flex justify-center gap-8 text-[11px] font-extrabold">
      <span className="flex flex-col items-center gap-1.5">
        <span className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-white"><X className="h-6 w-6" /></span>
        Personal
      </span>
      <span className="flex flex-col items-center gap-1.5">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-butter text-plum"><Check className="h-6 w-6" strokeWidth={3} /></span>
        Claim it
      </span>
    </div>
  </div>
);

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative mx-auto flex h-20 max-w-7xl items-center gap-10 px-5 sm:px-8">
        <LedgrLogo />
        <nav className="hidden gap-8 text-base font-bold md:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="hover:text-gold">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <details className="group md:hidden">
            <summary
              className="grid h-11 w-11 list-none place-items-center rounded-full border border-border bg-surface [&::-webkit-details-marker]:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </summary>
            <nav className="absolute inset-x-4 top-[4.5rem] z-30 grid rounded-[22px] border border-border bg-surface p-2 text-base font-bold shadow-2xl">
              {NAV.map(([label, href]) => (
                <a key={href} href={href} className="rounded-2xl px-4 py-3 hover:bg-surface-2">
                  {label}
                </a>
              ))}
              <Link href="/login" className="rounded-2xl px-4 py-3 hover:bg-surface-2">
                Log in
              </Link>
            </nav>
          </details>
          <Link href="/login" className="hidden text-base font-bold hover:text-gold sm:inline">
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-12 items-center rounded-full bg-plum px-5 text-[15px] font-extrabold text-white hover:opacity-90"
          >
            Start your pot
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative mx-3 overflow-hidden rounded-[32px] bg-plum px-6 pb-0 pt-14 sm:mx-6 sm:rounded-[40px] sm:px-12 lg:h-[720px] lg:px-16 lg:pt-20">
        <div className="relative z-10 max-w-[640px]">
          <h1 className="font-serif text-6xl font-black leading-[0.9] tracking-[-0.05em] text-butter sm:text-7xl lg:text-[104px]">
            Your refund, filling up all year.
          </h1>
          <p className="mt-6 max-w-[520px] text-lg font-medium leading-relaxed text-lav sm:text-xl">
            Chuck your receipts in as you go. Swipe to sort them. Watch your refund pot grow — then
            copy the numbers into myTax in October.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex h-14 items-center rounded-full bg-gold px-7 text-lg font-black text-plum shadow-[4px_4px_0_var(--color-butter)] hover:opacity-95"
            >
              Start your pot
            </Link>
            <a
              href="#how"
              className="inline-flex h-14 items-center rounded-full border-2 border-white/60 px-6 text-lg font-extrabold text-white hover:bg-white/10"
            >
              How it works
            </a>
          </div>
        </div>

        {/* phones: one on small screens, the pair from lg up */}
        <div className="relative mt-12 flex justify-center lg:absolute lg:right-12 lg:top-16 lg:mt-0 lg:block lg:h-full lg:w-[560px]">
          <PhoneFrame className="relative z-10 -mb-24 -rotate-3 lg:absolute lg:left-0 lg:top-2 lg:mb-0">
            <PhoneHome />
          </PhoneFrame>
          <PhoneFrame className="hidden rotate-6 lg:absolute lg:left-[250px] lg:top-10 lg:block">
            <PhoneSort />
          </PhoneFrame>
          <span aria-hidden="true" className="absolute -left-56 top-[440px] z-20 hidden -rotate-6 font-hand text-3xl text-butter lg:block">
            your refund pot →
          </span>
          <span aria-hidden="true" className="absolute right-0 -top-8 hidden rotate-3 font-hand text-[28px] text-mint lg:block">
            swipe right = claim it
          </span>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-7xl px-5 pb-8 pt-40 sm:px-8 lg:pt-28">
        <h2 className="font-serif text-5xl font-black leading-[0.95] tracking-[-0.045em] text-plum md:text-6xl">
          Three steps. No shoebox.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(([tint, title, body], i) => (
            <div key={title} className={`rounded-[28px] p-7 ${tint}`}>
              <div className="font-hand text-4xl text-plum">{i + 1}.</div>
              <h3 className="mt-2 text-2xl font-black text-plum">{title}</h3>
              <p className="mt-2 text-base font-medium leading-relaxed text-plum/85">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* what counts */}
      <section id="claim" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <h2 className="max-w-3xl font-serif text-5xl font-black leading-[0.95] tracking-[-0.045em] text-plum md:text-6xl">
          Bought it for work? Chuck it in.
        </h2>
        <p className="mt-4 text-lg font-medium text-muted-foreground">
          Ledgr knows what counts. It’ll tell you when something doesn’t.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {TILES.map(([tint, Icon, title, body, counts]) => (
            <div
              key={title}
              className={`flex min-h-[210px] flex-col rounded-[28px] p-6 ${
                counts ? tint : "border-2 border-dashed border-border text-muted-foreground"
              }`}
            >
              <Icon className="h-10 w-10" strokeWidth={1.8} />
              <div className={`mt-auto text-2xl font-black tracking-tight ${counts ? "" : "line-through"}`}>
                {title}
              </div>
              <p className="mt-1 text-[15px] font-semibold leading-snug">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* deadline */}
      <section className="mx-3 mb-6 flex flex-col items-start justify-between gap-6 rounded-[32px] bg-butter p-8 sm:mx-6 sm:rounded-[40px] sm:p-12 md:flex-row md:items-center">
        <div>
          <h2 className="font-serif text-4xl font-black leading-[0.95] tracking-[-0.045em] text-plum md:text-6xl">
            Returns are due 31 October.
          </h2>
          <p className="mt-3 text-lg font-semibold text-plum">
            Ledgr isn’t a tax agent. It just makes sure your pot’s full when you get there.
          </p>
        </div>
        <Link
          href="/signup"
          className="inline-flex h-14 shrink-0 items-center rounded-full bg-plum px-7 text-lg font-black text-white hover:opacity-90"
        >
          Start your pot
        </Link>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 pb-10 pt-4 text-sm font-semibold text-muted-foreground sm:px-8">
        <div className="flex items-center gap-4">
          <LedgrLogo size="sm" />
          <span>© {new Date().getFullYear()} Ledgr · General information, not tax advice.</span>
        </div>
        <div className="flex gap-6">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
