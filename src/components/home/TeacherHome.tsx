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
import {
  getTeacherDashboard,
  type TeacherDashboardSnapshot,
} from "@/storage/teacherDashboard";
import { EMPTY_TEACHER_DASHBOARD } from "@/lib/teacherAnalytics";
import { greeting } from "@/lib/studentDashboard";

/**
 * Accueil du professeur.
 *
 * Ses questions sont : qui decroche, quelle question passe mal, qu'ai-je a
 * relire. Le catalogue de cours ne repond a aucune des trois : il vit dans
 * l'onglet Mes cours.
 */
export default function TeacherHome() {
  const { color, space, radius, elevation } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<TeacherDashboardSnapshot>(EMPTY_TEACHER_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getTeacherDashboard(30));
    } catch (e: any) {
      setError(e?.message || "Indicateurs indisponibles.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = (user?.name || "").trim().split(" ")[0];
  const hasContent = data.courseCount > 0 || data.quizCount > 0;

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
      <View style={{ paddingHorizontal: space.lg, gap: space.xxs }}>
        <Text variant="caption" tone="muted">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </Text>
        <View style={styles.titleRow}>
          <Text variant="title" style={styles.flex}>
            Vos classes
          </Text>
          {user?.isReviewer ? (
            <Pressable
              onPress={() => router.push("/(app)/review")}
              accessibilityRole="button"
              accessibilityLabel="File de relecture"
              style={[
                styles.iconBtn,
                { backgroundColor: color.surface, borderColor: color.border, borderRadius: radius.pill },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={19} color={color.primary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <SkeletonList count={3} />
        </View>
      ) : error ? (
        <EmptyState
          tone="error"
          title="Indicateurs indisponibles"
          message={error}
          actionLabel="Reessayer"
          onAction={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : !hasContent ? (
        <EmptyState
          icon="add-circle-outline"
          title="Rien a suivre pour l'instant"
          message="Creez un cours et soumettez-le a la relecture. Vos indicateurs se rempliront des que vos eleves l'ouvriront."
          actionLabel="Creer un cours"
          onAction={() => router.push("/(app)/course/new")}
        />
      ) : (
        <>
          <Section title="Sur 30 jours">
            <View style={[styles.statRow, { gap: space.xl }]}>
              <Stat value={String(data.learnerCount)} label="Eleves suivis" />
              <Stat
                value={`${Math.round(data.completionRate * 100)}`}
                unit="%"
                label="Completion"
              />
              <Stat value={String(data.quizAttemptsRecent)} label="Quiz passes" />
            </View>
          </Section>

          {/* Ce qui appelle une action passe avant ce qui informe. */}
          {data.atRiskLearners.length ? (
            <Section title="Eleves a suivre" meta={`${data.atRiskCount}`}>
              {data.atRiskLearners.slice(0, 5).map((learner) => (
                <View
                  key={learner.userId}
                  style={[
                    styles.row,
                    {
                      backgroundColor: color.surface,
                      borderColor: color.border,
                      borderRadius: radius.lg,
                      padding: space.lg,
                      gap: space.md,
                    },
                  ]}
                >
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {learner.name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {Math.round(learner.completionRate * 100)} % de progression ·{" "}
                      {learner.attempts} quiz
                    </Text>
                  </View>
                  <Badge tone="warning">A relancer</Badge>
                </View>
              ))}
              <Button
                onPress={() => router.push("/(app)/(tabs)/learners")}
                variant="ghost"
                size="sm"
                icon="people-outline"
              >
                Voir tous mes eleves
              </Button>
            </Section>
          ) : null}

          {data.weakQuestions.length ? (
            <Section title="Questions les plus ratees">
              {data.weakQuestions.slice(0, 4).map((q) => (
                <View
                  key={q.id}
                  style={[
                    styles.stack,
                    {
                      backgroundColor: color.surface,
                      borderColor: color.border,
                      borderRadius: radius.lg,
                      padding: space.lg,
                      gap: space.xs,
                    },
                  ]}
                >
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {q.quizTitle}
                  </Text>
                  <Text variant="body" numberOfLines={3}>
                    {q.prompt}
                  </Text>
                  <View style={[styles.titleRow, { gap: space.sm }]}>
                    <View style={[styles.bar, { backgroundColor: color.surfaceSunk }]}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.round(q.accuracy * 100)}%`,
                            backgroundColor: q.accuracy < 0.5 ? color.danger : color.warning,
                          },
                        ]}
                      />
                    </View>
                    <Text variant="captionStrong" tone={q.accuracy < 0.5 ? "danger" : "warning"}>
                      {Math.round(q.accuracy * 100)} %
                    </Text>
                  </View>
                  <Text variant="caption" tone="faint">
                    {q.attempts} reponses
                  </Text>
                </View>
              ))}
            </Section>
          ) : null}

          <Section title="Mon contenu">
            <View style={[styles.statRow, { gap: space.xl }]}>
              <Stat value={String(data.courseCount)} label="Cours" />
              <Stat value={String(data.coursesPublished)} label="Publies" />
              <Stat value={String(data.quizCount)} label="Quiz" />
            </View>
            <View style={[styles.actions, { gap: space.sm, marginTop: space.md }]}>
              <Button onPress={() => router.push("/(app)/course/new")} icon="add-circle-outline" size="sm">
                Nouveau cours
              </Button>
              <Button
                onPress={() => router.push("/(app)/live/new")}
                icon="calendar-outline"
                variant="ghost"
                size="sm"
              >
                Programmer un live
              </Button>
            </View>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

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
          <Text variant="caption" tone="warning">
            {meta}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
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
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  stack: { borderWidth: 1 },
  statRow: { flexDirection: "row" },
  statValue: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap" },
  bar: { flex: 1, height: 6, borderRadius: 999, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 999 },
});
