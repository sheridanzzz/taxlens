import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import type { ReceiptEvidence } from "@shared/airtail-receipt";
import { buildAirtailImport } from "@shared/airtail-receipt";
import { formatCurrency } from "@shared/tax-calculator";
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
} from "@/lib/airtail";
import { openWeb, shortDate } from "@/lib/expenses";
import { colors } from "@/lib/theme";
import { Button, Card, Field, Heading, Screen, T } from "@/components/ui";

const amountText = (r: ListedReceipt) => (r.currency === "AUD" ? formatCurrency(r.amount) : `${r.amount.toFixed(2)} ${r.currency}`);

export default function Airtail() {
  const { data, save } = useData();
  const fy = data.settings.financialYear;
  const [status, setStatus] = useState<AirtailStatus | null>(null);
  const [receipts, setReceipts] = useState<ListedReceipt[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ListedReceipt | null>(null);
  const [evidence, setEvidence] = useState<ReceiptEvidence | null>(null);
  const [paidAud, setPaidAud] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Airtail. Try again.");
    } finally {
      setBusy("");
    }
  };

  const handleLoadMore = () =>
    void run("list", async () => {
      const page = await airtailReceipts(fy, cursor);
      setReceipts((old) => [...old, ...page.receipts.filter((r) => !old.some((o) => o.id === r.id))]);
      setCursor(page.nextCursor ?? null);
    });

  useEffect(() => {
    let live = true;
    airtailStatus()
      .then(async (s) => {
        if (!live) return;
        setStatus(s);
        if (!s.connected || s.expired) return;
        const page = await airtailReceipts(fy);
        if (!live) return;
        setReceipts(page.receipts);
        setCursor(page.nextCursor ?? null);
        setLoaded(true);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't reach Airtail."));
    return () => {
      live = false;
    };
  }, [fy]);

  const handleSelect = (r: ListedReceipt) =>
    void run("evidence", async () => {
      setSelected(r);
      setEvidence(null);
      setPaidAud("");
      setEvidence(await airtailEvidence(r.id));
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
    void run("attach", async () => {
      const target = data.expenses.find((e) => e.id === expenseId);
      if (!target) throw new Error("That expense is no longer here.");
      const imported = prepared();
      await save("expenses", {
        ...target,
        receiptDataUrl: imported.receiptDataUrl,
        notes: [target.notes, imported.notes].filter(Boolean).join("\n\n"),
      });
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
          <T color={colors.negative} accessibilityRole="alert">
            {error}
          </T>
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
            Airtail hasn&apos;t found any receipts for FY {fy}.
          </T>
        ) : (
          receipts.map((r, i) => {
            const saved = isSaved(r, data.expenses);
            const matched = !saved && matchFor(r, data.expenses);
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
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
      {cursor && <Button title="Load more" kind="soft" busy={busy === "list"} onPress={handleLoadMore} />}
    </Screen>
  );
}
