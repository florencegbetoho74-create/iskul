import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import { COLOR } from "@/theme/colors";
import { useAuth, Role } from "@/providers/AuthProvider";
import { useRouter, Link } from "expo-router";

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<Role>("student");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    try {
      setLoading(true);
      await signUp({ name, email, password, role });
      router.replace("/(app)/(tabs)");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un compte</Text>

      <View style={styles.roleToggle}>
        <TouchableOpacity onPress={() => setRole("student")} style={[styles.roleBtn, role === "student" && styles.roleActive]}>
          <Text style={[styles.roleText, role === "student" && styles.roleActiveText]}>Élève</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRole("teacher")} style={[styles.roleBtn, role === "teacher" && styles.roleActive]}>
          <Text style={[styles.roleText, role === "teacher" && styles.roleActiveText]}>Professeur</Text>
        </TouchableOpacity>
      </View>

      <TextInput placeholder="Nom complet" placeholderTextColor="#6b7280" style={styles.input} value={name} onChangeText={setName} />
      <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#6b7280" style={styles.input} value={email} onChangeText={setEmail} />
      <TextInput secureTextEntry placeholder="Mot de passe" placeholderTextColor="#6b7280" style={styles.input} value={password} onChangeText={setPassword} />

      <TouchableOpacity disabled={loading} style={[styles.primary, loading && { opacity: 0.7 }]} onPress={handle}>
        <Text style={styles.primaryText}>{loading ? "Création..." : "Créer le compte"}</Text>
      </TouchableOpacity>

      <View style={{ height: 12 }} />
      <Text style={{ color: COLOR.sub }}>
        Déjà un compte ? <Link href="/(auth)/sign-in">Se connecter</Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 24, gap: 16 },
  title: { color: COLOR.text, fontSize: 28, fontWeight: "800" },

  roleToggle: { flexDirection: "row", backgroundColor: "#111214", borderRadius: 14, borderColor: COLOR.border, borderWidth: 1 },
  roleBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 14 },
  roleActive: { backgroundColor: COLOR.primary },
  roleText: { color: COLOR.sub, fontWeight: "700" },
  roleActiveText: { color: "#fff" },

  input: { backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLOR.border },
  primary: { backgroundColor: COLOR.primary, borderRadius: 14, padding: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
