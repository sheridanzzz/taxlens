"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptScanner } from "@/components/expenses/receipt-scanner";
import { useTax } from "@/context/tax-context";
import { FINANCIAL_YEARS } from "@/lib/constants";
import { airtailExpenseId, prepareAirtailImport, type AirtailReceipt, type ReceiptEvidence, type ImportedReceipt } from "@/lib/airtail-import";
import type { FinancialYear } from "@/lib/types";
import { getExpenses } from "@/lib/storage";
import { ruleSuggestion, SHORTLIST_LABELS, type SuggestedReceipt } from "@/lib/receipt-shortlist";

type Status = { configured: boolean; signedIn: boolean; connected: boolean; accountEmail?: string; expiresAt?: string; expired: boolean };
async function requestJson(path = "", method = "GET", signal?: AbortSignal) {
  const response = await fetch(`/api/integrations/airtail${path}`, { method, signal, cache: "no-store" });
  const data = await response.json().catch(() => ({ error: "Could not reach the connector. Try again." }));
  if (!response.ok) throw new Error(data.error || "Could not complete this request.");
  return data;
}

export function AirtailConnector() {
  const { state, refreshData } = useTax();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [receipts, setReceipts] = useState<SuggestedReceipt[]>([]);
  const [receiptFilter, setReceiptFilter] = useState<"possible" | "personal" | "all">("possible");
  const [shortlistMode, setShortlistMode] = useState<"ai" | "rules">("rules");
  const [shortlistOccupation, setShortlistOccupation] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [fy, setFy] = useState<FinancialYear>(state.settings.financialYear);
  const [selected, setSelected] = useState<AirtailReceipt | null>(null);
  const [evidence, setEvidence] = useState<ReceiptEvidence | null>(null);
  const [paidAud, setPaidAud] = useState("");
  const [imported, setImported] = useState<ImportedReceipt | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const generation = useRef(0);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    const data = await requestJson("", "GET", signal);
    if (mounted.current) setStatus(data);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    void loadStatus(abort.signal).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    const outcome = new URLSearchParams(window.location.search).get("airtail");
    if (outcome) {
      queueMicrotask(() => {
        if (outcome === "connected") setMessage("Airtail connected. Retrieve receipts for your financial year below.");
        if (outcome === "cancelled") setMessage("Connection cancelled. You can connect again whenever you're ready.");
        if (outcome === "failed") setError("The connection did not finish. Check both apps' connector configuration, then connect again.");
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("airtail");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    return () => { mounted.current = false; abort.abort(); controller.current?.abort(); };
  }, [loadStatus]);

  async function run(name: string, action: (signal: AbortSignal, current: number) => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    const current = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(name); setError(""); setMessage("");
    try { await action(abort.signal, current); }
    catch (err) { if (mounted.current && !abort.signal.aborted) setError(err instanceof Error ? err.message : "Please try again."); }
    finally { lock.current = false; if (mounted.current) setBusy(""); }
  }

  const loadReceipts = (more = false) => run("receipts", async (signal, current) => {
    const params = new URLSearchParams({ fy, smart: "1" });
    if (more && cursor) params.set("cursor", cursor);
    const [data, existing] = await Promise.all([requestJson(`/receipts?${params}`, "GET", signal), getExpenses()]);
    if (current !== generation.current || !mounted.current) return;
    setReceipts(old => more ? [...old, ...data.receipts].filter((row, i, all) => all.findIndex(r => r.id === row.id) === i) : data.receipts);
    setCursor(data.nextCursor); setSearched(true); setSelected(null); setEvidence(null);
    setShortlistMode(data.shortlist?.mode === "ai" ? "ai" : "rules");
    setShortlistOccupation(data.shortlist ? data.shortlist.occupation : state.settings.occupation);
    setSavedIds(existing.map(expense => expense.id));
  });
  const viewReceipt = (receipt: AirtailReceipt) => run(receipt.id, async (signal, current) => {
    setSelected(receipt); setEvidence(null); setPaidAud("");
    const data = await requestJson(`/receipts/${receipt.id}`, "GET", signal);
    if (current === generation.current && mounted.current) setEvidence(data);
  });

  function changeYear(value: FinancialYear) {
    generation.current++; controller.current?.abort();
    setFy(value); setReceipts([]); setReceiptFilter("possible"); setCursor(null); setSearched(false); setSelected(null); setEvidence(null); setError("");
  }
  const alreadySaved = (receipt: AirtailReceipt) => savedIds.includes(airtailExpenseId(receipt.id)) || state.expenses.some(e => e.id === airtailExpenseId(receipt.id));
  const suggestionFor = (receipt: SuggestedReceipt) => receipt.suggestion || ruleSuggestion(receipt, { occupation: state.settings.occupation, wfhMethod: state.settings.wfhMethod });
  const personalCount = receipts.filter(receipt => suggestionFor(receipt).bucket === "likely_personal").length;
  const possibleCount = receipts.length - personalCount;
  const visibleReceipts = receipts.filter(receipt => receiptFilter === "all" || (receiptFilter === "personal" ? suggestionFor(receipt).bucket === "likely_personal" : suggestionFor(receipt).bucket !== "likely_personal"));
  const canImport = selected && evidence && (selected.currency === "AUD" || (Number(paidAud) > 0 && Number.isFinite(Number(paidAud))));
  return <Card id="airtail-connection" className="min-w-0">
    <CardHeader><CardTitle className="flex items-center gap-2"><Plug className="h-5 w-5" /> Airtail</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <p className="text-sm text-muted-foreground">Bring receipts from Gmail and Yahoo through your existing Airtail connections. Review the purchase, tax category and work use before saving it in Ledgr.</p>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {!status ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm">{error ? "Connection status unavailable." : "Checking your connection…"}</p>{error && <Button variant="outline" disabled={!!busy} onClick={() => void run("status", signal => loadStatus(signal))}>Retry</Button>}</div> : !status.signedIn ? <p className="text-sm">Sign in to a cloud Ledgr account to connect Airtail. <Link href="/login" className="underline">Sign in</Link></p> : !status.configured ? <p className="text-sm">The connector needs its app URLs configured on the server. Setup instructions are in the Airtail connector guide.</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 break-all text-sm">{status.connected ? `${status.accountEmail}${status.expired ? " · Connection expired" : " · Connected"}` : "Airtail is ready to connect."}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy} onClick={() => void run("connect", async signal => {
              const data = await requestJson("/connect", "POST", signal); window.location.assign(data.url);
            })}>{status.connected ? "Reconnect Airtail" : "Connect Airtail"}</Button>
            {status.connected && <Button variant="outline" disabled={!!busy} onClick={() => void run("disconnect", async signal => {
              await requestJson("", "DELETE", signal); setReceipts([]); setSelected(null); setEvidence(null); setCursor(null); setSearched(false);
              await loadStatus(signal); setMessage("Disconnected. Receipts already saved in Ledgr are kept.");
            })}>Disconnect</Button>}
          </div>
        </div>
        {status.connected && !status.expired && <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">Financial year<select className="mt-1 block h-10 rounded-md border bg-background px-3" value={fy} disabled={!!busy || !!imported} onChange={event => changeYear(event.target.value as FinancialYear)}>
              {FINANCIAL_YEARS.map(year => <option key={year.value} value={year.value}>{year.label}</option>)}
            </select></label>
            <Button disabled={!!busy} onClick={() => void loadReceipts()}>{busy === "receipts" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{searched ? "Refresh receipts" : "Retrieve receipts"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Uses transactions already synced in Airtail. If a receipt is missing, sync the mailbox in Airtail and refresh here. Retrieval adds no deductions.</p>
          {searched && receipts.length > 0 && <div className="space-y-3 rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium">{shortlistMode === "ai" ? "AI-assisted shortlist" : "Smart shortlist"}{shortlistOccupation ? ` · ${shortlistOccupation}` : ""}</p>
            <p className="text-xs text-muted-foreground">Possible work expenses and items needing details are shown first. Everyday personal purchases are filtered out. These are suggestions; confirm the work connection, reimbursement and work use before saving.</p>
            {!shortlistOccupation && <p className="text-xs"><Link href="/settings" className="underline">Add your occupation in Profile</Link> for better suggestions.</p>}
            {shortlistMode === "rules" && <p className="text-xs text-muted-foreground">Sorted using receipt rules. You can check every suggestion in All receipts.</p>}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter Airtail receipts">
              {([{ value: "possible", label: `Possible work (${possibleCount})` }, { value: "personal", label: `Likely personal (${personalCount})` }, { value: "all", label: `All receipts (${receipts.length})` }] as const).map(filter => <Button key={filter.value} size="sm" variant={receiptFilter === filter.value ? "default" : "outline"} aria-pressed={receiptFilter === filter.value} onClick={() => { setReceiptFilter(filter.value); setSelected(null); setEvidence(null); }}>{filter.label}</Button>)}
            </div>
            <p className="text-xs text-muted-foreground">{receipts.length} receipts checked{cursor ? " so far. Load more to check the rest of the year." : "."}</p>
          </div>}
          {searched && receipts.length === 0 && <p role="status" className="rounded-lg border p-4 text-sm">No Gmail or Yahoo receipts found for {fy}. Check the mailbox connections and sync in Airtail.</p>}
          {receipts.length > 0 && visibleReceipts.length === 0 && <p role="status" className="rounded-lg border p-4 text-sm">{receiptFilter === "possible" ? "No possible work expenses in the receipts checked so far. View all receipts to check the suggestions" : "No likely personal purchases in the receipts checked so far"}{cursor ? ", or load more receipts." : "."}</p>}
          {visibleReceipts.length > 0 && <ul className="divide-y rounded-lg border" aria-label="Receipts from Airtail">
            {visibleReceipts.map(receipt => <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{receipt.vendor}</p><p className="mt-1 break-words text-xs text-muted-foreground">{receipt.date} · {receipt.provider} · {receipt.amount.toFixed(2)} {receipt.currency}</p><p className="mt-1 break-words text-xs">{receipt.subject}</p><p className="mt-2 text-xs font-medium">{SHORTLIST_LABELS[suggestionFor(receipt).bucket]}</p><p className="mt-1 break-words text-xs text-muted-foreground">{suggestionFor(receipt).reason}</p></div>
              <Button variant="outline" disabled={!!busy || alreadySaved(receipt)} onClick={() => void viewReceipt(receipt)}>{alreadySaved(receipt) ? "Saved" : busy === receipt.id ? "Retrieving…" : "Review receipt"}</Button>
            </li>)}
          </ul>}
          {cursor && <Button variant="outline" disabled={!!busy} onClick={() => void loadReceipts(true)}>Load more receipts</Button>}
          {selected && <section aria-label="Receipt evidence" className="space-y-4 rounded-lg border p-4">
            <h3 className="break-words font-semibold">{selected.vendor} — original receipt</h3>
            {!evidence ? <p className="text-sm">{busy === selected.id ? "Retrieving original email and attachments…" : "Evidence could not be retrieved. Try reviewing this receipt again."}</p> : <>
              <p className="break-all text-xs text-muted-foreground">{evidence.from} · {evidence.date ? new Date(evidence.date).toLocaleDateString("en-AU") : "Email date unavailable"}</p>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm">{evidence.text || "The receipt is in an attachment below."}</pre>
              <div className="flex flex-col items-start gap-2 text-sm"><a href={evidence.originalEmail} download="original-receipt.eml" className="inline-flex items-center gap-2 underline"><Mail className="h-4 w-4" /> Download original email</a>
                {evidence.attachments.map((file, i) => <a key={i} className="max-w-full break-all underline" href={file.dataUrl} download={file.name}>{file.name}</a>)}
              </div>
              {selected.currency !== "AUD" && <label className="block text-sm font-medium">Amount paid in AUD <span className="font-normal text-muted-foreground">(from your payment record)</span><input className="mt-2 block h-10 w-full max-w-xs rounded-md border bg-background px-3" type="number" min="0.01" step="0.01" value={paidAud} onChange={event => setPaidAud(event.target.value)} /></label>}
              <p className="text-xs text-muted-foreground">The full original email, including attachments, will be retained with the expense. Work use starts at 0%; set the correct percentage when reviewing.</p>
              <Button disabled={!canImport || !!busy || alreadySaved(selected)} onClick={() => {
                try { setImported(prepareAirtailImport(selected, evidence, Number(paidAud))); } catch (err) { setError((err as Error).message); }
              }}>Review in Ledgr</Button>
            </>}
          </section>}
        </>}
      </>}
      {imported && <ReceiptScanner key={imported.id} open onOpenChange={open => { if (!open) setImported(null); }} initialReceipt={imported} onExpenseCreated={() => {
        setSavedIds(ids => [...new Set([...ids, imported.id])]);
        void refreshData().catch(() => setError("Saved, but the expense list could not refresh. Reload to update it."));
      }} />}
    </CardContent>
  </Card>;
}
