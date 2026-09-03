import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Chapter } from "@/types/course";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

type Props = {
  item: Chapter;
  index?: number;
  active?: boolean;
  onPress?: () => void;
};

export default function ChapterCard({ item, index, active, onPress }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, active && styles.cardActive]}
    >
      <View style={styles.thumbWrap}>
        <View style={styles.thumbFallback}>
          <Ionicons name="videocam" size={20} color={theme.color.textMuted} />
        </View>

        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>
            {typeof index === "number" ? String(index).padStart(2, "0") : ""}
          </Text>
        </View>

        {item.videoUrl ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={14} color={theme.color.onMedia} />
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

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: t.color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: "hidden",
    minHeight: 180,
    shadowColor: t.color.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardActive: {
    borderColor: t.color.primary,
  },
  thumbWrap: { height: 110, backgroundColor: t.color.surfaceSunk },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 12, gap: 6 },
  title: { color: t.color.text, fontFamily: t.type.heading.fontFamily },
  sub: { color: t.color.textMuted, fontSize: 12, fontFamily: t.type.body.fontFamily },
  topBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: t.color.media, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: t.color.mediaControl
  },
  topBadgeText: { color: t.color.onMedia, fontSize: 12, fontFamily: t.type.bodyStrong.fontFamily },
  playBadge: {
    position: "absolute", right: 8, bottom: 8,
    backgroundColor: t.color.media, borderRadius: 999, padding: 6,
    borderWidth: 1, borderColor: t.color.mediaControl
  }
});
