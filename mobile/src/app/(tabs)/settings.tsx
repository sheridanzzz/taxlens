import { useState } from "react";
import { Alert, Linking, Pressable, Switch, View } from "react-native";
import Constants from "expo-constants";
import type { SFSymbol } from "expo-symbols";
import type { UserSettings } from "@shared/types";
import { FINANCIAL_YEARS } from "@shared/constants";
import { useData } from "@/lib/store";
import { API_URL } from "@/lib/api";
import { colors } from "@/lib/theme";
import { Button, Card, Choice, Field, Heading, Icon, Screen, T } from "@/components/ui";

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
  { path: "/settings?airtail=setup", label: "Email receipts from Airtail", icon: "envelope.fill" },
];

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
  const { data, saveSettings, signOut, deleteAccount } = useData();
  const [draft, setDraft] = useState(data.settings);
  const [income, setIncome] = useState(data.settings.annualIncome ? String(data.settings.annualIncome) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage("");
  };
  const next = { ...draft, annualIncome: parseFloat(income.replace(/[^\d.]/g, "")) || 0, occupation: draft.occupation.trim() };
  const dirty = JSON.stringify(next) !== JSON.stringify(data.settings);

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
        <Choice label="Financial year" value={draft.financialYear} options={FINANCIAL_YEARS} onChange={(v) => set("financialYear", v)} />
        <Field label="Salary before tax" value={income} onChangeText={setIncome} keyboardType="number-pad" prefix="$" placeholder="0" />
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
