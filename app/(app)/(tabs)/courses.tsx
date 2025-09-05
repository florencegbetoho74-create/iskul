import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "expo-router";
import type { Course } from "@/types/course";
import { watchCoursesOrdered } from "@/storage/courses";
import CourseCard from "@/components/CourseCard";

export default function Courses() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const router = useRouter();

  const [all, setAll] = useState<Course[]>([]);
  const [q, setQ] = useState("");

  // Temps réel: derniers cours (tri serveur updatedAtMs) → filtre client
  useEffect(() => {
    const unsub = watchCoursesOrdered(setAll, 120);
    return () => unsub();
  }, []);

  const data = useMemo(() => {
    const base = isTeacher ? all.filter(c => c.ownerId === user?.id) : all.filter(c => c.published);
    if (!q.trim()) return base;
    const s = q.trim().toLowerCase();
    return base.filter(c =>
      (c.title?.toLowerCase().includes(s)) ||
      (c.subject?.toLowerCase().includes(s)) ||
      (c.level?.toLowerCase().includes(s)) ||
      (c.ownerName?.toLowerCase().includes(s))
    );
  }, [all, q, isTeacher, user?.id]);

  return (
    <View style={styles.container}>
      {/* Barre de recherche */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={COLOR.sub} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un cours (titre, matière, niveau)…"
          placeholderTextColor="#6b7280"
          style={styles.input}
          returnKeyType="search"
        />
        {q ? (
          <TouchableOpacity onPress={() => setQ("")}>
            <Ionicons name="close" size={18} color={COLOR.sub} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Grille */}
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 120, paddingTop: 12 }}
        renderItem={({ item }) => (
          <CourseCard
            item={item}
            onPress={() => router.push(`/(app)/course/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>
            {isTeacher ? "Créez un cours pour commencer." : "Aucun cours disponible pour l’instant."}
          </Text>
        }
      />

      {/* FAB prof */}
      {isTeacher ? (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.9}
          onPress={() => router.push("/(app)/course/new")}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Créer un cours</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, paddingTop: 24 },
  searchRow: {
    marginHorizontal: 16,
    backgroundColor: "#1A1B1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  input: { color: COLOR.text, flex: 1 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: COLOR.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  fabText: { color: "#fff", fontWeight: "800" }
});
