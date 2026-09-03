import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { fmtTime } from "@/utils/time";

export default function ResumeCard({
  item,
}: {
  item: {
    courseId: string;
    lessonId: string;
    courseTitle: string;
    lessonTitle: string;
    thumb?: string | null;
    percent: number;
    startSec?: number;
  };
}) {
  const { styles, theme } = useThemedStyles(makeStyles);
  const pct = Math.max(0, Math.min(1, item.percent || 0));
  const safeStart = Math.max(0, Math.floor(item.startSec || 0));

  return (
    <Link
      href={{
        pathname: "/(app)/course/play",
        params: {
          courseId: item.courseId,
          lessonId: item.lessonId,
          startSec: String(safeStart),
        },
      }}
      asChild
    >
      <TouchableOpacity style={styles.card} activeOpacity={0.92}>
        <View style={[styles.thumb, styles.fallback]}>
          <Ionicons name="play-circle" size={28} color={theme.color.textMuted} />
        </View>
        <View style={styles.progressWrap}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
        </View>

        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.title}>{item.courseTitle}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{item.lessonTitle}</Text>
          <Text numberOfLines={1} style={styles.caption}>
            Reprendre a {fmtTime(safeStart)} - {Math.round(pct * 100)}%
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  card: {
    width: 260,
    backgroundColor: t.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: "hidden",
    shadowColor: t.color.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  thumb: { width: "100%", aspectRatio: 16 / 9, backgroundColor: t.color.surfaceSunk },
  fallback: { alignItems: "center", justifyContent: "center" },
  progressWrap: { height: 4, backgroundColor: "rgba(29,78,216,0.12)" },
  progressFill: { height: 4, backgroundColor: t.color.primary },
  meta: { padding: 10, gap: 4 },
  title: { color: t.color.text, fontFamily: t.type.heading.fontFamily },
  subtitle: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  caption: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
});

