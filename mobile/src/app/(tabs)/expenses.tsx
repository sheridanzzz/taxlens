import { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { Expense } from "@shared/types";
import { EXPENSE_CATEGORIES } from "@shared/constants";
import { formatCurrency, isCoveredByFixedRate } from "@shared/tax-calculator";
import { myTaxItemFor } from "@shared/mytax";
import { useData } from "@/lib/store";
import { claimNote, myTaxCode, needsReceipt, plural, shortDate } from "@/lib/expenses";
import { colors } from "@/lib/theme";
import { uncheckedScans } from "@/components/receipt-review";
import { Button, Field, Heading, Icon, Pills, Screen, T } from "@/components/ui";

const BASE_FILTERS = [
  { value: "all", label: "All" },
  { value: "no-receipt", label: "No receipt" },
  { value: "unchecked", label: "Not checked" },
  { value: "personal", label: "Personal" },
];

const Row = ({ e, note, onPress }: { e: Expense; note: string; onPress: () => void }) => {
  const missing = needsReceipt(e);
  const attached = !!e.receiptDataUrl || !!e.hasReceipt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${e.description}, ${formatCurrency(e.amount)}, ${shortDate(e.date)}, ${note}${missing ? ", no receipt" : attached ? ", receipt attached" : ""}`}
      accessibilityHint="Opens this expense to edit"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: missing ? colors.pink : attached ? colors.mint : colors.surface2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={missing ? "exclamationmark" : attached ? "paperclip" : "doc.text"} size={17} />
      </View>
      <View style={{ flex: 1 }}>
        <T w="bold" size={15} numberOfLines={1}>
          {e.description}
        </T>
        <T w="medium" size={13} color={missing ? colors.negative : colors.inkSoft} numberOfLines={1}>
          {shortDate(e.date)} · {missing ? "No receipt" : note}
        </T>
      </View>
      <T w="bold" size={15} style={{ fontVariant: ["tabular-nums"] }}>
        {formatCurrency(e.amount)}
      </T>
    </Pressable>
  );
};

export default function Expenses() {
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const { data, refresh } = useData();
  const [filter, setFilter] = useState(filterParam ?? "all");
  const [appliedParam, setAppliedParam] = useState(filterParam);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { expenses, settings } = data;

  // Home and Tax time link here with a filter; this tab stays mounted, so apply each new one
  if (filterParam && filterParam !== appliedParam) {
    setAppliedParam(filterParam);
    setFilter(filterParam);
  }

  const unchecked = new Set(uncheckedScans(expenses).map((e) => e.id));
  const labels = [...new Set(expenses.filter((e) => e.workUsePercent > 0).map((e) => myTaxItemFor(e.category)))].sort();
  const filters = [...BASE_FILTERS, ...labels.map((item) => ({ value: item, label: myTaxCode(item) || item }))];

  const matchesFilter = (e: Expense) =>
    filter === "all"
      ? true
      : filter === "no-receipt"
        ? needsReceipt(e)
        : filter === "unchecked"
          ? unchecked.has(e.id)
          : filter === "personal"
            ? e.workUsePercent === 0
            : e.workUsePercent > 0 && myTaxItemFor(e.category) === filter;
  const q = query.trim().toLowerCase();
  const matchesQuery = (e: Expense) =>
    !q ||
    e.description.toLowerCase().includes(q) ||
    (EXPENSE_CATEGORIES[e.category]?.label ?? "").toLowerCase().includes(q) ||
    e.amount.toFixed(2).includes(q);

  // ponytail: a plain list in the scroll view; move to FlatList if a year passes ~500 expenses
  const shown = expenses.filter((e) => matchesFilter(e) && matchesQuery(e)).sort((a, b) => b.date.localeCompare(a.date));
  const claimed = shown.reduce((s, e) => s + (isCoveredByFixedRate(e, settings.wfhMethod) ? 0 : e.claimableAmount), 0);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => void handleRefresh()}>
      <Heading title="Expenses" subtitle={`FY ${settings.financialYear} · ${plural(expenses.length, "expense")}`} />
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Store, item, category or amount" clearButtonMode="while-editing" returnKeyType="search" />
      <Pills label="Filter expenses" options={filters} value={filters.some((f) => f.value === filter) ? filter : "all"} onChange={setFilter} />

      <View style={{ borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 6 }}>
        {shown.length === 0 ? (
          <T color={colors.inkSoft} style={{ paddingVertical: 14 }}>
            {expenses.length === 0
              ? "No expenses this year yet. Scan a receipt to start."
              : filter === "no-receipt" && !q
                ? "Every claimed expense has a receipt. Nice."
                : "Nothing matches."}
          </T>
        ) : (
          shown.map((e, i) => (
            <View key={e.id} style={{ borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
              <Row e={e} note={claimNote(e, settings.wfhMethod)} onPress={() => router.push({ pathname: "/expense", params: { id: e.id } })} />
            </View>
          ))
        )}
      </View>
      {shown.length > 0 && (
        <T w="bold" size={13} color={colors.inkSoft} style={{ textAlign: "center" }}>
          {plural(shown.length, "expense")} shown · {formatCurrency(claimed)} claimed
        </T>
      )}

      <Button title="Add a receipt" icon="camera.fill" kind="primary" onPress={() => router.push("/expense")} />
    </Screen>
  );
}
