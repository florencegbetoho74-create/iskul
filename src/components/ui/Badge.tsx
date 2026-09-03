import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

export type BadgeProps = {
  children: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Pastille pleine plutot que teintee, pour les etats qui doivent ressortir. */
  solid?: boolean;
  style?: ViewStyle;
};

/**
 * Pastille d'etat.
 *
 * Elle porte toujours un mot : la couleur seule ne dit rien a qui la distingue
 * mal, et rien du tout a un lecteur d'ecran.
 */
export default function Badge({ children, tone = "neutral", icon, solid, style }: BadgeProps) {
  const { color, radius, space } = useTheme();

  const skin: Record<BadgeTone, { soft: string; ink: string; strong: string }> = {
    neutral: { soft: color.surfaceSunk, ink: color.textMuted, strong: color.textMuted },
    primary: { soft: color.primarySoft, ink: color.primaryInk, strong: color.primary },
    success: { soft: color.successSoft, ink: color.success, strong: color.success },
    warning: { soft: color.warningSoft, ink: color.warning, strong: color.warning },
    danger: { soft: color.dangerSoft, ink: color.danger, strong: color.danger },
  };
  const t = skin[tone];
  const bg = solid ? t.strong : t.soft;
  const ink = solid ? color.textOnPrimary : t.ink;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: space.sm,
          paddingVertical: space.xs,
          gap: space.xs,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={12} color={ink} /> : null}
      <Text variant="overline" style={{ color: ink }}>
        {children.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
});
