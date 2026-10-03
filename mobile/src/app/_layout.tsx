import "expo-sqlite/localStorage/install";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Gabarito_400Regular,
  Gabarito_500Medium,
  Gabarito_700Bold,
  Gabarito_800ExtraBold,
  Gabarito_900Black,
} from "@expo-google-fonts/gabarito";
import { StoreProvider, useStore } from "@/lib/store";
import { colors } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

const Navigator = ({ fontsLoaded }: { fontsLoaded: boolean }) => {
  const { signedIn } = useStore();
  const ready = fontsLoaded && signedIn !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="expense" options={{ presentation: "modal" }} />
        <Stack.Screen name="receipt" options={{ presentation: "modal" }} />
        <Stack.Screen name="airtail" options={{ presentation: "modal" }} />
        <Stack.Screen name="gaps" options={{ presentation: "modal" }} />
        <Stack.Screen name="lodge" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Gabarito_400Regular,
    Gabarito_500Medium,
    Gabarito_700Bold,
    Gabarito_800ExtraBold,
    Gabarito_900Black,
  });
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Navigator fontsLoaded={fontsLoaded} />
    </StoreProvider>
  );
}
