import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLOR, ELEVATION, FONT, RADIUS } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import type { Course } from "@/types/course";
import { watchCoursesOrdered } from "@/storage/courses";
import CourseCard from "@/components/CourseCard";
import Segmented from "@/components/Segmented";
import { GRADE_LEVELS, normalizeCourseLevel } from "@/constants/gradeLevels";
import { COURSE_SUBJECTS, canonicalizeCourseSubject } from "@/constants/courseSubjects";

const BG = ["#F4F7FC", "#EAF0FF", "#F1F7FF"] as const;
const ACCENT = ["#2F5BFF", "#5B85FF"] as const;

type SegmentKey = "all" | "published" | "mine";

type SegmentItem = { key: SegmentKey; label: string };
type LevelOption = { key: string; label: string; count: number };
type SubjectGroup = { subject: string; courses: Course[]; chapters: number };
type LevelGroup = { level: string; subjects: SubjectGroup[]; courses: number; chapters: number };

export default function Courses() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isTeacher = String((user as any)?.role) === "teacher";

  const [all, setAll] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<SegmentKey>(isTeacher ? "mine" : "all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [menuVisible, setMenuVisible] = useState(false);
  const [openLevels, setOpenLevels] = useState<Record<string, boolean>>({});
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = watchCoursesOrdered(setAll, 120);
    return () => unsub();
  }, []);

  const segments = useMemo<SegmentItem[]>(() => {
    const base: SegmentItem[] = [{ key: "all", label: "Tous" }];
    if (isTeacher) {
      base.push({ key: "published", label: "Publies" });
      base.push({ key: "mine", label: "Mes cours" });
    }
    return base;
  }, [isTeacher]);

  const scoped = useMemo(() => {
    let base: Course[] = [];
    if (!isTeacher) {
      base = all.filter((c) => c.published);
    } else {
      switch (segment) {
        case "mine":
          base = all.filter((c) => c.ownerId === user?.id);
          break;
        case "published":
          base = all.filter((c) => c.published);
          break;
        default:
          base = all;
      }
    }
    return base;
  }, [all, isTeacher, segment, user?.id]);

  const levelOptions = useMemo<LevelOption[]>(() => {
    const map = new Map<string, number>();
    for (const c of scoped) {
      const k = normalizeCourseLevel(c.level);
      map.set(k, (map.get(k) || 0) + 1);
    }
    const list = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "fr", { sensitivity: "base" }))
      .map(([label, count]) => ({ key: label, label, count }));
    return [{ key: "all", label: "Toutes les classes", count: scoped.length }, ...list];
  }, [scoped]);

  useEffect(() => {
    if (levelOptions.some((it) => it.key === levelFilter)) return;
    setLevelFilter("all");
  }, [levelOptions, levelFilter]);

  const filtered = useMemo(() => {
    let base = scoped;
    if (levelFilter !== "all") {
      base = base.filter((c) => normalizeCourseLevel(c.level) === levelFilter);
    }
    if (!q.trim()) return base;
    const s = q.trim().toLowerCase();
    return base.filter(
      (c) =>
        c.title?.toLowerCase().includes(s) ||
        c.subject?.toLowerCase().includes(s) ||
        c.level?.toLowerCase().includes(s) ||
        c.ownerName?.toLowerCase().includes(s)
    );
  }, [scoped, levelFilter, q]);

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

  const studentTree = useMemo<LevelGroup[]>(() => {
    if (isTeacher) return [];

    const byLevel = new Map<string, Map<string, Course[]>>();
    for (const course of filtered) {
      const lvl = normalizeCourseLevel(course.level);
      const subj = canonicalizeCourseSubject(course.subject || "") || "Matiere non precise";
      if (!byLevel.has(lvl)) byLevel.set(lvl, new Map());
      const bySubject = byLevel.get(lvl)!;
      if (!bySubject.has(subj)) bySubject.set(subj, []);
      bySubject.get(subj)!.push(course);
    }

    const levels: LevelGroup[] = Array.from(byLevel.entries()).map(([lvl, bySubject]) => {
      const subjects: SubjectGroup[] = Array.from(bySubject.entries()).map(([subject, courses]) => {
        const sortedCourses = [...courses].sort((a, b) =>
          (a.title || "").localeCompare(b.title || "", "fr", { sensitivity: "base" })
        );
        return {
          subject,
          courses: sortedCourses,
          chapters: sortedCourses.reduce((acc, c) => acc + (c.chapters?.length || 0), 0),
        };
      });
      subjects.sort((a, b) => {
        const ra = subjectRank.has(a.subject) ? (subjectRank.get(a.subject) as number) : 999;
        const rb = subjectRank.has(b.subject) ? (subjectRank.get(b.subject) as number) : 999;
        if (ra !== rb) return ra - rb;
        return a.subject.localeCompare(b.subject, "fr", { sensitivity: "base" });
      });
      return {
        level: lvl,
        subjects,
        courses: subjects.reduce((acc, s) => acc + s.courses.length, 0),
        chapters: subjects.reduce((acc, s) => acc + s.chapters, 0),
      };
    });

    levels.sort((a, b) => {
      const ra = levelRank.has(a.level) ? (levelRank.get(a.level) as number) : 999;
      const rb = levelRank.has(b.level) ? (levelRank.get(b.level) as number) : 999;
      if (ra !== rb) return ra - rb;
      return a.level.localeCompare(b.level, "fr", { sensitivity: "base" });
    });

    return levels;
  }, [filtered, isTeacher, levelRank, subjectRank]);

  useEffect(() => {
    if (isTeacher || !studentTree.length) return;
    setOpenLevels((prev) => {
      if (Object.keys(prev).length) return prev;
      return { [studentTree[0].level]: true };
    });
  }, [studentTree, isTeacher]);

  const toggleLevel = (key: string) => {
    setOpenLevels((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleSubject = (key: string) => {
    setOpenSubjects((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleCourse = (key: string) => {
    setOpenCourses((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const Header = (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Cours</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {isTeacher ? "Espace prof" : "Catalogue eleve"} - {filtered.length} resultat{filtered.length > 1 ? "s" : ""}
          </Text>
        </View>
        {isTeacher ? (
          <Pressable onPress={() => router.push("/(app)/course/new")} style={styles.addBtn}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Nouveau</Text>
          </Pressable>
        ) : (
          <View style={styles.headerActions}>
            <Pressable onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
              <Ionicons name="list-outline" size={16} color={COLOR.text} />
              <Text style={styles.menuBtnText}>Menu</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/(tabs)/quizzes")} style={[styles.menuBtn, styles.quizNavBtn]}>
              <MaterialCommunityIcons name="brain" size={16} color={COLOR.primary} />
              <Text style={[styles.menuBtnText, styles.quizNavBtnText]}>Quiz</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.searchWrap} accessible accessibilityRole="search">
        <Ionicons name="search" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un cours"
          placeholderTextColor={COLOR.sub}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {q ? (
          <Pressable onPress={() => setQ("")} hitSlop={8}>
            <Ionicons name="close" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
          </Pressable>
        ) : null}
      </View>

      {segments.length > 1 ? (
        <View style={styles.segmentWrap}>
          <Segmented value={segment} items={segments} onChange={(k) => setSegment(k as SegmentKey)} />
        </View>
      ) : null}

      <View style={styles.classRowHead}>
        <Text style={styles.classRowTitle}>{isTeacher ? "Filtrer par classe" : "Classe"}</Text>
        {levelFilter !== "all" ? (
          <Pressable onPress={() => setLevelFilter("all")} style={styles.clearChip}>
            <Ionicons name="close" size={14} color={COLOR.sub} />
            <Text style={styles.clearChipText}>Reinitialiser</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.levelRow}
      >
        {levelOptions.map((opt) => {
          const active = levelFilter === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setLevelFilter(opt.key)}
              style={[styles.levelChip, active && styles.levelChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filtrer par ${opt.label}`}
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
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <FlatList
          data={filtered}
          ListHeaderComponent={Header}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, justifyContent: "space-between" }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 + insets.bottom }}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <CourseCard item={item} onPress={() => router.push(`/(app)/course/${item.id}`)} />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              isTeacher={isTeacher}
              segment={segment}
              levelFilter={levelFilter}
              hasSearch={!!q.trim()}
            />
          }
        />

        {isTeacher ? (
          <Pressable onPress={() => router.push("/(app)/course/new")} style={[styles.fabWrap, { bottom: 16 + insets.bottom }]}>
            <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fab}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.fabText}>Creer un cours</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>

      {!isTeacher ? (
        <Modal visible={menuVisible} animationType="slide" transparent onRequestClose={() => setMenuVisible(false)}>
          <View style={styles.menuRoot}>
            <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)} />
            <View style={[styles.menuSheet, { paddingBottom: 10 + insets.bottom }]}>
              <View style={styles.menuGrabber} />
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Menu Classe - Matiere - Cours - Chapitre</Text>
                <Pressable onPress={() => setMenuVisible(false)} style={styles.menuCloseBtn}>
                  <Ionicons name="close" size={18} color={COLOR.text} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.menuTreeContent}>
                {studentTree.length ? (
                  studentTree.map((item) => {
                    const levelOpen = openLevels[item.level] ?? false;
                    return (
                      <View key={item.level} style={styles.levelCard}>
                        <Pressable
                          style={styles.levelHead}
                          onPress={() => toggleLevel(item.level)}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: levelOpen }}
                          accessibilityLabel={`Classe ${item.level}`}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.levelTitle}>Classe {item.level}</Text>
                            <Text style={styles.levelSub}>
                              {item.subjects.length} matiere{item.subjects.length > 1 ? "s" : ""} - {item.courses} cours - {item.chapters} chapitres
                            </Text>
                          </View>
                          <Ionicons name={levelOpen ? "chevron-up" : "chevron-down"} size={18} color={COLOR.sub} />
                        </Pressable>

                        {levelOpen ? (
                          <View style={styles.levelBody}>
                            {item.subjects.map((subject) => {
                              const subjectKey = `${item.level}__${subject.subject}`;
                              const subjectOpen = openSubjects[subjectKey] ?? false;
                              return (
                                <View key={subjectKey} style={styles.subjectCard}>
                                  <Pressable
                                    style={styles.subjectHead}
                                    onPress={() => toggleSubject(subjectKey)}
                                    accessibilityRole="button"
                                    accessibilityState={{ expanded: subjectOpen }}
                                    accessibilityLabel={`Matiere ${subject.subject}`}
                                  >
                                    <Text style={styles.subjectTitle}>{subject.subject}</Text>
                                    <View style={styles.subjectRight}>
                                      <Text style={styles.subjectCount}>{subject.courses.length}</Text>
                                      <Ionicons name={subjectOpen ? "chevron-up" : "chevron-down"} size={16} color={COLOR.sub} />
                                    </View>
                                  </Pressable>

                                  {subjectOpen ? (
                                    <View style={styles.subjectBody}>
                                      {subject.courses.map((course) => {
                                        const chapters = [...(course.chapters || [])].sort((a, b) => {
                                          const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
                                          const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
                                          if (ao !== bo) return ao - bo;
                                          return (a.title || "").localeCompare(b.title || "", "fr", { sensitivity: "base" });
                                        });
                                        const courseOpen = openCourses[course.id] ?? false;
                                        return (
                                          <View key={course.id} style={styles.courseCard}>
                                            <Pressable
                                              style={styles.courseHead}
                                              onPress={() => toggleCourse(course.id)}
                                              accessibilityRole="button"
                                              accessibilityState={{ expanded: courseOpen }}
                                            >
                                              <View style={{ flex: 1 }}>
                                                <Text style={styles.courseTitle} numberOfLines={2}>{course.title || "Sans titre"}</Text>
                                                <Text style={styles.courseMeta}>{chapters.length} chapitre{chapters.length > 1 ? "s" : ""}</Text>
                                              </View>
                                              <Ionicons name={courseOpen ? "chevron-up" : "chevron-down"} size={16} color={COLOR.sub} />
                                            </Pressable>

                                            <View style={styles.courseActions}>
                                              <Pressable
                                                style={styles.courseActionBtn}
                                                onPress={() => {
                                                  setMenuVisible(false);
                                                  router.push(`/(app)/course/${course.id}`);
                                                }}
                                              >
                                                <Ionicons name="eye-outline" size={14} color={COLOR.text} />
                                                <Text style={styles.courseActionTxt}>Cours</Text>
                                              </Pressable>
                                              {chapters.length > 0 ? (
                                                <Pressable
                                                  style={styles.courseActionBtn}
                                                  onPress={() => {
                                                    setMenuVisible(false);
                                                    router.push(`/(app)/course/play?courseId=${course.id}`);
                                                  }}
                                                >
                                                  <Ionicons name="play-outline" size={14} color={COLOR.text} />
                                                  <Text style={styles.courseActionTxt}>Lire</Text>
                                                </Pressable>
                                              ) : null}
                                            </View>

                                            {courseOpen ? (
                                              chapters.length > 0 ? (
                                                <View style={styles.chapterList}>
                                                  {chapters.map((ch, idx) => (
                                                    <Pressable
                                                      key={ch.id}
                                                      style={styles.chapterRow}
                                                      onPress={() => {
                                                        setMenuVisible(false);
                                                        router.push(`/(app)/course/play?courseId=${course.id}&lessonId=${ch.id}`);
                                                      }}
                                                    >
                                                      <Ionicons name="play-circle-outline" size={15} color={COLOR.primary} />
                                                      <Text style={styles.chapterText} numberOfLines={1}>{idx + 1}. {ch.title || "Chapitre"}</Text>
                                                    </Pressable>
                                                  ))}
                                                </View>
                                              ) : (
                                                <Text style={styles.chapterEmpty}>Aucun chapitre pour ce cours.</Text>
                                              )
                                            ) : null}
                                          </View>
                                        );
                                      })}
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.menuEmpty}>Aucun cours disponible.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

function EmptyState({
  isTeacher,
  segment,
  levelFilter,
  hasSearch,
}: {
  isTeacher: boolean;
  segment: SegmentKey;
  levelFilter: string;
  hasSearch: boolean;
}) {
  const hasScopedFilter = levelFilter !== "all" || hasSearch;
  const title = isTeacher
    ? segment === "mine"
      ? "Commencez par creer votre premier cours."
      : segment === "published"
      ? "Aucun cours publie pour l'instant."
      : hasScopedFilter
      ? "Aucun cours pour ce filtre."
      : "Aucun cours ne correspond a votre recherche."
    : hasScopedFilter
    ? "Aucun cours pour ce filtre."
    : "Aucun cours disponible pour l'instant.";

  const subtitle = isTeacher
    ? segment === "mine"
      ? "Ajoutez vos chapitres et publiez en un clic."
      : hasScopedFilter
      ? "Essayez une autre classe ou effacez la recherche."
      : "Revenez plus tard ou ajustez vos filtres."
    : hasScopedFilter
    ? "Essayez une autre classe ou effacez la recherche."
    : "Revenez plus tard ou ajustez vos filtres.";

  return (
    <View style={styles.emptyWrap}>
      <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBg: { paddingBottom: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading },
  subtitle: { color: COLOR.sub, fontSize: 12, marginTop: 2, fontFamily: FONT.body },

  addBtn: {
    backgroundColor: COLOR.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
  },
  addBtnText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuBtn: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    ...ELEVATION.card,
  },
  menuBtnText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  quizNavBtn: {
    backgroundColor: COLOR.tint,
    borderColor: "rgba(29,78,216,0.28)",
  },
  quizNavBtnText: { color: COLOR.primary },

  searchWrap: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    ...ELEVATION.card,
  },
  searchInput: { flex: 1, color: COLOR.text, fontSize: 15, fontFamily: FONT.body },

  segmentWrap: { marginTop: 10, paddingHorizontal: 16 },
  classRowHead: {
    marginTop: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  classRowTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 13 },
  clearChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    borderRadius: 999,
    backgroundColor: COLOR.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearChipText: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 11 },
  levelRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2, gap: 8 },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
  },
  levelChipActive: {
    borderColor: "transparent",
    backgroundColor: COLOR.primary,
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  levelChipText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  levelChipTextActive: { color: "#fff" },
  levelCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    backgroundColor: COLOR.muted,
  },
  levelCountActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  levelCountText: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 11 },
  levelCountTextActive: { color: "#fff" },

  levelCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    overflow: "hidden",
    ...ELEVATION.card,
  },
  levelHead: { paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  levelTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  levelSub: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12, marginTop: 2 },
  levelBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLOR.border, padding: 10, gap: 8 },

  subjectCard: {
    backgroundColor: COLOR.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  subjectHead: { paddingHorizontal: 10, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subjectTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 13, flex: 1, paddingRight: 10 },
  subjectRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  subjectCount: {
    minWidth: 22,
    textAlign: "center",
    color: COLOR.sub,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    overflow: "hidden",
  },
  subjectBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLOR.border, padding: 8, gap: 8 },

  courseCard: {
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    borderRadius: RADIUS.md,
    padding: 10,
    gap: 8,
    ...ELEVATION.card,
  },
  courseHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  courseTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 13 },
  courseMeta: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 11, marginTop: 2 },
  courseActions: { flexDirection: "row", gap: 8 },
  courseActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    backgroundColor: COLOR.muted,
  },
  courseActionTxt: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },

  chapterList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLOR.border, paddingTop: 8, gap: 6 },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: COLOR.muted,
  },
  chapterText: { flex: 1, color: COLOR.text, fontFamily: FONT.body, fontSize: 12 },
  chapterEmpty: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12 },

  gridItem: { flexBasis: "48%", minWidth: 160, marginTop: 12 },

  emptyWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    ...ELEVATION.card,
  },
  emptyIcon: { borderRadius: 12, padding: 8, marginBottom: 6, height: 28, width: 28 },
  emptyTitle: { color: COLOR.text, fontSize: 16, fontFamily: FONT.headingAlt },
  emptySub: { color: COLOR.sub, fontSize: 13, fontFamily: FONT.body },

  fabWrap: {
    position: "absolute",
    right: 16,
    bottom: 24,
    borderRadius: 999,
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fab: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  fabText: { color: "#fff", fontFamily: FONT.bodyBold },

  menuRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11, 17, 32, 0.28)" },
  menuBackdrop: { ...StyleSheet.absoluteFillObject },
  menuSheet: {
    maxHeight: "88%",
    backgroundColor: COLOR.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.border,
  },
  menuGrabber: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLOR.border,
    marginTop: 10,
    marginBottom: 8,
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
    gap: 8,
  },
  menuTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 14, flex: 1 },
  menuCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
  },
  menuTreeContent: { paddingBottom: 8 },
  menuEmpty: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 13, paddingHorizontal: 16, paddingTop: 12 },
});





