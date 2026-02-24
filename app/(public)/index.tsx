import React from "react";
import { Link } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { COLOR, ELEVATION, FONT, RADIUS, SPACE } from "@/theme/colors";

const BG = ["#F4F7FC", "#EAF0FF", "#F1F7FF"] as const;
const ACCENT = ["#2F5BFF", "#5B85FF"] as const;

export default function Landing() {
  return (
    <LinearGradient colors={BG} style={styles.container}>
      <View style={styles.heroCard}>
        <Image source={require("../../assets/logo.png")} style={styles.logo} />
        <View style={styles.badge}>
          <Ionicons name="sparkles-outline" size={14} color={COLOR.primary} />
          <Text style={styles.badgeText}>Plateforme premium</Text>
        </View>
        <Text style={styles.title}>iSkul</Text>
        <Text style={styles.subtitle}>Apprendre mieux, dans la langue qui aide vraiment.</Text>

        <View style={styles.primaryRow}>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity style={styles.primaryBtn}>
              <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnInner}>
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

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.lg },
  heroCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: SPACE.lg,
    gap: SPACE.sm,
    ...ELEVATION.floating,
  },
  logo: { width: 74, height: 74, resizeMode: "contain", marginBottom: 4 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "auto",
    alignSelf: "flex-start",
    backgroundColor: COLOR.tint,
    borderWidth: 1,
    borderColor: COLOR.ring,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 11 },
  title: { color: COLOR.text, fontSize: 30, fontFamily: FONT.heading },
  subtitle: { color: COLOR.sub, fontSize: 15, fontFamily: FONT.body, marginTop: 2 },
  primaryRow: { flexDirection: "row", marginTop: 6 },
  primaryBtn: { flex: 1, borderRadius: RADIUS.md, overflow: "hidden" },
  primaryBtnInner: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
  },
  primaryText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 15 },
  ghostBtn: {
    minHeight: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLOR.border,
    marginTop: 4,
    backgroundColor: COLOR.surface,
  },
  ghostText: { color: COLOR.text, fontFamily: FONT.bodyBold },
});



