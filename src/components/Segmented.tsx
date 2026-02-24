import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLOR, ELEVATION, FONT, RADIUS } from "@/theme/colors";

type Item = { key: string; label: string };
type Props = { value: string; items: Item[]; onChange: (k: string) => void };
export default function Segmented({ value, items, onChange }: Props) {
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
const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 4,
    gap: 4,
    ...ELEVATION.card,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    minHeight: 40,
    justifyContent: "center",
  },
  active: { backgroundColor: COLOR.primary },
  txt: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 13 },
  txtActive: { color: "#fff" }
});
