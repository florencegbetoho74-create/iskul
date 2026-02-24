import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";

import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import type { Course } from "@/types/course";
import { watchByOwner } from "@/storage/courses";

const BG = ["#F5F4F1", "#EAF0FF", "#F6F1EA"] as const;

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

  const Header = () => (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mes cours</Text>
          <Text style={styles.subtitle}>Gerez vos brouillons et publications</Text>
        </View>
        <Link href="/(app)/course/new" asChild>
          <Pressable style={styles.addBtn}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addText}>Creer</Text>
          </Pressable>
        </Link>
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 120, paddingTop: 8 }}
        renderItem={({ item }) => (
          <Link href={`/(app)/course/edit/${item.id}`} asChild>
            <Pressable style={styles.card}>
              <View style={styles.thumbWrap}>
                <View style={styles.thumbFallback}>
                  <Ionicons name="play-circle" size={22} color={COLOR.sub} />
                </View>
                <View style={[styles.badge, { backgroundColor: item.published ? COLOR.success : COLOR.warn }]}
                >
                  <Text style={styles.badgeText}>{item.published ? "Publie" : "Brouillon"}</Text>
                </View>
              </View>
              <View style={styles.body}>
                <Text numberOfLines={2} style={styles.itemTitle}>{item.title || "Sans titre"}</Text>
                <Text numberOfLines={1} style={styles.meta}>{item.subject || "-"} - {item.level || "-"}</Text>
              </View>
            </Pressable>
          </Link>
        )}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          <Text style={{ color: COLOR.sub, paddingHorizontal: 16 }}>
            {ready ? "Aucun cours. Creez-en un pour commencer." : "Chargement..."}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  header: { paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading },
  subtitle: { color: COLOR.sub, marginTop: 4, fontFamily: FONT.body },

  addBtn: {
    backgroundColor: COLOR.primary,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  addText: { color: "#fff", fontFamily: FONT.bodyBold },

  card: {
    flex: 1,
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    overflow: "hidden",
    minHeight: 210,
  },
  thumbWrap: { height: 110, backgroundColor: COLOR.muted },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 10, gap: 6 },
  itemTitle: { color: COLOR.text, fontFamily: FONT.headingAlt },
  meta: { color: COLOR.sub, fontSize: 12, fontFamily: FONT.body },

  badge: { position: "absolute", top: 6, right: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: FONT.bodyBold },
});


