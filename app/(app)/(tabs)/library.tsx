import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from "react-native";
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
import { watchBooksOrdered, watchBooksScoped } from "@/storage/books";
import { listDocumentTypes, type DocumentType } from "@/storage/documentTypes";
import type { Book } from "@/types/book";

type Scope = "class" | "all" | "mine";

/**
 * Bibliotheque.
 *
 * Les types de documents existent en base depuis le lot taxonomie : ils
 * deviennent le premier filtre, pour que la banque d'epreuves ne soit plus
 * melangee aux oeuvres et aux manuels.
 */
export default function Library() {
  const { color, space, radius } = useTheme();
  const { user, canAccessAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isTeacher = String(user?.role || "") === "teacher";
  const canPublish = isTeacher || canAccessAdmin;
  const gradeLevelId = user?.gradeLevelId ?? null;
  const countryCode = user?.countryCode ?? null;

  const [scope, setScope] = useState<Scope>(
    canPublish ? "mine" : gradeLevelId ? "class" : "all"
  );
  const [rows, setRows] = useState<Book[]>([]);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listDocumentTypes()
      .then((t) => !cancelled && setTypes(t))
      .catch(() => !cancelled && setTypes([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const receive = (next: Book[]) => {
      setRows(next || []);
      setLoading(false);
    };
    if (scope === "class" && gradeLevelId) {
      return watchBooksScoped({ countryCode, gradeLevelId, limit: 80 }, receive);
    }
    return watchBooksOrdered(receive, 200);
  }, [scope, gradeLevelId, countryCode]);

  const scopeOptions = useMemo<FilterOption[]>(() => {
    if (canPublish) {
      return [
        { key: "mine", label: "Mes documents" },
        { key: "all", label: "Tout" },
      ];
    }
    if (!gradeLevelId) return [{ key: "all", label: "Tous" }];
    return [
      { key: "class", label: "Ma classe" },
      { key: "all", label: "Tout" },
    ];
  }, [canPublish, gradeLevelId]);

  const scoped = useMemo(() => {
    if (scope === "mine") return rows.filter((b) => b.ownerId === user?.id);
    return rows.filter((b) => b.published !== false);
  }, [rows, scope, user?.id]);

  // Le type de document est le premier tri utile : on ne cherche pas une
  // epreuve du BEPC comme on cherche une oeuvre au programme.
  const typeOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const b of scoped) {
      if (!b.documentTypeId) continue;
      counts.set(b.documentTypeId, (counts.get(b.documentTypeId) || 0) + 1);
    }
    const list = types
      .filter((t) => counts.has(t.id))
      .map((t) => ({ key: t.id, label: t.pluralLabel, count: counts.get(t.id) }));
    return [{ key: "all", label: "Tout", count: scoped.length }, ...list];
  }, [scoped, types]);

  useEffect(() => {
    if (typeOptions.some((o) => o.key === typeFilter)) return;
    setTypeFilter("all");
  }, [typeOptions, typeFilter]);

  const filtered = useMemo(() => {
    let base = scoped;
    if (typeFilter !== "all") base = base.filter((b) => b.documentTypeId === typeFilter);
    const needle = query.trim().toLowerCase();
    if (needle) {
      base = base.filter(
        (b) =>
          b.title?.toLowerCase().includes(needle) ||
          b.subject?.toLowerCase().includes(needle) ||
          b.level?.toLowerCase().includes(needle) ||
          b.author?.toLowerCase().includes(needle) ||
          b.examName?.toLowerCase().includes(needle)
      );
    }
    return [...base].sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
  }, [scoped, typeFilter, query]);

  const typeLabel = useCallback(
    (id?: string | null) => types.find((t) => t.id === id)?.label ?? null,
    [types]
  );

  const hasFilters = !!query.trim() || typeFilter !== "all";

  return (
    <View style={[styles.root, { backgroundColor: color.bg }]}>
      <View style={{ paddingTop: insets.top + space.lg, gap: space.md }}>
        <View style={[styles.headRow, { paddingHorizontal: space.lg, gap: space.md }]}>
          <View style={styles.flex}>
            <Text variant="title">Bibliothèque</Text>
            <Text variant="caption" tone="muted">
              Épreuves, œuvres, résumés et manuels
            </Text>
          </View>
          {canPublish ? (
            <Pressable
              onPress={() => router.push("/(app)/library/new")}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un document"
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
            placeholder="Titre, matiere, auteur, examen"
            placeholderTextColor={color.textFaint}
            style={[styles.searchInput, { color: color.text }]}
            returnKeyType="search"
            accessibilityLabel="Chercher un document"
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

        {typeOptions.length > 2 ? (
          <FilterChips
            options={typeOptions}
            value={typeFilter}
            onChange={setTypeFilter}
            accessibilityLabel="Type de document"
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
          renderItem={({ item }) => {
            const label = typeLabel(item.documentTypeId);
            const exam = [item.examName, item.examYear].filter(Boolean).join(" ");
            return (
              <Pressable
                onPress={() => router.push(`/(app)/library/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: color.surface,
                    borderColor: color.border,
                    borderRadius: radius.lg,
                    padding: space.md,
                    gap: space.md,
                  },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View
                  style={[styles.cover, { backgroundColor: color.surfaceSunk, borderRadius: radius.md }]}
                >
                  {item.coverUrl ? (
                    <Image source={{ uri: item.coverUrl }} style={styles.coverImg} resizeMode="cover" />
                  ) : (
                    <Ionicons name="document-text-outline" size={20} color={color.textMuted} />
                  )}
                </View>

                <View style={styles.flex}>
                  {label ? (
                    <Text variant="overline" tone="primary">
                      {label.toUpperCase()}
                    </Text>
                  ) : null}
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {[item.subject, item.level, exam || item.author].filter(Boolean).join(" · ") ||
                      "Document"}
                  </Text>
                  {scope === "mine" && item.published === false ? (
                    <Badge tone="warning" style={{ marginTop: space.xs }}>
                      Non publie
                    </Badge>
                  ) : null}
                </View>

                <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
              </Pressable>
            );
          }}
          ListHeaderComponent={
            filtered.length ? (
              <Text variant="caption" tone="muted" style={{ marginBottom: space.xs }}>
                {filtered.length} document{filtered.length > 1 ? "s" : ""}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            hasFilters ? (
              <EmptyState
                icon="search-outline"
                title="Aucun resultat"
                message="Aucun document ne correspond a cette recherche."
                actionLabel="Effacer les filtres"
                onAction={() => {
                  setQuery("");
                  setTypeFilter("all");
                }}
              />
            ) : canPublish && scope === "mine" ? (
              <EmptyState
                icon="cloud-upload-outline"
                title="Aucun document publie"
                message="Ajoutez une epreuve corrigee, une oeuvre au programme ou une fiche de revision."
                actionLabel="Ajouter un document"
                onAction={() => router.push("/(app)/library/new")}
              />
            ) : (
              <EmptyState
                icon="library-outline"
                title={scope === "class" ? "Rien pour ta classe" : "Bibliotheque vide"}
                message={
                  scope === "class"
                    ? "Aucun document n'est encore publie pour ta classe. Regarde le reste de la bibliotheque."
                    : "Aucun document publie pour le moment."
                }
                actionLabel={scope === "class" ? "Voir toute la bibliotheque" : undefined}
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
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  cover: { width: 48, height: 60, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverImg: { width: "100%", height: "100%" },
});
