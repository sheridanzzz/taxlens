import { useState } from "react";
import { Pressable, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { FY_DATE_RANGES, WFH_FIXED_RATE_PER_HOUR, toLocalDate } from "@shared/constants";
import { calculateWfhDeductionFixedRate, formatCurrency } from "@shared/tax-calculator";
import { useData } from "@/lib/store";
import { colors } from "@/lib/theme";
import { Button, Card, Heading, Icon, Screen, T } from "@/components/ui";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DEFAULT_HOURS = 8;

const Stepper = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const step = (d: number) => onChange(Math.min(24, Math.max(0.5, value + d)));
  const btn = (d: number, label: string, icon: "minus" | "plus") => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => step(d)}
      style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 999, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} />
    </Pressable>
  );
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Hours worked from home"
      accessibilityValue={{ text: `${value} hours` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 0.5 : -0.5)}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
    >
      {btn(-0.5, "Half an hour less", "minus")}
      <T w="black" size={44} color={colors.plum} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
        <T w="bold" size={20} color={colors.plum}>
          {" "}h
        </T>
      </T>
      {btn(0.5, "Half an hour more", "plus")}
    </View>
  );
};

export default function Wfh() {
  const { data, save, remove } = useData();
  const { settings, wfhEntries } = data;
  const fy = settings.financialYear;
  const { start, end } = FY_DATE_RANGES[fy];
  const today = toLocalDate();
  // hours can only be logged for days that have happened, inside the viewed FY
  const lastDay = today < end ? today : end;
  const started = lastDay >= start;

  const byDate = new Map(wfhEntries.map((e) => [e.date, e]));
  const [selected, setSelected] = useState(lastDay);
  const [hours, setHours] = useState(byDate.get(lastDay)?.hours ?? DEFAULT_HOURS);
  const [month, setMonth] = useState(() => {
    const d = new Date(`${lastDay}T12:00:00`);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entry = byDate.get(selected);

  const select = (date: string) => {
    setSelected(date);
    setHours(byDate.get(date)?.hours ?? DEFAULT_HOURS);
    setError("");
  };

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

  const totalHours = wfhEntries.reduce((s, e) => s + e.hours, 0);
  const fixedRate = settings.wfhMethod === "fixed_rate";

  const first = new Date(month.y, month.m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells = [...Array<null>(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthKey = (y: number, m: number) => toLocalDate(new Date(y, m, 1)).slice(0, 7);
  const canPrev = monthKey(month.y, month.m) > start.slice(0, 7);
  const canNext = monthKey(month.y, month.m) < lastDay.slice(0, 7);
  const shift = (d: number) => setMonth(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));

  const selectedLabel =
    selected === today
      ? "Today"
      : new Date(`${selected}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Screen>
      <Heading
        title="Home hours"
        subtitle={fixedRate ? `${Math.round(WFH_FIXED_RATE_PER_HOUR * 100)}c an hour, the ATO fixed rate` : "Your hours diary for the actual-cost method"}
      />

      <Card tint={colors.mint} style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <T w="bold" size={13} color={colors.plum}>
            FY {fy}
          </T>
          <T w="black" size={28} color={colors.plum}>
            {totalHours.toLocaleString("en-AU")} h
          </T>
          <T size={13} color={colors.plum}>
            {wfhEntries.length} day{wfhEntries.length === 1 ? "" : "s"} logged
          </T>
        </View>
        {fixedRate && (
          <View style={{ alignItems: "flex-end" }}>
            <T w="bold" size={13} color={colors.plum}>
              Deduction
            </T>
            <T w="black" size={28} color={colors.plum} style={{ fontVariant: ["tabular-nums"] }}>
              {formatCurrency(calculateWfhDeductionFixedRate(wfhEntries))}
            </T>
          </View>
        )}
      </Card>

      {!started ? (
        <Card>
          <T>FY {fy} hasn&apos;t started yet. Switch years in Settings to log hours.</T>
        </Card>
      ) : (
        <>
          <Card style={{ gap: 16 }}>
            <T w="heavy" size={20} color={colors.plum} accessibilityRole="header">
              {selectedLabel}
            </T>
            <Stepper value={hours} onChange={setHours} />
            <Button
              title={entry ? (entry.hours === hours ? "Logged" : "Update hours") : "Log these hours"}
              kind="primary"
              icon={entry?.hours === hours ? "checkmark" : undefined}
              busy={busy}
              disabled={entry?.hours === hours}
              onPress={() =>
                void run(() => save("wfhEntries", { id: entry?.id ?? randomUUID(), date: selected, hours, financialYear: fy }))
              }
            />
            {entry && <Button title="Remove this day" kind="danger" disabled={busy} onPress={() => void run(() => remove("wfhEntries", entry.id))} />}
            {!!error && (
              <T color={colors.negative} accessibilityRole="alert">
                {error}
              </T>
            )}
          </Card>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canPrev} onPress={() => shift(-1)} style={{ padding: 8, opacity: canPrev ? 1 : 0.3 }}>
                <Icon name="chevron.left" size={16} />
              </Pressable>
              <T w="heavy" size={17} color={colors.plum}>
                {first.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
              </T>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={!canNext} onPress={() => shift(1)} style={{ padding: 8, opacity: canNext ? 1 : 0.3 }}>
                <Icon name="chevron.right" size={16} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row" }}>
              {WEEKDAYS.map((d, i) => (
                <T key={i} w="bold" size={12} color={colors.inkSoft} style={{ width: `${100 / 7}%`, textAlign: "center" }}>
                  {d}
                </T>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((day, i) => {
                if (!day) return <View key={`blank-${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
                const key = toLocalDate(new Date(month.y, month.m, day));
                const logged = byDate.get(key);
                const disabled = key < start || key > lastDay;
                const isSelected = key === selected;
                return (
                  <View key={key} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${new Date(month.y, month.m, day).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}${logged ? `, ${logged.hours} hours logged` : ""}`}
                      accessibilityState={{ selected: isSelected, disabled }}
                      disabled={disabled}
                      onPress={() => select(key)}
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: logged ? colors.tangerine : colors.surface2,
                        borderWidth: isSelected ? 2.5 : 0,
                        borderColor: colors.plum,
                        opacity: disabled ? 0.35 : 1,
                      }}
                    >
                      <T w={logged ? "heavy" : "medium"} size={14} color={colors.ink}>
                        {day}
                      </T>
                      {logged && (
                        <T w="bold" size={10} color={colors.ink}>
                          {logged.hours}h
                        </T>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
