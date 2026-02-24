import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  Animated,
  Easing,
  Modal,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLOR, ELEVATION, FONT, RADIUS } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import type { Course } from "@/types/course";
import { watchCoursesOrdered } from "@/storage/courses";
import { watchInbox, hasUnread } from "@/storage/chat";
import { listRecentProgress } from "@/storage/progress";
import { listUpcoming } from "@/storage/lives";
import { getTeacherDashboard, type TeacherDashboardSnapshot } from "@/storage/teacherDashboard";
import CourseItem from "@/components/CourseItem";
import ResumeCard from "@/components/ResumeCard";
import SectionHeader from "@/components/SectionHeader";
import QuickAction from "@/components/QuickAction";
import { GRADE_LEVELS, normalizeCourseLevel } from "@/constants/gradeLevels";
import { COURSE_SUBJECTS, canonicalizeCourseSubject } from "@/constants/courseSubjects";
import { primeSmartStudentNotifications } from "@/lib/notifications";

const BG = ["#F4F7FC", "#EAF0FF", "#F1F7FF"] as const;
const ACCENT = ["#2F5BFF", "#5B85FF"] as const;
const SP = 12;

type FilterKey = "all" | "published" | "drafts" | "mine";
type SubjectGroup = { subject: string; courses: Course[]; chapters: number };
type LevelGroup = { level: string; subjects: SubjectGroup[]; courses: number; chapters: number };
type ResumeItem = {
  courseId: string;
  lessonId: string;
  courseTitle: string;
  lessonTitle: string;
  percent: number;
  startSec: number;
};

