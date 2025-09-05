import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";

export type LiveCard = {
  id: string; title: string; when: string; teacher: string; href?: string; status?: string;
};

export default function LiveItem({ item }: { item: LiveCard }) {
  return (
    <Link href={item.href ?? `/(app)/live/${item.id}`} asChild>
      <TouchableOpacity style={styles.card} activeOpacity={0.9}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.meta}>{item.teacher} • {item.when}</Text>
          {item.status ? <Text style={[styles.badge, item.status === "live" && { color: "#10b981" }]}>{item.status}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9aa0a6" />
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLOR.card, borderRadius: 16, borderColor: COLOR.border, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: COLOR.text, fontWeight: "800" },
  meta: { color: COLOR.sub, marginTop: 4 },
  badge: { color: "#f59e0b", marginTop: 4, fontWeight: "800" }
});
