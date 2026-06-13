"use client";

import { useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import {
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
  const { state, addWfhEntry, removeWfhEntry } = useTax();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hours, setHours] = useState("8");
  const [dialogOpen, setDialogOpen] = useState(false);

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
  const fyStart = new Date(fyRange.start);
  const fyEnd = new Date(fyRange.end);

  const isInFy = (d: Date) => d >= fyStart && d <= fyEnd;

  const totalHours = state.wfhEntries.reduce((sum, e) => sum + e.hours, 0);
  const totalDays = state.wfhEntries.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WFH Calendar</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalDays} days logged &middot; {totalHours.toFixed(1)} total hours
        </p>
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
                  ${!inFy ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:bg-[#f4f5f2] dark:hover:bg-white/5"}
                  ${entry ? "bg-[#e2f6d5] font-medium text-[#163300] dark:bg-[#163300]/20 dark:text-[#9fe870]" : ""}
                  ${isToday ? "ring-1 ring-[#9fe870]" : ""}
                  ${isWeekend && !entry ? "text-[#868685]" : ""}
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
      </CardContent>
    </Card>
  );
};
