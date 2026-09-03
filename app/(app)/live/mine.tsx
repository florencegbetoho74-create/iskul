import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { listMine } from "@/storage/lives";

/** Degrades derives du theme : figes, ils ignoraient le mode sombre. */
const backgroundGradient = (t: Theme): readonly [string, string, string] =>
  t.name === "dark"
    ? [t.color.bg, t.color.surfaceSunk, t.color.bg]
    : [t.color.bg, t.color.primarySoft, t.color.bg];

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function MyLives() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const rows = await listMine(user.id);
    setItems(rows);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const Header = () => (
    <LinearGradient colors={backgroundGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mes lives</Text>
          <Text style={styles.subtitle}>Suivez vos sessions planifiees</Text>
        </View>
        <Link href="/(app)/live/new" asChild>
          <Pressable style={styles.addBtn}>
            <Ionicons name="add" size={18} color={theme.color.textOnPrimary} />
            <Text style={styles.addText}>Programmer</Text>
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
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.meta}>{fmtDate(item.startAt)} - {item.status}</Text>
            </View>
            <Link href={`/(app)/live/${item.id}`} asChild>
              <Pressable style={styles.secondary}>
                <Ionicons name="play" size={16} color={theme.color.text} />
                <Text style={styles.secondaryText}>Ouvrir</Text>
              </Pressable>
            </Link>
          </View>
        )}
        ListHeaderComponent={Header}
        ListEmptyComponent={<Text style={{ color: theme.color.textMuted, paddingTop: 8 }}>Aucun live programme.</Text>}
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

  item: {
    backgroundColor: t.color.surface,
    borderRadius: 16,
    padding: 14,
    borderColor: t.color.border,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily },
  meta: { color: t.color.textMuted, marginTop: 4, fontFamily: t.type.body.fontFamily },
  secondary: {
    backgroundColor: t.color.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  secondaryText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily },
});


