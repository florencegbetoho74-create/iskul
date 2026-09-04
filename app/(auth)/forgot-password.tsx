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
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

/** Degrade d'accent derive du theme. */
const accentGradient = (t: Theme): readonly [string, string] => [
  t.color.primary,
  t.color.primaryPressed,
];
/** Fond de page derive du theme. */
const surfaceGradient = (t: Theme): readonly [string, string, string] =>
  t.name === "dark"
    ? [t.color.bg, t.color.surfaceSunk, t.color.bg]
    : [t.color.bg, t.color.primarySoft, t.color.bg];
const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s || "");

export default function ForgotPassword() {
  const { styles, theme } = useThemedStyles(makeStyles);
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
    <LinearGradient colors={surfaceGradient(theme)} style={styles.bg}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[
            styles.center,
            {
              paddingTop: insets.top + theme.space.lg,
              paddingBottom: Math.max(theme.space.xxl, insets.bottom + theme.space.lg),
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Image source={require("../../assets/logo.png")} style={styles.logo} />
            <View style={styles.heroBadge}>
              <Ionicons name="mail-open-outline" size={14} color={theme.color.primary} />
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
                <Ionicons name="mail-outline" size={18} color={theme.color.textMuted} />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="exemple@ecole.com"
                  placeholderTextColor={theme.color.textFaint}
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
                colors={accentGradient(theme)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.primaryGrad, (disabled || loading) && styles.ctaDisabled]}
              >
                <Ionicons name="send-outline" size={18} color={theme.color.textOnPrimary} />
                <Text style={styles.primaryText}>
                  {loading ? "Envoi..." : "Envoyer le lien de reinitialisation"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {sent ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={16} color={theme.color.success} />
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
                <Text style={styles.footerText}>Créer un compte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space.lg,
    gap: t.space.lg,
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
    backgroundColor: t.color.primarySoft,
    borderWidth: 1,
    borderColor: t.color.borderStrong,
    borderRadius: t.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
  heroTitle: { color: t.color.text, fontSize: 24, fontFamily: t.type.title.fontFamily, textAlign: "center" },
  heroSubtitle: { color: t.color.textMuted, fontSize: 14, fontFamily: t.type.body.fontFamily, textAlign: "center" },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: t.color.surface,
    borderRadius: t.radius.xl,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: t.space.xl,
    gap: t.space.md,
    ...t.elevation(3),
  },
  fieldBlock: { gap: 6 },
  label: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceSunk,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  inputShellError: {
    borderColor: t.color.danger,
    backgroundColor: t.color.dangerSoft,
  },
  input: {
    flex: 1,
    color: t.color.text,
    fontFamily: t.type.body.fontFamily,
    fontSize: 14,
    paddingVertical: 11,
  },
  ctaWrap: { marginTop: 6 },
  primaryGrad: {
    minHeight: 50,
    borderRadius: t.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  ctaDisabled: { opacity: 0.55 },
  primaryText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 14, textAlign: "center" },
  successBox: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: t.color.success,
    backgroundColor: t.color.successSoft,
    borderRadius: t.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  successText: {
    flex: 1,
    color: t.color.success,
    fontFamily: t.type.body.fontFamily,
    fontSize: 12,
  },
  linksRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  footerText: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
});



