import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLOR, FONT } from "@/theme/colors";
import { listAdminBooks, setAdminBookPublished, type AdminBookRow } from "@/storage/admin";

const formatDate = (ms?: number | null) => {
  if (!ms) return "-";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleDateString();
  }
};

export default function AdminBooks() {
  const [rows, setRows] = useState<AdminBookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminBooks({ limit: 320 });
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "published" && !r.published) return false;
      if (filter === "draft" && r.published) return false;
      if (!s) return true;
      return (
        r.title?.toLowerCase().includes(s) ||
        (r.subject || "").toLowerCase().includes(s) ||
        (r.level || "").toLowerCase().includes(s) ||
        (r.ownerName || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q, filter]);

  const togglePublish = async (row: AdminBookRow) => {
    try {
      const next = !row.published;
      await setAdminBookPublished(row.id, next);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, published: next } : r)));
    } catch (e: any) {
      setError(e?.message || "Impossible de modifier le statut.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Documents</Text>
          <Text style={styles.subtitle}>{loading ? "Chargement..." : `${filtered.length} documents`}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={18} color={COLOR.text} />
          <Text style={styles.refreshText}>Rafraichir</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.filters}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLOR.sub} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher un document"
            placeholderTextColor={COLOR.sub}
            style={styles.searchInput}
          />
          {!!q && (
            <Pressable onPress={() => setQ("")} hitSlop={6}>
              <Ionicons name="close" size={16} color={COLOR.sub} />
            </Pressable>
          )}
        </View>
        <View style={styles.filterRow}>
          {(["all", "published", "draft"] as const).map((k) => {
            const active = filter === k;
            return (
              <Pressable key={k} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(k)}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {k === "all" ? "Tous" : k === "published" ? "Publies" : "Brouillons"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Titre</Text>
          <Text style={[styles.th, { flex: 1 }]}>Niveau</Text>
          <Text style={[styles.th, { flex: 1 }]}>Matiere</Text>
          <Text style={[styles.th, { flex: 1 }]}>Prix</Text>
          <Text style={[styles.th, { flex: 1 }]}>Statut</Text>
          <Text style={[styles.th, { flex: 1 }]}>Actions</Text>
        </View>
        {filtered.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.td} numberOfLines={1}>{row.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>{row.ownerName || "-"} - {formatDate(row.updatedAtMs)}</Text>
            </View>
            <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{row.level || "-"}</Text>
            <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{row.subject || "-"}</Text>
            <Text style={[styles.td, { flex: 1 }]}>{row.price ? `${row.price} FCFA` : "Gratuit"}</Text>
            <Text style={[styles.td, { flex: 1 }]}>{row.published ? "Publie" : "Brouillon"}</Text>
            <View style={{ flex: 1 }}>
              <Pressable style={styles.actionBtn} onPress={() => togglePublish(row)}>
                <Text style={styles.actionText}>{row.published ? "Depublier" : "Publier"}</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {!loading && filtered.length === 0 ? <Text style={styles.emptyText}>Aucun document trouve.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 32, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading },
  subtitle: { color: COLOR.sub, fontFamily: FONT.body },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  errorText: { color: COLOR.danger, fontFamily: FONT.body },
  filters: { gap: 10 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, color: COLOR.text, fontFamily: FONT.body },
  filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
  },
  filterChipActive: { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
  filterText: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },
  filterTextActive: { color: "#fff" },
  table: {
    backgroundColor: COLOR.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.border,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: COLOR.tint,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  th: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },
  tableRow: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
    gap: 10,
  },
  td: { color: COLOR.text, fontFamily: FONT.body, fontSize: 13 },
  meta: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 11, marginTop: 2 },
  actionBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
  },
  actionText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 11 },
  emptyText: { color: COLOR.sub, fontFamily: FONT.body, padding: 16 },
});
