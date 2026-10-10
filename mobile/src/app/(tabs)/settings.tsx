import { useState } from "react";
import { Alert, Linking, Pressable, Switch, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { SFSymbol } from "expo-symbols";
import type { FinancialYear, UserSettings } from "@shared/types";
import { FINANCIAL_YEARS } from "@shared/constants";
import { taxTimeFor, withTaxTime } from "@shared/tax-time";
import { useData } from "@/lib/store";
import { API_URL } from "@/lib/api";
import { allowNotifications, readPrefs, savePrefs, USUAL_DAY_HOURS, type ReminderPrefs } from "@/lib/reminders";
import { shareOriginalReceipts } from "@/lib/receipts";
import { shareReceiptPack } from "@/lib/receipt-pack";
import { colors } from "@/lib/theme";
import { Button, Card, Choice, Field, Heading, Icon, Label, Screen, T } from "@/components/ui";

const RESIDENCY: { value: UserSettings["taxResidentStatus"]; label: string }[] = [
  { value: "resident", label: "Australian resident" },
  { value: "non_resident", label: "Foreign resident" },
  { value: "working_holiday", label: "Working holiday maker" },
];
const WFH_METHODS: { value: UserSettings["wfhMethod"]; label: string }[] = [
  { value: "fixed_rate", label: "Fixed rate (70c an hour)" },
  { value: "actual_cost", label: "Actual costs" },
];
const DEPRECIATION: { value: UserSettings["depreciationMethod"]; label: string }[] = [
  { value: "diminishing", label: "Diminishing value" },
  { value: "prime_cost", label: "Prime cost" },
];
// the parts of Ledgr that stay on the web for now
const WEB_LINKS: { path: string; label: string; icon: SFSymbol }[] = [
  { path: "/assets", label: "Assets & depreciation", icon: "laptopcomputer" },
  { path: "/rental", label: "Rental property", icon: "building.2.fill" },
  { path: "/investments", label: "Shares & crypto", icon: "chart.line.uptrend.xyaxis" },
  { path: "/reports", label: "Reports & myTax export", icon: "doc.richtext.fill" },
  { path: "/ask", label: "Ask about deductions", icon: "questionmark.bubble.fill" },
  { path: "/settings?airtail=setup", label: "Connect Airtail (email receipts)", icon: "envelope.badge.fill" },
];

const Row = ({ icon, label, onPress, busy }: { icon: SFSymbol; label: string; onPress: () => void; busy?: boolean }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ busy }}
    disabled={busy}
    onPress={onPress}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed || busy ? 0.6 : 1 })}
  >
    <Icon name={icon} size={18} />
    <T w="bold" style={{ flex: 1 }}>
      {busy ? "Preparing receipts…" : label}
    </T>
    <Icon name="chevron.right" size={13} color={colors.inkSoft} />
  </Pressable>
);

const Toggle = ({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
    <View style={{ flex: 1 }}>
      <T w="bold">{label}</T>
      <T size={13} color={colors.inkSoft}>
        {detail}
      </T>
    </View>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.tangerine }} />
  </View>
);

