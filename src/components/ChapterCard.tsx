import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLOR } from "@/theme/colors";
import type { Chapter } from "@/types/course";
import { isYouTubeUrl, getYouTubeId } from "@/utils/youtube";

type Props = {
  item: Chapter;
  index?: number;           // pour afficher 01, 02, …
  active?: boolean;         // chapitre en cours de lecture
  onPress?: () => void;
};

export default function ChapterCard({ item, index, active, onPress }: Props) {
  const thumb = useMemo(() => {
    if (item?.videoUrl && isYouTubeUrl(item.videoUrl)) {
      const vid = getYouTubeId(item.videoUrl);
      if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    }
    return null; // pas de miniature -> fallback
  }, [item?.videoUrl]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, active && styles.cardActive]}
    >
      <View style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="videocam" size={20} color="#cbd5e1" />
          </View>
        )}

        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>
            {typeof index === "number" ? String(index).padStart(2, "0") : "—"}
          </Text>
        </View>

        {item.videoUrl ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={14} color="#fff" />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text style={styles.sub}>{item.videoUrl ? "Vidéo liée" : "Aucune vidéo"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#111214",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2023",
    overflow: "hidden",
    minHeight: 180
  },
  cardActive: {
    borderColor: "#6C5CE7"
  },
  thumbWrap: { height: 110, backgroundColor: "#0b0b0c" },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 10, gap: 6 },
  title: { color: COLOR.text, fontWeight: "900" },
  sub: { color: COLOR.sub, fontSize: 12 },
  topBadge: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2
  },
  topBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  playBadge: {
    position: "absolute", right: 6, bottom: 6,
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 999, padding: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)"
  }
});
