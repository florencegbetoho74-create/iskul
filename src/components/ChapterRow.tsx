import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLOR, FONT } from "@/theme/colors";

type Props = { title: string; active?: boolean; hasVideo?: boolean; onPress?: () => void; index?: number };
export default function ChapterRow({ title, active, hasVideo, onPress, index }: Props) {
  return (
    <TouchableOpacity style={[styles.row, active && styles.active]} onPress={onPress} disabled={!hasVideo}>
      <Ionicons name={hasVideo ? "play-circle" : "pause-circle"} size={18} color={hasVideo ? (active ? COLOR.success : COLOR.sub) : COLOR.sub} />
      <Text style={[styles.title, !hasVideo && styles.dim]}>
        {index != null ? `${index}. ` : ""}{title}{!hasVideo ? " (sans video)" : ""}
      </Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  row: { backgroundColor: COLOR.surface, borderColor: COLOR.border, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  active: { borderColor: COLOR.primary, backgroundColor: "rgba(29,78,216,0.06)" },
  title: { color: COLOR.text, fontFamily: FONT.bodyBold, flex: 1 },
  dim: { color: COLOR.sub }
});

