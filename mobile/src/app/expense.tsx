import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import DateTimePicker from "@react-native-community/datetimepicker";
import { randomUUID } from "expo-crypto";
import type { SFSymbol } from "expo-symbols";
import type { AssetType, Expense, ExpenseCategory, ReceiptScanResult } from "@shared/types";
import { mustDepreciate } from "@shared/expense-claims";
import {
  ASSET_EFFECTIVE_LIVES,
  EXPENSE_CATEGORIES,
  FINANCIAL_YEARS,
  FY_DATE_RANGES,
  INSTANT_DEDUCTION_THRESHOLD,
  getDefaultDateForFinancialYear,
  getFinancialYearForDate,
  toLocalDate,
} from "@shared/constants";
import { formatCurrency, isCoveredByFixedRate } from "@shared/tax-calculator";
import { api } from "@/lib/api";
import { clearImport, pendingImport } from "@/lib/airtail";
import { useData } from "@/lib/store";
import { colors } from "@/lib/theme";
import { Button, Card, Choice, Field, Heading, Icon, Label, Screen, T } from "@/components/ui";

// same size and quality the web scanner sends (components/expenses/receipt-scanner)
const MAX_IMAGE_DIMENSION = 1536;
const JPEG_QUALITY = 0.85;
const CONSENT_KEY = "ledgr_ai_consent";

// car trips are km × the ATO rate, not a receipt total — they stay on the web
const CATEGORY_OPTIONS = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[])
  .filter((c) => c !== "car_km")
  .map((value) => ({ value, label: EXPENSE_CATEGORIES[value].label }));
const ASSET_OPTIONS = (Object.keys(ASSET_EFFECTIVE_LIVES) as AssetType[]).map((value) => ({
  value,
  label: `${ASSET_EFFECTIVE_LIVES[value].label} · ${ASSET_EFFECTIVE_LIVES[value].years} yrs`,
}));
const FIRST_DAY = FY_DATE_RANGES[FINANCIAL_YEARS[0].value].start;

const ask = (title: string, message: string, confirm: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirm, onPress: () => resolve(true) },
    ])
  );

// App Store rule 5.1.2(i): say who sees the photo before the first one leaves the phone
const aiConsent = async () => {
  if (localStorage.getItem(CONSENT_KEY) === "yes") return true;
  const ok = await ask(
    "Receipts are read by AI",
    "Ledgr sends your receipt photo to Google's Gemini AI (with Groq as a backup) to read the store, date, amount and items. The photo is also saved with the expense so you have it at tax time.",
    "Continue"
  );
  if (ok) localStorage.setItem(CONSENT_KEY, "yes");
  return ok;
};

const PickOption = ({ icon, title, detail, onPress }: { icon: SFSymbol; title: string; detail: string; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18, opacity: pressed ? 0.7 : 1 })}
  >
    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.butter, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={22} />
    </View>
    <View style={{ flex: 1 }}>
      <T w="heavy" size={18} color={colors.plum}>
        {title}
      </T>
      <T size={14} color={colors.inkSoft}>
        {detail}
      </T>
    </View>
    <Icon name="chevron.right" size={14} color={colors.inkSoft} />
  </Pressable>
);

const Header = ({ title, onClose }: { title: string; onClose: () => void }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
    <View style={{ flex: 1 }}>
      <Heading title={title} />
    </View>
    <Pressable accessibilityRole="button" onPress={onClose} style={{ paddingTop: 20, paddingLeft: 12 }}>
      <T w="bold" color={colors.tangerineInk}>
        Cancel
      </T>
    </Pressable>
  </View>
);

