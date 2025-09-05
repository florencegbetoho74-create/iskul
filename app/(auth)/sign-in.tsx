import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { COLOR } from "@/theme/colors";

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    try {
      setLoading(true);
      await signIn({ email, password });
      router.replace("/(app)/(tabs)");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de se connecter.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#6b7280"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        secureTextEntry
        placeholder="Mot de passe"
        placeholderTextColor="#6b7280"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity disabled={loading} style={[styles.primary, loading && { opacity: 0.7 }]} onPress={handle}>
        <Text style={styles.primaryText}>{loading ? "Connexion..." : "Se connecter"}</Text>
      </TouchableOpacity>

      <View style={{ height: 12 }} />
      <Text style={{ color: COLOR.sub }}>
        Pas de compte ? <Link href="/(auth)/sign-up">Créer un compte</Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 24, gap: 16 },
  title: { color: COLOR.text, fontSize: 28, fontWeight: "800" },
  input: { backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLOR.border },
  primary: { backgroundColor: COLOR.primary, borderRadius: 14, padding: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
