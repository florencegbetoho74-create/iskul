import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { COLOR } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { uploadOne } from "@/lib/upload";
import { addBook } from "@/storage/books";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "expo-router";

export default function NewBook() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [price, setPrice] = useState<string>("0");

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const pickCover = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["image/*"], multiple: false, copyToCacheDirectory: true } as any);
    // @ts-ignore
    if (res.canceled) return;
    // @ts-ignore
    const doc = res.assets ? res.assets[0] : res;
    if (!doc?.uri) return;
    setBusy(true);
    try {
      const up = await uploadOne({ uri: doc.uri, name: doc.name ?? "cover.jpg", contentType: doc.mimeType }, `books/covers`);
      setCoverUrl(up.url);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Upload cover échoué");
    } finally { setBusy(false); }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/epub+zip", "public.item", "application/octet-stream"],
      multiple: false,
      copyToCacheDirectory: true
    } as any);
    // @ts-ignore
    if (res.canceled) return;
    // @ts-ignore
    const doc = res.assets ? res.assets[0] : res;
    if (!doc?.uri) return;
    setBusy(true);
    try {
      const up = await uploadOne({ uri: doc.uri, name: doc.name ?? "book.pdf", contentType: doc.mimeType }, `books/files`);
      setFileUrl(up.url);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Upload fichier échoué");
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim() || !fileUrl) {
      Alert.alert("Champs requis", "Titre et fichier sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      const created = await addBook({
        title: title.trim(),
        subject: subject.trim() || undefined,
        level: level.trim() || undefined,
        price: Number(price) || 0,
        coverUrl: coverUrl || null,
        fileUrl,
        ownerId: user.id,
        ownerName: user.name,
        published: true
      } as any);
      Alert.alert("Ajouté", "Livre créé.", [{ text: "OK", onPress: () => router.replace(`/(app)/library/${created.id}`) }]);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Création impossible.");
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>Ajouter un livre</Text>
      <TextInput placeholder="Titre" placeholderTextColor="#6b7280" style={styles.input} value={title} onChangeText={setTitle} />
      <TextInput placeholder="Matière" placeholderTextColor="#6b7280" style={styles.input} value={subject} onChangeText={setSubject} />
      <TextInput placeholder="Niveau" placeholderTextColor="#6b7280" style={styles.input} value={level} onChangeText={setLevel} />
      <TextInput placeholder="Prix (FCFA, 0 = Gratuit)" placeholderTextColor="#6b7280" keyboardType="numeric" style={styles.input} value={price} onChangeText={setPrice} />

      <TouchableOpacity style={[styles.secondary, busy && { opacity: 0.6 }]} onPress={pickCover} disabled={busy}>
        <Ionicons name="image" size={18} color="#cbd5e1" />
        <Text style={styles.secondaryText}>{coverUrl ? "Changer la couverture" : "Importer une couverture"}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondary, busy && { opacity: 0.6 }]} onPress={pickFile} disabled={busy}>
        <Ionicons name="document-text" size={18} color="#cbd5e1" />
        <Text style={styles.secondaryText}>{fileUrl ? "Remplacer le fichier" : "Importer le fichier (PDF/EPUB…)"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.primary, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
        <Text style={styles.primaryText}>{busy ? "En cours…" : "Enregistrer"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  title: { color: COLOR.text, fontSize: 20, fontWeight: "800", marginBottom: 6 },
  input: { backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLOR.border },
  primary: { backgroundColor: COLOR.primary, borderRadius: 14, padding: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondary: { backgroundColor: "#111214", borderRadius: 14, padding: 12, alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", borderWidth: 1, borderColor: COLOR.border },
  secondaryText: { color: "#cbd5e1", fontWeight: "800" }
});
