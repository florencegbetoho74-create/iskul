import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from "react-native";
import { COLOR } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { getProfile, upsertProfile } from "@/storage/profile";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { persistAttachments } from "@/storage/files";

export default function EditProfile() {
  const auth = useAuth() as any;
  const user = auth?.user;
  const isTeacher = user?.role === "teacher";

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");       // élève
  const [subjects, setSubjects] = useState(""); // prof: "Maths, Physique"

  const urlRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const p = await getProfile(user.id);
      if (p) {
        setName(p.name ?? user.name);
        setAvatarUrl(p.avatarUrl ?? "");
        setBio(p.bio ?? "");
        setEmail(p.email ?? "");
        setPhone(p.phone ?? "");
        setSchool(p.school ?? "");
        setGrade(p.grade ?? "");
        setSubjects((p.subjects ?? []).join(", "));
      }
    })();
  }, [user?.id]);

  const pickAvatar = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "image/*", multiple: false } as any);
    // @ts-ignore
    if (res.canceled) return;
    // @ts-ignore
    const doc = res.assets ? res.assets[0] : res;
    if (!doc?.uri) return;
    const [att] = await persistAttachments([{ uri: doc.uri, name: doc.name ?? "avatar.jpg", mime: doc.mimeType ?? doc.mime ?? "image/*", size: doc.size ?? undefined }]);
    setAvatarUrl(att.uri);
  };

  const save = async () => {
    if (!user) return;
    if (!name.trim()) return Alert.alert("Nom requis", "Merci d'indiquer votre nom.");
    const payload = {
      name: name.trim(),
      avatarUrl: avatarUrl.trim() || undefined,
      bio: bio.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      school: school.trim() || undefined,
      grade: isTeacher ? undefined : (grade.trim() || undefined),
      subjects: isTeacher ? subjects.split(",").map(s => s.trim()).filter(Boolean) : undefined
    };
    await upsertProfile(user.id, payload);

    // Optionnel : si le provider supporte setUser, on synchronise le nom affiché
    try {
      if (auth?.setUser && name.trim() !== user.name) {
        auth.setUser({ ...user, name: name.trim() });
      }
    } catch {}

    Alert.alert("Enregistré", "Votre profil a été mis à jour.");
    history.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLOR.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.title}>Modifier le profil</Text>

        <View style={styles.avatarRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]} />
          )}
          <View style={{ gap: 8, flex: 1 }}>
            <TouchableOpacity style={styles.secondary} onPress={pickAvatar}>
              <Ionicons name="image-outline" size={18} color="#cbd5e1" />
              <Text style={styles.secondaryTxt}>Choisir une photo</Text>
            </TouchableOpacity>
            <TextInput
              ref={urlRef}
              style={styles.input}
              placeholder="…ou coller une URL d'image"
              placeholderTextColor="#6b7280"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              keyboardType="url"
              textContentType="URL"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <TextInput style={styles.input} placeholder="Nom complet *" placeholderTextColor="#6b7280" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#6b7280" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Téléphone" placeholderTextColor="#6b7280" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Établissement" placeholderTextColor="#6b7280" value={school} onChangeText={setSchool} />
        {isTeacher ? (
          <TextInput style={styles.input} placeholder="Matières (séparées par des virgules)" placeholderTextColor="#6b7280" value={subjects} onChangeText={setSubjects} />
        ) : (
          <TextInput style={styles.input} placeholder="Classe (ex. Seconde, Terminale…)" placeholderTextColor="#6b7280" value={grade} onChangeText={setGrade} />
        )}
        <TextInput style={[styles.input, { minHeight: 90 }]} multiline placeholder="Bio" placeholderTextColor="#6b7280" value={bio} onChangeText={setBio} />

        <TouchableOpacity style={styles.primary} onPress={save}>
          <Ionicons name="save-outline" size={18} color="#fff" />
          <Text style={styles.primaryTxt}>Enregistrer</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { color: COLOR.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  avatarRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#0b0b0c", borderWidth: 2, borderColor: "#2a2b2f" },
  avatarFallback: { },
  input: { backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLOR.border },
  primary: { backgroundColor: COLOR.primary, borderRadius: 14, padding: 14, alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center" },
  primaryTxt: { color: "#fff", fontWeight: "800" },
  secondary: { backgroundColor: "#111214", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#1F2023" },
  secondaryTxt: { color: "#cbd5e1", fontWeight: "800" }
});
