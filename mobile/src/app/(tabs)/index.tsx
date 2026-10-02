import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import type { Expense, WfhMethod } from "@shared/types";
import { WFH_FIXED_RATE_PER_HOUR } from "@shared/constants";
import { formatCurrency, getCategoryBreakdown, isCoveredByFixedRate } from "@shared/tax-calculator";
import { getMyTaxRows } from "@shared/mytax";
import { useData } from "@/lib/store";
import { API_URL } from "@/lib/api";
import { colors } from "@/lib/theme";
import { ReceiptReview } from "@/components/receipt-review";
import { Button, Card, Heading, Icon, Screen, T } from "@/components/ui";

const DAY = 86_400_000;
const TINTS = [colors.butter, colors.mint, colors.pink, colors.sky, colors.lav];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Morning!" : h < 17 ? "Arvo!" : "Evening!";
};

const claimNote = (e: Expense, wfhMethod: WfhMethod) =>
  isCoveredByFixedRate(e, wfhMethod)
    ? "Covered by the 70c rate"
    : e.workUsePercent === 0
      ? "Personal · no deduction"
      : e.claimType === "depreciation"
        ? "Over $300, so it's depreciated"
        : e.workUsePercent < 100
          ? `${e.workUsePercent}% work use`
          : "Claimed in full";

const Chip = ({ text, tint = colors.plum2, color = colors.lav }: { text: string; tint?: string; color?: string }) => (
  <View style={{ borderRadius: 999, backgroundColor: tint, paddingHorizontal: 12, paddingVertical: 5 }}>
    <T w="bold" size={13} color={color}>
      {text}
    </T>
  </View>
);

