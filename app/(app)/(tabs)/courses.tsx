import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import CourseRow from "@/components/catalog/CourseRow";
import FilterChips, { type FilterOption } from "@/components/catalog/FilterChips";
import { watchByOwner, watchCoursesScoped, watchCoursesOrdered } from "@/storage/courses";
import { listRecentProgress } from "@/storage/progress";
import type { Course } from "@/types/course";

type Scope = "mine" | "class" | "all";

/**
 * Catalogue des cours.
 *
 * L'ecran precedent empilait trois niveaux de repliement -- niveau, puis
 * matiere, puis cours -- soit trois occasions de se perdre avant d'atteindre
 * une lecon. Il devient une liste plate, filtree par matiere et cherchable.
 */
export default function Courses() {
  const { color, space, radius } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isTeacher = String(user?.role || "") === "teacher";
  const gradeLevelId = user?.gradeLevelId ?? null;
  const countryCode = user?.countryCode ?? null;

  const [scope, setScope] = useState<Scope>(isTeacher ? "mine" : gradeLevelId ? "class" : "all");
  const [subject, setSubject] = useState("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const receive = (next: Course[]) => {
      setRows(next || []);
      setLoading(false);
    };

    if (isTeacher && scope === "mine" && user?.id) {
      return watchByOwner(user.id, receive);
    }
    if (scope === "class" && gradeLevelId) {
      return watchCoursesScoped(
        { countryCode, gradeLevelId, publishedOnly: true, limit: 100 },
        receive
      );
    }
    return watchCoursesOrdered(receive, 120);
  }, [isTeacher, scope, user?.id, gradeLevelId, countryCode]);

  // L'avancement transforme une liste de titres en liste de reprises possibles.
  useEffect(() => {
    if (isTeacher || !user?.id) return;
    let active = true;
    listRecentProgress(user.id, 60)
      .then((items) => {
        if (!active) return;
        const byCourse: Record<string, { sum: number; count: number }> = {};
        for (const row of items) {
          const duration = Math.max(0, Number(row.durationSec || 0));
          const watched = Math.max(0, Number(row.watchedSec || 0));
          const ratio = duration > 0 ? Math.min(1, watched / duration) : 0;
          const acc = byCourse[row.courseId] || { sum: 0, count: 0 };
          byCourse[row.courseId] = { sum: acc.sum + ratio, count: acc.count + 1 };
        }
        setProgress(
          Object.fromEntries(
            Object.entries(byCourse).map(([id, v]) => [id, v.count ? v.sum / v.count : 0])
          )
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isTeacher, user?.id, rows.length]);

  const scopeOptions = useMemo<FilterOption[]>(() => {
    if (isTeacher) {
      return [
        { key: "mine", label: "Mes cours" },
        { key: "all", label: "Tout le catalogue" },
      ];
    }
    if (!gradeLevelId) return [{ key: "all", label: "Tous les cours" }];
    return [
      { key: "class", label: `Ma classe` },
      { key: "all", label: "Toutes les classes" },
    ];
  }, [isTeacher, gradeLevelId]);

  // Les matieres proposees sont celles reellement presentes dans le resultat :
  // un filtre qui ne renvoie rien n'a pas a etre offert.
  const subjectOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const c of rows) {
      const key = c.subject?.trim();
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
    if (subject !== "all") base = base.filter((c) => c.subject === subject);

    const needle = query.trim().toLowerCase();
    if (needle) {
      base = base.filter(
        (c) =>
          c.title?.toLowerCase().includes(needle) ||
          c.subject?.toLowerCase().includes(needle) ||
          c.level?.toLowerCase().includes(needle) ||
          c.ownerName?.toLowerCase().includes(needle)
      );
    }

    // Ce qui est commence remonte : c'est ce que l'eleve vient chercher.
    return [...base].sort((a, b) => {
      const pa = progress[a.id] ?? -1;
      const pb = progress[b.id] ?? -1;
      if (pa !== pb) return pb - pa;
      return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
    });
  }, [rows, subject, query, progress]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setSubject("all");
  }, []);

  const hasFilters = !!query.trim() || subject !== "all";

  return (
    <View style={[styles.root, { backgroundColor: color.bg }]}>
      <View style={{ paddingTop: insets.top + space.lg, gap: space.md }}>
        <View style={[styles.headRow, { paddingHorizontal: space.lg, gap: space.md }]}>
          <Text variant="title" style={styles.flex}>
            {isTeacher ? "Mes cours" : "Cours"}
          </Text>
          {isTeacher ? (
            <Pressable
              onPress={() => router.push("/(app)/course/new")}
              accessibilityRole="button"
              accessibilityLabel="Créer un cours"
              style={[
                styles.iconBtn,
                { backgroundColor: color.primary, borderRadius: radius.pill },
              ]}
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
            placeholder="Chercher un cours, une matière"
            placeholderTextColor={color.textFaint}
            style={[styles.searchInput, { color: color.text }]}
            returnKeyType="search"
            accessibilityLabel="Chercher un cours"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Effacer">
              <Ionicons name="close-circle" size={17} color={color.textFaint} />
            </Pressable>
          ) : null}
        </View>

        {scopeOptions.length > 1 ? (
          <FilterChips
            options={scopeOptions}
            value={scope}
            onChange={(k) => setScope(k as Scope)}
            accessibilityLabel="Perimetre"
          />
        ) : null}

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
          renderItem={({ item }) => (
            <CourseRow
              course={item}
              progress={progress[item.id]}
              showStatus={isTeacher && scope === "mine"}
            />
          )}
          ListHeaderComponent={
            filtered.length ? (
              <Text variant="caption" tone="muted" style={{ marginBottom: space.xs }}>
                {filtered.length} cours
              </Text>
            ) : null
          }
          ListEmptyComponent={
            hasFilters ? (
              <EmptyState
                icon="search-outline"
                title="Aucun resultat"
                message="Aucun cours ne correspond a cette recherche. Essayez une autre matière ou effacez les filtres."
                actionLabel="Effacer les filtres"
                onAction={clearFilters}
              />
            ) : isTeacher ? (
              <EmptyState
                icon="add-circle-outline"
                title="Aucun cours pour l'instant"
                message="Créez votre premier cours, ajoutez ses chapitres, puis envoyez-le en relecture."
                actionLabel="Créer un cours"
                onAction={() => router.push("/(app)/course/new")}
              />
            ) : (
              <EmptyState
                icon="book-outline"
                title={scope === "class" ? "Rien pour ta classe" : "Catalogue vide"}
                message={
                  scope === "class"
                    ? "Aucun cours n'est encore publie pour ta classe. Regarde les autres classes en attendant."
                    : "Aucun cours publié pour le moment. Reviens bientôt."
                }
                actionLabel={scope === "class" ? "Voir toutes les classes" : undefined}
                onAction={scope === "class" ? () => setScope("all") : undefined}
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
});
