"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useTax } from "@/context/tax-context";

const DISMISS_KEY = "ledgr_onboarding_dismissed";

const RESIDENCY_LABELS: Record<string, string> = {
  resident: "Australian Resident",
  non_resident: "Non-Resident",
  working_holiday: "Working Holiday",
};

export const Onboarding = () => {
  const { state, updateSettings } = useTax();
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" && !localStorage.getItem(DISMISS_KEY)
  );
  const [occupation, setOccupation] = useState(state.settings.occupation);
  const [income, setIncome] = useState("");
  const [residency, setResidency] = useState(
    state.settings.taxResidentStatus
  );

  // ponytail: onboarding = income unset; dismissal remembered in localStorage
  if (!state.loaded || state.settings.annualIncome > 0) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  const handleSave = async () => {
    await updateSettings({
      ...state.settings,
      occupation: occupation.trim() || state.settings.occupation,
      annualIncome: parseFloat(income) || 0,
      taxResidentStatus: residency,
    });
    dismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up your tax profile</DialogTitle>
          <DialogDescription>
            Three quick questions. Your occupation helps the AI judge whether
            a receipt is claimable for your line of work, and your income
            powers the refund estimate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ob-occupation" className="text-xs">
              What do you do? Include your industry
            </Label>
            <Input
              id="ob-occupation"
              placeholder="e.g. Software Engineer at a fintech"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-income" className="text-xs">
              Annual income before tax ($)
            </Label>
            <Input
              id="ob-income"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 120000"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-residency" className="text-xs">
              Tax residency
            </Label>
            <Select
              value={residency}
              onValueChange={(v) => setResidency(v as typeof residency)}
            >
              <SelectTrigger id="ob-residency">
                <span>{RESIDENCY_LABELS[residency]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resident">Australian Resident</SelectItem>
                <SelectItem value="non_resident">Non-Resident</SelectItem>
                <SelectItem value="working_holiday">Working Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Skip for now
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!income}>
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
