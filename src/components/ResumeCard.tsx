import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Link } from "expo-router";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";

export default function ResumeCard({
  item
}: {
  item: {
    courseId: string;
    lessonId: string;
    courseTitle: string;
    lessonTitle: string;
    thumb?: string | null;
    percent: number; // 0..1
  };
}) {
  const pct = Math.max(0, Math.min(1, item.percent || 0));
  return (
    <Link href={{ pathname: "/(app)/course/play", params: { courseId: item.courseId, lessonId: item.lessonId } }} asChild>
      <TouchableOpacity style={styles.card} activeOpacity={0.92}>
        {item.thumb ? (
          <Image source={{ uri: item.thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.fallback]}>
            <Ionicons name="play-circle" size={28} color="#cbd5e1" />
          </View>
        )}
        {/* barre de progression */}
        <View style={styles.progressWrap}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
        </View>

        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.title}>{item.courseTitle}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{item.lessonTitle}</Text>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { width: 240, backgroundColor: COLOR.card, borderRadius: 16, borderWidth: 1, borderColor: COLOR.border, overflow: "hidden" },
  thumb: { width: "100%", aspectRatio: 16/9, backgroundColor: "#0b0b0c" },
  fallback: { alignItems: "center", justifyContent: "center" },
  progressWrap: { height: 4, backgroundColor: "#222328" },
  progressFill: { height: 4, backgroundColor: "#6C5CE7" },
  meta: { padding: 10, gap: 4 },
  title: { color: COLOR.text, fontWeight: "900" },
  subtitle: { color: COLOR.sub }
});
