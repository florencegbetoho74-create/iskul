import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import type { Course } from "@/types/course";
import { watchByOwner } from "@/storage/courses";

/** Degrades derives du theme : figes, ils ignoraient le mode sombre. */
const backgroundGradient = (t: Theme): readonly [string, string, string] =>
  t.name === "dark"
    ? [t.color.bg, t.color.surfaceSunk, t.color.bg]
    : [t.color.bg, t.color.primarySoft, t.color.bg];

export default function MyCourses() {
  const { styles, theme } = useThemedStyles(makeStyles);
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
    <LinearGradient colors={backgroundGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mes cours</Text>
          <Text style={styles.subtitle}>Gerez vos brouillons et publications</Text>
        </View>
        <Link href="/(app)/course/new" asChild>
          <Pressable style={styles.addBtn}>
            <Ionicons name="add" size={18} color={theme.color.textOnPrimary} />
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
                  <Ionicons name="play-circle" size={22} color={theme.color.textMuted} />
                </View>
                <View style={[styles.badge, { backgroundColor: item.published ? theme.color.success : theme.color.warning }]}
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
          <Text style={{ color: theme.color.textMuted, paddingHorizontal: 16 }}>
            {ready ? "Aucun cours. Creez-en un pour commencer." : "Chargement..."}
          </Text>
        }
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },
  header: { paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  title: { color: t.color.text, fontSize: 22, fontFamily: t.type.title.fontFamily },
  subtitle: { color: t.color.textMuted, marginTop: 4, fontFamily: t.type.body.fontFamily },

  addBtn: {
    backgroundColor: t.color.primary,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  addText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily },

  card: {
    flex: 1,
    backgroundColor: t.color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: "hidden",
    minHeight: 210,
  },
  thumbWrap: { height: 110, backgroundColor: t.color.surfaceSunk },
  thumbFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 10, gap: 6 },
  itemTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily },
  meta: { color: t.color.textMuted, fontSize: 12, fontFamily: t.type.body.fontFamily },

  badge: { position: "absolute", top: 6, right: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: t.color.textOnPrimary, fontSize: 11, fontFamily: t.type.bodyStrong.fontFamily },
});


