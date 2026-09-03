import React from "react";
import { StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";

export type SurfaceProps = ViewProps & {
  /**
   * 0 : pose a plat, delimite par un trait.
   * 1 : carte courante.
   * 2 : element flottant, feuille modale.
   */
  level?: 0 | 1 | 2;
  padded?: boolean;
  style?: ViewStyle;
};

/**
 * Surface de base.
 *
 * L'audit relevait que tout etait devenu une carte : bordure, fond, rayon et
 * ombre appliques partout, ce qui aplatit la hierarchie. Le niveau permet de
 * ne lever que ce qui doit l'etre.
 */
export default function Surface({
  level = 1,
  padded = true,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const theme = useTheme();
  const { color, radius, space } = theme;

  return (
    <View
      style={[
        {
          backgroundColor: level === 0 ? "transparent" : color.surface,
          borderRadius: radius.lg,
          borderWidth: level === 0 ? 0 : StyleSheet.hairlineWidth * 2,
          borderColor: color.border,
          padding: padded ? space.lg : 0,
        },
        level === 2 ? theme.elevation(2) : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

/** Bloc titre + sous-titre d'une surface, avec l'espacement du theme. */
export function SurfaceHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { space } = useTheme();
  return (
    <View style={[styles.header, { marginBottom: subtitle ? space.md : space.sm, gap: space.md }]}>
      <View style={styles.headerText}>
        <Text variant="heading">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start" },
  headerText: { flex: 1 },
});
