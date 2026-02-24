import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { Course } from "@/types/course";
import { COLOR, FONT } from "@/theme/colors";

type Props = { item: Course; onPress?: () => void };

export default function CourseCard({ item, onPress }: Props) {
  const fallbackTitle = item.chapters?.[0]?.title || item.title || "Cours";
  const fallbackMeta = `${item.chapters?.length || 0} lecons`;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.thumbWrap}>
        <LinearGradient
          colors={["#0f172a", "#1e293b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.thumbFallback}
        >
          <View style={styles.thumbIcon}>
            <Ionicons name="play" size={18} color="#fff" />
          </View>
          <Text numberOfLines={2} style={styles.thumbTitle}>{fallbackTitle}</Text>
          <Text style={styles.thumbMeta}>{fallbackMeta}</Text>
        </LinearGradient>
        <LinearGradient colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.35)"]} style={styles.thumbShade} />
        <View style={styles.thumbBadge}>
          <Text style={styles.thumbBadgeText}>{item.subject}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{item.level}</Text>
        <Text style={styles.badge}>
          {item.chapters?.length || 0} chapitre{(item.chapters?.length || 0) > 1 ? "s" : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR.border,
    overflow: "hidden",
    minHeight: 220,
    shadowColor: "#0B1D39",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  thumbWrap: { height: 120, backgroundColor: COLOR.muted },
  thumbFallback: { flex: 1, padding: 12, justifyContent: "flex-end", gap: 6 },
  thumbIcon: {
    height: 30,
    width: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbTitle: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 13 },
  thumbMeta: { color: "rgba(255,255,255,0.7)", fontFamily: FONT.body, fontSize: 11 },
  thumbShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 60 },
  thumbBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  thumbBadgeText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  body: { padding: 12, gap: 6 },
  title: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  meta: { color: COLOR.sub, fontSize: 12, fontFamily: FONT.body },
  badge: {
    alignSelf: "flex-start",
    color: COLOR.text,
    backgroundColor: COLOR.tint,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontFamily: FONT.bodyBold,
    overflow: "hidden"
  }
});
