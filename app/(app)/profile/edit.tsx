import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { getProfile, upsertProfile } from "@/storage/profile";
import { persistAttachments } from "@/storage/files";

const ACCENT = ["#1D4ED8", "#2563EB"] as const;

export default function EditProfile() {
  const { user, ...auth } = useAuth() as any;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profDocRole, setProfDocRole] = useState<string | undefined>(undefined);

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [subjects, setSubjects] = useState("");
  const [busy, setBusy] = useState(false);

  const urlRef = useRef<TextInput>(null);

  const isTeacher = useMemo(() => {
    return profDocRole === "teacher" || user?.role === "teacher";
  }, [profDocRole, user?.role]);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const p = await getProfile(user.id);
      if (p) {
        setName(p.name ?? user.name ?? "");
        setAvatarUrl(p.avatarUrl ?? "");
        setBio(p.bio ?? "");
        setEmail(p.email ?? user.email ?? "");
        setPhone(p.phone ?? "");
        setSchool(p.school ?? "");
        setGrade(p.grade ?? "");
        setSubjects((p.subjects ?? []).join(", "));
        setProfDocRole(p.role);
      }
    })();
  }, [user?.id]);

  const pickAvatar = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "image/*", multiple: false } as any);
    // @ts-ignore
    if (res?.canceled) return;
    // @ts-ignore
    const doc = res.assets ? res.assets[0] : res;
    if (!doc?.uri) return;
    setBusy(true);
    try {
      const [att] = await persistAttachments([
        { uri: doc.uri, name: doc.name ?? "avatar.jpg", mime: doc.mimeType ?? "image/*", size: (doc.size as any) ?? undefined },
      ]);
      if (att?.uri) setAvatarUrl(att.uri);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Echec de l'import de la photo.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!user?.id) return;
    if (!name.trim()) {
      Alert.alert("Nom requis", "Merci d'indiquer votre nom.");
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("Email invalide", "Merci de verifier l'adresse email.");
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        bio: bio.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        school: school.trim() || undefined,
      };
      if (isTeacher) {
        payload.subjects = subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        payload.grade = undefined;
      } else {
        payload.grade = grade.trim() || undefined;
        payload.subjects = undefined;
      }

      await upsertProfile(user.id, payload);

      try {
        if (auth?.setUser && name.trim() && name.trim() !== user.name) {
          auth.setUser({ ...user, name: name.trim() });
        }
      } catch {}

      Alert.alert("Enregistre", "Votre profil a ete mis a jour.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'enregistrer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLOR.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Modifier le profil</Text>

        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </View>

          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.secondary} onPress={pickAvatar} disabled={busy} activeOpacity={0.9}>
              <Ionicons name="image-outline" size={16} color={COLOR.text} />
              <Text style={styles.secondaryTxt}>{busy ? "Import..." : "Choisir une photo"}</Text>
            </TouchableOpacity>

            <View style={{ height: 8 }} />

            <View style={styles.urlRow}>
              <Ionicons name="link-outline" size={16} color={COLOR.sub} />
              <TextInput
                ref={urlRef}
                style={styles.urlInput}
                placeholder="Ou coller une URL d'image"
                placeholderTextColor={COLOR.sub}
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                keyboardType="url"
                textContentType="URL"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              {!!avatarUrl && (
                <TouchableOpacity onPress={() => setAvatarUrl("")} hitSlop={8}>
                  <Ionicons name="close" size={16} color={COLOR.sub} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Informations</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom complet *"
            placeholderTextColor={COLOR.sub}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLOR.sub}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Telephone"
            placeholderTextColor={COLOR.sub}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Etablissement"
            placeholderTextColor={COLOR.sub}
            value={school}
            onChangeText={setSchool}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>{isTeacher ? "Pedagogie" : "Scolarite"}</Text>
          {isTeacher ? (
            <TextInput
              style={styles.input}
              placeholder="Matieres (separees par des virgules)"
              placeholderTextColor={COLOR.sub}
              value={subjects}
              onChangeText={setSubjects}
              autoCapitalize="sentences"
            />
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Classe (ex. Seconde, Terminale)"
              placeholderTextColor={COLOR.sub}
              value={grade}
              onChangeText={setGrade}
            />
          )}
          <TextInput
            style={[styles.input, { minHeight: 96 }]}
            multiline
            placeholder="Bio"
            placeholderTextColor={COLOR.sub}
            value={bio}
            onChangeText={setBio}
          />
        </View>

        <TouchableOpacity onPress={save} activeOpacity={0.9} disabled={busy} style={{ marginTop: 6 }}>
          <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.primaryTxt}>{busy ? "En cours..." : "Enregistrer"}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading, marginBottom: 10 },

  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { marginRight: 12 },
  avatarRing: { width: 88, height: 88, borderRadius: 999, padding: 3 },
  avatar: { width: "100%", height: "100%", borderRadius: 999, backgroundColor: COLOR.muted, borderWidth: 2, borderColor: COLOR.border },
  avatarFallback: { alignItems: "center", justifyContent: "center" },

  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  urlInput: {
    flex: 1,
    color: COLOR.text,
    marginHorizontal: 8,
    paddingVertical: 0,
    fontFamily: FONT.body,
  },

  group: {
    marginTop: 14,
    backgroundColor: COLOR.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    padding: 12,
  },
  groupTitle: { color: COLOR.sub, fontFamily: FONT.bodyBold, marginBottom: 8 },

  input: {
    backgroundColor: COLOR.muted,
    color: COLOR.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    marginTop: 8,
    fontFamily: FONT.body,
  },

  primaryGrad: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryTxt: { color: "#fff", fontFamily: FONT.bodyBold, marginLeft: 8 },

  secondary: {
    backgroundColor: COLOR.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  secondaryTxt: { color: COLOR.text, fontFamily: FONT.bodyBold, marginLeft: 8 },
});


