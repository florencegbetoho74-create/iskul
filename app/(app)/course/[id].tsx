import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { COLOR, FONT } from "@/theme/colors";
import TopBar from "@/components/TopBar";
import ChapterCard from "@/components/ChapterCard";
import { getCourse } from "@/storage/courses";
import { useAuth } from "@/providers/AuthProvider";
import { startThread } from "@/storage/chat";

const BG = ["#F5F4F1", "#EAF0FF", "#F6F1EA"] as const;
const ACCENT = ["#1D4ED8", "#2563EB"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v?: string | null) => !!v && UUID_RE.test(v);

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
  }, [id, router]);

  const hasValidOwner = useMemo(() => isValidUuid(course?.ownerId), [course?.ownerId]);
  const canContact = useMemo(
    () => !!user && user.role !== "teacher" && hasValidOwner && user.id !== course?.ownerId,
    [user?.id, user?.role, hasValidOwner, course?.ownerId]
  );

  const contactTeacher = async () => {
    if (!user || !course) return;
    if (!hasValidOwner) {
      Alert.alert("Impossible", "Ce cours n'est pas associe a un professeur valide.");
      return;
    }
    try {
      const th = await startThread({
        teacherId: course.ownerId,
        teacherName: course.ownerName || "",
        studentId: user.id,
        studentName: user.name || "",
        courseId: course.id,
        courseTitle: course.title || "",
      });
      router.push(`/(app)/messages/${th.id}`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de demarrer la discussion.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLOR.bg }]}>
        <ActivityIndicator color={COLOR.primary} />
      </View>
    );
  }

  if (!course) return <View style={{ flex: 1, backgroundColor: COLOR.bg }} />;

  const chapters = course?.chapters || [];
  const fallbackTitle = chapters?.[0]?.title || course.title || "Cours";
  const fallbackMeta = `${chapters.length || 0} lecons`;

  const Header = () => (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerWrap}>
      <TopBar title="Cours" right={null} />

      <View style={styles.heroCard}>
        <View style={styles.coverWrap}>
          <LinearGradient colors={["#0f172a", "#1e293b"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, styles.coverFallback]}>
            <View style={styles.coverIcon}>
              <Ionicons name="play" size={18} color="#fff" />
            </View>
            <Text numberOfLines={2} style={styles.coverTitle}>{fallbackTitle}</Text>
            <Text style={styles.coverMeta}>{fallbackMeta}</Text>
          </LinearGradient>
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.coverFade}
          />
          <View style={styles.coverBadgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{course.subject || "General"}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{course.level || "Niveau"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroBody}>
          <Text style={styles.title} numberOfLines={2}>{course.title}</Text>
          <Text style={styles.meta}>Par {course.ownerName || "Enseignant"}</Text>
          {course.description ? (
            <Text style={styles.desc} numberOfLines={3}>{course.description}</Text>
          ) : null}

          <View style={styles.ctaRow}>
            {chapters.length ? (
              <Link href={`/(app)/course/play?courseId=${course.id}`} asChild>
                <Pressable style={styles.primaryBtn}>
                  <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.primaryText}>Lire le cours</Text>
                  </LinearGradient>
                </Pressable>
              </Link>
            ) : null}

            {canContact ? (
              <Pressable style={styles.secondaryBtn} onPress={contactTeacher}>
                <Ionicons name="chatbubbles-outline" size={16} color={COLOR.text} />
                <Text style={styles.secondaryText}>Contacter le prof</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Chapitres ({chapters.length})</Text>
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={chapters}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 120, paddingTop: 8 }}
        renderItem={({ item, index }) => (
          <View style={{ flex: 1 }}>
            <ChapterCard
              item={item}
              index={index + 1}
              onPress={() => router.push(`/(app)/course/play?courseId=${course.id}&lessonId=${item.id}`)}
            />
          </View>
        )}
        ListHeaderComponent={Header}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>Aucun chapitre.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerWrap: { paddingBottom: 8 },
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: COLOR.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLOR.border,
    overflow: "hidden",
  },
  coverWrap: { height: 180, backgroundColor: COLOR.muted },
  cover: { width: "100%", height: "100%" },
  coverFallback: { padding: 14, justifyContent: "flex-end", gap: 6 },
  coverIcon: {
    height: 32,
    width: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverTitle: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 14 },
  coverMeta: { color: "rgba(255,255,255,0.7)", fontFamily: FONT.body, fontSize: 12 },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70 },
  coverBadgeRow: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", gap: 8 },
  badge: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  badgeText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },

  heroBody: { padding: 14, gap: 6 },
  title: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 18 },
  meta: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12 },
  desc: { color: COLOR.text, fontFamily: FONT.body, fontSize: 13 },

  ctaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  primaryBtn: { borderRadius: 12, overflow: "hidden" },
  primaryGrad: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  primaryText: { color: "#fff", fontFamily: FONT.bodyBold },

  secondaryBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryText: { color: COLOR.text, fontFamily: FONT.bodyBold },

  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 16 },
});



