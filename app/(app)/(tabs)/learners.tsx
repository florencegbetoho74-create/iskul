import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { getTeacherLearners, type TeacherLearner } from "@/storage/teacherDashboard";

function lastSeen(ms?: number | null): string {
  if (!ms) return "Jamais venu";
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return "Actif aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaines`;
  return "Il y a plus d'un mois";
}

/**
 * Eleves du professeur.
 *
 * N'apparaissent que ceux qui ont reellement ouvert une de ses lecons ou passe
 * un de ses quiz : ce n'est pas un annuaire de la plateforme.
 */
export default function Learners() {
  const { color, space, radius } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<TeacherLearner[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTeacher = String(user?.role || "") === "teacher";

  const load = useCallback(async () => {
    if (!isTeacher) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setRows(await getTeacherLearners(200));
    } catch (e: any) {
      setError(e?.message || "Liste indisponible.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isTeacher]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        String(r.grade || "").toLowerCase().includes(needle)
    );
  }, [rows, query]);

  if (!isTeacher) {
    return (
      <View style={[styles.root, { backgroundColor: color.bg, paddingTop: insets.top }]}>
        <EmptyState
          icon="lock-closed-outline"
          title="Espace enseignant"
          message="Cette page liste les élèves qui suivent vos cours."
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: color.bg }]}>
      <View style={{ paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, gap: space.md }}>
        <Text variant="title">Mes élèves</Text>
        <Text variant="caption" tone="muted">
          Ceux qui ont ouvert une de vos lecons ou passe un de vos quiz.
        </Text>

        <View
          style={[
            styles.search,
            {
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
            placeholder="Rechercher un élève"
            placeholderTextColor={color.textFaint}
            style={[styles.searchInput, { color: color.text }]}
            accessibilityLabel="Rechercher un élève"
          />
        </View>
      </View>

      {loading ? (
        <View style={{ padding: space.lg }}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{
            padding: space.lg,
            paddingBottom: insets.bottom + 120,
            gap: space.sm,
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
          ListEmptyComponent={
            <EmptyState
              icon={error ? "cloud-offline-outline" : "people-outline"}
              tone={error ? "error" : "empty"}
              title={error ? "Liste indisponible" : query ? "Aucun resultat" : "Pas encore d'eleves"}
              message={
                error ||
                (query
                  ? "Aucun élève ne correspond a cette recherche."
                  : "Vos indicateurs se rempliront des qu'un eleve ouvrira un de vos cours.")
              }
            />
          }
          renderItem={({ item }) => {
            const atRisk = item.completionRate < 0.4 && item.lessonsStarted >= 2;
            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: color.surface,
                    borderColor: color.border,
                    borderRadius: radius.lg,
                    padding: space.lg,
                    gap: space.sm,
                  },
                ]}
              >
                <View style={[styles.headRow, { gap: space.sm }]}>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {[item.grade, lastSeen(item.lastActiveMs)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {atRisk ? <Badge tone="warning">A relancer</Badge> : null}
                </View>

                <View style={[styles.bar, { backgroundColor: color.surfaceSunk }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.round(item.completionRate * 100)}%`,
                        backgroundColor: atRisk ? color.warning : color.primary,
                      },
                    ]}
                  />
                </View>

                <View style={[styles.metaRow, { gap: space.xl }]}>
                  <Meta value={`${Math.round(item.completionRate * 100)} %`} label="Progression" />
                  <Meta value={String(item.lessonsStarted)} label="Leçons" />
                  <Meta
                    value={item.quizAttempts ? `${Math.round(item.avgScorePct)} %` : "—"}
                    label="Moyenne quiz"
                  />
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function Meta({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="caption" tone="faint">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  search: { flexDirection: "row", alignItems: "center", borderWidth: 1, minHeight: 44 },
  searchInput: { flex: 1, paddingVertical: 10 },
  card: { borderWidth: 1 },
  headRow: { flexDirection: "row", alignItems: "center" },
  bar: { height: 6, borderRadius: 999, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 999 },
  metaRow: { flexDirection: "row" },
});
