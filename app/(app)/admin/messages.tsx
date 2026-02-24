import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLOR, FONT } from "@/theme/colors";
import { listAdminMessages, type AdminMessageRow } from "@/storage/admin";

const formatDateTime = (ms?: number | null) => {
  if (!ms) return "-";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
};

export default function AdminMessages() {
  const [rows, setRows] = useState<AdminMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminMessages({ limit: 320 });
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const teacher = (r.teacherName || "").toLowerCase();
      const student = (r.studentName || "").toLowerCase();
      const course = (r.courseTitle || "").toLowerCase();
      const last = (r.lastText || "").toLowerCase();
      return teacher.includes(s) || student.includes(s) || course.includes(s) || last.includes(s);
    });
  }, [rows, q]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>{loading ? "Chargement..." : `${filtered.length} discussions`}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={18} color={COLOR.text} />
          <Text style={styles.refreshText}>Rafraichir</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={COLOR.sub} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher une discussion"
          placeholderTextColor={COLOR.sub}
          style={styles.searchInput}
        />
        {!!q && (
          <Pressable onPress={() => setQ("")} hitSlop={6}>
            <Ionicons name="close" size={16} color={COLOR.sub} />
          </Pressable>
        )}
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Participants</Text>
          <Text style={[styles.th, { flex: 2 }]}>Cours</Text>
          <Text style={[styles.th, { flex: 3 }]}>Dernier message</Text>
          <Text style={[styles.th, { flex: 1 }]}>Date</Text>
        </View>
        {filtered.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.td} numberOfLines={1}>
                {(row.teacherName || "Prof") + " - " + (row.studentName || "Eleve")}
              </Text>
              <Text style={styles.meta}>{row.messageCount} messages</Text>
            </View>
            <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{row.courseTitle || "-"}</Text>
            <Text style={[styles.td, { flex: 3 }]} numberOfLines={1}>{row.lastText || "-"}</Text>
            <Text style={[styles.td, { flex: 1 }]}>{formatDateTime(row.lastAtMs)}</Text>
          </View>
        ))}
        {!loading && filtered.length === 0 ? <Text style={styles.emptyText}>Aucune discussion trouvee.</Text> : null}
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
  emptyText: { color: COLOR.sub, fontFamily: FONT.body, padding: 16 },
});
