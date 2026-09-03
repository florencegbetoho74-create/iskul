import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

export type ButtonProps = {
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Occupe toute la largeur disponible. */
  block?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export default function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  block = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { color, radius, hit, space } = useTheme();
  const inactive = disabled || loading;

  const skin: Record<ButtonVariant, { bg: string; border: string; ink: string }> = {
    primary: { bg: color.primary, border: "transparent", ink: color.textOnPrimary },
    secondary: { bg: color.primarySoft, border: color.primarySoft, ink: color.primaryInk },
    ghost: { bg: "transparent", border: color.borderInteractive, ink: color.text },
    danger: { bg: color.danger, border: "transparent", ink: color.textOnPrimary },
  };
  const tone = skin[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? children}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          borderRadius: radius.md,
          minHeight: size === "sm" ? hit.compact : hit.min,
          paddingHorizontal: size === "sm" ? space.md : space.lg,
          gap: space.sm,
        },
        block && styles.block,
        // Le retour tactile passe par l'opacite : un changement de couleur
        // demanderait une variante pressee par teinte.
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.ink} />
      ) : icon ? (
        <Ionicons name={icon} size={size === "sm" ? 15 : 17} color={tone.ink} />
      ) : null}
      <Text variant={size === "sm" ? "captionStrong" : "bodyStrong"} style={{ color: tone.ink }}>
        {children}
      </Text>
    </Pressable>
  );
}

/** Groupe de boutons alignes, avec l'espacement du theme. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const { space } = useTheme();
  return <View style={[styles.row, { gap: space.sm }]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  block: { alignSelf: "stretch" },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.45 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
});
