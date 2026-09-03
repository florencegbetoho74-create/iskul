import React from "react";
import { Link } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

/** Degrades derives du theme : figes, ils ignoraient le mode sombre. */
const backgroundGradient = (t: Theme): readonly [string, string, string] =>
  t.name === "dark"
    ? [t.color.bg, t.color.surfaceSunk, t.color.bg]
    : [t.color.bg, t.color.primarySoft, t.color.bg];

const accentGradient = (t: Theme): readonly [string, string] => [
  t.color.primary,
  t.color.primaryPressed,
];

export default function Landing() {
  const { styles, theme } = useThemedStyles(makeStyles);
  return (
    <LinearGradient colors={backgroundGradient(theme)} style={styles.container}>
      <View style={styles.heroCard}>
        <Image source={require("../../assets/logo.png")} style={styles.logo} />
        <View style={styles.badge}>
          <Ionicons name="sparkles-outline" size={14} color={theme.color.primary} />
          <Text style={styles.badgeText}>Plateforme premium</Text>
        </View>
        <Text style={styles.title}>iSkul</Text>
        <Text style={styles.subtitle}>Apprendre mieux, dans la langue qui aide vraiment.</Text>

        <View style={styles.primaryRow}>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity style={styles.primaryBtn}>
              <LinearGradient colors={accentGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnInner}>
                <Text style={styles.primaryText}>Creer un compte eleve</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Link>
        </View>

        <Link href="/(auth)/sign-in" asChild>
          <TouchableOpacity style={styles.ghostBtn}>
            <Text style={styles.ghostText}>Se connecter</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </LinearGradient>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: t.space.xl },
  heroCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: t.color.surface,
    borderRadius: t.radius.xl,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: t.space.xl,
    gap: t.space.md,
    ...t.elevation(3),
  },
  logo: { width: 74, height: 74, resizeMode: "contain", marginBottom: 4 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "auto",
    alignSelf: "flex-start",
    backgroundColor: t.color.primarySoft,
    borderWidth: 1,
    borderColor: t.color.borderStrong,
    borderRadius: t.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
  title: { color: t.color.text, fontSize: 30, fontFamily: t.type.title.fontFamily },
  subtitle: { color: t.color.textMuted, fontSize: 15, fontFamily: t.type.body.fontFamily, marginTop: 2 },
  primaryRow: { flexDirection: "row", marginTop: 6 },
  primaryBtn: { flex: 1, borderRadius: t.radius.md, overflow: "hidden" },
  primaryBtnInner: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space.lg,
  },
  primaryText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 15 },
  ghostBtn: {
    minHeight: 46,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: t.color.border,
    marginTop: 4,
    backgroundColor: t.color.surface,
  },
  ghostText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily },
});



