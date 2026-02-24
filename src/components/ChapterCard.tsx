import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Chapter } from "@/types/course";
import { COLOR, FONT } from "@/theme/colors";

type Props = {
  item: Chapter;
  index?: number;
  active?: boolean;
  onPress?: () => void;
};

export default function ChapterCard({ item, index, active, onPress }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, active && styles.cardActive]}
    >
      <View style={styles.thumbWrap}>
        <View style={styles.thumbFallback}>
          <Ionicons name="videocam" size={20} color={COLOR.sub} />
        </View>

        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>
            {typeof index === "number" ? String(index).padStart(2, "0") : ""}
          </Text>
        </View>

        {item.videoUrl ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={14} color={COLOR.text} />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text style={styles.sub}>{item.videoUrl ? "Video liee" : "Aucune video"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    overflow: "hidden",
    minHeight: 180,
    shadowColor: "#0B1D39",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardActive: {
    borderColor: COLOR.primary,
  },
  thumbWrap: { height: 110, backgroundColor: COLOR.muted },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 12, gap: 6 },
  title: { color: COLOR.text, fontFamily: FONT.headingAlt },
  sub: { color: COLOR.sub, fontSize: 12, fontFamily: FONT.body },
  topBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: COLOR.border
  },
  topBadgeText: { color: COLOR.text, fontSize: 12, fontFamily: FONT.bodyBold },
  playBadge: {
    position: "absolute", right: 8, bottom: 8,
    backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 999, padding: 6,
    borderWidth: 1, borderColor: COLOR.border
  }
});
