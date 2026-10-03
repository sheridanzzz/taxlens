import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import type { SFSymbol } from "expo-symbols";
import type { WfhEntry } from "@shared/types";
import { toLocalDate } from "@shared/constants";
import { fillPlan, taxTimeFor, usualWeek, weekdayOf, type WeekStatus } from "@shared/tax-time";
import { useData } from "@/lib/store";
import { yearWeeks } from "@/lib/checklist";
import { plural, shortDate } from "@/lib/expenses";
import { colors } from "@/lib/theme";
import { Button, Card, Heading, Icon, Screen, T } from "@/components/ui";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS: Record<WeekStatus, { icon?: SFSymbol; bg: string; words: string }> = {
  logged: { icon: "checkmark", bg: colors.mint, words: "Hours logged" },
  away: { icon: "airplane", bg: colors.sky, words: "Office or leave" },
  gap: { icon: "exclamationmark", bg: colors.surface, words: "No hours" },
  future: { bg: colors.surface2, words: "Not over yet" },
};

const dayLabel = (d: string) => `${DAY_NAMES[weekdayOf(d)]} ${shortDate(d)}`;

export default function Gaps() {
  const { data, save, saveMany, saveTaxTime } = useData();
  const { settings, wfhEntries } = data;
  const fy = settings.financialYear;
  const [today] = useState(toLocalDate);
  const record = taxTimeFor(settings);
  const weeks = yearWeeks(data, today);
  const gaps = weeks.filter((w) => w.status === "gap");
  const [selected, setSelected] = useState<string | null>(gaps[0]?.monday ?? null);
  const [preview, setPreview] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const byDate = new Map(wfhEntries.map((e) => [e.date, e]));
  const filled = new Set(record.filledDays ?? []);
  const usual = usualWeek(wfhEntries);
  const hasPattern = usual.some((h) => h > 0);
  const plan = fillPlan(gaps, usual, new Set(byDate.keys()));
  const chosen = plan.filter((p) => !skipped.has(p.date));
  const week = weeks.find((w) => w.monday === selected);

  // month rows, by each week's first day in the FY
  const months = new Map<string, typeof weeks>();
  for (const w of weeks) months.set(w.days[0].slice(0, 7), [...(months.get(w.days[0].slice(0, 7)) ?? []), w]);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy("");
    }
  };

  const handleAway = (monday: string, away: boolean) =>
    void run("away", () =>
      saveTaxTime((r) => ({ awayWeeks: away ? [...(r.awayWeeks ?? []), monday] : (r.awayWeeks ?? []).filter((m) => m !== monday) }))
    );

  const handleLogDay = (date: string) => {
    const entry = byDate.get(date);
    Alert.prompt(
      `Hours on ${dayLabel(date)}`,
      "Only the hours you actually worked from home.",
      (value) => {
        const hours = parseFloat(value);
        if (!(hours > 0 && hours <= 24)) return setError("Enter between 0.5 and 24 hours.");
        void run("day", () => save("wfhEntries", { id: entry?.id ?? randomUUID(), date, hours, financialYear: fy }));
      },
      "plain-text",
      String(entry?.hours ?? (usual[weekdayOf(date)] || 7.6)),
      "decimal-pad"
    );
  };

  const handleToggleDay = (date: string) =>
    setSkipped((s) => {
      const next = new Set(s);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  const handleFill = () =>
    void run("fill", async () => {
      const rows: WfhEntry[] = chosen.map((p) => ({ id: randomUUID(), date: p.date, hours: p.hours, financialYear: fy }));
      // tagged first: if a save fails midway, no filled day is left looking like one logged at the time
      await saveTaxTime((r) => ({ filledDays: [...(r.filledDays ?? []), ...rows.map((x) => x.date)] }));
      await saveMany("wfhEntries", rows);
      setPreview(false);
      setConfirmed(false);
      setSkipped(new Set());
      setMessage(`${plural(rows.length, "day")} added and tagged as filled from your usual week.`);
    });

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Heading title="Find gaps" subtitle={`FY ${fy} · ${gaps.length ? `${plural(gaps.length, "week")} with no hours` : "no gaps"}`} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ paddingTop: 20, paddingLeft: 12 }}>
          <T w="bold" color={colors.tangerineInk}>
            Done
          </T>
        </Pressable>
      </View>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {(Object.keys(STATUS) as WeekStatus[]).map((s) => (
            <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Square status={s} size={20} />
              <T size={13} color={colors.inkSoft}>
                {STATUS[s].words}
              </T>
            </View>
          ))}
        </View>
        {[...months].map(([month, rows]) => (
          <View key={month} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T w="bold" size={13} color={colors.inkSoft} style={{ width: 34 }}>
              {new Date(`${month}-15T12:00:00`).toLocaleDateString("en-AU", { month: "short" })}
            </T>
            <View style={{ flexDirection: "row", gap: 6, flex: 1 }}>
              {rows.map((w) => (
                <Pressable
                  key={w.monday}
                  accessibilityRole="button"
                  accessibilityLabel={`Week of ${shortDate(w.monday)}: ${w.status === "logged" ? `${w.hours} hours logged` : STATUS[w.status].words}`}
                  accessibilityState={{ selected: selected === w.monday }}
                  onPress={() => setSelected(w.monday)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Square status={w.status} size={40} selected={selected === w.monday} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </Card>

      {week && (
        <Card style={{ gap: 8 }}>
          <T w="heavy" size={18} color={colors.plum} accessibilityRole="header">
            Week of {dayLabel(week.monday)}
          </T>
          <T w="bold" color={colors.inkSoft}>
            {week.status === "logged" ? `${week.hours} hours logged` : STATUS[week.status].words}
          </T>
          {week.days.map((d) => {
            const entry = byDate.get(d);
            const future = d > today;
            return (
              <View key={d} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 }}>
                <T w="medium" style={{ flex: 1 }}>
                  {dayLabel(d)}
                  {filled.has(d) && entry ? (
                    <T size={13} color={colors.inkSoft}>
                      {" "}· filled from usual week
                    </T>
                  ) : null}
                </T>
                <T w="bold" style={{ fontVariant: ["tabular-nums"] }}>
                  {entry ? `${entry.hours} h` : "—"}
                </T>
                {!future && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${entry ? "Change" : "Log"} hours for ${dayLabel(d)}`}
                    disabled={!!busy}
                    onPress={() => handleLogDay(d)}
                    style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface2, opacity: pressed ? 0.6 : 1 })}
                  >
                    <T w="bold" size={14} color={colors.plum}>
                      {entry ? "Change" : "Log"}
                    </T>
                  </Pressable>
                )}
              </View>
            );
          })}
          {week.status === "gap" && (
            <Button title="Mark as office or leave" icon="airplane" kind="soft" busy={busy === "away"} onPress={() => handleAway(week.monday, true)} />
          )}
          {week.status === "away" && (
            <Button title="I did work from home this week" kind="soft" busy={busy === "away"} onPress={() => handleAway(week.monday, false)} />
          )}
        </Card>
      )}

      {gaps.length > 0 && (
        <Card tint={colors.lav} style={{ gap: 12 }}>
          <T w="heavy" size={18} color={colors.plum} accessibilityRole="header">
            Fill from your usual week
          </T>
          {!hasPattern ? (
            <T color={colors.plum}>Log a few normal weeks first so Ledgr knows your pattern.</T>
          ) : (
            <>
              <T color={colors.plum}>
                Your usual week: {usual.map((h, i) => (h ? `${DAY_NAMES[i]} ${h} h` : null)).filter(Boolean).join(", ")}.
              </T>
              <View style={{ borderRadius: 16, backgroundColor: colors.butter, padding: 14 }}>
                <T w="bold" size={14} color={colors.plum}>
                  The ATO doesn&apos;t accept estimates for the 70c rate. Only fill days you can back up with a calendar, timesheet or roster.
                </T>
              </View>
              {!preview ? (
                <Button title={`Preview ${plural(plan.length, "day")}`} kind="plum" onPress={() => setPreview(true)} />
              ) : (
                <>
                  <T size={14} color={colors.plum}>
                    Untick public holidays and any day you weren&apos;t home. Ledgr doesn&apos;t know your state&apos;s holidays.
                  </T>
                  {gaps.map((w) => {
                    const days = plan.filter((p) => p.date >= w.monday && p.date <= w.days[w.days.length - 1]);
                    if (!days.length) return null;
                    return (
                      <View key={w.monday} style={{ gap: 6 }}>
                        <T w="bold" size={13} color={colors.inkSoft}>
                          Week of {shortDate(w.monday)}
                        </T>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {days.map((p) => {
                            const on = !skipped.has(p.date);
                            return (
                              <Pressable
                                key={p.date}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: on }}
                                accessibilityLabel={`${dayLabel(p.date)}, ${p.hours} hours`}
                                onPress={() => handleToggleDay(p.date)}
                                style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: on ? colors.plum : colors.surface, borderWidth: 1, borderColor: on ? colors.plum : colors.border }}
                              >
                                <T w="bold" size={13} color={on ? "#ffffff" : colors.inkSoft} style={{ textDecorationLine: on ? "none" : "line-through" }}>
                                  {DAY_NAMES[weekdayOf(p.date)]} {Number(p.date.slice(8))} · {p.hours} h
                                </T>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: confirmed }}
                    onPress={() => setConfirmed((c) => !c)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.plum, backgroundColor: confirmed ? colors.plum : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {confirmed && <Icon name="checkmark" size={14} color="#ffffff" />}
                    </View>
                    <T w="bold" color={colors.plum} style={{ flex: 1 }}>
                      I can back these days up
                    </T>
                  </Pressable>
                  <Button
                    title={`Add ${plural(chosen.length, "day")}`}
                    kind="primary"
                    disabled={!confirmed || chosen.length === 0}
                    busy={busy === "fill"}
                    onPress={handleFill}
                  />
                  <Button title="Cancel" kind="soft" onPress={() => setPreview(false)} />
                </>
              )}
            </>
          )}
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
    </Screen>
  );
}

const Square = ({ status, size, selected }: { status: WeekStatus; size: number; selected?: boolean }) => {
  const { icon, bg } = STATUS[status];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: selected ? 3 : status === "gap" ? 2 : 0,
        borderColor: selected ? colors.plum : colors.tangerine,
        borderStyle: status === "gap" && !selected ? "dashed" : "solid",
      }}
    >
      {icon && <Icon name={icon} size={size * 0.4} color={status === "gap" ? colors.tangerineInk : colors.plum} />}
    </View>
  );
};
