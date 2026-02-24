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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLOR, ELEVATION, FONT, RADIUS } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import type { Book } from "@/types/book";
import { watchBooksOrdered } from "@/storage/books";
import BookCard from "@/components/BookCard";
import Segmented from "@/components/Segmented";

const BG = ["#F4F7FC", "#EAF0FF", "#F1F7FF"] as const;
const ACCENT = ["#2F5BFF", "#5B85FF"] as const;

type SegmentKey = "all" | "published" | "mine";

type SegmentItem = { key: SegmentKey; label: string };
type SortKey = "recent" | "alpha" | "price";

export default function Library() {
  const router = useRouter();
  const { user, canAccessAdmin } = useAuth();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role === "teacher" || canAccessAdmin;

  const [all, setAll] = useState<Book[]>([]);
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<SegmentKey>(isAdmin ? "mine" : "all");
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    const unsub = watchBooksOrdered(setAll, 200);
    return () => unsub();
  }, []);

  const segments = useMemo<SegmentItem[]>(() => {
    const base: SegmentItem[] = [{ key: "all", label: "Tous" }];
    if (isAdmin) {
      base.push({ key: "published", label: "Publies" });
      base.push({ key: "mine", label: "Mes livres" });
    }
    return base;
  }, [isAdmin]);

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

    if (!q.trim()) return scoped;
    const s = q.trim().toLowerCase();
    return scoped.filter(
      (b) =>
        b.title?.toLowerCase().includes(s) ||
        b.subject?.toLowerCase().includes(s) ||
        b.level?.toLowerCase().includes(s) ||
        b.ownerName?.toLowerCase().includes(s)
    );
  }, [all, q, segment, user?.id]);

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
        {isAdmin ? (
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
          placeholder="Rechercher un livre"
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
            </View>
          )}
          ListEmptyComponent={<EmptyState isAdmin={isAdmin} segment={segment} />}
        />

        {isAdmin ? (
          <Pressable onPress={() => router.push("/(app)/library/new")} style={[styles.fabWrap, { bottom: 16 + insets.bottom }]}>
            <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fab}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.fabText}>Ajouter un livre</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmptyState({ isAdmin, segment }: { isAdmin: boolean; segment: SegmentKey }) {
  const title = isAdmin && segment === "mine"
    ? "Ajoutez votre premier livre."
    : "Aucun livre trouve pour l'instant.";

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





