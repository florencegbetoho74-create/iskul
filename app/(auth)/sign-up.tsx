import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
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
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import CountryField from "@/components/CountryField";
import SelectionSheetField from "@/components/SelectionSheetField";

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

export default function SignUp() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [gradeLevelId, setGradeLevelId] = useState<string>("");
  const [school, setSchool] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const {
    countries,
    gradeLevels,
    loadingCountries,
    loadingGrades,
    fallbackNotice,
    error: optionsError,
  } = useSchoolingOptions(countryCode);

  // Changer de pays peut changer le programme : la classe choisie avant ne
  // vaut plus rien si elle n'appartient pas au nouveau referentiel.
  useEffect(() => {
    if (!gradeLevelId) return;
    if (gradeLevels.some((l) => l.id === gradeLevelId)) return;
    setGradeLevelId("");
  }, [gradeLevels, gradeLevelId]);

  const gradeOptions = useMemo(() => gradeLevels.map((l) => l.label), [gradeLevels]);
  const gradeLabel = useMemo(
    () => gradeLevels.find((l) => l.id === gradeLevelId)?.label ?? "",
    [gradeLevels, gradeLevelId]
  );

  const disabled = useMemo(() => {
    if (loading) return true;
    if (!name.trim() || !email.trim() || !password.trim()) return true;
    if (!isEmail(email.trim())) return true;
    if (!countryCode.trim() || !gradeLevelId.trim() || !school.trim()) return true;
    return false;
  }, [loading, name, email, password, countryCode, gradeLevelId, school]);

  const handle = async () => {
    try {
      if (disabled) return;
      setLoading(true);
      await signUp({
        name,
        email,
        password,
        countryCode,
        gradeLevelId,
        school,
      });
      router.replace("/(app)/(tabs)");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Inscription impossible.");
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
              <Ionicons name="school-outline" size={14} color={theme.color.primary} />
              <Text style={styles.heroBadgeText}>Compte eleve</Text>
            </View>
            <Text style={styles.heroTitle}>Creer votre compte</Text>
            <Text style={styles.heroSubtitle}>Inscription rapide pour acceder aux cours, lives et quiz iSkul.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Nom complet</Text>
              <View style={styles.inputShell}>
                <Ionicons name="person-outline" size={18} color={theme.color.textMuted} />
                <TextInput
                  placeholder="Ex: Aicha K."
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputShell}>
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
                  placeholder="Minimum 8 caracteres"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="next"
                />
              </View>
            </View>

            <CountryField
              label="Pays"
              value={countryCode}
              countries={countries}
              loading={loadingCountries}
              onChange={setCountryCode}
              helperText="Vos cours suivent le programme de votre pays."
            />

            {fallbackNotice ? <Text style={styles.notice}>{fallbackNotice}</Text> : null}

            <SelectionSheetField
              label="Classe"
              value={gradeLabel}
              placeholder={
                !countryCode
                  ? "Choisissez d'abord votre pays"
                  : loadingGrades
                  ? "Chargement des classes..."
                  : "Selectionnez votre classe"
              }
              options={gradeOptions}
              onChange={(label) => {
                const match = gradeLevels.find((l) => l.label === label);
                if (match) setGradeLevelId(match.id);
              }}
              icon="school-outline"
              helperText="Choisissez votre niveau scolaire."
            />

            {optionsError ? <Text style={styles.errorText}>{optionsError}</Text> : null}

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Etablissement</Text>
              <View style={styles.inputShell}>
                <Ionicons name="business-outline" size={18} color={theme.color.textMuted} />
                <TextInput
                  placeholder="Nom de votre ecole"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={school}
                  onChangeText={setSchool}
                  returnKeyType="done"
                  onSubmitEditing={handle}
                />
              </View>
            </View>

            <TouchableOpacity disabled={disabled} onPress={handle} activeOpacity={disabled ? 1 : 0.9} style={styles.ctaWrap}>
              <LinearGradient
                colors={accentGradient(theme)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.primaryGrad, (loading || disabled) && styles.ctaDisabled]}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.color.textOnPrimary} />
                <Text style={styles.primaryText}>{loading ? "Creation..." : "Creer le compte"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              Deja un compte ? <Link href="/(auth)/sign-in">Se connecter</Link>
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
  },
  ctaDisabled: { opacity: 0.55 },
  primaryText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 15 },
  footerText: { color: t.color.textMuted, textAlign: "center", marginTop: 4, fontFamily: t.type.body.fontFamily },
  notice: {
    color: t.color.text,
    fontFamily: t.type.body.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: t.color.primarySoft,
    borderWidth: 1,
    borderColor: t.color.borderStrong,
    borderRadius: t.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  errorText: { color: t.color.danger, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12, marginTop: 8 },
});



