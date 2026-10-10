import type { ReactNode } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { colors, font } from "@/lib/theme";

export const T = ({
  w = "regular",
  size = 16,
  color = colors.ink,
  style,
  ...props
}: TextProps & { w?: keyof typeof font; size?: number; color?: string }) => (
  <Text style={[{ fontFamily: font[w], fontSize: size, color }, style]} {...props} />
);

export const Icon = ({ name, size = 20, color = colors.plum }: { name: SFSymbol; size?: number; color?: string }) => (
  <SymbolView name={name} size={size} tintColor={color} />
);

const KINDS = {
  primary: { bg: colors.tangerine, fg: colors.ink, border: undefined },
  plum: { bg: colors.plum, fg: "#ffffff", border: undefined },
  soft: { bg: colors.surface, fg: colors.plum, border: "rgba(42,21,56,0.2)" },
  pink: { bg: colors.pink, fg: colors.plum, border: undefined },
  mint: { bg: colors.mint, fg: colors.plum, border: undefined },
  danger: { bg: "transparent", fg: colors.negative, border: undefined },
};

export const Button = ({
  title,
  onPress,
  kind = "plum",
  icon,
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: keyof typeof KINDS;
  icon?: SFSymbol;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const { bg, fg, border } = KINDS[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 50,
          borderRadius: 999,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: bg,
          borderWidth: border ? 1 : 0,
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={17} color={fg} /> : null}
      <T w="bold" color={fg}>
        {title}
      </T>
    </Pressable>
  );
};

export const Card = ({
  tint = colors.surface,
  style,
  children,
}: {
  tint?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) => (
  <View
    style={[
      { backgroundColor: tint, borderRadius: 26, padding: 20, gap: 12 },
      tint === colors.surface && { borderWidth: 1, borderColor: colors.border },
      style,
    ]}
  >
    {children}
  </View>
);

/** The web's tinted cards (WeekCard, GettingStarted): white icon tile, plum text, arrow. */
export const Tile = ({
  tint,
  icon,
  title,
  detail,
  onPress,
  web,
}: {
  tint: string;
  icon: SFSymbol;
  title: string;
  detail: string;
  onPress: () => void;
  web?: boolean;
}) => (
  <Pressable
    accessibilityRole={web ? "link" : "button"}
    accessibilityHint={web ? "Opens in Safari" : undefined}
    onPress={onPress}
    style={({ pressed }) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderRadius: 24,
      backgroundColor: tint,
      padding: 18,
      opacity: pressed ? 0.8 : 1,
    })}
  >
    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={22} />
    </View>
    <View style={{ flex: 1 }}>
      <T w="heavy" size={18} color={colors.plum}>
        {title}
      </T>
      <T w="medium" size={14} color={colors.plum} style={{ opacity: 0.8 }}>
        {detail}
      </T>
    </View>
    <Icon name={web ? "arrow.up.right" : "chevron.right"} size={15} color={colors.plum} />
  </Pressable>
);

/** A row of selectable pills (filters, two-way switches). Scrolls sideways when it overflows. */
export const Pills = <V extends string>({
  options,
  value,
  onChange,
  dark,
  label,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  /** on the plum card */
  dark?: boolean;
  label: string;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={label} contentContainerStyle={{ gap: 8 }}>
    {options.map((o) => {
      const selected = o.value === value;
      return (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          onPress={() => onChange(o.value)}
          style={({ pressed }) => ({
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: selected ? (dark ? colors.butter : colors.plum) : dark ? colors.plum2 : colors.surface,
            borderWidth: dark ? 0 : 1,
            borderColor: colors.border,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <T w="bold" size={14} color={selected ? (dark ? colors.plum : "#ffffff") : dark ? colors.lav : colors.plum}>
            {o.label}
          </T>
        </Pressable>
      );
    })}
  </ScrollView>
);

const box: ViewStyle = {
  minHeight: 50,
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#e2d3c3",
  backgroundColor: colors.surface,
  paddingHorizontal: 14,
};

export const Label = ({ children }: { children: ReactNode }) => (
  <T w="bold" size={13} color={colors.inkSoft}>
    {children}
  </T>
);

export const Field = ({
  label,
  prefix,
  suffix,
  ...props
}: TextInputProps & { label: string; prefix?: string; suffix?: string }) => (
  <View style={{ gap: 6 }}>
    <Label>{label}</Label>
    <View style={box}>
      {prefix && <T color={colors.inkSoft}>{prefix}</T>}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkSoft}
        style={{ flex: 1, fontFamily: font.medium, fontSize: 17, color: colors.ink, paddingVertical: 12 }}
        {...props}
      />
      {suffix && <T color={colors.inkSoft}>{suffix}</T>}
    </View>
  </View>
);

/** One of a few fixed options, picked from the native iOS action sheet. */
export const Choice = <V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
}) => {
  const current = options.find((o) => o.value === value)?.label ?? value;
  const open = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: label, options: [...options.map((o) => o.label), "Cancel"], cancelButtonIndex: options.length },
      (i) => {
        if (i < options.length) onChange(options[i].value);
      }
    );
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        accessibilityHint="Opens a list to choose from"
        style={({ pressed }) => [box, { opacity: pressed ? 0.7 : 1 }]}
      >
        <T w="medium" size={17} numberOfLines={1} style={{ flex: 1 }}>
          {current}
        </T>
        <Icon name="chevron.up.chevron.down" size={14} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
};

export const Screen = ({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) => (
  <ScrollView
    contentInsetAdjustmentBehavior="automatic"
    keyboardShouldPersistTaps="handled"
    automaticallyAdjustKeyboardInsets
    style={{ backgroundColor: colors.cream }}
    contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}
    refreshControl={
      onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.plum} /> : undefined
    }
  >
    {children}
  </ScrollView>
);

export const Heading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={{ paddingTop: 8 }}>
    <T w="black" size={38} color={colors.plum} accessibilityRole="header" style={{ letterSpacing: -1.2 }}>
      {title}
    </T>
    {subtitle && (
      <T w="bold" size={15} color={colors.inkSoft} style={{ marginTop: 2 }}>
        {subtitle}
      </T>
    )}
  </View>
);
