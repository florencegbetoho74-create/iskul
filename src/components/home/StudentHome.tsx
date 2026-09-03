import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import WeeklyBars from "@/components/home/WeeklyBars";
import { getStudentDashboard } from "@/storage/studentDashboard";
import {
  EMPTY_STUDENT_DASHBOARD,
  currentStreak,
  greeting,
  liveCountdown,
  type StudentDashboard,
} from "@/lib/studentDashboard";

/**
 * Accueil de l'eleve.
 *
 * L'ecran precedent etait un second catalogue, avec arbres deplians par niveau
 * et matiere, qui doublait l'onglet Cours. Il devient un point de depart :
 * reprendre, ce qu'il reste a faire, la progression, les nouveautes.
 */
export default function StudentHome() {
  const { color, space, radius, elevation } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<StudentDashboard>(EMPTY_STUDENT_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getStudentDashboard(7));
    } catch (e: any) {
      setError(e?.message || "Tableau de bord indisponible.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const streak = currentStreak(data.weekly);
  const firstName = (user?.name || "").trim().split(" ")[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: insets.bottom + 120,
        gap: space.xxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={color.primary}
        />
      }
    >
      {/* --- Salutation --- */}
      <View style={{ paddingHorizontal: space.lg, gap: space.xxs }}>
        <Text variant="caption" tone="muted">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </Text>
        <View style={[styles.titleRow, { gap: space.md }]}>
          <Text variant="title" style={styles.flex}>
            {user?.grade ? `Ta classe de ${user.grade}` : "Ton espace"}
          </Text>
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/messages")}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les messages"
            style={[
              styles.iconBtn,
              { backgroundColor: color.surface, borderColor: color.border, borderRadius: radius.pill },
            ]}
          >
            <Ionicons name="chatbubbles-outline" size={19} color={color.text} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <SkeletonList count={3} />
        </View>
      ) : error ? (
        <EmptyState
          tone="error"
          title="Impossible de charger ton espace"
          message={error}
          actionLabel="Reessayer"
          onAction={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : (
        <>
          {/* --- Reprendre : l'action la plus probable en ouvrant l'app --- */}
          {data.resume ? (
            <Section title="Reprendre">
              <Pressable
                onPress={() =>
                  router.push(
                    `/(app)/course/play?courseId=${data.resume!.courseId}&lessonId=${data.resume!.lessonId}&startSec=${data.resume!.watchedSec}`
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Reprendre ${data.resume.lessonTitle}`}
                style={({ pressed }) => [
                  styles.resume,
                  {
                    backgroundColor: color.surface,
                    borderColor: color.border,
                    borderRadius: radius.lg,
                    padding: space.lg,
                    gap: space.sm,
                  },
                  elevation(1),
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {data.resume.courseTitle}
                </Text>
                <Text variant="subheading" numberOfLines={2}>
                  {data.resume.lessonTitle}
                </Text>
                <View style={[styles.progressTrack, { backgroundColor: color.surfaceSunk }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(data.resume.percent * 100)}%`, backgroundColor: color.primary },
                    ]}
                  />
                </View>
                <View style={[styles.titleRow, { gap: space.sm }]}>
                  <Text variant="caption" tone="primary" style={styles.flex}>
                    {Math.round(data.resume.percent * 100)} % termine
                  </Text>
                  <Ionicons name="play-circle" size={26} color={color.primary} />
                </View>
              </Pressable>
            </Section>
          ) : null}

          {/* --- Aujourd'hui : ce qui demande une action --- */}
          {data.nextLive || data.pendingQuizzes.length ? (
            <Section title="Aujourd'hui">
              {data.nextLive ? (
                <Pressable
                  onPress={() => router.push(`/(app)/live/${data.nextLive!.liveId}`)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: color.surface,
                      borderColor: data.nextLive!.status === "live" ? color.danger : color.border,
                      borderRadius: radius.lg,
                      padding: space.lg,
                      gap: space.md,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name="radio"
                    size={20}
                    color={data.nextLive.status === "live" ? color.danger : color.primary}
                  />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {data.nextLive.title}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {liveCountdown(data.nextLive.startAtMs)}
                      {data.nextLive.ownerName ? ` · ${data.nextLive.ownerName}` : ""}
                    </Text>
                  </View>
                  {data.nextLive.status === "live" ? (
                    <Badge tone="danger" solid>
                      En direct
                    </Badge>
                  ) : null}
                </Pressable>
              ) : null}

              {data.pendingQuizzes.map((quiz) => (
                <Pressable
                  key={quiz.quizId}
                  onPress={() => router.push(`/(app)/course/quiz?quizId=${quiz.quizId}`)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: color.surface,
                      borderColor: color.border,
                      borderRadius: radius.lg,
                      padding: space.lg,
                      gap: space.md,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={color.primary} />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {quiz.title}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {quiz.subject || "Quiz"} · jamais tente
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
                </Pressable>
              ))}
            </Section>
          ) : null}

          {/* --- Ma semaine --- */}
          <Section
            title="Ma semaine"
            meta={streak > 1 ? `${streak} jours d'affilee` : undefined}
          >
            <WeeklyBars data={data.weekly} />
            <View style={[styles.statRow, { gap: space.xl, marginTop: space.md }]}>
              <Stat value={`${data.totals.minutesThisPeriod}`} unit="min" label="Temps passe" />
              <Stat value={`${data.totals.lessonsCompleted}`} label="Lecons finies" />
              <Stat
                value={data.totals.quizAttempts ? `${Math.round(data.totals.quizAvgScorePct)}` : "—"}
                unit={data.totals.quizAttempts ? "%" : undefined}
                label="Moyenne quiz"
              />
            </View>
          </Section>

          {/* --- Nouveautes non ouvertes --- */}
          {data.freshCourses.length ? (
            <Section title="Nouveau dans ta classe">
              {data.freshCourses.slice(0, 4).map((course) => (
                <Pressable
                  key={course.courseId}
                  onPress={() => router.push(`/(app)/course/${course.courseId}`)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: color.surface,
                      borderColor: color.border,
                      borderRadius: radius.lg,
                      padding: space.lg,
                      gap: space.md,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: color.primarySoft, borderRadius: radius.sm },
                    ]}
                  >
                    <Ionicons name="book-outline" size={17} color={color.primaryInk} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {course.title}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {course.subject || "Cours"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
                </Pressable>
              ))}
              <Button
                onPress={() => router.push("/(app)/(tabs)/courses")}
                variant="ghost"
                size="sm"
                icon="grid-outline"
              >
                Voir tout le catalogue
              </Button>
            </Section>
          ) : null}

          {!data.resume && !data.freshCourses.length && !data.pendingQuizzes.length ? (
            <EmptyState
              icon="school-outline"
              title="Rien encore pour ta classe"
              message={
                user?.grade
                  ? `Aucun cours n'est publie pour la ${user.grade} pour le moment. Reviens bientot.`
                  : "Renseigne ta classe pour voir les cours qui te concernent."
              }
              actionLabel={user?.grade ? "Explorer le catalogue" : "Choisir ma classe"}
              onAction={() =>
                router.push(user?.grade ? "/(app)/(tabs)/courses" : "/(app)/profile/settings")
              }
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

/** Section a plat : un titre, un filet implicite, du contenu qui respire. */
function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  const { space } = useTheme();
  return (
    <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
      <View style={styles.titleRow}>
        <Text variant="heading" style={styles.flex}>
          {title}
        </Text>
        {meta ? (
          <Text variant="caption" tone="primary">
            {meta}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.flex}>
      <View style={styles.statValue}>
        <Text variant="title">{value}</Text>
        {unit ? (
          <Text variant="caption" tone="muted" style={{ marginBottom: 3 }}>
            {unit}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  resume: { borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  dot: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 999 },
  statRow: { flexDirection: "row" },
  statValue: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
});
