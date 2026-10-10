import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, View } from "react-native";
import { router } from "expo-router";
import type { ReceiptEvidence } from "@shared/airtail-receipt";
import { buildAirtailImport } from "@shared/airtail-receipt";
import { formatCurrency } from "@shared/tax-calculator";
import { ruleSuggestion, SHORTLIST_LABELS } from "@shared/receipt-shortlist";
import { useData } from "@/lib/store";
import {
  airtailEvidence,
  airtailReceipts,
  airtailStatus,
  handOffImport,
  isSaved,
  matchFor,
  type AirtailStatus,
  type ListedReceipt,
  type ReceiptPage,
} from "@/lib/airtail";
import { openWeb, shortDate } from "@/lib/expenses";
import { colors } from "@/lib/theme";
import { Button, Card, Field, Heading, Pills, Screen, T } from "@/components/ui";

const amountText = (r: ListedReceipt) => (r.currency === "AUD" ? formatCurrency(r.amount) : `${r.amount.toFixed(2)} ${r.currency}`);

export default function Airtail() {
  const { data } = useData();
  return <AirtailReceipts key={data.settings.financialYear} />;
}

function AirtailReceipts() {
  const { data, save, saveSettings } = useData();
  const fy = data.settings.financialYear;
  const [status, setStatus] = useState<AirtailStatus | null>(null);
  const [receipts, setReceipts] = useState<ListedReceipt[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ListedReceipt | null>(null);
  const [evidence, setEvidence] = useState<ReceiptEvidence | null>(null);
  const [paidAud, setPaidAud] = useState("");
  const [busy, setBusy] = useState("initial");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [receiptFilter, setReceiptFilter] = useState<"possible" | "personal" | "all">("possible");
  const [shortlist, setShortlist] = useState({ mode: "rules", occupation: "" });
  const [pageResult, setPageResult] = useState<{ added: number; possible: number; total: number } | null>(null);
  const [paginationError, setPaginationError] = useState("");
  const [editingOccupation, setEditingOccupation] = useState(false);
  const [occupation, setOccupation] = useState("");
  const active = useRef(true);
  const generation = useRef(0);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const profileChanged = loaded && shortlist.occupation.trim() !== data.settings.occupation.trim();
  const suggestionFor = (receipt: ListedReceipt) => receipt.suggestion || ruleSuggestion(receipt, data.settings);
  const personalCount = receipts.filter(receipt => suggestionFor(receipt).bucket === "likely_personal").length;
  const possibleCount = receipts.length - personalCount;
  const visibleReceipts = receipts.filter(receipt => receiptFilter === "all" || (receiptFilter === "personal" ? suggestionFor(receipt).bucket === "likely_personal" : suggestionFor(receipt).bucket !== "likely_personal"));

  const applyPage = (page: ReceiptPage, more = false) => {
    const seen = new Set(more ? receipts.map(receipt => receipt.id) : []);
    const added = page.receipts.filter(receipt => {
      if (seen.has(receipt.id)) return false;
      seen.add(receipt.id); return true;
    });
    const combined = more ? [...receipts, ...added] : added;
    setReceipts(combined);
    setCursor(page.nextCursor ?? null);
    setShortlist(page.shortlist ?? { mode: "rules", occupation: data.settings.occupation });
    setLoaded(true);
    if (more) setPageResult({ added: added.length, possible: added.filter(receipt => suggestionFor(receipt).bucket !== "likely_personal").length, total: combined.length });
  };

  const run = async (name: string, action: (signal: AbortSignal, current: number) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    const current = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(name);
    setError("");
    setPaginationError("");
    setMessage("");
    try {
      await action(abort.signal, current);
    } catch (e) {
      if (active.current && !abort.signal.aborted && current === generation.current) {
        const detail = e instanceof Error ? e.message : "Couldn't reach Airtail. Try again.";
        if (name === "more") setPaginationError(detail);
        else setError(detail);
      }
    } finally {
      if (active.current && current === generation.current) { lock.current = false; setBusy(""); }
    }
  };

  const handleLoadMore = () => {
    if (!cursor || profileChanged) return;
    void run("more", async (signal, current) => {
      setPageResult(null);
      const page = await airtailReceipts(fy, cursor, signal);
      if (active.current && current === generation.current) applyPage(page, true);
    });
  };

  const handleRefresh = () => void run("refresh", async (signal, current) => {
    const status = await airtailStatus(signal);
    if (!active.current || current !== generation.current) return;
    setStatus(status);
    if (!status.connected || status.expired || !status.configured) return;
    const page = await airtailReceipts(fy, null, signal);
    if (!active.current || current !== generation.current) return;
    setPageResult(null); setSelected(null); setEvidence(null);
    applyPage(page);
  });

  const handleOccupation = () => void run("occupation", async (_signal, current) => {
    if (!occupation.trim()) throw new Error("Enter your occupation before saving.");
    await saveSettings({ ...data.settings, occupation: occupation.trim() });
    if (!active.current || current !== generation.current) return;
    Keyboard.dismiss(); setEditingOccupation(false);
    setMessage("Occupation saved. Refresh receipts to update your shortlist.");
  });

  useEffect(() => {
    active.current = true;
    const current = ++generation.current;
    let live = true;
    const abort = new AbortController();
    controller.current = abort;
    lock.current = true;
    airtailStatus(abort.signal)
      .then(async (s) => {
        if (!live) return;
        setStatus(s);
        if (!s.connected || s.expired) return;
        const page = await airtailReceipts(fy, null, abort.signal);
        if (!live) return;
        setReceipts(page.receipts);
        setCursor(page.nextCursor ?? null);
        setShortlist(page.shortlist ?? { mode: "rules", occupation: data.settings.occupation });
        setLoaded(true);
      })
      .catch((e) => { if (live && !abort.signal.aborted) { setError(e instanceof Error ? e.message : "Couldn't reach Airtail."); setLoaded(true); } })
      .finally(() => { if (live && current === generation.current) { lock.current = false; setBusy(""); } });
    return () => {
      live = false;
      active.current = false;
      abort.abort(); controller.current?.abort();
    };
    // A saved occupation requires an explicit refresh; keep the current pages until then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy]);

  const handleSelect = (r: ListedReceipt) =>
    void run("evidence", async (signal, current) => {
      setSelected(r);
      setEvidence(null);
      setPaidAud("");
      const evidence = await airtailEvidence(r.id, signal);
      if (active.current && current === generation.current) setEvidence(evidence);
    });

  const prepared = () => {
    if (!selected || !evidence) throw new Error("Open a receipt first.");
    return buildAirtailImport(selected.expenseId, selected, evidence, paidAud ? Number(paidAud) : undefined);
  };

  const handleSaveNew = () => {
    setError("");
    try {
      handOffImport(prepared());
      router.push({ pathname: "/expense", params: { airtail: "1" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't prepare this receipt.");
    }
  };

  const handleAttach = (expenseId: string) =>
    void run("attach", async (_signal, current) => {
      const target = data.expenses.find((e) => e.id === expenseId);
      if (!target) throw new Error("That expense is no longer here.");
      const imported = prepared();
      await save("expenses", {
        ...target,
        receiptDataUrl: imported.receiptDataUrl,
        notes: [target.notes, imported.notes].filter(Boolean).join("\n\n"),
      });
      if (!active.current || current !== generation.current) return;
      setMessage(`Email attached to ${target.description}.`);
      setSelected(null);
      setEvidence(null);
    });

  const header = (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Heading title="Email receipts" subtitle={`From Airtail · FY ${fy}`} />
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ paddingTop: 20, paddingLeft: 12 }}>
        <T w="bold" color={colors.tangerineInk}>
          Done
        </T>
      </Pressable>
    </View>
  );

  if (!status) {
    return (
      <Screen>
        {header}
        {error ? (
          <><T color={colors.negative} accessibilityRole="alert">{error}</T><Button title="Retry connection" busy={busy === "refresh"} onPress={handleRefresh} /></>
        ) : (
          <ActivityIndicator color={colors.plum} accessibilityLabel="Checking your Airtail connection" />
        )}
      </Screen>
    );
  }

  if (!status.connected || status.expired || !status.configured) {
    return (
      <Screen>
        {header}
        <Card tint={colors.sky}>
          <T w="heavy" size={18} color={colors.plum}>
            {!status.configured ? "Airtail isn't set up on this server" : status.expired ? "Your Airtail connection expired" : "Connect Airtail first"}
          </T>
          <T color={colors.plum}>
            Connecting a Gmail or Yahoo inbox happens on the Ledgr website. Once it&apos;s connected, the receipts it finds show up here.
          </T>
          <Button title="Connect on the web" icon="arrow.up.right" kind="plum" onPress={() => openWeb("/settings?airtail=setup")} />
          <Button title="Check connection" kind="soft" busy={busy === "refresh"} disabled={!!busy} onPress={handleRefresh} />
        </Card>
      </Screen>
    );
  }

  const match = selected ? matchFor(selected, data.expenses) : undefined;
  const needsAud = selected && selected.currency !== "AUD";

  return (
    <Screen>
      {header}
      {status.accountEmail && (
        <T w="bold" size={14} color={colors.inkSoft}>
          Connected as {status.accountEmail}
        </T>
      )}
      <Button title={busy === "refresh" ? "Refreshing receipts…" : "Refresh receipts"} kind="soft" busy={busy === "refresh"} disabled={!!busy} onPress={handleRefresh} />
      {loaded && receipts.length > 0 && <Card tint={colors.lav}>
        <T w="heavy" size={18}>{shortlist.mode === "ai" ? "AI-assisted shortlist" : "Smart shortlist"}{shortlist.occupation ? ` · ${shortlist.occupation}` : ""}</T>
        <T size={13} color={colors.inkSoft}>Possible work expenses and items needing details are shown first. Personal purchases stay in All receipts. Confirm the work connection and work use before saving.</T>
        {shortlist.mode === "rules" && <T size={13} color={colors.inkSoft}>Sorted using receipt rules.</T>}
        {!editingOccupation && <Button title={data.settings.occupation.trim() ? "Edit occupation" : "Add occupation"} kind="soft" disabled={!!busy} onPress={() => { setOccupation(data.settings.occupation); setEditingOccupation(true); setError(""); }} />}
        {editingOccupation && <View style={{ gap: 10 }}>
          <Field label="Occupation" value={occupation} onChangeText={setOccupation} autoCapitalize="words" autoFocus editable={!busy} placeholder="Your job title" returnKeyType="done" onSubmitEditing={handleOccupation} />
          <Button title="Save occupation" busy={busy === "occupation"} disabled={!!busy} onPress={handleOccupation} />
          <Button title="Cancel" kind="soft" disabled={!!busy} onPress={() => { Keyboard.dismiss(); setEditingOccupation(false); setError(""); }} />
        </View>}
        {profileChanged && <T size={13} accessibilityLiveRegion="polite">Your occupation changed. Refresh receipts to update this shortlist.</T>}
        <Pills label="Filter email receipts" value={receiptFilter} onChange={value => { setReceiptFilter(value); setSelected(null); setEvidence(null); }} options={[
          { value: "possible", label: `Possible work (${possibleCount})` },
          { value: "personal", label: `Likely personal (${personalCount})` },
          { value: "all", label: `All receipts (${receipts.length})` },
        ]} />
        <T size={13} color={colors.inkSoft}>{receipts.length} receipts checked{cursor ? " so far. Load more to check the rest of the year." : "."}</T>
      </Card>}

      {selected && (
        <Card tint={colors.lav} style={{ gap: 10 }}>
          <T w="heavy" size={18} color={colors.plum} accessibilityRole="header">
            {selected.vendor} · {amountText(selected)}
          </T>
          {!evidence ? (
            <ActivityIndicator color={colors.plum} accessibilityLabel="Loading the email" />
          ) : (
            <>
              <T w="bold" color={colors.plum}>
                {evidence.subject}
              </T>
              <T size={13} color={colors.inkSoft}>
                From {evidence.from}
                {evidence.date ? ` · ${new Date(evidence.date).toLocaleDateString("en-AU")}` : ""}
              </T>
              <T size={14} color={colors.ink} numberOfLines={12}>
                {evidence.text.trim() || "No text in this email."}
              </T>
              {evidence.attachments.length > 0 && (
                <T size={13} color={colors.inkSoft}>
                  Attached: {evidence.attachments.map((a) => a.name).join(", ")}
                </T>
              )}
              {needsAud && (
                <Field label="Amount paid in AUD (from your bank or card statement)" value={paidAud} onChangeText={setPaidAud} keyboardType="decimal-pad" prefix="$" />
              )}
              <T size={13} color={colors.plum}>
                The whole original email, attachments included, is kept with the expense.
              </T>
              {isSaved(selected, data.expenses) ? (
                <T w="bold" color={colors.positive}>
                  Already in Ledgr.
                </T>
              ) : (
                <>
                  {match && (
                    <Button title={`Attach to “${match.description}”`} icon="paperclip" kind="plum" busy={busy === "attach"} onPress={() => handleAttach(match.id)} />
                  )}
                  <Button title="Save as a new expense" kind={match ? "soft" : "primary"} disabled={!!busy || (!!needsAud && !(Number(paidAud) > 0))} onPress={handleSaveNew} />
                  <T size={12} color={colors.inkSoft}>
                    A new expense starts at 0% work use, so nothing is claimed until you set it.
                  </T>
                </>
              )}
            </>
          )}
          <Button title="Close this receipt" kind="soft" onPress={() => setSelected(null)} />
        </Card>
      )}

      {!!message && (
        <T w="bold" color={colors.positive} accessibilityLiveRegion="polite">
          {message}
        </T>
      )}
      {!!error && (
        <T color={colors.negative} accessibilityRole="alert">
          {error}
        </T>
      )}

      <Card style={{ gap: 0, paddingVertical: 8 }}>
        {!loaded ? (
          <ActivityIndicator color={colors.plum} accessibilityLabel="Loading receipts" style={{ paddingVertical: 14 }} />
        ) : receipts.length === 0 ? (
          <T color={colors.inkSoft} style={{ paddingVertical: 14 }}>
            {error ? "Receipts could not be loaded. Try Refresh receipts." : `Airtail hasn't found any receipts for FY ${fy}.`}
          </T>
        ) : visibleReceipts.length === 0 ? (
          <T color={colors.inkSoft} style={{ paddingVertical: 14 }}>No {receiptFilter === "personal" ? "likely personal purchases" : "possible work expenses"} in the receipts checked so far. View All receipts{cursor ? " or load more." : "."}</T>
        ) : (
          visibleReceipts.map((r, i) => {
            const saved = isSaved(r, data.expenses);
            const matched = !saved && matchFor(r, data.expenses);
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!busy }}
                disabled={!!busy}
                accessibilityLabel={`${r.vendor}, ${amountText(r)}, ${shortDate(r.date)}${saved ? ", already in Ledgr" : matched ? `, matches ${matched.description}` : ""}`}
                onPress={() => handleSelect(r)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: colors.border, opacity: pressed ? 0.6 : 1 })}
              >
                <View style={{ flex: 1 }}>
                  <T w="bold" size={15} numberOfLines={1}>
                    {r.vendor}
                  </T>
                  <T size={13} color={colors.inkSoft} numberOfLines={1}>
                    {shortDate(r.date)} · {r.subject}
                  </T>
                  <T size={12} w="bold" style={{ marginTop: 5 }}>{SHORTLIST_LABELS[suggestionFor(r).bucket]}</T>
                  <T size={12} color={colors.inkSoft}>{suggestionFor(r).reason}</T>
                </View>
                {(saved || matched) && (
                  <View style={{ borderRadius: 999, backgroundColor: saved ? colors.mint : colors.butter, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <T w="bold" size={12} color={colors.plum}>
                      {saved ? "Saved" : "Match"}
                    </T>
                  </View>
                )}
                <T w="bold" size={15} style={{ fontVariant: ["tabular-nums"] }}>
                  {amountText(r)}
                </T>
              </Pressable>
            );
          })
        )}
      </Card>
      {!!paginationError && <T color={colors.negative} accessibilityRole="alert">{paginationError} Your loaded receipts are kept. Try loading more again.</T>}
      {pageResult && <View style={{ gap: 10 }}>
        <T size={14} accessibilityLiveRegion="polite">Checked {pageResult.added} more {pageResult.added === 1 ? "receipt" : "receipts"}: {pageResult.possible} possible work {pageResult.possible === 1 ? "expense" : "expenses"} and {pageResult.added - pageResult.possible} likely personal. {pageResult.total} checked in total.{pageResult.possible === 0 && receiptFilter === "possible" ? " No additional possible work expenses in this batch." : ""}</T>
        {receiptFilter !== "all" && <Button title={`View all ${pageResult.total} receipts`} kind="soft" onPress={() => setReceiptFilter("all")} />}
      </View>}
      {cursor && <Button title={busy === "more" ? "Loading more receipts…" : "Load more receipts"} kind="soft" busy={busy === "more"} disabled={!!busy || profileChanged} onPress={handleLoadMore} />}
    </Screen>
  );
}
