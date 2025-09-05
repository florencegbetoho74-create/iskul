import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { COLOR } from "@/theme/colors";

type Props = { label: string; onPress?: () => void; style?: ViewStyle; left?: React.ReactNode };
export default function QuickAction({ label, onPress, style, left }: Props) {
  return (
    <TouchableOpacity style={[styles.btn, style]} onPress={onPress} activeOpacity={0.8}>
      {left}
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1A1B1E", borderColor: COLOR.border, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 },
  text: { color: COLOR.text, fontWeight: "700" }
});
