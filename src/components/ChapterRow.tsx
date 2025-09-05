import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLOR } from "@/theme/colors";

type Props = { title: string; active?: boolean; hasVideo?: boolean; onPress?: () => void; index?: number };
export default function ChapterRow({ title, active, hasVideo, onPress, index }: Props) {
  return (
    <TouchableOpacity style={[styles.row, active && styles.active]} onPress={onPress} disabled={!hasVideo}>
      <Ionicons name={hasVideo ? "play-circle" : "pause-circle"} size={18} color={hasVideo ? (active ? "#10b981" : "#cbd5e1") : "#64748b"} />
      <Text style={[styles.title, !hasVideo && styles.dim]}>
        {index != null ? `${index}. ` : ""}{title}{!hasVideo ? " (sans vidéo)" : ""}
      </Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  row: { backgroundColor: "#111214", borderColor: "#1F2023", borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  active: { borderColor: COLOR.primary },
  title: { color: "#fff", fontWeight: "700", flex: 1 },
  dim: { color: "#cbd5e1" }
});
