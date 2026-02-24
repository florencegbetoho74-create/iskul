import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { COLOR, FONT } from "@/theme/colors";

export type Course = {
  id: string;
  title: string;
  level: string;
  chapters?: Array<{ id: string; title: string; videoUrl?: string; videoByLang?: Record<string, string> }>;
  coverUrl?: string;
};

export default function CourseItem({ item }: { item: any }) {
  const title = item.title ?? "Cours";
  const level = item.level ?? "";
  const fallbackTitle = item?.chapters?.[0]?.title || title;
  const fallbackMeta = `${item?.chapters?.length || 0} lecons`;

  return (
    <Link href={`/(app)/course/${item.id}`} asChild>
      <TouchableOpacity style={styles.card} activeOpacity={0.92}>
        <View style={[styles.thumb, styles.thumbFallback]}>
          <View style={styles.thumbIcon}>
            <Ionicons name="play" size={16} color="#fff" />
          </View>
          <Text numberOfLines={2} style={styles.thumbTitle}>{fallbackTitle}</Text>
          <Text style={styles.thumbMeta}>{fallbackMeta}</Text>
        </View>

        <View style={styles.meta}>
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
          {!!level && <Text style={styles.level}>{level}</Text>}
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderColor: COLOR.border,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#0B1D39",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  thumb: { width: "100%", aspectRatio: 16 / 9, backgroundColor: COLOR.muted },
  thumbFallback: { padding: 12, justifyContent: "flex-end", gap: 6, backgroundColor: "#0f172a" },
  thumbIcon: {
    height: 28,
    width: 28,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbTitle: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 12 },
  thumbMeta: { color: "rgba(255,255,255,0.7)", fontFamily: FONT.body, fontSize: 11 },
  meta: { padding: 12, gap: 6 },
  title: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  level: { color: COLOR.sub, fontFamily: FONT.body }
});
