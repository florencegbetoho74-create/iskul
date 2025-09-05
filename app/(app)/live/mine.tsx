import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { listMine, setStatus } from "@/storage/lives";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes directs</Text>
        <Link href="/(app)/live/new" asChild>
          <TouchableOpacity style={styles.addBtn}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addText}>Programmer</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.meta}>{fmtDate(item.startAt)} • {item.status}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Link href={`/(app)/live/${item.id}`} asChild>
                <TouchableOpacity style={styles.secondary}>
                  <Ionicons name="play" size={16} color="#cbd5e1" />
                  <Text style={styles.secondaryText}>Ouvrir</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, padding: 16 }}>Aucun live programmé.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  title: { color: COLOR.text, fontSize: 20, fontWeight: "800" },
  addBtn: { backgroundColor: COLOR.primary, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  addText: { color: "#fff", fontWeight: "800" },
  item: { backgroundColor: COLOR.card, borderRadius: 16, padding: 14, borderColor: COLOR.border, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  itemTitle: { color: COLOR.text, fontWeight: "800" },
  meta: { color: COLOR.sub, marginTop: 4 },
  secondary: { backgroundColor: "#111214", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", flexDirection: "row", gap: 6, borderWidth: 1, borderColor: COLOR.border },
  secondaryText: { color: "#cbd5e1", fontWeight: "800" }
});
