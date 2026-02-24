import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { COLOR, ELEVATION, FONT, RADIUS, SPACE } from "@/theme/colors";

type Props = { label: string; onPress?: () => void; style?: ViewStyle; left?: React.ReactNode };
export default function QuickAction({ label, onPress, style, left }: Props) {
  return (
    <TouchableOpacity style={[styles.btn, style]} onPress={onPress} activeOpacity={0.85}>
      {left}
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    minHeight: 48,
    ...ELEVATION.card,
  },
  text: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 14 }
});
