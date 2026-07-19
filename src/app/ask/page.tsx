"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Section, Card, Pill } from "@/components/ledgr/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTax } from "@/context/tax-context";
import { fadeInUp } from "@/lib/animations";

interface AskResponse {
  answer: string;
  sources: { source: string }[];
}

const SUGGESTIONS = [
  "Can I claim my internet bill on the fixed rate WFH method?",
  "How does depreciation work for a $2,000 laptop?",
  "Is driving to my regular office deductible?",
];

export default function AskPage() {
  const { state } = useTax();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setQuestion(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          occupation: state.settings.occupation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div {...fadeInUp} className="mx-auto max-w-3xl">
      <Section
        eyebrow="Ask · AI"
        title="Ask about deductions."
      >
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
            className="space-y-3"
          >
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(question);
                }
              }}
              placeholder="e.g. Can I claim my $450 office chair I also use for gaming?"
              rows={3}
              disabled={loading}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Answers come from TaxLens&apos;s ATO deduction notes — general
                information, not personal advice.
              </p>
              <Button type="submit" disabled={loading || !question.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Ask
              </Button>
            </div>
          </form>
        </Card>

        {!result && !loading && !error && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <Card className="mt-4 border-negative/30">
            <p className="text-sm text-negative">{error}</p>
          </Card>
        )}

        {result && (
          <motion.div {...fadeInUp}>
            <Card className="mt-4">
              <div className="eyebrow mb-2">Answer</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {result.answer}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                {result.sources.map((s) => (
                  <Pill key={s.source} tone="gold">{s.source}</Pill>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </Section>
    </motion.div>
  );
}