export default function Settings() {
  const { data, summary, saveSettings, saveTaxTime, signOut, deleteAccount } = useData();
  const [prefs, setPrefs] = useState(readPrefs);
  const [reminderMessage, setReminderMessage] = useState("");
  const [packing, setPacking] = useState(false);
  const [draft, setDraft] = useState(data.settings);
  const [storedOccupation, setStoredOccupation] = useState(data.settings.occupation);
  // The email-receipt screen can save the occupation while this tab stays mounted.
  if (storedOccupation !== data.settings.occupation) {
    setStoredOccupation(data.settings.occupation);
    if (draft.occupation === storedOccupation) setDraft({ ...draft, occupation: data.settings.occupation });
  }
  const [income, setIncome] = useState(data.settings.annualIncome ? String(data.settings.annualIncome) : "");
  const storedWithheld = (fy: FinancialYear) => {
    const v = taxTimeFor(data.settings, fy).taxWithheld;
    return v === undefined ? "" : String(v);
  };
  const [withheld, setWithheld] = useState(() => storedWithheld(data.settings.financialYear));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage("");
  };
  const handleYearChange = (fy: FinancialYear) => {
    set("financialYear", fy);
    setWithheld(storedWithheld(fy));
  };
  const parsedWithheld = withheld.trim() === "" ? undefined : parseFloat(withheld.replace(/[^\d.]/g, "")) || 0;
  // lodging progress comes from the store, not the draft, so this screen can't undo
  // what Tax time or Lodge mode saved since it opened
  const next = withTaxTime(
    { ...draft, taxTime: data.settings.taxTime, annualIncome: parseFloat(income.replace(/[^\d.]/g, "")) || 0, occupation: draft.occupation.trim() },
    draft.financialYear,
    { taxWithheld: parsedWithheld }
  );
  const dirty = JSON.stringify(next) !== JSON.stringify(withTaxTime(data.settings, draft.financialYear, {}));

  const submit = async () => {
    setBusy(true);
    try {
      await saveSettings(next);
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleReminders = async (patch: Partial<ReminderPrefs>) => {
    setReminderMessage("");
    const turningOn = (patch.hours && !prefs.hours) || (patch.deadline && !prefs.deadline);
    if (turningOn && !(await allowNotifications())) {
      setReminderMessage("Notifications are off for Ledgr. Turn them on in the Settings app, then try again.");
      return;
    }
    const nextPrefs = { ...prefs, ...patch };
    setPrefs(nextPrefs);
    try {
      await savePrefs(nextPrefs, data);
    } catch {
      setReminderMessage("Couldn't set the reminders. Try again.");
    }
  };

  const handlePack = async (originals = false) => {
    setPacking(true);
    try {
      if (originals) {
        const missing = await shareOriginalReceipts(data.settings.financialYear);
        if (missing) Alert.alert("Missing receipts", `${missing} entries have no original receipt stored.`);
      } else await shareReceiptPack(data, summary);
    } catch (e) {
      Alert.alert("Couldn't make the receipt pack", e instanceof Error ? e.message : "Try again.");
    } finally {
      setPacking(false);
    }
  };

  const lodgedAt = taxTimeFor(data.settings, draft.financialYear).lodgedAt;
  const reminderTime = new Date(2000, 0, 1, prefs.hour, prefs.minute);

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your Ledgr account and every expense, receipt, asset and hour logged in it, here and on the web. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => void deleteAccount().catch((e) => Alert.alert("Couldn't delete your account", e instanceof Error ? e.message : "Try again.")),
        },
      ]
    );

  return (
    <Screen>
      <Heading title="Settings" subtitle="These shape every estimate" />

      <Card style={{ gap: 16 }}>
        <Choice label="Financial year" value={draft.financialYear} options={FINANCIAL_YEARS} onChange={handleYearChange} />
        <Field label="Salary before tax" value={income} onChangeText={setIncome} keyboardType="number-pad" prefix="$" placeholder="0" />
        <View style={{ gap: 4 }}>
          <Field
            label={`Tax withheld · FY ${draft.financialYear}`}
            value={withheld}
            onChangeText={(v) => {
              setWithheld(v);
              setMessage("");
            }}
            keyboardType="decimal-pad"
            prefix="$"
            placeholder="From your income statement"
          />
          <T size={13} color={colors.inkSoft}>
            In myGov under Employment income statements, or on your payslip at 30 June. Home then shows an estimated refund.
          </T>
        </View>
        {lodgedAt && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <T size={14} color={colors.inkSoft} style={{ flex: 1 }}>
              FY {draft.financialYear} marked lodged on {new Date(`${lodgedAt}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long" })}.
            </T>
            <Button title="Undo" kind="soft" onPress={() => void saveTaxTime({ lodgedAt: undefined }, draft.financialYear).catch(() => {})} style={{ minHeight: 38 }} />
          </View>
        )}
        <Field label="Occupation" value={draft.occupation} onChangeText={(v) => set("occupation", v)} autoCapitalize="words" />
        <Choice label="Tax residency" value={draft.taxResidentStatus} options={RESIDENCY} onChange={(v) => set("taxResidentStatus", v)} />
      </Card>

      <Card style={{ gap: 16 }}>
        <Choice label="Work-from-home method" value={draft.wfhMethod} options={WFH_METHODS} onChange={(v) => set("wfhMethod", v)} />
        <Choice label="Depreciation method" value={draft.depreciationMethod} options={DEPRECIATION} onChange={(v) => set("depreciationMethod", v)} />
        <Toggle label="HELP or HECS debt" detail="Deductions cut your compulsory repayment too" value={draft.hasHelpDebt} onChange={(v) => set("hasHelpDebt", v)} />
        <Toggle label="Private hospital cover" detail="Without it, higher incomes pay the Medicare levy surcharge" value={draft.hasPrivateHospitalCover} onChange={(v) => set("hasPrivateHospitalCover", v)} />
      </Card>

      {(dirty || !!message) && (
        <View style={{ gap: 8 }}>
          {dirty && <Button title="Save settings" kind="primary" busy={busy} onPress={() => void submit()} />}
          {!!message && (
            <T w="bold" color={message === "Saved." ? colors.positive : colors.negative} style={{ textAlign: "center" }} accessibilityLiveRegion="polite">
              {message}
            </T>
          )}
        </View>
      )}

      <Card style={{ gap: 14 }}>
        <T w="heavy" size={18} color={colors.plum} accessibilityRole="header">
          Reminders
        </T>
        <Toggle
          label="Log my hours"
          detail={`Weekdays, with Log ${USUAL_DAY_HOURS} h right on the notification`}
          value={prefs.hours}
          onChange={(v) => void handleReminders({ hours: v })}
        />
        {prefs.hours && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Label>Remind me at</Label>
            <DateTimePicker
              value={reminderTime}
              mode="time"
              display="compact"
              accentColor={colors.tangerine}
              onValueChange={(_, picked) => void handleReminders({ hour: picked.getHours(), minute: picked.getMinutes() })}
            />
          </View>
        )}
        <Toggle
          label="Lodging deadline"
          detail="Two weeks, one week and two days before 31 October, with what's left"
          value={prefs.deadline}
          onChange={(v) => void handleReminders({ deadline: v })}
        />
        {!!reminderMessage && (
          <T size={14} color={colors.negative} accessibilityRole="alert">
            {reminderMessage}
          </T>
        )}
      </Card>

      <Card style={{ gap: 4 }}>
        <T w="heavy" size={18} color={colors.plum} accessibilityRole="header">
          Records
        </T>
        <Row icon="doc.on.doc.fill" label={`Receipt pack for FY ${data.settings.financialYear} (PDF)`} busy={packing} onPress={() => void handlePack()} />
        <Row icon="square.and.arrow.up" label="Original receipts (ZIP)" busy={packing} onPress={() => void handlePack(true)} />
        <Row icon="envelope.fill" label="Email receipts from Airtail" onPress={() => router.push("/airtail")} />
      </Card>

      <Card style={{ gap: 4 }}>
        <T w="heavy" size={18} color={colors.plum} accessibilityRole="header">
          More on the web
        </T>
        {WEB_LINKS.map((l) => (
          <Pressable
            key={l.path}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`${API_URL}${l.path}`)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name={l.icon} size={18} />
            <T w="bold" style={{ flex: 1 }}>
              {l.label}
            </T>
            <Icon name="arrow.up.right" size={13} color={colors.inkSoft} />
          </Pressable>
        ))}
      </Card>

      <View style={{ gap: 4 }}>
        <Button title="Sign out" kind="soft" onPress={() => void signOut()} />
        <Button title="Delete account" kind="danger" onPress={confirmDelete} />
      </View>

      <T size={12} color={colors.inkSoft} style={{ textAlign: "center" }}>
        Ledgr gives estimates based on ATO rules, not tax advice. Check with a registered tax agent before you lodge.
        {"\n"}Version {Constants.expoConfig?.version}
      </T>
    </Screen>
  );
}
