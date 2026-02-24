import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLOR, FONT } from "@/theme/colors";

export type LiveCard = {
  id: string; title: string; when: string; teacher: string; href?: string; status?: string;
};

export default function LiveItem({ item }: { item: LiveCard }) {
  const router = useRouter();
  const statusTone = item.status === "live" ? COLOR.success : item.status === "ended" ? COLOR.sub : COLOR.accent;
  const href = item.href ?? (item.id ? `/(app)/live/${item.id}` : undefined);
  return (
    <TouchableOpacity
      style={[styles.card, !href && { opacity: 0.6 }]}
      activeOpacity={0.9}
      onPress={() => (href ? router.push(href) : null)}
      disabled={!href}
    >
      <View style={styles.badge}>
        <Ionicons name="radio" size={16} color={statusTone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.meta}>{item.teacher} - {item.when}</Text>
        {item.status ? <Text style={[styles.status, { color: statusTone }]}>{item.status}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLOR.sub} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderColor: COLOR.border,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#0B1D39",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLOR.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  meta: { color: COLOR.sub, marginTop: 2, fontFamily: FONT.body, fontSize: 12 },
  status: { marginTop: 4, fontFamily: FONT.bodyBold, fontSize: 12 }
});

