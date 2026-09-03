import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import TopBar from "@/components/TopBar";
import ChapterCard from "@/components/ChapterCard";
import { getCourse } from "@/storage/courses";
import { useAuth } from "@/providers/AuthProvider";
import { startThread } from "@/storage/chat";

/** Degrades derives du theme : figes, ils ignoraient le mode sombre. */
const backgroundGradient = (t: Theme): readonly [string, string, string] =>
  t.name === "dark"
    ? [t.color.bg, t.color.surfaceSunk, t.color.bg]
    : [t.color.bg, t.color.primarySoft, t.color.bg];

const accentGradient = (t: Theme): readonly [string, string] => [
  t.color.primary,
  t.color.primaryPressed,
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v?: string | null) => !!v && UUID_RE.test(v);

export default function CourseDetail() {
  const { styles, theme } = useThemedStyles(makeStyles);
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
      <View style={[styles.center, { backgroundColor: theme.color.bg }]}>
        <ActivityIndicator color={theme.color.primary} />
      </View>
    );
  }

  if (!course) return <View style={{ flex: 1, backgroundColor: theme.color.bg }} />;

  const chapters = course?.chapters || [];
  const fallbackTitle = chapters?.[0]?.title || course.title || "Cours";
  const fallbackMeta = `${chapters.length || 0} lecons`;

  const Header = () => (
    <LinearGradient colors={backgroundGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerWrap}>
      <TopBar title="Cours" right={null} />

      <View style={styles.heroCard}>
        <View style={styles.coverWrap}>
          <LinearGradient colors={[theme.color.media, theme.color.surfaceSunk]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, styles.coverFallback]}>
            <View style={styles.coverIcon}>
              <Ionicons name="play" size={18} color={theme.color.textOnPrimary} />
            </View>
            <Text numberOfLines={2} style={styles.coverTitle}>{fallbackTitle}</Text>
            <Text style={styles.coverMeta}>{fallbackMeta}</Text>
          </LinearGradient>
          <LinearGradient
            colors={["transparent", theme.color.mediaScrim]}
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
                  <LinearGradient colors={accentGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
                    <Ionicons name="play" size={16} color={theme.color.textOnPrimary} />
                    <Text style={styles.primaryText}>Lire le cours</Text>
                  </LinearGradient>
                </Pressable>
              </Link>
            ) : null}

            {canContact ? (
              <Pressable style={styles.secondaryBtn} onPress={contactTeacher}>
                <Ionicons name="chatbubbles-outline" size={16} color={theme.color.text} />
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
        ListEmptyComponent={<Text style={{ color: theme.color.textMuted, paddingHorizontal: 16 }}>Aucun chapitre.</Text>}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  headerWrap: { paddingBottom: 8 },
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: t.color.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: "hidden",
  },
  coverWrap: { height: 180, backgroundColor: t.color.surfaceSunk },
  cover: { width: "100%", height: "100%" },
  coverFallback: { padding: 14, justifyContent: "flex-end", gap: 6 },
  coverIcon: {
    height: 32,
    width: 32,
    borderRadius: 10,
    backgroundColor: t.color.mediaControl,
    alignItems: "center",
    justifyContent: "center",
  },
  coverTitle: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 14 },
  coverMeta: { color: t.color.onMediaMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70 },
  coverBadgeRow: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", gap: 8 },
  badge: {
    backgroundColor: t.color.media,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: t.color.mediaControl,
  },
  badgeText: { color: t.color.onMedia, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },

  heroBody: { padding: 14, gap: 6 },
  title: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 18 },
  meta: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  desc: { color: t.color.text, fontFamily: t.type.body.fontFamily, fontSize: 13 },

  ctaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  primaryBtn: { borderRadius: 12, overflow: "hidden" },
  primaryGrad: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  primaryText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily },

  secondaryBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily },

  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 16 },
});



