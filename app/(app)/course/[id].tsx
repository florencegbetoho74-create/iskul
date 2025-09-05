import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { getCourse } from "@/storage/courses";
import { useAuth } from "@/providers/AuthProvider";
import { startThread } from "@/storage/chat";

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [course, setCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const c = await getCourse(id);
      if (!c) {
        Alert.alert("Introuvable", "Ce cours n'existe pas.", [{ text: "OK", onPress: () => router.back() }]);
        return;
      }
      setCourse(c);
      setLoading(false);
    })();
  }, [id]);

  const canContact = useMemo(
    () => !!user && user.role !== "teacher" && course && course.ownerId && user.id !== course.ownerId,
    [user?.id, user?.role, course?.ownerId]
  );

  const contactTeacher = async () => {
    if (!user || !course) return;
    try {
      const th = await startThread({
        teacherId: course.ownerId,
        teacherName: course.ownerName || "",
        studentId: user.id,
        studentName: user.name || "",
        courseId: course.id,
        courseTitle: course.title || ""
      });
      router.push(`/(app)/messages/${th.id}`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de démarrer la discussion.");
    }
  };

  if (loading || !course) return <View style={{ flex: 1, backgroundColor: COLOR.bg }} />;

  return (
    <View style={styles.container}>
      {/* Header + cover */}
      <View style={styles.header}>
        <View style={styles.coverWrap}>
          {course.coverUrl ? (
            <Image source={{ uri: course.coverUrl }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="play-circle" size={28} color="#cbd5e1" />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.title} numberOfLines={2}>{course.title}</Text>
          <Text style={styles.meta}>{course.subject || "—"} • {course.level || "—"}</Text>
          <Text style={styles.by}>par {course.ownerName || "Enseignant"}</Text>

          {/* CTA élève : démarrer la conversation */}
          {canContact ? (
            <TouchableOpacity onPress={contactTeacher} style={styles.primary} activeOpacity={0.9}>
              <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
              <Text style={styles.primaryText}>Contacter le professeur</Text>
            </TouchableOpacity>
          ) : null}

          {/* Lien lecture si chapitres */}
          {course?.chapters?.length ? (
            <Link href={`/(app)/course/play?courseId=${course.id}`} asChild>
              <TouchableOpacity style={styles.secondary} activeOpacity={0.9}>
                <Ionicons name="play" size={16} color="#cbd5e1" />
                <Text style={styles.secondaryText}>Lire le cours</Text>
              </TouchableOpacity>
            </Link>
          ) : null}
        </View>
      </View>

      {/* Chapitres en grille (miniatures) */}
      <Text style={styles.section}>Chapitres ({course?.chapters?.length || 0})</Text>
      <FlatList
        data={course?.chapters || []}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 100, paddingTop: 8 }}
        renderItem={({ item, index }) => (
          <Link href={`/(app)/course/play?courseId=${course.id}&lessonId=${item.id}`} asChild>
            <TouchableOpacity style={styles.card} activeOpacity={0.9}>
              <View style={styles.thumbWrap}>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbFallback}>
                    <Ionicons name="film-outline" size={20} color="#cbd5e1" />
                  </View>
                )}
                <View style={styles.idxBadge}><Text style={styles.idxText}>{index + 1}</Text></View>
              </View>
              <View style={styles.body}>
                <Text numberOfLines={2} style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMeta}>{item.videoUrl ? "Vidéo" : "—"}</Text>
              </View>
            </TouchableOpacity>
          </Link>
        )}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>Aucun chapitre.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  header: { flexDirection: "row", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: "#1F2023" },
  coverWrap: { width: 120, height: 120, borderRadius: 12, overflow: "hidden", backgroundColor: "#0b0b0c", borderWidth: 1, borderColor: "#1F2023" },
  cover: { width: "100%", height: "100%" },
  title: { color: COLOR.text, fontSize: 18, fontWeight: "900" },
  meta: { color: COLOR.sub },
  by: { color: "#cbd5e1", fontSize: 12 },

  primary: { backgroundColor: COLOR.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondary: { backgroundColor: "#111214", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1, borderColor: COLOR.border, marginTop: 8 },
  secondaryText: { color: "#cbd5e1", fontWeight: "800" },

  section: { color: COLOR.text, fontWeight: "900", paddingHorizontal: 16, marginTop: 10 },

  card: { flex: 1, backgroundColor: "#111214", borderRadius: 14, borderWidth: 1, borderColor: "#1F2023", overflow: "hidden", minHeight: 160 },
  thumbWrap: { height: 90, backgroundColor: "#0b0b0c" },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  idxBadge: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  idxText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  body: { padding: 10, gap: 6 },
  itemTitle: { color: COLOR.text, fontWeight: "900" },
  itemMeta: { color: COLOR.sub, fontSize: 12 }
});
