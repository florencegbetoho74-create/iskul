import React from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";

export type FilterOption = { key: string; label: string; count?: number };

export type FilterChipsProps = {
  options: readonly FilterOption[];
  value: string;
  onChange: (key: string) => void;
  accessibilityLabel: string;
};

/**
 * Filtres horizontaux.
 *
 * Un rang de pastilles montre d'un coup d'oeil ce qui est disponible, la ou un
 * menu deroulant oblige a l'ouvrir pour le decouvrir.
 */
export default function FilterChips({
  options,
  value,
  onChange,
  accessibilityLabel,
}: FilterChipsProps) {
  const { color, space, radius, hit } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { gap: space.sm, paddingHorizontal: space.lg }]}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              {
                minHeight: hit.compact,
                paddingHorizontal: space.lg,
                borderRadius: radius.pill,
                borderColor: active ? color.primary : color.border,
                backgroundColor: active ? color.primarySoft : color.surface,
              },
            ]}
          >
            <Text variant="captionStrong" tone={active ? "primary" : "muted"}>
              {option.label}
              {typeof option.count === "number" ? `  ${option.count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  chip: { justifyContent: "center", borderWidth: 1 },
});
