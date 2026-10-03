import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import type { FinancialYear } from "@shared/types";
import { getFinancialYearForDate, toLocalDate } from "@shared/constants";
import { lodgingYear, taxTimeFor } from "@shared/tax-time";
import { checklist } from "./checklist";
import { useData, type Data } from "./store";

// Local notifications only: nothing is sent to a server. Actions that log hours
// open the app to do it, so no background task is needed.

const HOURS_CATEGORY = "hours";
const ACTION_LOG = "log";
const ACTION_DIFFERENT = "different";
export const USUAL_DAY_HOURS = 7.6;
const PREFS_KEY = "ledgr_reminders";
/** Days before 31 October that the deadline reminders go out, at 9am. */
const DEADLINE_DAYS = [14, 7, 2];

export type ReminderPrefs = { hours: boolean; hour: number; minute: number; deadline: boolean };
const DEFAULT_PREFS: ReminderPrefs = { hours: false, hour: 17, minute: 0, deadline: false };

/** What the deadline reminders need to say. */
type Deadline = { fy: FinancialYear | null; lodged: boolean; left: string[] };

export const deadlineFor = (data: Data): Deadline => {
  const today = toLocalDate();
  const fy = lodgingYear(today);
  return {
    fy,
    lodged: !!fy && !!taxTimeFor(data.settings, fy).lodgedAt,
    left: fy && data.settings.financialYear === fy ? checklist(data, today).filter((i) => !i.done).map((i) => i.title) : [],
  };
};

export const readPrefs = (): ReminderPrefs => {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});
void Notifications.setNotificationCategoryAsync(HOURS_CATEGORY, [
  { identifier: ACTION_LOG, buttonTitle: `Log ${USUAL_DAY_HOURS} h`, options: { opensAppToForeground: true } },
  { identifier: ACTION_DIFFERENT, buttonTitle: "Different hours", options: { opensAppToForeground: true } },
  { identifier: "skip", buttonTitle: "Not today", options: { opensAppToForeground: false } },
]);

/** Asks once; returns whether notifications may be shown. */
export const allowNotifications = async () => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
};

/** Replaces every scheduled reminder with what these preferences call for. */
const schedule = async (prefs: ReminderPrefs, deadline: Deadline) => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (prefs.hours) {
    // ponytail: weekdays only; public holidays still get one (no holiday data), so there's Not today
    for (let weekday = 2; weekday <= 6; weekday++) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Worked from home today?",
          body: "Log your hours while you remember. The 70c rate needs them day by day.",
          categoryIdentifier: HOURS_CATEGORY,
          data: { kind: "hours" },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: prefs.hour, minute: prefs.minute },
      });
    }
  }
  if (!prefs.deadline || !deadline.fy || deadline.lodged) return;
  const due = new Date(Number(deadline.fy.slice(0, 4)) + 1, 9, 31, 9, 0);
  for (const days of DEADLINE_DAYS) {
    const at = new Date(due.getFullYear(), due.getMonth(), due.getDate() - days, 9, 0);
    if (at.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${days} days to lodge your FY ${deadline.fy} return`,
        body: deadline.left.length
          ? `Still on your checklist: ${deadline.left.join("; ")}.`
          : "Your checklist is done. Lodge mode walks you through myTax.",
        data: { kind: "deadline" },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
};

export const savePrefs = async (prefs: ReminderPrefs, data: Data) => {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await schedule(prefs, deadlineFor(data));
};

/** Keeps the deadline text current, and acts on taps and buttons. Mount once, inside the tabs. */
export const useReminders = () => {
  const { data, save } = useData();
  const deadlineKey = JSON.stringify(deadlineFor(data));

  useEffect(() => {
    const prefs = readPrefs();
    if (prefs.hours || prefs.deadline) void schedule(prefs, JSON.parse(deadlineKey) as Deadline).catch(() => {});
  }, [deadlineKey]);

  const response = Notifications.useLastNotificationResponse();
  const handled = useRef("");
  const entries = data.wfhEntries;
  useEffect(() => {
    if (!response) return;
    const key = `${response.notification.request.identifier}|${response.notification.date}|${response.actionIdentifier}`;
    if (handled.current === key) return;
    handled.current = key;
    Notifications.clearLastNotificationResponse();

    const kind = response.notification.request.content.data?.kind;
    const action = response.actionIdentifier;
    if (kind === "deadline") return router.navigate("/tax-time");
    if (kind !== "hours") return;
    // iOS reports seconds since 1970, Android milliseconds
    const sent = response.notification.date;
    const date = toLocalDate(new Date(sent < 1e12 ? sent * 1000 : sent));
    if (action === ACTION_LOG) {
      const fy = getFinancialYearForDate(date);
      if (!fy) return;
      const existing = entries.find((e) => e.date === date);
      void save("wfhEntries", { id: existing?.id ?? randomUUID(), date, hours: USUAL_DAY_HOURS, financialYear: fy }).catch(() => {});
    }
    if (action === ACTION_LOG || action === ACTION_DIFFERENT || action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.navigate({ pathname: "/wfh", params: { date } });
    }
  }, [response, entries, save]);
};
