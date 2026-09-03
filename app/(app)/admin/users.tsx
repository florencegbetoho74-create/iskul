import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import {
  listAdminUsers,
  setAdminUserAdmin,
  setAdminUserReviewer,
  setAdminUserRole,
  type AdminUserRow,
} from "@/storage/admin";

const fmtDate = (ms?: number | null) => {
  if (!ms) return "-";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
};

export default function AdminUsers() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminUsers({ search: q, limit: 300 });
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      return (
        r.name.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s) ||
        (r.school || "").toLowerCase().includes(s) ||
        (r.grade || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  const toggleRole = async (row: AdminUserRow) => {
    const next = row.role === "teacher" ? "student" : "teacher";
    setBusyId(row.id);
    setError(null);
    try {
      await setAdminUserRole(row.id, next);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, role: next } : r)));
    } catch (e: any) {
      setError(e?.message || "Impossible de changer le role.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleAdmin = async (row: AdminUserRow) => {
    const next = !row.isAdmin;
    setBusyId(row.id);
    setError(null);
    try {
      await setAdminUserAdmin(row.id, next);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isAdmin: next } : r)));
    } catch (e: any) {
      setError(e?.message || "Impossible de changer les droits admin.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleReviewer = async (row: AdminUserRow) => {
    const next = !row.isReviewer;
    setBusyId(row.id);
    setError(null);
    try {
      await setAdminUserReviewer(row.id, next);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isReviewer: next } : r)));
    } catch (e: any) {
      setError(e?.message || "Impossible de changer le role relecteur.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Utilisateurs</Text>
          <Text style={styles.subtitle}>{loading ? "Chargement..." : `${filtered.length} comptes`}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={18} color={theme.color.text} />
          <Text style={styles.refreshText}>Rafraichir</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={theme.color.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher (nom, email, ecole, classe)"
          placeholderTextColor={theme.color.textMuted}
          style={styles.searchInput}
        />
        {!!q && (
          <Pressable onPress={() => setQ("")} hitSlop={6}>
            <Ionicons name="close-circle" size={16} color={theme.color.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Utilisateur</Text>
          <Text style={[styles.th, { flex: 1 }]}>Role</Text>
          <Text style={[styles.th, { flex: 1 }]}>Admin</Text>
              <Text style={[styles.th, { flex: 1 }]}>Relecteur</Text>
          <Text style={[styles.th, { flex: 2 }]}>Activite</Text>
          <Text style={[styles.th, { flex: 2 }]}>Actions</Text>
        </View>

        {filtered.map((row) => {
          const isBusy = busyId === row.id;
          return (
            <View key={row.id} style={styles.tableRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.td} numberOfLines={1}>{row.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{row.email}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {(row.school || "Sans ecole")} {row.grade ? `- ${row.grade}` : ""}
                </Text>
              </View>
              <Text style={[styles.td, { flex: 1 }]}>{row.role === "teacher" ? "Prof" : "Eleve"}</Text>
              <Text style={[styles.td, { flex: 1 }]}>{row.isAdmin ? "Oui" : "Non"}</Text>
              <Text style={[styles.td, { flex: 1 }]}>{row.isReviewer ? "Oui" : "Non"}</Text>
              <View style={{ flex: 2 }}>
                <Text style={styles.td}>{row.coursesCount} cours, {row.booksCount} docs</Text>
                <Text style={styles.meta}>{row.livesCount} lives, {row.quizzesCount} quiz</Text>
                <Text style={styles.meta}>Vu: {fmtDate(row.lastSeenMs)}</Text>
              </View>
              <View style={{ flex: 2, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable style={[styles.actionBtn, isBusy && { opacity: 0.6 }]} disabled={isBusy} onPress={() => toggleRole(row)}>
                  <Text style={styles.actionText}>{row.role === "teacher" ? "Passer eleve" : "Passer prof"}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, isBusy && { opacity: 0.6 }]} disabled={isBusy} onPress={() => toggleAdmin(row)}>
                  <Text style={styles.actionText}>{row.isAdmin ? "Retirer admin" : "Rendre admin"}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => toggleReviewer(row)}>
                  <Text style={styles.actionText}>
                    {row.isReviewer ? "Retirer relecteur" : "Rendre relecteur"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {!loading && filtered.length === 0 ? <Text style={styles.emptyText}>Aucun utilisateur trouve.</Text> : null}
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { padding: 20, paddingBottom: 32, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: t.color.text, fontSize: 22, fontFamily: t.type.title.fontFamily },
  subtitle: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  errorText: { color: t.color.danger, fontFamily: t.type.body.fontFamily },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, color: t.color.text, fontFamily: t.type.body.fontFamily },
  table: {
    backgroundColor: t.color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: t.color.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
  },
  th: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  tableRow: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color.border,
    gap: 10,
  },
  td: { color: t.color.text, fontFamily: t.type.body.fontFamily, fontSize: 13 },
  meta: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 11, marginTop: 2 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.bg,
  },
  actionText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
  emptyText: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, padding: 16 },
});
