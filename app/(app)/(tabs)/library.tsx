import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "expo-router";
import type { Book } from "@/types/book";
import { watchBooksOrdered } from "@/storage/books";
import BookCard from "@/components/BookCard";

export default function Library() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const router = useRouter();

  const [all, setAll] = useState<Book[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const unsub = watchBooksOrdered(setAll, 200);
    return () => unsub();
  }, []);

  const data = useMemo(() => {
    const base = all.filter((b) => b.published !== false);
    if (!q.trim()) return base;
    const s = q.trim().toLowerCase();
    return base.filter((b) =>
      (b.title?.toLowerCase().includes(s)) ||
      (b.subject?.toLowerCase().includes(s)) ||
      (b.level?.toLowerCase().includes(s)) ||
      (b.ownerName?.toLowerCase().includes(s))
    );
  }, [all, q]);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={COLOR.sub} />
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un livre…" placeholderTextColor="#6b7280" style={styles.input} />
        {q ? <TouchableOpacity onPress={() => setQ("")}><Ionicons name="close" size={18} color={COLOR.sub} /></TouchableOpacity> : null}
      </View>

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 120, paddingTop: 12 }}
        renderItem={({ item }) => (
          <BookCard item={item} onPress={() => router.push(`/(app)/library/${item.id}`)} />
        )}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>Aucun livre.</Text>}
      />

      {isTeacher ? (
        <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => router.push("/(app)/library/new")}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Ajouter un livre</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, paddingTop: 12 },
  searchRow: { marginHorizontal: 16, backgroundColor: "#1A1B1E", borderRadius: 12, borderWidth: 1, borderColor: COLOR.border, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { color: COLOR.text, flex: 1 },
  fab: { position: "absolute", right: 16, bottom: 24, backgroundColor: COLOR.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  fabText: { color: "#fff", fontWeight: "800" }
});
