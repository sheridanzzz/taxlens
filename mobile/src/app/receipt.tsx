import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useData } from "@/lib/store";
import { fetchReceiptEvidence, parseDataUrl, receiptKind, shareDataUrl, type StoredEvidence } from "@/lib/receipts";
import { colors } from "@/lib/theme";
import { Button, Card, Heading, Screen, T } from "@/components/ui";

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StoredReceipt key={id} id={id} />;
}

function StoredReceipt({ id }: { id: string }) {
  const { data } = useData();
  const { width } = useWindowDimensions();
  const expense = data.expenses.find((e) => e.id === id);
  const [receipt, setReceipt] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState<StoredEvidence | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    fetchReceiptEvidence(id)
      .then((r) => { if (live) { setEvidence(r); setReceipt(r.dataUrl); } })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load the receipt."));
    return () => {
      live = false;
    };
  }, [id, attempt]);

  const parsed = receipt ? parseDataUrl(receipt) : null;
  const title = expense?.description ?? "Receipt";

  const handleShare = async (url = receipt, name = title) => {
    if (!url || busy) return;
    setBusy(true);
    setError("");
    try {
      await shareDataUrl(url, name);
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
      {evidence?.email?.messages.map((message, i) => (
        <Card key={i}>
          <T w="bold" size={16}>{message.subject}</T>
          <T size={12} color={colors.inkSoft}>{message.from}{message.date ? ` · ${message.date}` : ""}</T>
          <T selectable>{message.text || "No plain-text message content."}</T>
        </Card>
      ))}
      {!!evidence?.email?.attachments.length && <Card>
        <T w="bold" size={16}>Original attachments</T>
        {evidence.email.attachments.map((attachment, i) => <View key={i} style={{ gap: 8 }}>
          {attachment.mimeType.startsWith("image/") && <Image source={{ uri: attachment.dataUrl }} accessibilityLabel={attachment.name} resizeMode="contain" style={{ width: width - 64, height: 200 }} />}
          <Button title={attachment.name} icon="square.and.arrow.up" kind="soft" disabled={busy} onPress={() => void handleShare(attachment.dataUrl, attachment.name)} />
        </View>)}
      </Card>}
      {!!evidence?.previewError && <T color={colors.inkSoft}>{evidence.previewError}</T>}
      {!!error && (
        <T color={colors.negative} accessibilityRole="alert">
          {error}
        </T>
      )}
      <View style={{ gap: 8 }}>
        {!!error && <Button title="Retry receipt" kind="soft" disabled={busy} onPress={() => { setReceipt(undefined); setEvidence(null); setError(""); setAttempt(n => n + 1); }} />}
        {!!parsed && <Button title={parsed.mime.startsWith("image/") ? "Share or save" : "Open"} icon="square.and.arrow.up" kind="primary" busy={busy} onPress={() => void handleShare()} />}
        <Button title="Close" kind="soft" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
