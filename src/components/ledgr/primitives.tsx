import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Section({
  eyebrow,
  title,
  children,
  action,
  description,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <section className="mb-7 md:mb-8">
      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          {eyebrow && (
            <div className="eyebrow mb-1">
              <span className="text-gold">•</span> {eyebrow}
            </div>
          )}
          <h1 className="font-serif text-3xl leading-[1.08] tracking-[-0.02em] md:text-4xl">
            {title}
          </h1>
          {description && (
            <div className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  delta,
  hint,
  positive,
  large,
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
  positive?: boolean;
  large?: boolean;
}) {
  return (
    <div className="surface relative flex min-w-0 flex-col gap-2 overflow-hidden p-4 sm:p-5">
      {positive && <span className="absolute inset-y-0 left-0 w-px bg-positive/70" />}
      <div className="eyebrow">{label}</div>
      <div
        className={`truncate font-serif leading-none tabular ${
          large ? "text-4xl md:text-5xl" : "text-3xl"
        }`}
        title={value}
      >
        {value}
      </div>
      <div className="flex min-h-4 items-center gap-2 text-xs text-muted-foreground">
        {delta && (
          <span
            className={`inline-flex items-center gap-1 tabular ${
              positive ? "text-positive" : "text-negative"
            }`}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  // min-w-0 stops ResponsiveContainer↔grid-column width feedback loops
  return <div className={`surface min-w-0 p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "gold" | "positive" | "negative";
}) {
  const map = {
    muted: "bg-surface-2 text-muted-foreground border-border",
    gold: "bg-gold-soft text-gold border-gold/30",
    positive: "bg-positive/10 text-positive border-positive/30",
    negative: "bg-negative/10 text-negative border-negative/30",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${map[tone]}`}>
      {children}
    </span>
  );
}
