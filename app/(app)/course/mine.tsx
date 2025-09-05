import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from "react-native";
import { COLOR } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Course } from "@/types/course";
import { watchByOwner } from "@/storage/courses";

export default function MyCourses() {
  const { user } = useAuth();
  const [items, setItems] = useState<Course[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = watchByOwner(user.id, (rows) => {
      setItems(rows);
      setReady(true);
    });
    return () => unsub();
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes cours</Text>
        <Link href="/(app)/course/new" asChild>
          <TouchableOpacity style={styles.addBtn}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addText}>Créer</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 120, paddingTop: 12 }}
        renderItem={({ item }) => (
          <Link href={`/(app)/course/edit/${item.id}`} asChild>
            <TouchableOpacity style={styles.card} activeOpacity={0.9}>
              <View style={styles.thumbWrap}>
                {item.coverUrl ? (
                  <Image source={{ uri: item.coverUrl }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbFallback}>
                    <Ionicons name="play-circle" size={22} color="#cbd5e1" />
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: item.published ? "#10b981" : "#6b7280" }]}>
                  <Text style={styles.badgeText}>{item.published ? "Publié" : "Brouillon"}</Text>
                </View>
              </View>
              <View style={styles.body}>
                <Text numberOfLines={2} style={styles.itemTitle}>{item.title || "Sans titre"}</Text>
                <Text numberOfLines={1} style={styles.meta}>{item.subject || "—"} • {item.level || "—"}</Text>
              </View>
            </TouchableOpacity>
          </Link>
        )}
        ListEmptyComponent={
          <Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>
            {ready ? "Aucun cours. Créez-en un pour commencer." : "Chargement…"}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 24 },
  title: { color: COLOR.text, fontSize: 20, fontWeight: "800" },
  addBtn: { backgroundColor: COLOR.primary, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  addText: { color: "#fff", fontWeight: "800" },

  card: { flex: 1, backgroundColor: COLOR.card, borderRadius: 12, borderWidth: 1, borderColor: COLOR.border, overflow: "hidden", minHeight: 210 },
  thumbWrap: { height: 110, backgroundColor: "#0b0b0c" },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 10, gap: 6 },
  itemTitle: { color: COLOR.text, fontWeight: "900" },
  meta: { color: COLOR.sub, fontSize: 12 },

  badge: { position: "absolute", top: 6, right: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" }
});
