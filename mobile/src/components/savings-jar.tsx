import { useCallback, useState } from "react";
import { Animated, AppState, Easing, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { colors } from "@/lib/theme";
import { useReducedMotion } from "@/lib/reduced-motion";

const S = 0.72;
const COIN = "#f2b63c";

export const SavingsJar = ({ fill }: { fill: number }) => {
  const reducedMotion = useReducedMotion();
  const [values] = useState(() => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
  const [wave, backWave, coins, bubbles] = values;
  const level = Math.round(56 * Math.min(1, Math.max(0.15, fill)));

  useFocusEffect(useCallback(() => {
    values.forEach(value => value.setValue(0));
    if (reducedMotion) return;
    const animations = values.map((value, i) => Animated.loop(Animated.timing(value, {
      toValue: 1, duration: [3600, 5400, 3800, 4000][i], easing: Easing.linear,
      useNativeDriver: true, isInteraction: false,
    })));
    const start = () => animations.forEach(animation => animation.start());
    const stop = () => animations.forEach(animation => animation.stop());
    if (AppState.currentState === "active") start();
    const subscription = AppState.addEventListener("change", state => state === "active" ? start() : stop());
    return () => { subscription.remove(); stop(); };
  }, [reducedMotion, values]));

  const surface = (value: Animated.Value, back = false) => (
    <Animated.View style={{ position: "absolute", top: (back ? -6 : -4) * S, left: 0, width: 240 * S, height: 8 * S,
      opacity: back ? 0.4 : 1, transform: [{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: back ? [-80 * S, 0] : [0, -80 * S] }) }] }}>
      {Array.from({ length: 6 }, (_, i) => <View key={i} style={{ position: "absolute", left: i * 40 * S, width: 40 * S, height: 8 * S, borderRadius: 20 * S, backgroundColor: colors.butter }} />)}
    </Animated.View>
  );
  const coin = (left: number, top: number, last = false) => (
    <Animated.View style={{ position: "absolute", left: left * S, top: top * S,
      transform: [{ translateY: coins.interpolate({ inputRange: [0, 0.5, 1], outputRange: last ? [-2 * S, 0, -2 * S] : [0, -3 * S, 0] }) }] }}>
      <Animated.View style={{ width: 12 * S, height: 12 * S, borderRadius: 6 * S, backgroundColor: COIN,
        transform: [{ scaleX: coins.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.65, 1] }) }] }}>
        <View style={{ position: "absolute", left: 3 * S, top: 2 * S, width: 4 * S, height: 2 * S, borderRadius: S, backgroundColor: "#ffe69b", transform: [{ rotate: "-25deg" }] }} />
      </Animated.View>
    </Animated.View>
  );

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 100 * S, height: 120 * S }}>
      <View style={{ position: "absolute", left: 26 * S, top: 4 * S, width: 48 * S, height: 12 * S, borderRadius: 4 * S, backgroundColor: colors.tangerine }} />
      <View style={{ position: "absolute", left: 10 * S, top: 22 * S, width: 80 * S, height: 94 * S,
        borderWidth: 3 * S, borderColor: "#fff", borderTopLeftRadius: 8 * S, borderTopRightRadius: 8 * S,
        borderBottomLeftRadius: 12 * S, borderBottomRightRadius: 12 * S, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: level * S, backgroundColor: colors.butter }}>
          {surface(backWave, true)}
          {surface(wave)}
        </View>
        {!reducedMotion && [19, 45, 71].map((left, i) => {
          const phase = Animated.modulo(Animated.add(bubbles, i / 3), 1);
          return <Animated.View key={left} style={{ position: "absolute", left: left * S, bottom: 3 * S, width: 4 * S, height: 4 * S,
            borderRadius: 2 * S, borderWidth: S, borderColor: "#fff4c7",
            opacity: phase.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.65, 0, 0] }),
            transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.max(8, level - 6) * S] }) }] }} />;
        })}
        {coin(15, 69)}
        {coin(41, 63, true)}
      </View>
    </View>
  );
};
