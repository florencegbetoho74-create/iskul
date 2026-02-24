import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";

import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { listMine } from "@/storage/lives";

const BG = ["#F5F4F1", "#EAF0FF", "#F6F1EA"] as const;

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function MyLives() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const rows = await listMine(user.id);
    setItems(rows);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const Header = () => (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mes lives</Text>
          <Text style={styles.subtitle}>Suivez vos sessions planifiees</Text>
        </View>
        <Link href="/(app)/live/new" asChild>
          <Pressable style={styles.addBtn}>
            <Ionicons name="add" size={18} color="#fff" />
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
                <Ionicons name="play" size={16} color={COLOR.text} />
                <Text style={styles.secondaryText}>Ouvrir</Text>
              </Pressable>
            </Link>
          </View>
        )}
        ListHeaderComponent={Header}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, paddingTop: 8 }}>Aucun live programme.</Text>}
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

  item: {
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    padding: 14,
    borderColor: COLOR.border,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemTitle: { color: COLOR.text, fontFamily: FONT.headingAlt },
  meta: { color: COLOR.sub, marginTop: 4, fontFamily: FONT.body },
  secondary: {
    backgroundColor: COLOR.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  secondaryText: { color: COLOR.text, fontFamily: FONT.bodyBold },
});


