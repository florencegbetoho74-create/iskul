import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

export default function LiveWebFallback() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id || "").trim();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="desktop-outline" size={22} color={theme.color.text} />
        <Text style={styles.title}>Live video indisponible sur cette version web</Text>
        <Text style={styles.sub}>
          Utilisez l'application mobile pour participer au live Agora.
        </Text>
        {sessionId ? (
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Session</Text>
            <Text style={styles.metaValue}>{sessionId}</Text>
          </View>
        ) : null}
        <Pressable style={styles.pill}>
          <Text style={styles.pillText}>Version mobile requise</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    padding: 18,
    gap: 8,
  },
  title: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 20 },
  sub: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 13 },
  meta: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.bg,
    padding: 10,
  },
  metaLabel: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
  metaValue: { color: t.color.text, fontFamily: "Menlo", marginTop: 3 },
  pill: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.color.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: t.color.primarySoft,
  },
  pillText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
});
