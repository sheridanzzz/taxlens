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
            <div className="eyebrow mb-1">{eyebrow}</div>
          )}
          <h1 className="font-serif text-3xl leading-[1.05] md:text-[40px]">
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
    <div
      className={`relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-[22px] p-4 sm:p-5 ${
        positive ? "bg-mint" : "surface"
      }`}
    >
      <div className="eyebrow">{label}</div>
      <div
        className={`truncate font-serif font-black leading-none tabular ${
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
  return <div className={`surface min-w-0 p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "gold" | "positive" | "negative";
}) {
  const map = {
    muted: "bg-surface-2 text-muted-foreground",
    gold: "bg-butter text-plum",
    positive: "bg-mint text-positive",
    negative: "bg-pink text-negative",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${map[tone]}`}>
      {children}
    </span>
  );
}
