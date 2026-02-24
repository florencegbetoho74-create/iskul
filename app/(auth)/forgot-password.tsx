import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/providers/AuthProvider";
import { COLOR, ELEVATION, FONT, RADIUS, SPACE } from "@/theme/colors";

const ACCENT = ["#2F5BFF", "#5B85FF"] as const;
const SURFACE_BG = ["#F4F7FC", "#ECF2FF", "#F2F7FF"] as const;
const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s || "");

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const disabled = useMemo(() => {
    if (loading) return true;
    if (!email.trim()) return true;
    if (!isEmail(email.trim())) return true;
    return false;
  }, [email, loading]);

  const handleReset = async () => {
    try {
      if (disabled) return;
      setLoading(true);
      await resetPassword(email.trim());
      setSent(true);
      Alert.alert(
        "Email envoye",
        "Si cette adresse existe, vous recevrez un lien pour reinitialiser votre mot de passe."
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d'envoyer l'email de reinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={SURFACE_BG} style={styles.bg}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[
            styles.center,
            {
              paddingTop: insets.top + SPACE.md,
              paddingBottom: Math.max(SPACE.xl, insets.bottom + SPACE.md),
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Image source={require("../../assets/logo.png")} style={styles.logo} />
            <View style={styles.heroBadge}>
              <Ionicons name="mail-open-outline" size={14} color={COLOR.primary} />
              <Text style={styles.heroBadgeText}>Recuperation compte</Text>
            </View>
            <Text style={styles.heroTitle}>Mot de passe oublie ?</Text>
            <Text style={styles.heroSubtitle}>
              Entrez votre email pour recevoir un lien de reinitialisation.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputShell, !!email && !isEmail(email) && styles.inputShellError]}>
                <Ionicons name="mail-outline" size={18} color={COLOR.sub} />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="exemple@ecole.com"
                  placeholderTextColor="#95A1B4"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleReset} activeOpacity={disabled ? 1 : 0.9} style={styles.ctaWrap}>
              <LinearGradient
                colors={ACCENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.primaryGrad, (disabled || loading) && styles.ctaDisabled]}
              >
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.primaryText}>
                  {loading ? "Envoi..." : "Envoyer le lien de reinitialisation"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {sent ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.successText}>
                  Email envoye. Verifiez votre boite de reception (et les spams).
                </Text>
              </View>
            ) : null}

            <View style={styles.linksRow}>
              <Text style={styles.footerText}>
                <Link href="/(auth)/sign-in">Retour connexion</Link>
              </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")}>
                <Text style={styles.footerText}>Creer un compte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
    gap: SPACE.md,
  },
  hero: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    gap: 7,
  },
  logo: { width: 80, height: 80, resizeMode: "contain", marginBottom: 4 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLOR.tint,
    borderWidth: 1,
    borderColor: COLOR.ring,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 11 },
  heroTitle: { color: COLOR.text, fontSize: 24, fontFamily: FONT.heading, textAlign: "center" },
  heroSubtitle: { color: COLOR.sub, fontSize: 14, fontFamily: FONT.body, textAlign: "center" },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: SPACE.lg,
    gap: SPACE.sm,
    ...ELEVATION.floating,
  },
  fieldBlock: { gap: 6 },
  label: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: "#F8FAFF",
    paddingHorizontal: 12,
    minHeight: 50,
  },
  inputShellError: {
    borderColor: COLOR.danger,
    backgroundColor: "#FFF4F4",
  },
  input: {
    flex: 1,
    color: COLOR.text,
    fontFamily: FONT.body,
    fontSize: 14,
    paddingVertical: 11,
  },
  ctaWrap: { marginTop: 6 },
  primaryGrad: {
    minHeight: 50,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  ctaDisabled: { opacity: 0.55 },
  primaryText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 14, textAlign: "center" },
  successBox: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  successText: {
    flex: 1,
    color: "#166534",
    fontFamily: FONT.body,
    fontSize: 12,
  },
  linksRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  footerText: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },
});



