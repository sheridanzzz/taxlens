import { useRef, useState } from "react";
import { Animated, PanResponder, View } from "react-native";
import { router } from "expo-router";
import type { Expense } from "@shared/types";
import { EXPENSE_CATEGORIES, isAiScanned } from "@shared/constants";
import { formatCurrency, isCoveredByFixedRate } from "@shared/tax-calculator";
import { expenseReviewStatus } from "@shared/receipt-review";
import { useReducedMotion } from "@/lib/reduced-motion";
import { useData } from "@/lib/store";
import { colors } from "@/lib/theme";
import { Button, Icon, T } from "./ui";

const fingerprint = (e: Expense) => JSON.stringify([e.id, e.date, e.description, e.amount, e.category,
  e.claimType, e.workUsePercent, e.claimableAmount, e.notes, e.assetId, e.reviewStatus]);

/** Pending scans share their review status with the web and other devices. */
export const uncheckedScans = (expenses: Expense[]) =>
  expenses.filter(e => isAiScanned(e) && expenseReviewStatus(e) === "pending");

type Decision = "personal" | "confirm";

export const ReceiptReview = () => {
  const { data, saveExpense } = useData();
  const [leaving, setLeaving] = useState<Expense | null>(null);
  const lock = useRef(false);
  const [history, setHistory] = useState<{ before: Expense; after: Expense; decision: Decision }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion();
  const [x] = useState(() => new Animated.Value(0));

  const wfhMethod = data.settings.wfhMethod;
  const queue = uncheckedScans(data.expenses)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const top = leaving ?? queue[0];
  const last = history.at(-1);
  const canUndo = !!last && data.expenses.some((e) => fingerprint(e) === fingerprint(last.after));
  const total = data.expenses.filter(isAiScanned).length;
  const reviewed = total - queue.length;

  const settle = () => reducedMotion ? x.setValue(0) : Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();

  const decide = async (decision: Decision) => {
    if (!top || lock.current) return;
    if (decision === "confirm" && top.workUsePercent === 0) {
      settle();
      setMessage("Review work use before confirming this receipt.");
      router.push({ pathname: "/expense", params: { id: top.id } });
      return;
    }
    lock.current = true;
    setBusy(true);
    setLeaving(top);
    setError("");
    const after: Expense = decision === "personal"
      ? { ...top, workUsePercent: 0, claimableAmount: 0, reviewStatus: "personal" }
      : { ...top, reviewStatus: "reviewed" };
    try {
      await saveExpense(after);
      await new Promise(done => Animated.timing(x, {
        toValue: reducedMotion ? 0 : decision === "personal" ? -500 : 500,
        duration: reducedMotion ? 0 : 220, useNativeDriver: true,
      }).start(done));
      setHistory(h => [...h, { before: top, after, decision }]);
      setMessage(decision === "personal" ? `${top.description} marked personal. Receipt kept, claim set to $0.` : `${top.description} checked.`);
    } catch {
      setError("Couldn't save this review. Your card is still here, so try again.");
    } finally {
      x.setValue(0);
      setLeaving(null);
      setBusy(false);
      lock.current = false;
    }
  };

  const undo = async () => {
    if (!last || !canUndo || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      // Legacy scans have no status field. Explicit null clears the decision;
      // omitting it would ask the server to preserve the current status.
      await saveExpense({ ...last.before, reviewStatus: last.before.reviewStatus ?? null });
      setHistory((h) => h.slice(0, -1));
      setMessage(`Undone. ${last.before.description} is back for review.`);
    } catch {
      setError("Couldn't undo yet. Try again.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };

  // ponytail: rebuilt each render so it always calls the current decide();
  // cheap, and nothing re-renders mid-drag (the drag only moves an Animated value)
  // PanResponder stores callbacks; the save lock is read only when a gesture fires.
  // eslint-disable-next-line react-hooks/refs
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !busy && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => x.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) >= 90 || (Math.abs(g.dx) >= 35 && Math.abs(g.vx) >= 0.65)) {
        void decide(g.dx < 0 ? "personal" : "confirm");
      } else {
        settle();
      }
    },
    onPanResponderTerminate: settle,
  });

  const covered = top && isCoveredByFixedRate(top, wfhMethod);
  const shown = top ? (top.claimType === "depreciation" ? top.amount : covered ? 0 : top.claimableAmount) : 0;

  return (
    <View style={{ borderRadius: 28, backgroundColor: "rgba(228,216,238,0.6)", padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T w="heavy" size={19} color={colors.plum} accessibilityRole="header">
          Check your scans
        </T>
        <View style={{ borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)", paddingHorizontal: 12, paddingVertical: 4 }}>
          <T w="bold" size={12} color={colors.plum}>
            {queue.length ? `${queue.length} to check` : "All caught up"}
          </T>
        </View>
      </View>
      {total > 0 && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Receipt review progress"
          accessibilityValue={{ min: 0, max: total, now: reviewed }}
          style={{ height: 6, borderRadius: 999, backgroundColor: "rgba(42,21,56,0.1)", overflow: "hidden" }}
        >
          <View style={{ height: "100%", width: `${(reviewed / total) * 100}%`, backgroundColor: colors.plum, borderRadius: 999 }} />
        </View>
      )}

      {top ? (
        <>
          <View>
            <View style={{ position: "absolute", top: 8, bottom: -4, left: 12, right: 12, borderRadius: 22, backgroundColor: colors.mint, transform: [{ rotate: "2deg" }] }} />
            <View style={{ position: "absolute", top: 4, bottom: -2, left: 4, right: 4, borderRadius: 22, backgroundColor: colors.pink, transform: [{ rotate: "-1deg" }] }} />
            <Animated.View
              {...pan.panHandlers}
              accessible
              accessibilityLabel={`Review ${top.description}`}
              accessibilityHint="Swipe left for personal, right if it looks right"
              accessibilityActions={[
                { name: "personal", label: "Mark personal" },
                { name: "confirm", label: "Looks right" },
              ]}
              onAccessibilityAction={(e) => void decide(e.nativeEvent.actionName as Decision)}
              style={{
                minHeight: 200,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 20,
                overflow: "hidden",
                transform: [
                  { translateX: x },
                  { rotate: x.interpolate({ inputRange: [-220, 0, 220], outputRange: reducedMotion ? ["0deg", "0deg", "0deg"] : ["-10deg", "0deg", "10deg"] }) },
                ],
              }}
            >
              <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.butter, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="doc.text.fill" />
                </View>
                <View style={{ flex: 1 }}>
                  <T w="heavy" size={18}>
                    {top.description}
                  </T>
                  <T w="medium" size={13} color={colors.inkSoft} style={{ marginTop: 2 }}>
                    {new Date(`${top.date}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} ·{" "}
                    {EXPENSE_CATEGORIES[top.category]?.label ?? top.category}
                  </T>
                </View>
              </View>
              <T w="bold" size={12} color={colors.inkSoft} style={{ marginTop: 18 }}>
                {top.claimType === "depreciation"
                  ? "Receipt total · claimed through Assets"
                  : covered
                    ? "Covered by the 70c rate · not claimed separately"
                    : "Recorded deduction"}
              </T>
              <T w="black" size={38} color={colors.plum} style={{ fontVariant: ["tabular-nums"] }}>
                {formatCurrency(shown)}
              </T>
              <T size={14} color={colors.inkSoft}>
                {expenseReviewStatus(top) === "pending" ? "Pending review · set work use before claiming" : top.workUsePercent === 0 ? "Personal · no deduction" : `${top.workUsePercent}% work use · ${formatCurrency(top.amount)} paid`}
              </T>
              <Animated.View
                pointerEvents="none"
                style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,198,211,0.95)", opacity: x.interpolate({ inputRange: [-90, -15], outputRange: [1, 0], extrapolate: "clamp" }) }}
              >
                <Stamp text="PERSONAL" rotate="-12deg" />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(189,235,210,0.95)", opacity: x.interpolate({ inputRange: [15, 90], outputRange: [0, 1], extrapolate: "clamp" }) }}
              >
                <Stamp text="LOOKS RIGHT" rotate="12deg" />
              </Animated.View>
            </Animated.View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <T w="bold" size={12} color={colors.plum}>
              ← Swipe personal
            </T>
            <T w="bold" size={12} color={colors.plum}>
              Swipe to confirm →
            </T>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Personal" icon="xmark" kind="pink" busy={busy} onPress={() => void decide("personal")} style={{ flex: 1 }} />
            <Button
              title="Fix"
              icon="pencil"
              kind="soft"
              disabled={busy}
              onPress={() => router.push({ pathname: "/expense", params: { id: top.id } })}
            />
            <Button title="Looks right" icon="checkmark" busy={busy} onPress={() => void decide("confirm")} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <View style={{ borderRadius: 22, backgroundColor: colors.butter, padding: 22, gap: 10 }}>
          <View style={{ width: 46, height: 46, borderRadius: 999, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center" }}>
            <Icon name="checkmark" color={colors.butter} />
          </View>
          <T w="black" size={28} color={colors.plum}>
            {history.length ? "Nice. All sorted." : "All sorted."}
          </T>
          <T size={15} color={colors.plum}>
            {history.length
              ? `${history.length} receipt${history.length === 1 ? "" : "s"} checked.`
              : "Nothing waiting for a look. Scan your next receipt whenever you're ready."}
          </T>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 32 }}>
        <T size={12} color={colors.inkSoft} style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {busy ? "Saving…" : message || "Saved decisions sync with your account."}
        </T>
        {history.length > 0 && (
          <Button title="Undo" icon="arrow.uturn.backward" kind="soft" disabled={busy || !canUndo} onPress={() => void undo()} style={{ minHeight: 38 }} />
        )}
      </View>
      {!!error && (
        <View style={{ borderRadius: 14, backgroundColor: colors.surface, padding: 12 }}>
          <T size={14} color={colors.negative} accessibilityRole="alert">
            {error}
          </T>
        </View>
      )}
    </View>
  );
};

const Stamp = ({ text, rotate }: { text: string; rotate: string }) => (
  <View style={{ transform: [{ rotate }], borderWidth: 4, borderColor: colors.plum, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6 }}>
    <T w="black" size={24} color={colors.plum}>
      {text}
    </T>
  </View>
);
