import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/lib/supabase";
import { COLOR, FONT } from "@/theme/colors";

const BG = ["#F4EEE6", "#EAF1FF", "#F4F7EE"] as const;
const ACCENT = ["#1D4ED8", "#2563EB"] as const;

const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s || "");

function getErrorMessage(error: any): string {
  const msg = String(error?.message || "");
  if (!msg) return "Echec de l'inscription.";
  if (msg.includes("already") || msg.includes("registered")) return "Cette adresse email existe deja.";
  if (msg.includes("portal_closed")) return "Le portail prof est temporairement ferme.";
  if (msg.includes("invalid_portal_key")) return "Code d'acces invalide.";
  if (msg.includes("weak_password")) return "Mot de passe trop faible (8 caracteres min).";
  if (msg.includes("invalid_email")) return "Adresse email invalide.";
  return msg;
}

export default function TeacherPortal() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [school, setSchool] = useState("");
  const [subjects, setSubjects] = useState("");
  const [portalKey, setPortalKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const disabled = useMemo(() => {
    if (loading) return true;
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) return true;
    if (!isEmail(email.trim())) return true;
    if (password.trim().length < 8) return true;
    if (password !== confirmPassword) return true;
    if (!portalKey.trim()) return true;
    return false;
  }, [name, email, password, confirmPassword, loading, portalKey]);

  const onSubmit = async () => {
    if (disabled) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error } = await supabase.functions.invoke("teacher-register", {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          school: school.trim() || null,
          subjects: subjects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          portalKey: portalKey.trim(),
        },
      });

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.error || "registration_failed");
      }

      setSuccess("Compte professeur cree. Connectez-vous depuis l'application mobile.");
    } catch (e: any) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={BG} style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.heroRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color={COLOR.text} />
              <Text style={styles.heroBadgeText}>Portail prive</Text>
            </View>
            <Text style={styles.heroTitle}>Inscription Professeur</Text>
            <Text style={styles.heroSub}>
              Ce portail cree un compte enseignant utilisable directement dans l'app iSkul.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <Field label="Nom complet" value={name} onChangeText={setName} placeholder="Ex: Mariam Diallo" />
              <Field
                label="Email professionnel"
                value={email}
                onChangeText={setEmail}
                placeholder="nom@ecole.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.row}>
              <Field
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholder="8 caracteres minimum"
                secureTextEntry
              />
              <Field
                label="Confirmer mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Retaper le mot de passe"
                secureTextEntry
              />
            </View>

            <View style={styles.row}>
              <Field label="Etablissement" value={school} onChangeText={setSchool} placeholder="College/Lycee/Universite" />
              <Field
                label="Matieres"
                value={subjects}
                onChangeText={setSubjects}
                placeholder="Maths, SVT, Physique"
              />
            </View>

            <Field
              label="Code d'acces portail"
              value={portalKey}
              onChangeText={setPortalKey}
              placeholder="Code prive transmis en interne"
              autoCapitalize="none"
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <Pressable onPress={onSubmit} disabled={disabled} style={{ marginTop: 14 }}>
              <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.cta, disabled && { opacity: 0.6 }]}>
                <Text style={styles.ctaText}>{loading ? "Creation..." : "Creer mon compte prof"}</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Deja un compte ?</Text>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable style={styles.ghostBtn}>
                  <Text style={styles.ghostText}>Se connecter</Text>
                </Pressable>
              </Link>
              {success ? (
                <Pressable onPress={() => router.push("/(auth)/sign-in")} style={styles.ghostBtn}>
                  <Text style={styles.ghostText}>Aller a la connexion</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
}) {
  return (
    <View style={{ flex: 1, minWidth: 220 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7D8696"
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  wrap: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 28, paddingBottom: 28, alignItems: "center" },
  heroRow: { width: "100%", maxWidth: 980 },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  heroTitle: { marginTop: 10, color: COLOR.text, fontFamily: FONT.heading, fontSize: 30 },
  heroSub: { marginTop: 6, color: COLOR.sub, fontFamily: FONT.body, maxWidth: 720 },
  card: {
    width: "100%",
    maxWidth: 980,
    marginTop: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    gap: 10,
    shadowColor: "#0B1D39",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  label: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: "#F9FBFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLOR.text,
    fontFamily: FONT.body,
  },
  error: { marginTop: 8, color: "#B91C1C", fontFamily: FONT.bodyBold },
  success: { marginTop: 8, color: "#15803D", fontFamily: FONT.bodyBold },
  cta: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  ctaText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 15 },
  footerRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  footerText: { color: COLOR.sub, fontFamily: FONT.body },
  ghostBtn: {
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLOR.surface,
  },
  ghostText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
});



