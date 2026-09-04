import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
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

type RecoveryPayload = {
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: string | null;
  errorDescription: string | null;
};

function parseRecoveryPayload(rawUrl: string): RecoveryPayload {
  const entries = new Map<string, string>();

  const appendFromString = (value: string) => {
    const clean = value.replace(/^[?#]/, "");
    if (!clean) return;
    const params = new URLSearchParams(clean);
    params.forEach((paramValue, key) => {
      entries.set(key, paramValue);
    });
  };

  try {
    const url = new URL(rawUrl);
    appendFromString(url.search);
    appendFromString(url.hash);
  } catch {
    const [base, hash] = rawUrl.split("#");
    const queryIndex = base.indexOf("?");
    if (queryIndex >= 0) appendFromString(base.slice(queryIndex + 1));
    if (hash) appendFromString(hash);
  }

  const pick = (key: string) => {
    const value = entries.get(key);
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  return {
    accessToken: pick("access_token"),
    refreshToken: pick("refresh_token"),
    tokenHash: pick("token_hash"),
    type: pick("type"),
    errorDescription: pick("error_description"),
  };
}

function mapRecoveryError(error: any): string {
  const message = String(error?.message || "");
  if (!message) return "Lien de reinitialisation invalide ou expire.";
  if (message.toLowerCase().includes("expired")) return "Lien de reinitialisation expire.";
  if (message.toLowerCase().includes("invalid")) return "Lien de reinitialisation invalide.";
  return message;
}

function mapPasswordError(error: any): string {
  const message = String(error?.message || "");
  if (message.includes("Password should be at least")) {
    return "Mot de passe trop faible (6 caracteres minimum).";
  }
  return message || "Impossible de mettre a jour le mot de passe.";
}

export default function ResetPasswordScreen() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const passwordsMatch = password.trim() !== "" && password.trim() === confirmPassword.trim();
  const strongEnough = password.trim().length >= 6;

  const disabled = useMemo(() => {
    if (loading || !sessionReady) return true;
    if (!strongEnough) return true;
    if (!passwordsMatch) return true;
    return false;
  }, [loading, sessionReady, strongEnough, passwordsMatch]);

  const consumeRecoveryUrl = useCallback(async (url: string): Promise<boolean> => {
    const payload = parseRecoveryPayload(url);
    if (payload.errorDescription) {
      throw new Error(payload.errorDescription);
    }

    if (payload.accessToken && payload.refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });
      if (error) throw error;
      return true;
    }

    if (payload.tokenHash && payload.type === "recovery") {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: payload.tokenHash,
        type: "recovery",
      });
      if (error) throw error;
      return true;
    }

    return false;
  }, []);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          setSessionReady(true);
          setLinkError(null);
          return;
        }

        const initialUrl = await Linking.getInitialURL();
        if (!active) return;

        if (initialUrl) {
          const ok = await consumeRecoveryUrl(initialUrl);
          if (!active) return;
          if (ok) {
            setSessionReady(true);
            setLinkError(null);
          } else {
            setLinkError("Lien de reinitialisation invalide ou incomplet.");
          }
        } else {
          setLinkError("Lien de reinitialisation manquant. Ouvrez le lien recu par email.");
        }
      } catch (error) {
        if (!active) return;
        setLinkError(mapRecoveryError(error));
      } finally {
        if (active) setPreparing(false);
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      consumeRecoveryUrl(url)
        .then((ok) => {
          if (!active) return;
          if (ok) {
            setSessionReady(true);
            setLinkError(null);
          }
        })
        .catch((error) => {
          if (!active) return;
          setLinkError(mapRecoveryError(error));
        })
        .finally(() => {
          if (active) setPreparing(false);
        });
    });

    init();

    return () => {
      active = false;
      subscription.remove();
    };
  }, [consumeRecoveryUrl]);

  const handleUpdatePassword = async () => {
    try {
      if (disabled) return;
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: password.trim() });
      if (error) throw error;

      Alert.alert("Mot de passe mis a jour", "Vous pouvez maintenant vous reconnecter.", [
        {
          text: "Se connecter",
          onPress: async () => {
            await supabase.auth.signOut().catch(() => {});
            router.replace("/(auth)/sign-in");
          },
        },
      ]);
    } catch (error) {
      Alert.alert("Erreur", mapPasswordError(error));
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
            <Image source={require("../assets/logo.png")} style={styles.logo} />
            <View style={styles.heroBadge}>
              <Ionicons name="key-outline" size={14} color={theme.color.primary} />
              <Text style={styles.heroBadgeText}>Securite compte</Text>
            </View>
            <Text style={styles.heroTitle}>Nouveau mot de passe</Text>
            <Text style={styles.heroSubtitle}>
              Definissez un nouveau mot de passe pour reprendre votre compte.
            </Text>
          </View>

          <View style={styles.card}>
            {preparing ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.color.primary} />
                <Text style={styles.loadingText}>Vérification du lien...</Text>
              </View>
            ) : null}

            {!preparing && linkError && !sessionReady ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.color.danger} />
                <Text style={styles.errorText}>{linkError}</Text>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.8}
                  onPress={() => router.replace("/(auth)/forgot-password")}
                >
                  <Text style={styles.secondaryBtnText}>Recevoir un nouveau lien</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!preparing && sessionReady ? (
              <>
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Nouveau mot de passe</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="lock-closed-outline" size={18} color={theme.color.textMuted} />
                    <TextInput
                      secureTextEntry
                      placeholder="Minimum 6 caracteres"
                      placeholderTextColor={theme.color.textFaint}
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Confirmer</Text>
                  <View
                    style={[
                      styles.inputShell,
                      confirmPassword.length > 0 && !passwordsMatch && styles.inputShellError,
                    ]}
                  >
                    <Ionicons name="shield-checkmark-outline" size={18} color={theme.color.textMuted} />
                    <TextInput
                      secureTextEntry
                      placeholder="Retapez le mot de passe"
                      placeholderTextColor={theme.color.textFaint}
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleUpdatePassword}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleUpdatePassword}
                  activeOpacity={disabled ? 1 : 0.9}
                  style={styles.ctaWrap}
                >
                  <LinearGradient
                    colors={accentGradient(theme)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.primaryGrad, (disabled || loading) && styles.ctaDisabled]}
                  >
                    <Ionicons name="checkmark" size={18} color={theme.color.textOnPrimary} />
                    <Text style={styles.primaryText}>
                      {loading ? "Mise a jour..." : "Enregistrer le nouveau mot de passe"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : null}
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
  loadingBox: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: t.color.textMuted,
    fontFamily: t.type.body.fontFamily,
    fontSize: 13,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: t.color.danger,
    backgroundColor: t.color.dangerSoft,
    borderRadius: t.radius.md,
    padding: t.space.lg,
    gap: 10,
    alignItems: "flex-start",
  },
  errorText: {
    color: t.color.danger,
    fontFamily: t.type.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: t.color.borderStrong,
    backgroundColor: t.color.primarySoft,
    borderRadius: t.radius.md,
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: t.color.primary,
    fontFamily: t.type.bodyStrong.fontFamily,
    fontSize: 13,
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
});



