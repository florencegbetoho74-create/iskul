import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

type Props = { title: string; active?: boolean; hasVideo?: boolean; onPress?: () => void; index?: number };
export default function ChapterRow({ title, active, hasVideo, onPress, index }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={[styles.row, active && styles.active]} onPress={onPress} disabled={!hasVideo}>
      <Ionicons name={hasVideo ? "play-circle" : "pause-circle"} size={18} color={hasVideo ? (active ? theme.color.success : theme.color.textMuted) : theme.color.textMuted} />
      <Text style={[styles.title, !hasVideo && styles.dim]}>
        {index != null ? `${index}. ` : ""}{title}{!hasVideo ? " (sans video)" : ""}
      </Text>
    </TouchableOpacity>
  );
}
const makeStyles = (t: Theme) =>
  StyleSheet.create({
  row: { backgroundColor: t.color.surface, borderColor: t.color.border, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  active: { borderColor: t.color.primary, backgroundColor: t.color.primarySoft },
  title: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, flex: 1 },
  dim: { color: t.color.textMuted }
});

