import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

type Props = { title?: string; right?: React.ReactNode };
export default function TopBar({ title, right }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={20} color={theme.color.text} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title ?? ""}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.space.lg,
    paddingBottom: t.space.sm,
    gap: t.space.sm,
    backgroundColor: "rgba(244,247,252,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
    ...t.elevation(2),
  },
  iconBtn: {
    padding: 9,
    borderRadius: t.radius.md,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 17, flex: 1 },
  right: { minWidth: 36, alignItems: "flex-end" }
});

