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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLOR, ELEVATION, FONT, RADIUS } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import type { Book } from "@/types/book";
import { watchBooksOrdered, watchBooksScoped } from "@/storage/books";
import BookCard from "@/components/BookCard";
import Segmented from "@/components/Segmented";
import { listDocumentTypes, type DocumentType } from "@/storage/documentTypes";
import { formatExamLabel } from "@/lib/documentTaxonomy";

const BG = ["#F4F7FC", "#EAF0FF", "#F1F7FF"] as const;
const ACCENT = ["#2F5BFF", "#5B85FF"] as const;

type SegmentKey = "all" | "published" | "mine" | "myclass";

type SegmentItem = { key: SegmentKey; label: string };
type SortKey = "recent" | "alpha" | "price";

export default function Library() {
  const router = useRouter();
  const { user, canAccessAdmin } = useAuth();
  const insets = useSafeAreaInsets();
  // Meme regle qu'ailleurs : l'experience suit le role, la permission de
  // publier suit les droits.
  const isAdmin = user?.role === "teacher";
  const canPublish = isAdmin || canAccessAdmin;

  const [all, setAll] = useState<Book[]>([]);
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<SegmentKey>(isAdmin ? "mine" : "myclass");
  const [sort, setSort] = useState<SortKey>("recent");
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    listDocumentTypes()
      .then((types) => {
        if (!cancelled) setDocumentTypes(types);
      })
      .catch(() => {
        if (!cancelled) setDocumentTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Un eleve ne telecharge que les documents de sa classe et ceux marques
  // tous niveaux, au lieu des 200 derniers toutes classes confondues.
  const gradeLevelId = user?.gradeLevelId ?? null;
  const countryCode = user?.countryCode ?? null;
  const scopedToClass = !isAdmin && segment === "myclass" && !!gradeLevelId;

  useEffect(() => {
    if (scopedToClass) {
      const unsub = watchBooksScoped({ countryCode, gradeLevelId, limit: 60 }, setAll);
      return () => unsub();
    }
    const unsub = watchBooksOrdered(setAll, 200);
    return () => unsub();
  }, [scopedToClass, countryCode, gradeLevelId]);

  // Un eleve sans classe renseignee ne doit pas rester sur un segment vide.
  useEffect(() => {
    if (isAdmin) return;
    if (segment === "myclass" && !gradeLevelId) setSegment("all");
  }, [isAdmin, segment, gradeLevelId]);

  const segments = useMemo<SegmentItem[]>(() => {
    if (isAdmin) {
      return [
        { key: "all", label: "Tous" },
        { key: "published", label: "Publies" },
        { key: "mine", label: "Mes documents" },
      ];
    }
    if (!gradeLevelId) return [{ key: "all", label: "Tous" }];
    return [
      { key: "myclass", label: "Ma classe" },
      { key: "all", label: "Tous les documents" },
    ];
  }, [isAdmin, gradeLevelId]);

  const filtered = useMemo(() => {
    const base = all.filter((b) => b.published !== false);

    let scoped: Book[];
    switch (segment) {
      case "mine":
        scoped = base.filter((b) => b.ownerId === user?.id);
        break;
      case "published":
        scoped = base.filter((b) => b.published === true);
        break;
      default:
        scoped = base;
    }

    const byType =
      typeFilter === "all"
        ? scoped
        : scoped.filter((b) => b.documentTypeId === typeFilter);

    if (!q.trim()) return byType;
    const s = q.trim().toLowerCase();
    return byType.filter(
      (b) =>
        b.title?.toLowerCase().includes(s) ||
        b.subject?.toLowerCase().includes(s) ||
        b.level?.toLowerCase().includes(s) ||
        b.author?.toLowerCase().includes(s) ||
        b.examName?.toLowerCase().includes(s) ||
        b.ownerName?.toLowerCase().includes(s)
    );
  }, [all, q, segment, typeFilter, user?.id]);

  // Un type sans document ne merite pas d'onglet : il n'apprend rien.
  const typeChips = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((b) => {
      const key = String(b.documentTypeId ?? "");
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const chips = documentTypes
      .filter((t) => (counts.get(t.id) || 0) > 0)
      .map((t) => ({ key: t.id, label: t.pluralLabel, count: counts.get(t.id) || 0 }));
    return [{ key: "all", label: "Tous", count: all.length }, ...chips];
  }, [all, documentTypes]);

  useEffect(() => {
    if (typeChips.some((c) => c.key === typeFilter)) return;
    setTypeFilter("all");
  }, [typeChips, typeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "alpha":
        return arr.sort((a, b) => a.title.localeCompare(b.title, "fr", { sensitivity: "base" }));
      case "price":
        return arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0) || ((b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0)));
      default:
        return arr.sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
    }
  }, [filtered, sort]);

  const sortItems: { key: SortKey; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "alpha", label: "Titre" },
    { key: "price", label: "Prix" },
  ];
  const sortLabel = sortItems.find((i) => i.key === sort)?.label || "Recent";
  const cycleSort = () => {
    setSort((prev) => {
      const idx = sortItems.findIndex((i) => i.key === prev);
      const next = sortItems[(idx + 1) % sortItems.length];
      return next.key;
    });
  };

  const Header = (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Bibliotheque</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {isAdmin ? "Espace admin" : "Catalogue"} - {filtered.length} resultat{filtered.length > 1 ? "s" : ""}
          </Text>
        </View>
        {canPublish ? (
          <Pressable onPress={() => router.push("/(app)/library/new")} style={styles.addBtn}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Nouveau</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchWrap} accessible accessibilityRole="search">
        <Ionicons name="search" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un document"
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

      <View style={styles.filterRow}>
        {segments.length > 1 ? (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Segmented value={segment} items={segments} onChange={(k) => setSegment(k as SegmentKey)} />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable onPress={cycleSort} style={styles.sortChip}>
          <Ionicons name="swap-vertical" size={16} color={COLOR.sub} />
          <Text style={styles.sortChipText}>{sortLabel}</Text>
        </Pressable>
      </View>

      {typeChips.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeRow}
          keyboardShouldPersistTaps="handled"
        >
          {typeChips.map((chip) => {
            const active = chip.key === typeFilter;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setTypeFilter(chip.key)}
                style={[styles.typeChip, active && styles.typeChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                  {chip.label}
                </Text>
                <Text style={[styles.typeChipCount, active && styles.typeChipTextActive]}>
                  {chip.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </LinearGradient>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <FlatList
          data={sorted}
          ListHeaderComponent={Header}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, justifyContent: "space-between" }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 + insets.bottom }}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <BookCard item={item} onPress={() => router.push(`/(app)/library/${item.id}`)} />
              {formatExamLabel(item) ? (
                <Text style={styles.examLabel} numberOfLines={1}>
                  {formatExamLabel(item)}
                </Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<EmptyState isAdmin={isAdmin} segment={segment} />}
        />

        {isAdmin ? (
          <Pressable onPress={() => router.push("/(app)/library/new")} style={[styles.fabWrap, { bottom: 16 + insets.bottom }]}>
            <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fab}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.fabText}>Ajouter un document</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmptyState({ isAdmin, segment }: { isAdmin: boolean; segment: SegmentKey }) {
  const title = isAdmin && segment === "mine"
    ? "Ajoutez votre premier document."
    : "Aucun document trouve pour l'instant.";

  const subtitle = isAdmin && segment === "mine"
    ? "Importez un PDF ou un EPUB pour votre classe."
    : "Essayez un autre filtre ou revenez plus tard.";

  return (
    <View style={styles.emptyWrap}>
      <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  typeRow: { gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
  },
  typeChipActive: { borderColor: COLOR.primary, backgroundColor: COLOR.tint },
  typeChipText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  typeChipTextActive: { color: COLOR.primary },
  typeChipCount: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 11 },
  examLabel: {
    color: COLOR.sub,
    fontFamily: FONT.body,
    fontSize: 11,
    marginTop: 4,
    paddingHorizontal: 2,
  },
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

  filterRow: {
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sortChip: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    ...ELEVATION.card,
  },
  sortChipText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },

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
});





