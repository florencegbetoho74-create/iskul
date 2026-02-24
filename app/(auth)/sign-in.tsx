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

const DEFAULT_HOME = "/(app)/(tabs)";
const ACCENT = ["#2F5BFF", "#5B85FF"] as const;
const SURFACE_BG = ["#F4F7FC", "#ECF2FF", "#F2F7FF"] as const;
const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s || "");

export default function SignIn() {
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
              <Ionicons name="sparkles-outline" size={14} color={COLOR.primary} />
              <Text style={styles.heroBadgeText}>Apprendre autrement</Text>
            </View>
            <Text style={styles.heroTitle}>Bon retour sur iSkul</Text>
            <Text style={styles.heroSubtitle}>Connectez-vous pour reprendre vos cours, lives et quiz.</Text>
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
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputShell}>
                <Ionicons name="lock-closed-outline" size={18} color={COLOR.sub} />
                <TextInput
                  secureTextEntry
                  placeholder="Votre mot de passe"
                  placeholderTextColor="#95A1B4"
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
                colors={ACCENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.primaryGrad, (disabled || loading) && styles.ctaDisabled]}
              >
                <Ionicons name="arrow-forward" size={18} color="#fff" />
                <Text style={styles.primaryText}>{loading ? "Connexion..." : "Se connecter"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              Pas de compte ? <Link href="/(auth)/sign-up">Creer un compte</Link>
            </Text>
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
  logo: { width: 82, height: 82, resizeMode: "contain", marginBottom: 4 },
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
  heroTitle: { color: COLOR.text, fontSize: 25, fontFamily: FONT.heading, textAlign: "center" },
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
  forgotRow: {
    alignItems: "flex-end",
    marginTop: 2,
  },
  forgotText: {
    color: COLOR.primary,
    fontFamily: FONT.bodyBold,
    fontSize: 12,
  },
  ctaWrap: { marginTop: 6 },
  primaryGrad: {
    minHeight: 50,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaDisabled: { opacity: 0.55 },
  primaryText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 15 },
  footerText: { color: COLOR.sub, textAlign: "center", marginTop: 4, fontFamily: FONT.body },
});




