"use client";

import { useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTax } from "@/context/tax-context";
import { FY_DATE_RANGES } from "@/lib/constants";
import type { WfhEntry } from "@/lib/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getMonthDays = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];

  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  return days;
};

const toDateString = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const WfhCalendar = () => {
  const { state, addWfhEntry, addWfhEntries, removeWfhEntry } = useTax();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hours, setHours] = useState("8");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [bulkHours, setBulkHours] = useState("8");
  // Mon..Sun, weekdays on by default
  const [bulkDays, setBulkDays] = useState([true, true, true, true, true, false, false]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const entryMap = useMemo(() => {
    const map = new Map<string, WfhEntry>();
    for (const entry of state.wfhEntries) {
      map.set(entry.date, entry);
    }
    return map;
  }, [state.wfhEntries]);

  const days = getMonthDays(currentMonth.year, currentMonth.month);

  const monthLabel = new Date(
    currentMonth.year,
    currentMonth.month
  ).toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const handleDayClick = (date: Date) => {
    const dateStr = toDateString(date);
    setSelectedDate(dateStr);

    const existing = entryMap.get(dateStr);
    if (existing) {
      setHours(existing.hours.toString());
    } else {
      setHours("8");
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0 || numHours > 24) return;

    const existing = entryMap.get(selectedDate);
    if (existing) {
      await removeWfhEntry(existing.id);
    }

    const entry: WfhEntry = {
      id: uuidv4(),
      date: selectedDate,
      hours: numHours,
      financialYear: state.settings.financialYear,
    };
    await addWfhEntry(entry);
    setDialogOpen(false);
  };

  const handleRemove = async () => {
    if (!selectedDate) return;
    const existing = entryMap.get(selectedDate);
    if (existing) {
      await removeWfhEntry(existing.id);
    }
    setDialogOpen(false);
  };

  const fyRange = FY_DATE_RANGES[state.settings.financialYear];
  // parse as local midnight — bare ISO dates parse as UTC and shift the
  // FY boundary, excluding 1 Jul in any timezone ahead of UTC
  const fyStart = new Date(fyRange.start + "T00:00:00");
  const fyEnd = new Date(fyRange.end + "T00:00:00");

  const isInFy = (d: Date) => d >= fyStart && d <= fyEnd;

  // dates the bulk dialog would create: in range, in FY, day ticked, not
  // already logged. Public holidays aren't skipped — delete those days after.
  const bulkTargets = (): string[] => {
    if (!bulkFrom || !bulkTo || bulkFrom > bulkTo) return [];
    const out: string[] = [];
    const d = new Date(bulkFrom + "T00:00:00");
    const end = new Date(bulkTo + "T00:00:00");
    for (; d <= end; d.setDate(d.getDate() + 1)) {
      if (!isInFy(d)) continue;
      if (!bulkDays[(d.getDay() + 6) % 7]) continue;
      const ds = toDateString(d);
      if (!entryMap.has(ds)) out.push(ds);
    }
    return out;
  };

  const handleOpenBulk = () => {
    const today = toDateString(new Date());
    setBulkFrom(fyRange.start);
    setBulkTo(today > fyRange.end ? fyRange.end : today < fyRange.start ? fyRange.start : today);
    setBulkOpen(true);
  };

  const handleBulkSave = async () => {
    const numHours = parseFloat(bulkHours);
    if (isNaN(numHours) || numHours <= 0 || numHours > 24) return;
    const targets = bulkTargets();
    if (targets.length === 0) return;
    setBulkSaving(true);
    await addWfhEntries(
      targets.map((date) => ({
        id: uuidv4(),
        date,
        hours: numHours,
        financialYear: state.settings.financialYear,
      }))
    );
    setBulkSaving(false);
    setBulkOpen(false);
  };

  const totalHours = state.wfhEntries.reduce((sum, e) => sum + e.hours, 0);
  const totalDays = state.wfhEntries.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">WFH Calendar</CardTitle>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {totalDays} days logged &middot; {totalHours.toFixed(1)} total hours
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleOpenBulk}>
            <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
            Bulk log
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {days.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const dateStr = toDateString(day);
            const entry = entryMap.get(dateStr);
            const inFy = isInFy(day);
            const isToday = toDateString(new Date()) === dateStr;
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <button
                key={dateStr}
                onClick={() => inFy && handleDayClick(day)}
                disabled={!inFy}
                className={`
                  relative flex aspect-square flex-col items-center justify-center rounded-md text-xs transition-colors
                  ${!inFy ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:bg-secondary dark:hover:bg-secondary"}
                  ${entry ? "bg-mint font-medium text-foreground dark:bg-primary/20 dark:text-primary" : ""}
                  ${isToday ? "ring-1 ring-primary" : ""}
                  ${isWeekend && !entry ? "text-muted-foreground" : ""}
                `}
                aria-label={`${dateStr}${entry ? `, ${entry.hours} hours logged` : ""}`}
                tabIndex={inFy ? 0 : -1}
              >
                <span>{day.getDate()}</span>
                {entry && (
                  <span className="text-[10px] leading-none">{entry.hours}h</span>
                )}
              </button>
            );
          })}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {selectedDate
                  ? new Date(selectedDate + "T00:00:00").toLocaleDateString(
                      "en-AU",
                      { weekday: "long", day: "numeric", month: "long" }
                    )
                  : "Log Hours"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wfh-hours">Hours worked from home</Label>
                <Input
                  id="wfh-hours"
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="flex justify-between">
                {entryMap.get(selectedDate || "") ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemove}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    {entryMap.get(selectedDate || "") ? "Update" : "Log"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bulk log WFH days</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bulk-from">From</Label>
                  <Input
                    id="bulk-from"
                    type="date"
                    min={fyRange.start}
                    max={fyRange.end}
                    value={bulkFrom}
                    onChange={(e) => setBulkFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulk-to">To</Label>
                  <Input
                    id="bulk-to"
                    type="date"
                    min={fyRange.start}
                    max={fyRange.end}
                    value={bulkTo}
                    onChange={(e) => setBulkTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Days you work from home</Label>
                <div className="flex gap-1.5">
                  {DAYS.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setBulkDays((prev) => prev.map((v, j) => (j === i ? !v : v)))
                      }
                      className={`flex-1 rounded-md border px-0 py-1.5 text-xs font-medium transition-colors ${
                        bulkDays[i]
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-transparent text-muted-foreground hover:bg-secondary"
                      }`}
                      aria-pressed={bulkDays[i]}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-hours">Hours per day</Label>
                <Input
                  id="bulk-hours"
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={bulkHours}
                  onChange={(e) => setBulkHours(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Will log <span className="font-medium text-foreground">{bulkTargets().length} days</span>{" "}
                ({(bulkTargets().length * (parseFloat(bulkHours) || 0)).toFixed(0)} hours).
                Already-logged days are skipped; remove public holidays and leave
                afterwards by clicking them on the calendar.
              </p>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setBulkOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleBulkSave}
                  disabled={bulkSaving || bulkTargets().length === 0}
                >
                  {bulkSaving ? "Logging…" : "Log days"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