export default function Home() {
  const { data, summary, refresh } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [now] = useState(() => Date.now());
  const { settings, expenses, wfhEntries, assets } = data;
  const fy = settings.financialYear;

  // same year-progress maths as the web dashboard
  const startYear = parseInt(fy.slice(0, 4), 10);
  const fyStart = new Date(startYear, 6, 1).getTime();
  const fyEnd = new Date(startYear + 1, 5, 30, 23, 59).getTime();
  const lodgeBy = new Date(startYear + 1, 9, 31, 23, 59).getTime();
  const yearDone = Math.min(1, Math.max(0, (now - fyStart) / (fyEnd - fyStart)));
  const status =
    now < fyStart
      ? "Hasn't started yet"
      : now <= fyEnd
        ? `${Math.max(1, Math.ceil((fyEnd - now) / (30 * DAY)))} months to go`
        : now <= lodgeBy
          ? `Lodge by 31 Oct ${startYear + 1} · ${Math.ceil((lodgeBy - now) / DAY)} days left`
          : "All wrapped up";

  const weekAgo = now - 7 * DAY;
  const weekHours = wfhEntries.filter((e) => new Date(e.date).getTime() >= weekAgo).reduce((s, e) => s + e.hours, 0);
  const weekClaimed =
    expenses
      .filter((e) => new Date(e.createdAt).getTime() >= weekAgo && !isCoveredByFixedRate(e, settings.wfhMethod))
      .reduce((s, e) => s + e.claimableAmount, 0) +
    (settings.wfhMethod === "fixed_rate" ? weekHours * WFH_FIXED_RATE_PER_HOUR : 0);

  const returnRows = getMyTaxRows(
    getCategoryBreakdown(expenses, settings.wfhMethod, assets, fy),
    summary.totalWfhDeduction
  );
  if (summary.rentalDeductions > 0) returnRows.push({ item: "Rental property (I21)", amount: summary.rentalDeductions });

  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const pull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={pull}>
      <Heading title={greeting()} subtitle={`FY ${fy} · ${status}`} />

      <Card tint={colors.plum} style={{ gap: 16, borderRadius: 32, padding: 22 }}>
        <View>
          <T w="bold" size={15} color={colors.butter}>
            Estimated tax savings · FY {fy}
          </T>
          <T
            w="black"
            size={54}
            color="#ffffff"
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{ letterSpacing: -1.5, fontVariant: ["tabular-nums"] }}
          >
            {formatCurrency(summary.estimatedTaxSaved)}
          </T>
          <T w="medium" size={15} color={colors.lav}>
            Tax your deductions save you
            {settings.annualIncome > 0
              ? ` on a ${formatCurrency(settings.annualIncome)} salary.`
              : ". Add your salary in Settings for a sharper number."}
          </T>
        </View>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T w="bold" size={12} color={colors.lav}>
              1 Jul {startYear}
            </T>
            <T w="bold" size={12} color={colors.lav}>
              {Math.round(yearDone * 100)}% of the year gone
            </T>
            <T w="bold" size={12} color={colors.lav}>
              30 Jun {startYear + 1}
            </T>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Financial year progress"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(yearDone * 100) }}
            style={{ height: 10, borderRadius: 999, backgroundColor: colors.plum2, overflow: "hidden" }}
          >
            <View style={{ height: "100%", width: `${yearDone * 100}%`, borderRadius: 999, backgroundColor: colors.butter }} />
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {weekClaimed > 0 && <Chip text={`+${formatCurrency(weekClaimed)} this week`} tint={colors.mint} color={colors.plum} />}
          <Chip text={`${formatCurrency(summary.totalDeductions)} in deductions`} />
          <Chip text={`Taxable income ${formatCurrency(summary.taxableIncome)}`} />
        </View>
        <T size={12} color={colors.lav}>
          Your final refund also depends on tax withheld and other income.
        </T>
      </Card>

      <Button title="Add a receipt" icon="camera.fill" kind="primary" onPress={() => router.push("/expense")} />

      <ReceiptReview />

      <Card>
        <T w="heavy" size={20} color={colors.plum} accessibilityRole="header">
          Your return
        </T>
        {returnRows.length === 0 ? (
          <T color={colors.inkSoft}>
            Nothing claimed yet. Scan a receipt or log some hours and it&apos;ll show up here, sorted into the labels myTax uses.
          </T>
        ) : (
          <View>
            {returnRows.map((r, i) => {
              const code = r.item.match(/\(([A-Z]\d+)\)$/)?.[1] ?? "";
              return (
                <View key={r.item} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                  <View style={{ minWidth: 44, borderRadius: 8, backgroundColor: colors.lav, paddingHorizontal: 6, paddingVertical: 4, alignItems: "center" }}>
                    <T w="heavy" size={12} color={colors.plum}>
                      {code}
                    </T>
                  </View>
                  <T w="bold" size={15} style={{ flex: 1 }}>
                    {r.item.replace(/ \([A-Z]\d+\)$/, "")}
                  </T>
                  <T w="bold" size={15} style={{ fontVariant: ["tabular-nums"] }}>
                    {formatCurrency(r.amount)}
                  </T>
                </View>
              );
            })}
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 2, borderColor: colors.plum, paddingTop: 10 }}>
              <T w="heavy">Total</T>
              <T w="black" size={17} style={{ fontVariant: ["tabular-nums"] }}>
                {formatCurrency(returnRows.reduce((s, r) => s + r.amount, 0))}
              </T>
            </View>
          </View>
        )}
      </Card>

      <Card>
        <T w="heavy" size={20} color={colors.plum} accessibilityRole="header">
          Recent
        </T>
        {recent.length === 0 ? (
          <T color={colors.inkSoft}>Expenses you add will land here.</T>
        ) : (
          recent.map((e, i) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityHint="Opens this expense to edit"
              onPress={() => router.push({ pathname: "/expense", params: { id: e.id } })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: TINTS[i % TINTS.length], alignItems: "center", justifyContent: "center" }}>
                <Icon name="doc.text.fill" size={17} />
              </View>
              <View style={{ flex: 1 }}>
                <T w="bold" size={15} numberOfLines={1}>
                  {e.description}
                </T>
                <T w="medium" size={13} color={colors.inkSoft}>
                  {new Date(`${e.date}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} ·{" "}
                  {claimNote(e, settings.wfhMethod)}
                </T>
              </View>
              <T w="bold" size={15} style={{ fontVariant: ["tabular-nums"] }}>
                {formatCurrency(e.amount)}
              </T>
            </Pressable>
          ))
        )}
      </Card>

      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(`${API_URL}/reports`)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 8 }}
      >
        <T w="bold" size={14} color={colors.tangerineInk}>
          Export for myTax on the web
        </T>
        <Icon name="arrow.up.right" size={13} color={colors.tangerineInk} />
      </Pressable>
    </Screen>
  );
}
