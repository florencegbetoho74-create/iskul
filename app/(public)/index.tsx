import React from "react";
import { Link } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLOR } from "@/theme/colors";

export default function Landing() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>iSkul</Text>
      <Text style={styles.subtitle}>Plateforme EdTech moderne pour le secondaire</Text>

      <View style={{ height: 24 }} />

      <Link href="/(auth)/sign-in" asChild>
        <TouchableOpacity style={styles.primaryBtn}><Text style={styles.btnText}>Se connecter</Text></TouchableOpacity>
      </Link>

      <Link href="/(auth)/sign-up" asChild>
        <TouchableOpacity style={styles.ghostBtn}><Text style={styles.ghostText}>Créer un compte</Text></TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { color: COLOR.text, fontSize: 48, fontWeight: "800", letterSpacing: 2 },
  subtitle: { color: COLOR.sub, fontSize: 16, textAlign: "center", marginTop: 8 },
  primaryBtn: { backgroundColor: COLOR.primary, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 16, width: "100%", maxWidth: 360, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ghostBtn: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 16, width: "100%", maxWidth: 360, alignItems: "center", borderWidth: 1, borderColor: COLOR.border, marginTop: 12 },
  ghostText: { color: COLOR.text, fontSize: 16, fontWeight: "600" }
});
