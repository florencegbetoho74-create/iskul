import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import type { Course } from "@/types/course";
import { isYouTubeUrl, getYouTubeId } from "@/utils/youtube";

type Props = { item: Course; onPress?: () => void };

export default function CourseCard({ item, onPress }: Props) {
  const thumb = useMemo(() => {
    if (item.coverUrl) return item.coverUrl as string;
    const first = item.chapters?.[0];
    if (first?.videoUrl && isYouTubeUrl(first.videoUrl)) {
      const vid = getYouTubeId(first.videoUrl);
      if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    }
    return null;
  }, [item.coverUrl, item.chapters]);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="book" size={22} color="#cbd5e1" />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {item.subject} • {item.level}
        </Text>
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
    backgroundColor: "#111214",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1F2023",
    overflow: "hidden",
    minHeight: 220
  },
  thumbWrap: { height: 120, backgroundColor: "#0b0b0c" },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 10, gap: 6 },
  title: { color: COLOR.text, fontWeight: "900" },
  meta: { color: COLOR.sub, fontSize: 12 },
  badge: {
    alignSelf: "flex-start",
    color: "#fff",
    backgroundColor: "#4441b8",
    borderColor: "#3532a1",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden"
  }
});
