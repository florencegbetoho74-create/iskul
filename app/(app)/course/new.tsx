import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { createCourse } from "@/storage/courses";
import { useRouter } from "expo-router";

export default function NewCourse() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!user) return;
    if (!title.trim() || !level.trim() || !subject.trim()) {
      Alert.alert("Champs requis", "Merci de compléter tous les champs.");
      return;
    }
    try {
      setLoading(true);
      const created = await createCourse({
        title: title.trim(),
        level: level.trim(),
        subject: subject.trim(),
        chapters: [],
        published: false,
        ownerId: user.id,
        ownerName: user.name
      });
      Alert.alert("Brouillon créé", "Passez en édition pour compléter.", [
        { text: "OK", onPress: () => router.replace(`/(app)/course/edit/${created.id}`) }
      ]);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Création impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un cours</Text>
      <TextInput placeholder="Titre du cours" placeholderTextColor="#6b7280" style={styles.input} value={title} onChangeText={setTitle} />
      <TextInput placeholder="Niveau (Seconde, Première, Terminale…)" placeholderTextColor="#6b7280" style={styles.input} value={level} onChangeText={setLevel} />
      <TextInput placeholder="Matière (Maths, Physique, ...)" placeholderTextColor="#6b7280" style={styles.input} value={subject} onChangeText={setSubject} />
      <TouchableOpacity style={[styles.primary, loading && { opacity: 0.7 }]} onPress={save} disabled={loading}>
        <Ionicons name="save-outline" size={18} color="#fff" />
        <Text style={styles.primaryText}>{loading ? "Création..." : "Enregistrer le brouillon"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg, padding: 16, gap: 12 },
  title: { color: COLOR.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  input: { backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLOR.border },
  primary: { backgroundColor: COLOR.primary, borderRadius: 14, padding: 14, alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "800" }
});
