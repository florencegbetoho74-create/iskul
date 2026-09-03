import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

type Props = { label: string; onPress?: () => void; style?: ViewStyle; left?: React.ReactNode };
export default function QuickAction({ label, onPress, style, left }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={[styles.btn, style]} onPress={onPress} activeOpacity={0.85}>
      {left}
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}
const makeStyles = (t: Theme) =>
  StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space.sm,
    backgroundColor: t.color.surface,
    borderColor: t.color.border,
    borderWidth: 1,
    paddingVertical: t.space.md,
    paddingHorizontal: t.space.lg,
    borderRadius: t.radius.md,
    minHeight: 48,
    ...t.elevation(2),
  },
  text: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 14 }
});
