import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useData } from "@/lib/store";
import { fetchReceipt, parseDataUrl, receiptKind, shareDataUrl } from "@/lib/receipts";
import { colors } from "@/lib/theme";
import { Button, Card, Heading, Screen, T } from "@/components/ui";

/** A stored receipt: photos inline with pinch-zoom; PDFs and emails through the share sheet. */
export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData();
  const { width } = useWindowDimensions();
  const expense = data.expenses.find((e) => e.id === id);
  const [receipt, setReceipt] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchReceipt(id)
      .then((r) => live && setReceipt(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load the receipt."));
    return () => {
      live = false;
    };
  }, [id]);

  const parsed = receipt ? parseDataUrl(receipt) : null;
  const title = expense?.description ?? "Receipt";

  const handleShare = async () => {
    if (!receipt) return;
    setBusy(true);
    setError("");
    try {
      await shareDataUrl(receipt, title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the receipt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading title={title} subtitle={parsed ? receiptKind(parsed.mime) : undefined} />
      {receipt === undefined && !error && <ActivityIndicator color={colors.plum} accessibilityLabel="Loading the receipt" />}
      {receipt === null && (
        <Card>
          <T>No receipt is stored with this expense.</T>
        </Card>
      )}
      {receipt && parsed?.mime.startsWith("image/") && (
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          style={{ borderRadius: 20, backgroundColor: colors.surface2 }}
          accessibilityHint="Pinch to zoom"
        >
          <Image source={{ uri: receipt }} accessibilityLabel={`Receipt for ${title}`} resizeMode="contain" style={{ width: width - 32, height: (width - 32) * 1.4 }} />
        </ScrollView>
      )}
      {parsed && !parsed.mime.startsWith("image/") && (
        <Card tint={colors.lav}>
          <T color={colors.plum}>
            {parsed.mime === "message/rfc822"
              ? "The original email, with its attachments. Open it in Mail or save it to Files."
              : "Open it to read, or save it to Files."}
          </T>
        </Card>
      )}
      {!!error && (
        <T color={colors.negative} accessibilityRole="alert">
          {error}
        </T>
      )}
      <View style={{ gap: 8 }}>
        {!!parsed && <Button title={parsed.mime.startsWith("image/") ? "Share or save" : "Open"} icon="square.and.arrow.up" kind="primary" busy={busy} onPress={() => void handleShare()} />}
        <Button title="Close" kind="soft" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
