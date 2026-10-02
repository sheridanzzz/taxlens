import { ActivityIndicator, View } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { Button, T } from "@/components/ui";

export default function TabsLayout() {
  const { data, error, refresh, signOut } = useStore();

  // every tab reads the loaded data, so nothing renders until it's here
  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24, backgroundColor: colors.cream }}>
        {error ? (
          <>
            <T w="bold" size={17} style={{ textAlign: "center" }} accessibilityRole="alert">
              {error}
            </T>
            <Button title="Try again" onPress={() => void refresh()} />
            <Button title="Sign out" kind="danger" onPress={() => void signOut()} />
          </>
        ) : (
          <ActivityIndicator color={colors.plum} accessibilityLabel="Loading your deductions" />
        )}
      </View>
    );
  }

  return (
    <NativeTabs tintColor={colors.tangerineInk}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wfh">
        <NativeTabs.Trigger.Label>Home hours</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
