import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import FilterChips, { type FilterOption } from "@/components/catalog/FilterChips";
import { listQuizzes, type Quiz } from "@/storage/quizzes";

/**
 * Quiz.
 *
 * L'ecran melangeait deux idees : parcourir les quiz disponibles et gerer les
 * siens. Le role decide desormais lequel on voit.
 */
export default function Quizzes() {
  const { color, space, radius } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isTeacher = String(user?.role || "") === "teacher";

  const [rows, setRows] = useState<Quiz[]>([]);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(
        await listQuizzes(
          isTeacher
            ? { ownerId: user?.id, limit: 200 }
            : { publishedOnly: true, limit: 200 }
        )
      );
    } catch (e: any) {
      setError(e?.message || "Quiz indisponibles.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isTeacher, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const subjectOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const q of rows) {
      const key = q.subject?.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const list = Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "fr", { sensitivity: "base" }))
      .map(([label, count]) => ({ key: label, label, count }));
    return [{ key: "all", label: "Toutes", count: rows.length }, ...list];
  }, [rows]);

  useEffect(() => {
    if (subjectOptions.some((o) => o.key === subject)) return;
    setSubject("all");
  }, [subjectOptions, subject]);

  const filtered = useMemo(() => {
    let base = rows;
    if (subject !== "all") base = base.filter((q) => q.subject === subject);
    const needle = query.trim().toLowerCase();
    if (needle) {
      base = base.filter(
        (q) =>
          q.title?.toLowerCase().includes(needle) ||
          q.subject?.toLowerCase().includes(needle) ||
          q.courseTitle?.toLowerCase().includes(needle)
      );
    }
    return base;
  }, [rows, subject, query]);

  const hasFilters = !!query.trim() || subject !== "all";

  return (
    <View style={[styles.root, { backgroundColor: color.bg }]}>
      <View style={{ paddingTop: insets.top + space.lg, gap: space.md }}>
        <View style={[styles.headRow, { paddingHorizontal: space.lg, gap: space.md }]}>
          <View style={styles.flex}>
            <Text variant="title">Quiz</Text>
            <Text variant="caption" tone="muted">
              {isTeacher
                ? "Ceux que vous avez ecrits"
                : "Vérifié ce que tu as vraiment compris"}
            </Text>
          </View>
          {isTeacher ? (
            <Pressable
              onPress={() => router.push("/(app)/course/quiz?mode=standalone")}
              accessibilityRole="button"
              accessibilityLabel="Créer un quiz"
              style={[styles.iconBtn, { backgroundColor: color.primary, borderRadius: radius.pill }]}
            >
              <Ionicons name="add" size={22} color={color.textOnPrimary} />
            </Pressable>
          ) : null}
        </View>

        <View
          style={[
            styles.search,
            {
              marginHorizontal: space.lg,
              borderColor: color.borderInteractive,
              backgroundColor: color.surfaceSunk,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              gap: space.sm,
            },
          ]}
        >
          <Ionicons name="search-outline" size={17} color={color.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher un quiz"
            placeholderTextColor={color.textFaint}
            style={[styles.searchInput, { color: color.text }]}
            returnKeyType="search"
            accessibilityLabel="Chercher un quiz"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Effacer">
              <Ionicons name="close-circle" size={17} color={color.textFaint} />
            </Pressable>
          ) : null}
        </View>

        {subjectOptions.length > 2 ? (
          <FilterChips
            options={subjectOptions}
            value={subject}
            onChange={setSubject}
            accessibilityLabel="Matière"
          />
        ) : null}
      </View>

      {loading ? (
        <View style={{ padding: space.lg }}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: space.lg,
            paddingBottom: insets.bottom + 120,
            gap: space.sm,
          }}
          keyboardShouldPersistTaps="handled"
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(
                  item.scope === "lesson" && item.courseId && item.lessonId
                    ? `/(app)/course/quiz?courseId=${item.courseId}&lessonId=${item.lessonId}`
                    : `/(app)/course/quiz?quizId=${item.id}`
                )
              }
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: color.surface,
                  borderColor: color.border,
                  borderRadius: radius.lg,
                  padding: space.lg,
                  gap: space.sm,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={[styles.cardHead, { gap: space.md }]}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: color.primarySoft, borderRadius: radius.md },
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={19} color={color.primaryInk} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {[
                      item.subject,
                      item.level,
                      `${item.questions.length} question${item.questions.length > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
              </View>

              {/* Le professeur a besoin du statut ; l'eleve, du rattachement. */}
              {isTeacher ? (
                <Badge
                  tone={
                    item.status === "published"
                      ? "success"
                      : item.status === "in_review"
                      ? "warning"
                      : item.status === "rejected"
                      ? "danger"
                      : "neutral"
                  }
                >
                  {item.status === "published"
                    ? "Publié"
                    : item.status === "in_review"
                    ? "En relecture"
                    : item.status === "rejected"
                    ? "A corriger"
                    : "Brouillon"}
                </Badge>
              ) : item.courseTitle ? (
                <Text variant="caption" tone="faint" numberOfLines={1}>
                  Rattache a {item.courseTitle}
                </Text>
              ) : (
                <Badge tone="primary">Quiz libre</Badge>
              )}
            </Pressable>
          )}
          ListHeaderComponent={
            filtered.length ? (
              <Text variant="caption" tone="muted" style={{ marginBottom: space.xs }}>
                {filtered.length} quiz
              </Text>
            ) : null
          }
          ListEmptyComponent={
            error ? (
              <EmptyState
                tone="error"
                title="Quiz indisponibles"
                message={error}
                actionLabel="Réessayer"
                onAction={() => {
                  setLoading(true);
                  void load();
                }}
              />
            ) : hasFilters ? (
              <EmptyState
                icon="search-outline"
                title="Aucun resultat"
                message="Aucun quiz ne correspond a cette recherche."
                actionLabel="Effacer les filtres"
                onAction={() => {
                  setQuery("");
                  setSubject("all");
                }}
              />
            ) : isTeacher ? (
              <EmptyState
                icon="add-circle-outline"
                title="Aucun quiz ecrit"
                message="Un quiz rattache a un chapitre verifie ce que vos eleves ont compris. Un quiz libre sert d'entrainement."
                actionLabel="Ecrire un quiz"
                onAction={() => router.push("/(app)/course/quiz?mode=standalone")}
              />
            ) : (
              <EmptyState
                icon="checkmark-circle-outline"
                title="Pas encore de quiz"
                message="Aucun quiz n'est publié pour ta classe. Regarde d'abord un cours : la plupart en proposent un a la fin."
                actionLabel="Voir les cours"
                onAction={() => router.push("/(app)/(tabs)/courses")}
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  headRow: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", borderWidth: 1, minHeight: 46 },
  searchInput: { flex: 1, paddingVertical: 11 },
  card: { borderWidth: 1 },
  cardHead: { flexDirection: "row", alignItems: "center" },
  icon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
});
