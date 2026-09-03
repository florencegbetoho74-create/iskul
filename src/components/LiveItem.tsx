import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

export type LiveCard = {
  id: string; title: string; when: string; teacher: string; href?: string; status?: string;
};

export default function LiveItem({ item }: { item: LiveCard }) {
  const { styles, theme } = useThemedStyles(makeStyles);
  const router = useRouter();
  const statusTone = item.status === "live" ? theme.color.success : item.status === "ended" ? theme.color.textMuted : theme.color.warning;
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
      <Ionicons name="chevron-forward" size={18} color={theme.color.textMuted} />
    </TouchableOpacity>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  card: {
    backgroundColor: t.color.surface,
    borderRadius: 18,
    borderColor: t.color.border,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: t.color.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: t.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 15 },
  meta: { color: t.color.textMuted, marginTop: 2, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  status: { marginTop: 4, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 }
});

