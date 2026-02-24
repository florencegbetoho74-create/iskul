import React, { useMemo, useState } from "react";
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
import { GRADE_LEVELS } from "@/constants/gradeLevels";
import { COLOR, ELEVATION, FONT, RADIUS, SPACE } from "@/theme/colors";
import SelectionSheetField from "@/components/SelectionSheetField";

const ACCENT = ["#2F5BFF", "#5B85FF"] as const;
const SURFACE_BG = ["#F4F7FC", "#ECF2FF", "#F2F7FF"] as const;
const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s || "");

export default function SignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [grade, setGrade] = useState<string>("");
  const [school, setSchool] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => {
    if (loading) return true;
    if (!name.trim() || !email.trim() || !password.trim()) return true;
    if (!isEmail(email.trim())) return true;
    if (!grade.trim() || !school.trim()) return true;
    return false;
  }, [loading, name, email, password, grade, school]);

  const handle = async () => {
    try {
      if (disabled) return;
      setLoading(true);
      await signUp({
        name,
        email,
        password,
        grade,
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
              <Ionicons name="school-outline" size={14} color={COLOR.primary} />
              <Text style={styles.heroBadgeText}>Compte eleve</Text>
            </View>
            <Text style={styles.heroTitle}>Creer votre compte</Text>
            <Text style={styles.heroSubtitle}>Inscription rapide pour acceder aux cours, lives et quiz iSkul.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Nom complet</Text>
              <View style={styles.inputShell}>
                <Ionicons name="person-outline" size={18} color={COLOR.sub} />
                <TextInput
                  placeholder="Ex: Aicha K."
                  placeholderTextColor="#95A1B4"
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
                  placeholder="Minimum 8 caracteres"
                  placeholderTextColor="#95A1B4"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="next"
                />
              </View>
            </View>

            <SelectionSheetField
              label="Classe"
              value={grade}
              placeholder="Selectionnez votre classe"
              options={GRADE_LEVELS}
              onChange={(value) => setGrade(value)}
              icon="school-outline"
              helperText="Choisissez votre niveau scolaire."
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Etablissement</Text>
              <View style={styles.inputShell}>
                <Ionicons name="business-outline" size={18} color={COLOR.sub} />
                <TextInput
                  placeholder="Nom de votre ecole"
                  placeholderTextColor="#95A1B4"
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
                colors={ACCENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.primaryGrad, (loading || disabled) && styles.ctaDisabled]}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
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
  },
  ctaDisabled: { opacity: 0.55 },
  primaryText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 15 },
  footerText: { color: COLOR.sub, textAlign: "center", marginTop: 4, fontFamily: FONT.body },
});