export default function Home() {
  const { user, canAccessAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const role = String((user as any)?.role || "");
  const isTeacher = !!(canAccessAdmin || role === "teacher");

  const [all, setAll] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>(isTeacher ? "mine" : "all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [unread, setUnread] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [openLevels, setOpenLevels] = useState<Record<string, boolean>>({});
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({});
  const [resumeItem, setResumeItem] = useState<ResumeItem | null>(null);
  const [teacherDash, setTeacherDash] = useState<TeacherDashboardSnapshot | null>(null);
  const [teacherDashLoading, setTeacherDashLoading] = useState(false);
  const notifLastRunRef = useRef(0);
  const teacherDashReveal = useRef(new Animated.Value(0)).current;

  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
    ).start();
  }, [shimmer]);

  useEffect(() => {
    setLoading(true);
    const unsub = watchCoursesOrdered((rows) => {
      setAll(rows || []);
      setLoading(false);
      setRefreshing(false);
    }, 100);
    return () => unsub?.();
  }, [refreshKey]);

  useEffect(() => {
    if (!user?.id) {
      setUnread(0);
      return;
    }
    const unsub = watchInbox(user.id, (rows) => {
      const count = rows.reduce((acc, t) => acc + (hasUnread(t, user.id) ? 1 : 0), 0);
      setUnread(count);
    });
    return () => unsub?.();
  }, [user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const courseById = useMemo(() => {
    const map = new Map<string, Course>();
    all.forEach((c) => {
      if (c?.id) map.set(c.id, c);
    });
    return map;
  }, [all]);

  useEffect(() => {
    if (!user?.id || isTeacher || !all.length) {
      setResumeItem(null);
      return;
    }
    let active = true;
    (async () => {
      const rows = await listRecentProgress(user.id, 20);
      if (!active) return;
      let picked: ResumeItem | null = null;
      for (const row of rows) {
        const course = courseById.get(row.courseId);
        if (!course?.published) continue;
        const lesson = (course.chapters || []).find((ch: any) => ch.id === row.lessonId);
        if (!lesson) continue;
        const duration = Math.max(0, Number(row.durationSec || 0));
        const watched = Math.max(0, Number(row.watchedSec || 0));
        const percent = duration > 0 ? Math.max(0, Math.min(1, watched / duration)) : 0;
        picked = {
          courseId: course.id,
          lessonId: lesson.id,
          courseTitle: course.title || "Cours",
          lessonTitle: lesson.title || "Chapitre",
          percent,
          startSec: Math.floor(watched),
        };
        break;
      }
      setResumeItem(picked);
    })();
    return () => {
      active = false;
    };
  }, [user?.id, isTeacher, all.length, refreshKey, courseById]);

  useEffect(() => {
    if (!isTeacher || !user?.id) {
      setTeacherDash(null);
      return;
    }
    let active = true;
    setTeacherDashLoading(true);
    getTeacherDashboard(user.id)
      .then((snap) => {
        if (active) setTeacherDash(snap);
      })
      .catch(() => {
        if (active) setTeacherDash(null);
      })
      .finally(() => {
        if (active) setTeacherDashLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isTeacher, user?.id, refreshKey, all.length]);

  useEffect(() => {
    if (!isTeacher) {
      teacherDashReveal.setValue(1);
      return;
    }
    teacherDashReveal.setValue(0);
    const anim = Animated.timing(teacherDashReveal, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [isTeacher, refreshKey, teacherDashReveal]);

  useEffect(() => {
    if (!user?.id || isTeacher || !all.length) return;
    const now = Date.now();
    if (now - notifLastRunRef.current < 45_000) return;
    notifLastRunRef.current = now;
    (async () => {
      const [upcomingLives, progressRows] = await Promise.all([
        listUpcoming(),
        listRecentProgress(user.id, 12),
      ]);
      const hasPendingWork = progressRows.some((r) => {
        const watched = Number(r.watchedSec || 0);
        const duration = Number(r.durationSec || 0);
        if (duration > 0) return watched > 60 && watched < duration * 0.9;
        return watched > 300;
      });
      await primeSmartStudentNotifications({
        userId: user.id,
        courses: all.map((c) => ({
          id: c.id,
          title: c.title,
          published: c.published,
          updatedAtMs: (c as any).updatedAtMs,
          createdAtMs: (c as any).createdAtMs,
        })),
        lives: (upcomingLives || []).map((l: any) => ({
          id: l.id,
          title: l.title,
          startAt: l.startAt,
          status: l.status,
        })),
        hasPendingWork,
      });
    })().catch(() => {});
  }, [user?.id, isTeacher, all]);

  const recent = useMemo(() => {
    const meId = user?.id;
    const base = isTeacher
      ? all.filter((c) => c.ownerId === meId)
      : all.filter((c) => c.published);

    const q = search.trim().toLowerCase();
    const filtered = q
      ? base.filter((c) => {
          const t = (c.title || "").toLowerCase();
          const d = (c.description || "").toLowerCase();
          return t.includes(q) || d.includes(q);
        })
      : base;

    const byTab =
      filter === "published"
        ? filtered.filter((c) => !!c.published)
        : filter === "drafts"
        ? filtered.filter((c) => !c.published)
        : filter === "mine"
        ? filtered.filter((c) => c.ownerId === meId)
        : filtered;

    return byTab.slice(0, 8);
  }, [all, user?.id, isTeacher, search, filter]);

  const stats = useMemo(() => {
    const meId = user?.id;
    const mine = meId ? all.filter((c) => c.ownerId === meId) : [];
    const published = mine.filter((c) => c.published);
    const drafts = mine.filter((c) => !c.published);
    return { total: mine.length, published: published.length, drafts: drafts.length };
  }, [all, user?.id]);

  const teacherCompletionPct = teacherDash ? Math.round(teacherDash.completionRate * 100) : 0;
  const teacherKpis = useMemo(
    () =>
      teacherDash
        ? [
            {
              key: "completion",
              label: "Completion",
              value: `${teacherCompletionPct}%`,
              icon: "trending-up-outline" as const,
              tint: "#DBEAFE",
              tone: "#1D4ED8",
            },
            {
              key: "learners",
              label: "Eleves actifs",
              value: String(teacherDash.learnerCount),
              icon: "people-outline" as const,
              tint: "#DBEAFE",
              tone: "#15803D",
            },
            {
              key: "quizzes",
              label: "Quiz passes",
              value: String(teacherDash.quizAttempts),
              icon: "help-circle-outline" as const,
              tint: "#FFE7CC",
              tone: "#C2410C",
            },
            {
              key: "risk",
              label: "A risque",
              value: String(teacherDash.atRiskCount),
              icon: "alert-circle-outline" as const,
              tint: "#FEE2E2",
              tone: "#B91C1C",
            },
          ]
        : [],
    [teacherDash, teacherCompletionPct]
  );

  const badge = unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;

  const menuSource = useMemo(() => {
    const base = isTeacher ? all.filter((c) => c.ownerId === user?.id) : all.filter((c) => c.published);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.subject || "").toLowerCase().includes(q) ||
        (c.level || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.ownerName || "").toLowerCase().includes(q)
    );
  }, [all, isTeacher, search, user?.id]);

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
    for (const course of menuSource) {
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
  }, [isTeacher, levelRank, menuSource, subjectRank]);

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

  const Greeting = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 10 }}>
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          {!isTeacher ? (
            <Pressable onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
              <Ionicons name="list-outline" size={16} color={COLOR.text} />
              <Text style={styles.menuBtnText}>Menu</Text>
            </Pressable>
          ) : null}
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{isTeacher ? "Espace prof" : "Espace eleve"}</Text>
          </View>
        </View>
        <View style={styles.heroRight}>
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/quizzes")}
            style={styles.quizBtn}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les quiz"
          >
            <MaterialCommunityIcons name="brain" size={18} color={COLOR.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/messages")}
            style={styles.msgBtn}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les messages"
          >
            <MaterialCommunityIcons name="message-text-outline" size={18} color={COLOR.text} />
            {badge ? (
              <View style={styles.msgBadge}>
                <Text style={styles.msgBadgeText}>{badge}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <Text style={styles.hello}>Bonjour, {user?.name || "ami"}</Text>
      <Text style={styles.subHello}>
        {isTeacher ? "Pilote tes cours et lives depuis un tableau clair." : "Reprends la progression la plus utile aujourd'hui."}
      </Text>
    </View>
  );

  const FilterChips = () => {
    const CHIP_ORDER: FilterKey[] = isTeacher ? ["mine", "published", "drafts", "all"] : ["all"];
    const LABEL: Record<FilterKey, string> = { all: "Tous", published: "Publies", drafts: "Brouillons", mine: "Mes cours" };
    if (CHIP_ORDER.length <= 1) return null;
    return (
      <View style={styles.chipsRow}>
        {CHIP_ORDER.map((k) => {
          const active = filter === k;
          return (
            <Pressable
              key={k}
              onPress={() => setFilter(k)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              {active ? <LinearGradient colors={ACCENT} style={styles.chipActiveBg} /> : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{LABEL[k]}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const AdminActions = () =>
    !isTeacher ? null : (
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <SectionHeader title="Actions rapides" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsRow}
          keyboardShouldPersistTaps="handled"
        >
          <QuickAction
            label="Creer un cours"
            style={styles.actionPill}
            left={<Ionicons name="add-circle" size={18} color={COLOR.text} />}
            onPress={() => router.push("/(app)/course/new")}
          />
          <QuickAction
            label="Mes cours"
            style={styles.actionPill}
            left={<Ionicons name="folder-open-outline" size={18} color={COLOR.text} />}
            onPress={() => router.push("/(app)/course/mine")}
          />
          <QuickAction
            label="Programmer un live"
            style={styles.actionPill}
            left={<MaterialCommunityIcons name="calendar-clock" size={18} color={COLOR.text} />}
            onPress={() => router.push("/(app)/live/new")}
          />
          <QuickAction
            label="Quiz autonomes"
            style={styles.actionPill}
            left={<MaterialCommunityIcons name="brain" size={18} color={COLOR.text} />}
            onPress={() => router.push("/(app)/(tabs)/quizzes")}
          />
        </ScrollView>

        <View style={styles.statsRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <StatCard label="Total" value={stats.total} />
          </View>
          <View style={{ flex: 1, marginRight: 10 }}>
            <StatCard label="Publies" value={stats.published} />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard label="Brouillons" value={stats.drafts} />
          </View>
        </View>

        <Animated.View
          style={[
            styles.teacherDashCard,
            {
              opacity: teacherDashReveal,
              transform: [
                {
                  translateY: teacherDashReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["#F3F7FF", "#EEF3FF", "#FFFFFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.teacherDashHead}
          >
            <View style={styles.teacherDashHeadIcon}>
              <Ionicons name="analytics-outline" size={16} color={COLOR.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.teacherDashTitle}>Tableau de bord prof</Text>
              <Text style={styles.teacherDashHeadCaption}>Vue rapide des cours, quiz et eleves a suivre.</Text>
            </View>
          </LinearGradient>
          {teacherDashLoading ? (
            <View style={styles.teacherDashBody}>
              <Text style={styles.teacherDashEmpty}>Chargement des indicateurs...</Text>
            </View>
          ) : teacherDash ? (
            <View style={styles.teacherDashBody}>
              <View style={styles.teacherDashMeterBox}>
                <View style={styles.teacherDashMeterRow}>
                  <Text style={styles.teacherDashMeterLabel}>Completion globale</Text>
                  <Text style={styles.teacherDashMeterValue}>{teacherCompletionPct}%</Text>
                </View>
                <View style={styles.teacherDashMeterTrack}>
                  <View style={[styles.teacherDashMeterFill, { width: `${Math.max(0, Math.min(100, teacherCompletionPct))}%` }]} />
                </View>
              </View>

              <View style={styles.teacherDashKpiRow}>
                {teacherKpis.map((kpi) => (
                  <View key={kpi.key} style={styles.teacherDashKpi}>
                    <View style={styles.teacherDashKpiTop}>
                      <Text style={styles.teacherDashKpiValue}>{kpi.value}</Text>
                      <View style={[styles.teacherDashKpiIcon, { backgroundColor: kpi.tint }]}>
                        <Ionicons name={kpi.icon} size={14} color={kpi.tone} />
                      </View>
                    </View>
                    <Text style={styles.teacherDashKpiLabel}>{kpi.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.teacherDashSection}>
                <View style={styles.teacherDashSubTitleRow}>
                  <Ionicons name="bulb-outline" size={14} color={COLOR.sub} />
                  <Text style={styles.teacherDashSubTitle}>Questions a retravailler</Text>
                </View>
                {teacherDash.weakQuestions.length ? (
                  <View style={styles.teacherDashList}>
                    {teacherDash.weakQuestions.slice(0, 3).map((q) => (
                      <View key={q.id} style={styles.teacherDashListItem}>
                        <View style={styles.teacherDashLineTop}>
                          <Text style={styles.teacherDashLineTitle} numberOfLines={1}>
                            {q.quizTitle}
                          </Text>
                          <Text style={styles.teacherDashLineBadge}>{Math.round(q.accuracy * 100)}%</Text>
                        </View>
                        <Text style={styles.teacherDashLine} numberOfLines={2}>
                          {q.prompt}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.teacherDashEmpty}>Pas assez de tentatives pour analyser les questions.</Text>
                )}
              </View>

              <View style={styles.teacherDashSection}>
                <View style={styles.teacherDashSubTitleRow}>
                  <Ionicons name="pulse-outline" size={14} color={COLOR.sub} />
                  <Text style={styles.teacherDashSubTitle}>Eleves a suivre</Text>
                </View>
                {teacherDash.atRiskLearners.length ? (
                  <View style={styles.teacherDashList}>
                    {teacherDash.atRiskLearners.slice(0, 3).map((s) => (
                      <View key={s.userId} style={styles.teacherDashListItem}>
                        <View style={styles.teacherDashLineTop}>
                          <Text style={styles.teacherDashLineTitle} numberOfLines={1}>
                            {s.name}
                          </Text>
                          <Text style={[styles.teacherDashLineBadge, styles.teacherDashLineBadgeRisk]}>
                            {Math.round(s.completionRate * 100)}%
                          </Text>
                        </View>
                        <Text style={styles.teacherDashLine}>
                          {s.attempts} tentative{s.attempts > 1 ? "s" : ""} de quiz
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.teacherDashEmpty}>Aucun eleve en difficultes marquees.</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.teacherDashBody}>
              <Text style={styles.teacherDashEmpty}>Indicateurs indisponibles.</Text>
            </View>
          )}
        </Animated.View>
      </View>
    );

  const ResumeSection = () =>
    isTeacher || !resumeItem ? null : (
      <View style={{ paddingHorizontal: 16, paddingTop: 2 }}>
        <SectionHeader title="Reprendre" />
        <ResumeCard item={resumeItem} />
      </View>
    );

  const RecentHeader = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <SectionHeader title={isTeacher ? "Vos cours recents" : "Cours recents"} href="/(app)/(tabs)/courses" />
    </View>
  );

  const ListHeader = (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
      <Greeting />
      <View style={styles.searchWrap} accessible accessibilityRole="search">
        <Ionicons name="search" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un cours"
          placeholderTextColor={COLOR.sub}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Champ de recherche"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityLabel="Effacer la recherche">
            <Ionicons name="close" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
          </Pressable>
        )}
      </View>
      <FilterChips />
      <ResumeSection />
      <AdminActions />
      <RecentHeader />
    </LinearGradient>
  );

  const ListEmpty = loading ? (
    <SkeletonGrid shimmer={shimmer} />
  ) : (
    <EmptyState
      isTeacher={isTeacher}
      onCreate={() => router.push("/(app)/course/new")}
      onExplore={() => router.push("/(app)/(tabs)/courses")}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={recent}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <CourseItem item={item} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLOR.text}
            colors={[COLOR.text]}
            progressBackgroundColor={COLOR.surface}
          />
        }
      />

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
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard} accessibilityRole="text" accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({
  isTeacher,
  onCreate,
  onExplore,
}: {
  isTeacher: boolean;
  onCreate: () => void;
  onExplore: () => void;
}) {
  return (
    <View style={styles.emptyWrap}>
      <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>
        {isTeacher ? "Creez un cours pour commencer." : "Aucun cours disponible pour l'instant."}
      </Text>
      <Text style={styles.emptySub}>
        {isTeacher ? "Publiez vos premieres lecons ou programmez un live." : "Revenez plus tard ou explorez tous les cours."}
      </Text>

      <View style={styles.emptyCtasRow}>
        {isTeacher ? (
          <>
            <PrimaryButton label="Creer un cours" onPress={onCreate} />
            <GhostButton label="Voir tous les cours" onPress={onExplore} />
          </>
        ) : (
          <PrimaryButton label="Voir tous les cours" onPress={onExplore} />
        )}
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryBtn} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGrad}>
        <Text style={styles.primaryBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.ghostBtn} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.ghostBtnText}>{label}</Text>
    </Pressable>
  );
}

function SkeletonGrid({ shimmer }: { shimmer: Animated.Value }) {
  const items = Array.from({ length: 6 }).map((_, i) => i);
  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });
  return (
    <View style={styles.skeletonGrid}>
      {items.map((i) => (
        <View key={i} style={styles.skelCard}>
          <View style={styles.skelCover}>
            <Animated.View style={[styles.skelSheen, { transform: [{ translateX }] }]} />
          </View>
          <View style={styles.skelLineShort}>
            <Animated.View style={[styles.skelSheenThin, { transform: [{ translateX }] }]} />
          </View>
          <View style={styles.skelLineLong}>
            <Animated.View style={[styles.skelSheenThin, { transform: [{ translateX }] }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },

  headerBg: { paddingBottom: 10 },
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroRight: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  heroBadge: {
    backgroundColor: COLOR.tint,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.ring,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 12 },
  hello: { color: COLOR.text, fontSize: 26, fontFamily: FONT.heading, marginTop: 10 },
  subHello: { color: COLOR.sub, fontSize: 13, marginTop: 4, fontFamily: FONT.body },

  searchWrap: {
    marginTop: 14,
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

  chipsRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 8 },
  chip: {
    position: "relative",
    backgroundColor: COLOR.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    overflow: "hidden",
  },
  chipActive: {
    borderColor: "transparent",
    shadowColor: "#2a6df5",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  chipActiveBg: { ...StyleSheet.absoluteFillObject, opacity: 0.2, borderRadius: 999 },
  chipText: { color: COLOR.sub, fontSize: 12, fontFamily: FONT.bodyBold },
  chipTextActive: { color: COLOR.text },

  actionsRow: { flexDirection: "row", marginTop: 4, gap: 10, paddingBottom: 10, paddingRight: 4 },
  actionPill: { flexShrink: 0 },
  statsRow: { flexDirection: "row", marginTop: 6 },

  statCard: {
    flex: 1,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    ...ELEVATION.card,
  },
  statValue: { color: COLOR.text, fontSize: 18, fontFamily: FONT.headingAlt },
  statLabel: { color: COLOR.sub, fontSize: 12, marginTop: 2, fontFamily: FONT.body },

  teacherDashCard: {
    marginTop: 10,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    ...ELEVATION.card,
  },
  teacherDashHead: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },
  teacherDashHeadIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(29, 78, 216, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  teacherDashHeadCaption: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12, marginTop: 2 },
  teacherDashBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  teacherDashTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  teacherDashMeterBox: {
    backgroundColor: COLOR.muted,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  teacherDashMeterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teacherDashMeterLabel: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },
  teacherDashMeterValue: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 13 },
  teacherDashMeterTrack: {
    marginTop: 8,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#DDE4EF",
    overflow: "hidden",
  },
  teacherDashMeterFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLOR.primary,
  },
  teacherDashKpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  teacherDashKpi: {
    minWidth: "47%",
    flex: 1,
    backgroundColor: COLOR.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  teacherDashKpiTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teacherDashKpiIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  teacherDashKpiValue: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 17 },
  teacherDashKpiLabel: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 11, marginTop: 2 },
  teacherDashSection: { marginTop: 2 },
  teacherDashSubTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  teacherDashSubTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  teacherDashList: { gap: 6 },
  teacherDashListItem: {
    backgroundColor: COLOR.muted,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  teacherDashLineTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  teacherDashLineTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12, flex: 1 },
  teacherDashLineBadge: {
    color: COLOR.primary,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    backgroundColor: COLOR.tint,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  teacherDashLineBadgeRisk: {
    color: "#B91C1C",
    backgroundColor: "#FEE2E2",
  },
  teacherDashLine: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12, marginTop: 3 },
  teacherDashEmpty: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12 },

  emptyWrap: {
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    alignItems: "flex-start",
  },
  emptyIcon: { borderRadius: 12, padding: 8, marginBottom: 6, height: 28, width: 28 },
  emptyTitle: { color: COLOR.text, fontSize: 16, fontFamily: FONT.headingAlt },
  emptySub: { color: COLOR.sub, fontSize: 13, fontFamily: FONT.body },

  emptyCtasRow: { flexDirection: "row", marginTop: 8 },
  primaryBtn: { borderRadius: 12, overflow: "hidden", marginRight: 10 },
  primaryBtnGrad: { paddingHorizontal: 12, paddingVertical: 8 },
  primaryBtnText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 13 },

  ghostBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    backgroundColor: "transparent",
  },
  ghostBtnText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 13 },

  msgBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
  },
  quizBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLOR.tint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(29, 78, 216, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  msgBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: COLOR.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLOR.bg,
  },
  msgBadgeText: { color: "#fff", fontSize: 10, fontFamily: FONT.bodyBold },

  levelCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    overflow: "hidden",
  },
  levelHead: { paddingHorizontal: 12, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  levelTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  levelSub: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12, marginTop: 2 },
  levelBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLOR.border, padding: 10, gap: 8 },

  subjectCard: {
    backgroundColor: COLOR.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    borderRadius: 12,
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
    borderRadius: 12,
    padding: 10,
    gap: 8,
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

  menuRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11, 17, 32, 0.28)" },
  menuBackdrop: { ...StyleSheet.absoluteFillObject },
  menuSheet: {
    maxHeight: "88%",
    backgroundColor: COLOR.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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

  skeletonGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", marginRight: -SP },
  skelCard: {
    width: "48%",
    minWidth: 150,
    backgroundColor: COLOR.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    padding: 10,
    marginRight: SP,
    marginTop: SP,
  },
  skelCover: { height: 90, borderRadius: 10, overflow: "hidden", backgroundColor: COLOR.muted, marginBottom: 10 },
  skelLineShort: { height: 12, width: "65%", borderRadius: 8, overflow: "hidden", backgroundColor: COLOR.muted, marginBottom: 8 },
  skelLineLong: { height: 10, width: "90%", borderRadius: 8, overflow: "hidden", backgroundColor: COLOR.muted },
  skelSheen: { position: "absolute", top: 0, bottom: 0, width: 80, backgroundColor: "rgba(255,255,255,0.5)" },
  skelSheenThin: { position: "absolute", top: 0, bottom: 0, width: 60, backgroundColor: "rgba(255,255,255,0.5)" },
});













