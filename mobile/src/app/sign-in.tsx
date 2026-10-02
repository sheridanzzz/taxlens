import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { Button, Card, Field, T } from "@/components/ui";

// Logo 09 "Sticker": the wordmark on a tilted butter pill with a hard tangerine shadow.
const Sticker = () => (
  <View style={{ alignSelf: "flex-start", transform: [{ rotate: "-4deg" }] }} accessibilityRole="header" accessibilityLabel="Ledgr">
    <View style={{ position: "absolute", top: 5, left: 5, right: -5, bottom: -5, borderRadius: 999, backgroundColor: colors.tangerine }} />
    <View style={{ borderRadius: 999, backgroundColor: colors.butter, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 8 }}>
      <T w="black" size={54} color={colors.plum} style={{ letterSpacing: -2.6 }}>
        ledgr
      </T>
    </View>
  </View>
);

export default function SignIn() {
  const { signIn } = useStore();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password, signup);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.plum }}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, gap: 28 }}
      >
        <View style={{ gap: 18 }}>
          <Sticker />
          <T w="black" size={34} color="#ffffff" style={{ letterSpacing: -1 }}>
            Your refund, filling up all year.
          </T>
          <T size={17} color={colors.lav}>
            Snap work receipts as you go and log your home hours. Ledgr sorts them by the ATO&apos;s rules.
          </T>
        </View>

        <Card style={{ gap: 14 }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={signup ? "new-password" : "current-password"}
            textContentType={signup ? "newPassword" : "password"}
            placeholder={signup ? "At least 8 characters" : undefined}
            onSubmitEditing={submit}
          />
          {!!error && (
            <T accessibilityRole="alert" color={colors.negative}>
              {error}
            </T>
          )}
          <Button
            title={signup ? "Create account" : "Sign in"}
            kind="primary"
            onPress={submit}
            busy={busy}
            disabled={!email.trim() || !password}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSignup((s) => !s);
              setError("");
            }}
            style={{ alignSelf: "center", padding: 8 }}
          >
            <T w="bold" color={colors.tangerineInk}>
              {signup ? "Already have an account? Sign in" : "New to Ledgr? Create an account"}
            </T>
          </Pressable>
        </Card>

        <T size={13} color={colors.lav} style={{ textAlign: "center" }}>
          Estimates based on ATO rules, not tax advice.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
