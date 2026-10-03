import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useKeepAwake } from "expo-keep-awake";
import { toLocalDate } from "@shared/constants";
import { formatCurrency } from "@shared/tax-calculator";
import { MYTAX_WFH } from "@shared/mytax";
import { lodgeLines, taxTimeFor, type LodgeLine } from "@shared/tax-time";
import { useData } from "@/lib/store";
import { MYTAX_RENTAL, myTaxCode, myTaxName, myTaxRows, plural } from "@/lib/expenses";
import { colors } from "@/lib/theme";
import { Button, Card, Heading, Icon, Screen, T } from "@/components/ui";

/** myTax wants dollars and cents with no symbol or commas. */
const forMyTax = (amount: number) => amount.toFixed(2);

export default function Lodge() {
  // the phone sits beside the laptop while you type, so it mustn't lock
  useKeepAwake();
  const { data, summary, saveTaxTime } = useData();
  const { settings, expenses, assets, wfhEntries } = data;
  const fy = settings.financialYear;
  const record = taxTimeFor(settings);
  const rows = myTaxRows(data, summary);
  const entered = new Set(record.entered ?? []);
  const firstLeft = rows.findIndex((r) => !entered.has(r.item));
  const [step, setStep] = useState(firstLeft < 0 ? rows.length : firstLeft);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const goTo = (i: number) => {
    setStep(i);
    setOpen(false);
    setCopied("");
  };

  const handleCopy = async (item: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(item);
  };

  const handleEntered = (item: string) =>
    void run(async () => {
      await saveTaxTime((r) => ({ entered: [...(r.entered ?? []).filter((x) => x !== item), item] }));
      goTo(step + 1);
    });

  const linesFor = (item: string): LodgeLine[] =>
    item === MYTAX_RENTAL
      ? [
          { label: "Rental income", detail: "Entered on the web", amount: summary.rentalIncome },
          { label: "Rental deductions", detail: "Ownership share, from the web", amount: summary.rentalDeductions },
        ]
      : lodgeLines(item, expenses, assets, wfhEntries, fy, settings.wfhMethod, summary.totalWfhDeduction);

  const header = (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Heading title="Lodge mode" subtitle={`FY ${fy} · ${step < rows.length ? `${step + 1} of ${rows.length}` : "Summary"}`} />
      </View>
      <Pressable accessibilityRole="button" accessibilityHint="Your progress is kept" onPress={() => router.back()} style={{ paddingTop: 20, paddingLeft: 12 }}>
        <T w="bold" color={colors.tangerineInk}>
          Close
        </T>
      </Pressable>
    </View>
  );

  if (step < rows.length) {
    const row = rows[step];
    const lines = linesFor(row.item);
    // the 70c method asks for hours and does the maths itself
    const hoursStep = row.item === MYTAX_WFH && settings.wfhMethod === "fixed_rate";
    const hours = wfhEntries.reduce((s, e) => s + e.hours, 0);
    const copyText = hoursStep ? String(hours) : forMyTax(row.amount);
    return (
      <Screen>
        {header}
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Lodge progress"
          accessibilityValue={{ min: 0, max: rows.length, now: step }}
          style={{ height: 8, borderRadius: 999, backgroundColor: colors.lav, overflow: "hidden" }}
        >
          <View style={{ height: "100%", width: `${(step / rows.length) * 100}%`, backgroundColor: colors.plum, borderRadius: 999 }} />
        </View>

        <Card tint={colors.plum} style={{ borderRadius: 32, padding: 22, gap: 10 }}>
          <View style={{ alignSelf: "flex-start", borderRadius: 10, backgroundColor: colors.butter, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T w="black" size={16} color={colors.plum}>
              {myTaxCode(row.item) || "Other"}
            </T>
          </View>
          <T w="heavy" size={22} color="#ffffff">
            {myTaxName(row.item)}
          </T>
          <T w="black" size={52} color="#ffffff" adjustsFontSizeToFit numberOfLines={1} style={{ letterSpacing: -1.5, fontVariant: ["tabular-nums"] }}>
            {formatCurrency(row.amount)}
          </T>
          <Button
            title={copied === row.item ? `Copied ${copyText}` : hoursStep ? `Copy hours (${hours.toLocaleString("en-AU")})` : "Copy amount"}
            icon={copied === row.item ? "checkmark" : "doc.on.doc"}
            kind={copied === row.item ? "mint" : "primary"}
            onPress={() => void handleCopy(row.item, copyText)}
          />
          <T size={13} color={colors.lav}>
            {row.item === MYTAX_RENTAL
              ? "In myTax, add Rental properties under Income, then enter the income and each deduction."
              : hoursStep
                ? "In myTax, under Other work-related expenses (D5), choose the fixed rate method and enter your hours. myTax works out the 70c."
                : `In myTax, open Deductions and choose ${myTaxName(row.item)}. Enter the total, or each item if myTax asks for them.`}
          </T>
        </Card>

        <Card style={{ gap: 0 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((o) => !o)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}
          >
            <T w="heavy" size={17} color={colors.plum}>
              What&apos;s in it · {plural(lines.length, "item")}
            </T>
            <Icon name={open ? "chevron.up" : "chevron.down"} size={14} />
          </Pressable>
          {open &&
            lines.map((l, i) => (
              <View key={`${l.label}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: colors.border, marginTop: i ? 0 : 10 }}>
                <View style={{ flex: 1 }}>
                  <T w="bold" size={15} numberOfLines={2}>
                    {l.label}
                  </T>
                  <T size={13} color={colors.inkSoft}>
                    {l.detail}
                  </T>
                </View>
                <T w="bold" size={15} style={{ fontVariant: ["tabular-nums"] }}>
                  {formatCurrency(l.amount)}
                </T>
              </View>
            ))}
        </Card>

        {!!error && (
          <T color={colors.negative} accessibilityRole="alert">
            {error}
          </T>
        )}
        <Button title={entered.has(row.item) ? "Entered · next" : "I've entered this · next"} icon="checkmark" kind="plum" busy={busy} onPress={() => handleEntered(row.item)} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Back" kind="soft" disabled={step === 0} onPress={() => goTo(step - 1)} style={{ flex: 1 }} />
          <Button title="Skip for now" kind="soft" onPress={() => goTo(step + 1)} style={{ flex: 1 }} />
        </View>
      </Screen>
    );
  }

  const left = rows.filter((r) => !entered.has(r.item));
  return (
    <Screen>
      {header}
      <Card>
        <T w="heavy" size={20} color={colors.plum} accessibilityRole="header">
          {rows.length === 0 ? "No deductions to enter" : left.length ? `${plural(left.length, "label")} not entered yet` : "Everything's entered"}
        </T>
        {rows.length === 0 && <T color={colors.inkSoft}>You can still lodge: myTax pre-fills your income from your employer.</T>}
        {rows.map((r, i) => (
          <Pressable
            key={r.item}
            accessibilityRole="button"
            accessibilityLabel={`${myTaxName(r.item)}, ${formatCurrency(r.amount)}, ${entered.has(r.item) ? "entered" : "not entered"}`}
            onPress={() => goTo(i)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.border, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name={entered.has(r.item) ? "checkmark.circle.fill" : "circle"} size={20} color={entered.has(r.item) ? colors.positive : colors.inkSoft} />
            <T w="bold" style={{ flex: 1 }}>
              {myTaxCode(r.item)} {myTaxName(r.item)}
            </T>
            <T w="bold" style={{ fontVariant: ["tabular-nums"] }}>
              {formatCurrency(r.amount)}
            </T>
          </Pressable>
        ))}
      </Card>

      {!!error && (
        <T color={colors.negative} accessibilityRole="alert">
          {error}
        </T>
      )}
      {record.lodgedAt ? (
        <Card tint={colors.mint}>
          <T w="heavy" size={18} color={colors.plum}>
            Marked lodged on {new Date(`${record.lodgedAt}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long" })}
          </T>
          <T color={colors.plum}>Keep your records for five years from today. The receipt pack in Settings puts them in one PDF.</T>
          <Button title="Done" kind="plum" onPress={() => router.back()} />
          <Button title="Undo, I haven't lodged" kind="soft" busy={busy} onPress={() => void run(() => saveTaxTime({ lodgedAt: undefined }))} />
        </Card>
      ) : (
        <Button title="I've lodged" icon="checkmark.seal.fill" kind="primary" busy={busy} onPress={() => void run(() => saveTaxTime({ lodgedAt: toLocalDate() }))} />
      )}
    </Screen>
  );
}
