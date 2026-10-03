import { ActivityIndicator, View } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { toLocalDate } from "@shared/constants";
import { lodgingYear, taxTimeFor } from "@shared/tax-time";
import { useStore } from "@/lib/store";
import { useReminders } from "@/lib/reminders";
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

  // 1 July to 31 October, until that year is marked lodged
  const lodging = lodgingYear(toLocalDate());
  const showTaxTime = !!lodging && !taxTimeFor(data.settings, lodging).lodgedAt;

  return (
    <>
      <ReminderSync />
      <NativeTabs tintColor={colors.tangerineInk}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="house.fill" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="expenses">
          <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet.rectangle.fill" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="wfh">
          <NativeTabs.Trigger.Label>Hours</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="clock.fill" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="tax-time" hidden={!showTaxTime}>
          <NativeTabs.Trigger.Label>Tax time</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="checklist" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}

// a component so the hook only runs once data has loaded
const ReminderSync = () => {
  useReminders();
  return null;
};
