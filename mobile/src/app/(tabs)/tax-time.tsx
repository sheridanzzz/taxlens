import { useEffect, useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";
import { router } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { FY_DATE_RANGES, toLocalDate } from "@shared/constants";
import { calculateCurrentYearDepreciation } from "@shared/depreciation";
import { formatCurrency } from "@shared/tax-calculator";
import { lodgingYear, taxTimeFor } from "@shared/tax-time";
import { useData } from "@/lib/store";
import { airtailStatus } from "@/lib/airtail";
import { BILLS, checklist, type CheckItem } from "@/lib/checklist";
import { openWeb, plural } from "@/lib/expenses";
import { shareOriginalReceipts } from "@/lib/receipts";
import { shareReceiptPack } from "@/lib/receipt-pack";
import { colors } from "@/lib/theme";
import { Button, Card, Heading, Icon, Screen, T } from "@/components/ui";

const DAY = 86_400_000;

const Row = ({
  icon,
  tint,
  title,
  detail,
  status,
  onPress,
  web,
}: {
  icon: SFSymbol;
  tint: string;
  title: string;
  detail: string;
  status: string;
  onPress?: () => void;
  web?: boolean;
}) => (
  <Pressable
    accessibilityRole={web ? "link" : onPress ? "button" : undefined}
    accessibilityLabel={`${status}: ${title}. ${detail}`}
    disabled={!onPress}
    onPress={onPress}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
  >
    <View style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={15} />
    </View>
    <View style={{ flex: 1 }}>
      <T w="bold" size={16}>
        {title}
      </T>
      <T size={13} color={colors.inkSoft}>
        {detail}
      </T>
    </View>
    {onPress && <Icon name={web ? "arrow.up.right" : "chevron.right"} size={13} color={colors.inkSoft} />}
  </Pressable>
);

export default function TaxTime() {
  const { data, summary, saveSettings, saveTaxTime } = useData();
  const { settings, assets } = data;
  const [today] = useState(toLocalDate);
  const [now] = useState(() => Date.now());
  const [airtailConnected, setAirtailConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const lodging = lodgingYear(today);
  const fy = settings.financialYear;
  const record = taxTimeFor(settings);

  useEffect(() => {
    airtailStatus()
      .then((s) => setAirtailConnected(s.connected && !s.expired))
      .catch(() => setAirtailConnected(false));
  }, []);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy("");
    }
  };

  if (lodging && fy !== lodging) {
    return (
      <Screen>
        <Heading title="Tax time" subtitle={`FY ${lodging} is ready to lodge`} />
        <Card tint={colors.butter}>
          <T w="heavy" size={18} color={colors.plum}>
            You&apos;re looking at FY {fy}
          </T>
          <T color={colors.plum}>
            The checklist and Lodge mode work on FY {lodging}. Switch the app to it while you lodge, then switch back in Settings when you&apos;re done.
          </T>
          <Button title={`Switch to FY ${lodging}`} kind="plum" busy={busy === "switch"} onPress={() => void run("switch", () => saveSettings({ ...settings, financialYear: lodging }))} />
        </Card>
        {!!error && (
          <T color={colors.negative} accessibilityRole="alert">
            {error}
          </T>
        )}
      </Screen>
    );
  }

  const items = checklist(data, today);
  const done = items.filter((i) => i.done).length;
  const deadline = `${FY_DATE_RANGES[fy].end.slice(0, 4)}-10-31`;
  const daysLeft = Math.max(0, Math.ceil((Date.parse(`${deadline}T23:59:59`) - now) / DAY));
  const earlierAssets = assets.filter((a) => a.financialYear !== fy && calculateCurrentYearDepreciation(a, fy) > 0);

  const handleIncome = () =>
    Alert.prompt(
      "Tax withheld",
      `The total tax withheld for FY ${fy}, from your income statement in myGov (Employment income statements). Add them up if you had more than one job.`,
      (value) => {
        const amount = parseFloat(value.replace(/[^\d.]/g, ""));
        if (value.trim() === "") void run("income", () => saveTaxTime({ taxWithheld: undefined }));
        else if (Number.isFinite(amount)) void run("income", () => saveTaxTime({ taxWithheld: amount }));
      },
      "plain-text",
      record.taxWithheld === undefined ? "" : String(record.taxWithheld),
      "decimal-pad"
    );

  const handleItem = (item: CheckItem) => {
    if (item.id === "income") return handleIncome();
    if (item.id === "gaps") return router.push("/gaps");
    if (item.id === "receipts") return router.navigate({ pathname: "/expenses", params: { filter: "no-receipt" } });
    if (item.id === "scans") return router.navigate("/");
  };

  return (
    <Screen>
      <Heading title="Tax time" subtitle={`FY ${fy} · ${daysLeft ? `${plural(daysLeft, "day")} until 31 Oct` : "Lodge today"}`} />

      <Card tint={colors.plum} style={{ borderRadius: 32, padding: 22, gap: 14 }}>
        <T w="bold" size={15} color={colors.butter}>
          Before you lodge
        </T>
        <T w="black" size={40} color="#ffffff" style={{ letterSpacing: -1 }}>
          {done === items.length ? "All ready" : `${done} of ${items.length} ready`}
        </T>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Checklist progress"
          accessibilityValue={{ min: 0, max: items.length, now: done }}
          style={{ height: 10, borderRadius: 999, backgroundColor: colors.plum2, overflow: "hidden" }}
        >
          <View style={{ height: "100%", width: `${(done / items.length) * 100}%`, borderRadius: 999, backgroundColor: colors.butter }} />
        </View>
        <T size={13} color={colors.lav}>
          Nothing here stops you lodging. It&apos;s what the ATO can ask you to show.
        </T>
      </Card>

      <Card style={{ gap: 0, paddingVertical: 8 }}>
        {items.map((item, i) => (
          <View key={item.id} style={{ borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
            <Row
              icon={item.done ? "checkmark" : "exclamationmark"}
              tint={item.done ? colors.mint : colors.butter}
              title={item.title}
              detail={item.detail}
              status={item.done ? "Done" : "To do"}
              onPress={item.id === "bills" ? undefined : () => handleItem(item)}
            />
            {item.id === "bills" && (
              <View style={{ paddingLeft: 48, paddingBottom: 12, gap: 8 }}>
                {BILLS.map((b) => (
                  <View key={b.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <T w="medium">{b.label} bill</T>
                    <Switch
                      accessibilityLabel={`I have a ${b.label.toLowerCase()} bill`}
                      value={!!record.bills?.[b.key]}
                      onValueChange={(v) => void run("bills", () => saveTaxTime((r) => ({ bills: { ...r.bills, [b.key]: v } })))}
                      trackColor={{ true: colors.tangerine }}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
        {earlierAssets.length > 0 && (
          <View style={{ borderTopWidth: 1, borderColor: colors.border }}>
            <Row
              icon="info"
              tint={colors.sky}
              status="Info"
              title={`${plural(earlierAssets.length, "asset")} from earlier years`}
              detail={`${formatCurrency(earlierAssets.reduce((s, a) => s + calculateCurrentYearDepreciation(a, fy), 0))} of depreciation, already in your totals`}
              web
              onPress={() => openWeb("/assets")}
            />
          </View>
        )}
        <View style={{ borderTopWidth: 1, borderColor: colors.border }}>
          {airtailConnected ? (
            <Row icon="envelope.fill" tint={colors.sky} status="Info" title="Email receipts" detail="See what Airtail found in your inbox for this year" onPress={() => router.push("/airtail")} />
          ) : (
            <Row
              icon="envelope.fill"
              tint={colors.sky}
              status="Info"
              title="Receipts in your email?"
              detail={airtailConnected === null ? "Checking Airtail…" : "Connect Airtail on the web to bring them in from Gmail or Yahoo"}
              web
              onPress={airtailConnected === null ? undefined : () => openWeb("/settings?airtail=setup")}
            />
          )}
        </View>
      </Card>

      {!!error && (
        <T color={colors.negative} accessibilityRole="alert">
          {error}
        </T>
      )}

      <View style={{ gap: 8 }}>
        <Button title="Enter into myTax" icon="arrow.right.circle.fill" kind="primary" onPress={() => router.push("/lodge")} />
        <Button title="Receipt pack (PDF)" icon="doc.on.doc.fill" kind="soft" busy={busy === "pack"} onPress={() => void run("pack", () => shareReceiptPack(data, summary))} />
        <Button title="Original receipts (ZIP)" icon="square.and.arrow.up" kind="soft" disabled={!!busy} busy={busy === "originals"} onPress={() => void run("originals", async () => { const missing = await shareOriginalReceipts(fy); if (missing) Alert.alert("Missing receipts", `${missing} entries have no original receipt stored.`); })} />
      </View>
      <T size={12} color={colors.inkSoft} style={{ textAlign: "center" }}>
        Lodge in myTax through myGov by 31 October, or ask a registered tax agent.
      </T>
    </Screen>
  );
}
