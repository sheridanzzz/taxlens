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
import { Button, Card, Heading, Icon, Screen, T, Tile } from "@/components/ui";

const DAY = 86_400_000;
const TINTS = [colors.butter, colors.mint, colors.pink, colors.sky, colors.lav];
const COIN = "#f2b63c";
// the web Jar (dashboard/page.tsx) is an SVG on a 100×120 grid; these Views redraw it at this scale
const S = 0.72;

const openWeb = (path: string) => void Linking.openURL(`${API_URL}${path}`);

const Jar = ({ fill }: { fill: number }) => {
  // the pot fills as the financial year goes on
  const level = Math.round(56 * Math.min(1, Math.max(0.15, fill)));
  const coin = (left: number, top: number) => (
    <View style={{ position: "absolute", left: left * S, top: top * S, width: 12 * S, height: 12 * S, borderRadius: 6 * S, backgroundColor: COIN }} />
  );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 100 * S, height: 120 * S }}>
      <View style={{ position: "absolute", left: 26 * S, top: 4 * S, width: 48 * S, height: 12 * S, borderRadius: 4 * S, backgroundColor: colors.tangerine }} />
      <View
        style={{
          position: "absolute",
          left: 10 * S,
          top: 22 * S,
          width: 80 * S,
          height: 94 * S,
          borderWidth: 3 * S,
          borderColor: "#ffffff",
          borderTopLeftRadius: 8 * S,
          borderTopRightRadius: 8 * S,
          borderBottomLeftRadius: 12 * S,
          borderBottomRightRadius: 12 * S,
          backgroundColor: "rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: level * S, backgroundColor: colors.butter }} />
        {coin(15, 69)}
        {coin(41, 63)}
      </View>
    </View>
  );
};

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

  const empty = expenses.length === 0 && assets.length === 0 && wfhEntries.length === 0;
  const missingReceipts = expenses.filter((e) => e.workUsePercent > 0 && !e.receiptDataUrl && !e.hasReceipt).length;

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

      {empty && (
        <Card>
          <View style={{ gap: 4 }}>
            <T w="bold" size={13} color={colors.inkSoft}>
              Getting started
            </T>
            <T w="black" size={28} color={colors.plum} accessibilityRole="header" style={{ letterSpacing: -0.6 }}>
              Your FY {fy} pot is empty
            </T>
            <T size={15} color={colors.inkSoft}>
              Start with whatever&apos;s closest to hand — it all goes in the pot.
            </T>
          </View>
          <Tile tint={colors.butter} icon="camera.viewfinder" title="Scan a receipt" detail="AI reads it and suggests the claim" onPress={() => router.push("/expense")} />
          <Tile
            tint={colors.mint}
            icon="plus"
            title="Add an expense"
            detail="Enter a deduction manually"
            onPress={() => router.push({ pathname: "/expense", params: { manual: "1" } })}
          />
          <Tile tint={colors.pink} icon="house.fill" title="Log WFH hours" detail="70c an hour, one day at a time" onPress={() => router.navigate("/wfh")} />
        </Card>
      )}

      <Card tint={colors.plum} style={{ gap: 16, borderRadius: 32, padding: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1 }}>
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
          <Jar fill={yearDone} />
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

      {!empty && <Button title="Add a receipt" icon="camera.fill" kind="primary" onPress={() => router.push("/expense")} />}

      <ReceiptReview />

      <View style={{ gap: 10 }}>
        <T w="heavy" size={20} color={colors.plum} accessibilityRole="header">
          This week
        </T>
        <Tile
          tint={colors.butter}
          icon="doc.text.fill"
          web
          title={missingReceipts > 0 ? `${missingReceipts} receipt${missingReceipts === 1 ? "" : "s"} missing` : "Every receipt attached"}
          detail={missingReceipts > 0 ? "Attach them before you lodge" : "Nice — nothing to chase"}
          onPress={() => openWeb("/expenses")}
        />
        <Tile
          tint={colors.mint}
          icon="clock.fill"
          title={weekHours > 0 ? `${weekHours.toLocaleString()} h at home` : "No hours logged"}
          detail={weekHours > 0 ? `${formatCurrency(weekHours * WFH_FIXED_RATE_PER_HOUR)} at 70c an hour` : "Worked from home? Log it while you remember"}
          onPress={() => router.navigate("/wfh")}
        />
        <Tile
          tint={colors.pink}
          icon="shippingbox.fill"
          web
          title={assets.length > 0 ? `${assets.length} asset${assets.length === 1 ? "" : "s"} depreciating` : "No assets yet"}
          detail={assets.length > 0 ? `${formatCurrency(summary.totalDepreciationClaims)} claimed this year` : "Laptop over $300? Add it here"}
          onPress={() => openWeb("/assets")}
        />
      </View>

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
        onPress={() => openWeb("/reports")}
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
