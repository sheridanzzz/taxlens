import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Section({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          {eyebrow && (
            <div className="eyebrow mb-1">
              <span className="text-gold">•</span> {eyebrow}
            </div>
          )}
          <h2 className="font-serif text-3xl md:text-4xl leading-tight">{title}</h2>
        </div>
        {action}
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
    <div className="surface p-5 flex flex-col gap-2">
      <div className="eyebrow">{label}</div>
      <div className={`font-serif tabular ${large ? "text-5xl" : "text-3xl"}`}>{value}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
  return <div className={`surface min-w-0 p-5 ${className}`}>{children}</div>;
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
