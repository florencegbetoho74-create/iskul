import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { isYouTubeUrl, getYouTubeId } from "@/utils/youtube";

// Type minimal accepté partout
export type Course = {
  id: string;
  title: string;
  level: string;
  // optionnels si l'item vient du storage complet
  chapters?: Array<{ id: string; title: string; videoUrl?: string }>;
  coverUrl?: string; // si on ajoute un jour une image de couverture
};

function getThumbUrl(item: any): string | null {
  // priorité à une cover explicite si tu en ajoutes plus tard
  if (item.coverUrl) return item.coverUrl;

  // sinon, première vidéo YouTube du 1er chapitre
  const firstVideo = item?.chapters?.find?.((ch: any) => !!ch.videoUrl)?.videoUrl;
  if (firstVideo && isYouTubeUrl(firstVideo)) {
    const id = getYouTubeId(firstVideo);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  // pas d'image dispo
  return null;
}

export default function CourseItem({ item }: { item: any }) {
  const title = item.title ?? "Cours";
  const level = item.level ?? "";
  const thumb = getThumbUrl(item);

  return (
    <Link href={`/(app)/course/${item.id}`} asChild>
      <TouchableOpacity style={styles.card} activeOpacity={0.92}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="play-circle" size={28} color="#cbd5e1" />
          </View>
        )}

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
    backgroundColor: COLOR.card,
    borderRadius: 16,
    borderColor: COLOR.border,
    borderWidth: 1,
    overflow: "hidden"
  },
  thumb: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#0b0b0c" },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  meta: { padding: 12, gap: 6 },
  title: { color: COLOR.text, fontWeight: "800" },
  level: { color: COLOR.sub }
});