export default function ExpenseScreen() {
  const { id, manual, airtail } = useLocalSearchParams<{ id?: string; manual?: string; airtail?: string }>();
  const { data, saveExpense, remove, expensesFor } = useData();
  const { settings } = data;
  const editing: Expense | undefined = id ? data.expenses.find((e) => e.id === id) : undefined;
  // an Airtail email the review screen handed over; work use starts at 0% like the web import
  const [imported] = useState(() => (airtail && !id ? pendingImport() : null));

  const [step, setStep] = useState<"pick" | "scanning" | "form">(id || manual || imported ? "form" : "pick");
  const [scan, setScan] = useState<ReceiptScanResult | null>(null);
  const [photo, setPhoto] = useState<{ uri: string; dataUrl: string } | null>(null);
  const [description, setDescription] = useState(editing?.description ?? imported?.description ?? "");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : imported ? String(imported.amount) : "");
  const [date, setDate] = useState(editing?.date ?? imported?.date ?? getDefaultDateForFinancialYear(settings.financialYear));
  const [category, setCategory] = useState<ExpenseCategory>(editing?.category ?? "other");
  const [workUse, setWorkUse] = useState(String(editing?.workUsePercent ?? (imported ? 0 : settings.defaultWorkUsePercent)));
  const [assetType, setAssetType] = useState<AssetType>("other");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => router.back();

  if (id && !editing) {
    return (
      <Screen>
        <Heading title="Not here" subtitle="This expense isn't in the financial year you're viewing." />
        <Button title="Close" onPress={close} />
      </Screen>
    );
  }

  /** Camera or library photo, shrunk to what the scanner and receipt store expect. Null if cancelled. */
  const capture = async (source: "camera" | "library") => {
    if (source === "camera" && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      setError("Camera access is off. Turn it on in the Settings app, or choose a photo instead.");
      return null;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
    const picked =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled) return null;
    const { uri, width, height } = picked.assets[0];
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const context = ImageManipulator.manipulate(uri);
    if (scale < 1) context.resize({ width: Math.round(width * scale), height: null });
    const image = await (await context.renderAsync()).saveAsync({ base64: true, compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    return { uri: image.uri, base64: image.base64 ?? "", dataUrl: `data:image/jpeg;base64,${image.base64}` };
  };

  /** Keeps a photo as the receipt without the AI read, for an expense whose details are already right. */
  const handleAttach = async (source: "camera" | "library") => {
    setError("");
    try {
      const image = await capture(source);
      if (image) setPhoto({ uri: image.uri, dataUrl: image.dataUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't attach that photo.");
    }
  };

  const pick = async (source: "camera" | "library") => {
    if (!(await aiConsent())) return;
    setError("");
    try {
      const image = await capture(source);
      if (!image) return;
      setPhoto({ uri: image.uri, dataUrl: image.dataUrl });
      setStep("scanning");

      const result = await api<ReceiptScanResult>("/api/ai/scan-receipt", {
        method: "POST",
        body: { base64: image.base64, mimeType: "image/jpeg", occupation: settings.occupation },
      });
      setScan(result);
      setDescription(result.itemName);
      setMerchant(result.storeName);
      setAmount(String(result.amount));
      setDate(result.date);
      setCategory(result.suggestedCategory === "car_km" ? "travel" : result.suggestedCategory);
      setWorkUse(String(result.suggestedWorkUsePercent));
      setAssetType(result.suggestedAssetType ?? "other");
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Couldn't read that receipt."} Fill it in below; the photo stays attached.`);
    }
    setStep("form");
  };

  const numAmount = parseFloat(amount);
  const numWorkUse = parseFloat(workUse);
  const fy = getFinancialYearForDate(date);
  // an edit keeps its claim type: a depreciating receipt already has its asset record
  const claimType = editing
    ? editing.claimType
    : mustDepreciate(numAmount, category, description)
      ? "depreciation"
      : "full";
  const claimable = (wu: number) =>
    claimType === "full" ? Math.round(numAmount * (wu / 100) * 100) / 100 : 0;
  const valid =
    !!description.trim() && numAmount > 0 && numWorkUse >= 0 && numWorkUse <= 100 && !!fy;
  const isCarTrip = editing?.category === "car_km";

  const persist = async (personal = false) => {
    if (!valid || !fy) return;
    setBusy(true);
    setError("");
    try {
      // same amount + date already on file → probably scanned twice. Checked
      // against the target FY, since old receipts often belong to last year.
      if (!editing) {
        const dup = (await expensesFor(fy)).find((x) => x.amount === numAmount && x.date === date);
        if (dup && !(await ask("Possible duplicate", `“${dup.description}” is already saved for this date and amount.`, "Save anyway"))) {
          return;
        }
      }
      const wu = personal ? 0 : numWorkUse;
      const type = personal ? "full" : claimType;
      const name = description.trim();
      // A depreciating item deducts nothing as an expense row: it goes on the
      // asset register, and the expense row keeps the receipt as evidence.
      const assetId = type === "depreciation" && !editing ? randomUUID() : editing?.assetId;
      const linkedAsset = type === "depreciation" && !editing ? {
          id: assetId!,
          name,
          assetType,
          purchaseDate: date,
          purchasePrice: numAmount,
          effectiveLifeYears: scan?.suggestedEffectiveLife ?? ASSET_EFFECTIVE_LIVES[assetType].years,
          depreciationMethod: scan?.suggestedDepreciationMethod ?? settings.depreciationMethod,
          workUsePercent: wu,
          financialYear: fy,
          createdAt: new Date().toISOString(),
        } : undefined;
      await saveExpense({
        // an import keeps its stable id, so the same email can't be saved twice
        id: editing?.id ?? imported?.id ?? randomUUID(),
        date,
        description: name,
        amount: numAmount,
        category: personal ? "other" : category,
        claimType: type,
        workUsePercent: wu,
        reviewStatus: wu === 0 ? "personal" : "reviewed",
        claimableAmount: type === "full" ? Math.round(numAmount * (wu / 100) * 100) / 100 : 0,
        assetId,
        receiptDataUrl: photo?.dataUrl ?? imported?.receiptDataUrl,
        // list rows carry this flag instead of the image; the server keeps the stored one
        hasReceipt: editing?.hasReceipt,
        notes: editing
          ? editing.notes
          : imported
            ? imported.notes
            : scan
              ? `AI scan: ${merchant.trim() || scan.storeName}. ${scan.relevanceExplanation}`
              : undefined,
        financialYear: fy,
        createdAt: editing?.createdAt ?? new Date().toISOString(),
      }, linkedAsset);
      if (imported) clearImport();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const destroy = async () => {
    if (!editing) return;
    const ok = await ask(
      "Delete this expense?",
      editing.claimType === "depreciation"
        ? "This removes the expense, its receipt and its linked asset."
        : "This removes the expense and its receipt.",
      "Delete"
    );
    if (!ok) return;
    setBusy(true);
    try {
      await remove("expenses", editing.id);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete. Try again.");
      setBusy(false);
    }
  };

  if (step === "pick") {
    return (
      <Screen>
        <Header title="Add a receipt" onClose={close} />
        <PickOption icon="camera.fill" title="Take a photo" detail="AI reads the store, date and total" onPress={() => void pick("camera")} />
        <PickOption icon="photo.on.rectangle" title="Choose a photo" detail="A receipt or invoice screenshot" onPress={() => void pick("library")} />
        <PickOption icon="keyboard" title="Type it in" detail="No receipt handy? Enter the details" onPress={() => setStep("form")} />
        {!!error && (
          <T color={colors.negative} accessibilityRole="alert">
            {error}
          </T>
        )}
      </Screen>
    );
  }

  if (step === "scanning") {
    return (
      <Screen>
        <Header title="Reading it…" onClose={close} />
        {photo && <Image source={{ uri: photo.uri }} accessibilityLabel="Your receipt" style={{ width: "100%", height: 320, borderRadius: 24, backgroundColor: colors.surface2 }} resizeMode="contain" />}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" }}>
          <ActivityIndicator color={colors.plum} />
          <T w="bold" color={colors.plum}>
            Pulling out the store, date and total
          </T>
        </View>
      </Screen>
    );
  }

  const covered = isCoveredByFixedRate({ category, description }, settings.wfhMethod);
  const lastDay = FY_DATE_RANGES[FINANCIAL_YEARS[FINANCIAL_YEARS.length - 1].value].end;
  const today = toLocalDate();

  return (
    <Screen>
      <Header title={editing ? "Edit expense" : scan || imported ? "Check the details" : "New expense"} onClose={close} />

      {photo && <Image source={{ uri: photo.uri }} accessibilityLabel="Your receipt" style={{ width: "100%", height: 180, borderRadius: 20, backgroundColor: colors.surface2 }} resizeMode="contain" />}
      {editing?.hasReceipt && !photo && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <T w="bold" size={14} color={colors.positive}>
            Receipt attached
          </T>
          <Button title="View receipt" icon="doc.text.magnifyingglass" kind="soft" onPress={() => router.push({ pathname: "/receipt", params: { id: editing.id } })} style={{ minHeight: 40 }} />
        </View>
      )}
      {imported && (
        <Card tint={colors.sky}>
          <T w="heavy" color={colors.plum}>
            Email receipt from {imported.merchant}
          </T>
          <T size={15} color={colors.plum}>
            The original email is saved with this expense. Work use starts at 0%, so set it before you save if part of this was for work.
          </T>
        </Card>
      )}
      {!photo && !imported && !editing?.hasReceipt && !isCarTrip && (
        <View style={{ gap: 6 }}>
          <Label>{editing ? "No receipt yet" : "Receipt"}</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Take photo" icon="camera.fill" kind="soft" onPress={() => void handleAttach("camera")} style={{ flex: 1 }} />
            <Button title="Choose" icon="photo.on.rectangle" kind="soft" onPress={() => void handleAttach("library")} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {scan && !scan.isRelevantToOccupation && (
        <Card tint={colors.pink}>
          <T w="heavy" color={colors.plum}>
            Probably not claimable for a {settings.occupation}
          </T>
          <T size={15} color={colors.plum}>
            {scan.relevanceExplanation}
          </T>
          <Button title="Save as personal" kind="soft" busy={busy} disabled={!valid} onPress={() => void persist(true)} />
        </Card>
      )}
      {scan?.isRelevantToOccupation && !!scan.relevanceExplanation && (
        <Card tint={colors.mint}>
          <T size={15} color={colors.plum}>
            {scan.relevanceExplanation}
          </T>
          {scan.modelUsed && (
            <T size={12} color={colors.inkSoft}>
              Read by {scan.modelUsed}. Check it before you save.
            </T>
          )}
        </Card>
      )}

      {isCarTrip ? (
        <Card>
          <T>Car trips are worked out from kilometres. Edit this one on the web.</T>
        </Card>
      ) : (
        <Card style={{ gap: 16 }}>
          <Field label="What was it?" value={description} onChangeText={setDescription} placeholder="Mechanical keyboard" />
          {scan && <Field label="Store" value={merchant} onChangeText={setMerchant} />}
          <Field label="Amount paid (incl. GST)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" prefix="$" placeholder="0.00" />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Label>Date</Label>
            <DateTimePicker
              value={new Date(`${date}T12:00:00`)}
              mode="date"
              display="compact"
              accentColor={colors.tangerine}
              minimumDate={new Date(`${FIRST_DAY}T00:00:00`)}
              maximumDate={new Date(`${today < lastDay ? today : lastDay}T23:59:59`)}
              onValueChange={(_, picked) => setDate(toLocalDate(picked))}
            />
          </View>
          <Choice label="Category" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
          <Field label="Used for work" value={workUse} onChangeText={setWorkUse} keyboardType="number-pad" suffix="%" />
        </Card>
      )}

      {!isCarTrip && (
        <Card tint={colors.lav}>
          {!fy ? (
            <T color={colors.negative}>
              Pick a date from {new Date(`${FIRST_DAY}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}. That&apos;s as far back as Ledgr goes.
            </T>
          ) : covered ? (
            <T color={colors.plum}>
              Covered by the 70c rate. Energy, internet, phone and stationery/computer consumables are included in your hourly work-from-home rate.
            </T>
          ) : claimType === "depreciation" ? (
            editing ? (
              <T color={colors.plum}>Claimed through Assets. Saving its work use here updates the linked asset too.</T>
            ) : (
              <>
                <T color={colors.plum}>
                  Over ${INSTANT_DEDUCTION_THRESHOLD}, so it&apos;s depreciated: Ledgr adds it to your assets and claims it over its effective life.
                </T>
                <Choice label="Asset type" value={assetType} options={ASSET_OPTIONS} onChange={setAssetType} />
              </>
            )
          ) : (
            <View>
              <T w="bold" size={13} color={colors.inkSoft}>
                You&apos;ll claim · FY {fy}
              </T>
              <T w="black" size={32} color={colors.plum} style={{ fontVariant: ["tabular-nums"] }}>
                {formatCurrency(claimable(numWorkUse) || 0)}
              </T>
            </View>
          )}
        </Card>
      )}

      {!!error && (
        <T color={colors.negative} accessibilityRole="alert">
          {error}
        </T>
      )}
      {!isCarTrip && <Button title={editing ? "Save changes" : "Save expense"} kind="primary" busy={busy} disabled={!valid} onPress={() => void persist()} />}
      {editing && <Button title="Delete expense" kind="danger" icon="trash" disabled={busy} onPress={() => void destroy()} />}
    </Screen>
  );
}
