import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

type Item = { key: string; label: string };
type Props = { value: string; items: Item[]; onChange: (k: string) => void };
export default function Segmented({ value, items, onChange }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      {items.map((it) => (
        <TouchableOpacity key={it.key} onPress={() => onChange(it.key)} style={[styles.item, value === it.key && styles.active]}>
          <Text style={[styles.txt, value === it.key && styles.txtActive]}>{it.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const makeStyles = (t: Theme) =>
  StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: t.color.surface,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 4,
    gap: 4,
    ...t.elevation(2),
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: t.radius.sm,
    alignItems: "center",
    minHeight: 40,
    justifyContent: "center",
  },
  active: { backgroundColor: t.color.primary },
  txt: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 13 },
  txtActive: { color: t.color.textOnPrimary },
});
