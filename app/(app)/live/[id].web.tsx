import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { COLOR, FONT } from "@/theme/colors";

export default function LiveWebFallback() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id || "").trim();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="desktop-outline" size={22} color={COLOR.text} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    padding: 18,
    gap: 8,
  },
  title: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 20 },
  sub: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 13 },
  meta: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bg,
    padding: 10,
  },
  metaLabel: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 11 },
  metaValue: { color: COLOR.text, fontFamily: FONT.mono, marginTop: 3 },
  pill: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLOR.tint,
  },
  pillText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 11 },
});
