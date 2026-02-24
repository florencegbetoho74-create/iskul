import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLOR, FONT } from "@/theme/colors";
import Segmented from "@/components/Segmented";
import { useAuth } from "@/providers/AuthProvider";
import { listQuizzes, type Quiz } from "@/storage/quizzes";
import { GRADE_LEVELS, normalizeCourseLevel } from "@/constants/gradeLevels";
import { COURSE_SUBJECTS, canonicalizeCourseSubject } from "@/constants/courseSubjects";

const BG = ["#F5F4F1", "#EAF0FF", "#F6F1EA"] as const;
const ACCENT = ["#1D4ED8", "#2563EB"] as const;

type ScopeFilter = "all" | "standalone" | "lesson";
type SubjectGroup = { subject: string; quizzes: Quiz[] };
type LevelGroup = { level: string; subjects: SubjectGroup[]; quizzes: number };

export default function QuizzesTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isTeacher = String((user as any)?.role || "") === "teacher";

  const [rows, setRows] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const load = useCallback(async () => {
    if (!user?.id && isTeacher) return;
    setLoading(true);
    try {
      const list = await listQuizzes({
        ownerId: isTeacher ? user?.id : undefined,
        publishedOnly: !isTeacher,
      });
      setRows(list || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isTeacher, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const levelRank = useMemo(() => {
    const map = new Map<string, number>();
    GRADE_LEVELS.forEach((lvl, i) => map.set(lvl, i));
    return map;
  }, []);

  const subjectRank = useMemo(() => {
    const map = new Map<string, number>();
    COURSE_SUBJECTS.forEach((subj, i) => map.set(subj, i));
    return map;
  }, []);

  const scoped = useMemo(() => {
    if (scopeFilter === "standalone") return rows.filter((q) => q.scope === "standalone");
    if (scopeFilter === "lesson") return rows.filter((q) => q.scope === "lesson");
    return rows;
  }, [rows, scopeFilter]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((quiz) => {
      return (
        (quiz.title || "").toLowerCase().includes(q) ||
        (quiz.description || "").toLowerCase().includes(q) ||
        (quiz.subject || "").toLowerCase().includes(q) ||
        (quiz.level || "").toLowerCase().includes(q) ||
        (quiz.courseTitle || "").toLowerCase().includes(q) ||
        (quiz.lessonTitle || "").toLowerCase().includes(q)
      );
    });
  }, [query, scoped]);

  const levelOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const quiz of searched) {
      const lvl = normalizeCourseLevel(quiz.level);
      counts.set(lvl, (counts.get(lvl) || 0) + 1);
    }
    const items = Array.from(counts.entries())
      .sort((a, b) => {
        const ra = levelRank.has(a[0]) ? (levelRank.get(a[0]) as number) : 999;
        const rb = levelRank.has(b[0]) ? (levelRank.get(b[0]) as number) : 999;
        if (ra !== rb) return ra - rb;
        return a[0].localeCompare(b[0], "fr", { sensitivity: "base" });
      })
      .map(([key, count]) => ({ key, label: key, count }));
    return [{ key: "all", label: "Toutes classes", count: searched.length }, ...items];
  }, [levelRank, searched]);

  useEffect(() => {
    if (levelOptions.some((opt) => opt.key === levelFilter)) return;
    setLevelFilter("all");
  }, [levelFilter, levelOptions]);

  const filtered = useMemo(() => {
    if (levelFilter === "all") return searched;
    return searched.filter((quiz) => normalizeCourseLevel(quiz.level) === levelFilter);
  }, [levelFilter, searched]);

  const grouped = useMemo<LevelGroup[]>(() => {
    const byLevel = new Map<string, Map<string, Quiz[]>>();
    for (const quiz of filtered) {
      const level = normalizeCourseLevel(quiz.level);
      const subject = canonicalizeCourseSubject(quiz.subject || "") || "Matiere non precise";
      if (!byLevel.has(level)) byLevel.set(level, new Map());
      const bySubject = byLevel.get(level)!;
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject)!.push(quiz);
    }

    const levels: LevelGroup[] = Array.from(byLevel.entries()).map(([level, bySubject]) => {
      const subjects: SubjectGroup[] = Array.from(bySubject.entries()).map(([subject, quizzes]) => {
        const sorted = [...quizzes].sort((a, b) => {
          if ((b.updatedAtMs || 0) !== (a.updatedAtMs || 0)) return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
          return (a.title || "").localeCompare(b.title || "", "fr", { sensitivity: "base" });
        });
        return { subject, quizzes: sorted };
      });

      subjects.sort((a, b) => {
        const ra = subjectRank.has(a.subject) ? (subjectRank.get(a.subject) as number) : 999;
        const rb = subjectRank.has(b.subject) ? (subjectRank.get(b.subject) as number) : 999;
        if (ra !== rb) return ra - rb;
        return a.subject.localeCompare(b.subject, "fr", { sensitivity: "base" });
      });

      return {
        level,
        subjects,
        quizzes: subjects.reduce((acc, s) => acc + s.quizzes.length, 0),
      };
    });

    levels.sort((a, b) => {
      const ra = levelRank.has(a.level) ? (levelRank.get(a.level) as number) : 999;
      const rb = levelRank.has(b.level) ? (levelRank.get(b.level) as number) : 999;
      if (ra !== rb) return ra - rb;
      return a.level.localeCompare(b.level, "fr", { sensitivity: "base" });
    });

    return levels;
  }, [filtered, levelRank, subjectRank]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const openQuiz = (quiz: Quiz) => {
    router.push(`/(app)/course/quiz?quizId=${encodeURIComponent(quiz.id)}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: (isTeacher ? 168 : 120) + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLOR.text}
            colors={[COLOR.text]}
            progressBackgroundColor={COLOR.surface}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
          <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Quiz</Text>
              <Text style={styles.subtitle}>
                {isTeacher
                  ? "Creer et publier des quiz classes par classe et matiere."
                  : "Quiz disponibles par classe et matiere."}
              </Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un quiz"
              placeholderTextColor={COLOR.sub}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
              </Pressable>
            ) : null}
          </View>

          {isTeacher ? (
            <View style={styles.segmentWrap}>
              <Segmented
                value={scopeFilter}
                items={[
                  { key: "all", label: "Tous" },
                  { key: "standalone", label: "Libres" },
                  { key: "lesson", label: "Chapitres" },
                ]}
                onChange={(k) => setScopeFilter(k as ScopeFilter)}
              />
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRow}>
            {levelOptions.map((opt) => {
              const active = levelFilter === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setLevelFilter(opt.key)}
                  style={[styles.levelChip, active && styles.levelChipActive]}
                >
                  <Text style={[styles.levelChipText, active && styles.levelChipTextActive]}>{opt.label}</Text>
                  <View style={[styles.levelCount, active && styles.levelCountActive]}>
                    <Text style={[styles.levelCountText, active && styles.levelCountTextActive]}>{opt.count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLOR.primary} />
            <Text style={styles.loadingText}>Chargement des quiz...</Text>
          </View>
        ) : grouped.length ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {grouped.map((levelGroup) => (
              <View key={levelGroup.level} style={styles.levelCard}>
                <View style={styles.levelHead}>
                  <Text style={styles.levelTitle}>Classe {levelGroup.level}</Text>
                  <Text style={styles.levelSub}>
                    {levelGroup.quizzes} quiz
                  </Text>
                </View>

                {levelGroup.subjects.map((subjectGroup) => (
                  <View key={`${levelGroup.level}__${subjectGroup.subject}`} style={styles.subjectBlock}>
                    <View style={styles.subjectHead}>
                      <Text style={styles.subjectTitle}>{subjectGroup.subject}</Text>
                      <Text style={styles.subjectCount}>{subjectGroup.quizzes.length}</Text>
                    </View>

                    {subjectGroup.quizzes.map((quiz) => (
                      <Pressable key={quiz.id} onPress={() => openQuiz(quiz)} style={styles.quizCard}>
                        <View style={styles.quizCardTop}>
                          <Text style={styles.quizTitle} numberOfLines={2}>{quiz.title || "Quiz sans titre"}</Text>
                          <View style={[styles.scopeBadge, quiz.scope === "standalone" ? styles.scopeStandalone : styles.scopeLesson]}>
                            <Text style={styles.scopeBadgeText}>{quiz.scope === "standalone" ? "Autonome" : "Chapitre"}</Text>
                          </View>
                        </View>

                        {quiz.description ? (
                          <Text style={styles.quizDesc} numberOfLines={2}>{quiz.description}</Text>
                        ) : null}

                        <View style={styles.quizMetaRow}>
                          <Text style={styles.quizMeta}>
                            {quiz.questions.length} question{quiz.questions.length > 1 ? "s" : ""}
                          </Text>
                          {quiz.scope === "lesson" ? (
                            <Text style={styles.quizMeta} numberOfLines={1}>
                              {(quiz.courseTitle || "Cours")} - {(quiz.lessonTitle || "Chapitre")}
                            </Text>
                          ) : (
                            <Text style={styles.quizMeta}>Quiz general de matiere</Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Aucun quiz trouve</Text>
            <Text style={styles.emptySub}>
              {isTeacher
                ? "Creer un quiz autonome pour alimenter la section eleve par classe et matiere."
                : "Aucun quiz publie sur ce filtre pour le moment."}
            </Text>
          </View>
        )}
      </ScrollView>
      {isTeacher ? (
        <Pressable
          onPress={() => router.push("/(app)/course/quiz?mode=standalone")}
          style={[styles.fabAdd, { bottom: insets.bottom + 16 }]}
          accessibilityRole="button"
          accessibilityLabel="Creer un quiz"
        >
          <Ionicons name="add" size={26} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },

  headerBg: { paddingBottom: 10 },
  headerRow: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center" },
  title: { color: COLOR.text, fontSize: 24, fontFamily: FONT.heading },
  subtitle: { color: COLOR.sub, fontSize: 12, fontFamily: FONT.body, marginTop: 3 },

  searchWrap: {
    marginHorizontal: 16,
    backgroundColor: COLOR.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
  },
  searchInput: { flex: 1, color: COLOR.text, fontFamily: FONT.body, fontSize: 15 },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 10 },

  levelRow: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  levelChipActive: { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
  levelChipText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  levelChipTextActive: { color: "#fff" },
  levelCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: COLOR.muted,
  },
  levelCountActive: { backgroundColor: "rgba(255,255,255,0.24)" },
  levelCountText: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 11 },
  levelCountTextActive: { color: "#fff" },

  loadingBox: { paddingTop: 28, alignItems: "center", gap: 8 },
  loadingText: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 13 },

  levelCard: {
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    marginBottom: 12,
    overflow: "hidden",
  },
  levelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
    backgroundColor: COLOR.muted,
  },
  levelTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 14 },
  levelSub: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },

  subjectBlock: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },
  subjectHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  subjectTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 13 },
  subjectCount: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 11 },

  quizCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    padding: 10,
    marginBottom: 8,
  },
  quizCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  quizTitle: { flex: 1, color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 13 },
  scopeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scopeStandalone: { backgroundColor: COLOR.tint, borderColor: COLOR.border },
  scopeLesson: { backgroundColor: COLOR.muted, borderColor: COLOR.border },
  scopeBadgeText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 10 },
  quizDesc: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12, marginTop: 5, lineHeight: 18 },
  quizMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 },
  quizMeta: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 11, flex: 1 },

  emptyWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    alignItems: "flex-start",
  },
  emptyIcon: { borderRadius: 12, height: 28, width: 28, marginBottom: 6 },
  emptyTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 16 },
  emptySub: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 13, marginTop: 2 },

  fabAdd: {
    position: "absolute",
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: COLOR.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B1D39",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
});



