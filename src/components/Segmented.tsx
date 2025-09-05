import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";

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
  wrap: { flexDirection: "row", backgroundColor: "#111214", borderRadius: 12, borderWidth: 1, borderColor: "#1F2023", overflow: "hidden" },
  item: { flex: 1, paddingVertical: 10, alignItems: "center" },
  active: { backgroundColor: COLOR.primary },
  txt: { color: COLOR.sub, fontWeight: "800" },
  txtActive: { color: "#fff" }
});
