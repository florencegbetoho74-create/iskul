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

const DEFAULT_HOME = "/(app)/(tabs)";
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

export default function SignIn() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => {
    if (loading) return true;
    if (!email.trim() || !password.trim()) return true;
    if (!isEmail(email.trim())) return true;
    return false;
  }, [email, password, loading]);

  const handle = async () => {
    try {
      if (disabled) return;
      setLoading(true);
      await signIn({
        email: email.trim(),
        password: password.trim(),
      });
      router.replace(DEFAULT_HOME);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de se connecter.");
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
              <Ionicons name="sparkles-outline" size={14} color={theme.color.primary} />
              <Text style={styles.heroBadgeText}>Apprendre autrement</Text>
            </View>
            <Text style={styles.heroTitle}>Bon retour sur iSkul</Text>
            <Text style={styles.heroSubtitle}>Connectez-vous pour reprendre vos cours, lives et quiz.</Text>
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
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputShell}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.color.textMuted} />
                <TextInput
                  secureTextEntry
                  placeholder="Votre mot de passe"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={handle}
                />
              </View>
            </View>

            <View style={styles.forgotRow}>
              <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} activeOpacity={0.8}>
                <Text style={styles.forgotText}>Mot de passe oublie ?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handle} activeOpacity={disabled ? 1 : 0.9} style={styles.ctaWrap}>
              <LinearGradient
                colors={accentGradient(theme)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.primaryGrad, (disabled || loading) && styles.ctaDisabled]}
              >
                <Ionicons name="arrow-forward" size={18} color={theme.color.textOnPrimary} />
                <Text style={styles.primaryText}>{loading ? "Connexion..." : "Se connecter"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              Pas de compte ? <Link href="/(auth)/sign-up">Créer un compte</Link>
            </Text>
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
  logo: { width: 82, height: 82, resizeMode: "contain", marginBottom: 4 },
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
  heroTitle: { color: t.color.text, fontSize: 25, fontFamily: t.type.title.fontFamily, textAlign: "center" },
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
  forgotRow: {
    alignItems: "flex-end",
    marginTop: 2,
  },
  forgotText: {
    color: t.color.primary,
    fontFamily: t.type.bodyStrong.fontFamily,
    fontSize: 12,
  },
  ctaWrap: { marginTop: 6 },
  primaryGrad: {
    minHeight: 50,
    borderRadius: t.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaDisabled: { opacity: 0.55 },
  primaryText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 15 },
  footerText: { color: t.color.textMuted, textAlign: "center", marginTop: 4, fontFamily: t.type.body.fontFamily },
});




