import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { COLOR, FONT, RADIUS } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { invalidateReferentials } from "@/storage/referentials";
import CountryField from "@/components/CountryField";
import SelectionSheetField from "@/components/SelectionSheetField";

export default function Settings() {
  const { user, updateSchooling } = useAuth();

  const [countryCode, setCountryCode] = useState<string>(user?.countryCode ?? "");
  const [gradeLevelId, setGradeLevelId] = useState<string>(user?.gradeLevelId ?? "");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const {
    countries,
    gradeLevels,
    loadingCountries,
    loadingGrades,
    fallbackNotice,
    error: optionsError,
  } = useSchoolingOptions(countryCode);

  useEffect(() => {
    setCountryCode(user?.countryCode ?? "");
    setGradeLevelId(user?.gradeLevelId ?? "");
  }, [user?.countryCode, user?.gradeLevelId]);

  // Un changement de pays peut changer le programme : on ne conserve pas une
  // classe qui n'existe pas dans le nouveau referentiel.
  useEffect(() => {
    if (!gradeLevelId) return;
    if (loadingGrades || !gradeLevels.length) return;
    if (gradeLevels.some((l) => l.id === gradeLevelId)) return;
    setGradeLevelId("");
  }, [gradeLevels, gradeLevelId, loadingGrades]);

  const gradeOptions = useMemo(() => gradeLevels.map((l) => l.label), [gradeLevels]);
  const gradeLabel = useMemo(
    () => gradeLevels.find((l) => l.id === gradeLevelId)?.label ?? "",
    [gradeLevels, gradeLevelId]
  );

  const dirty =
    countryCode !== (user?.countryCode ?? "") || gradeLevelId !== (user?.gradeLevelId ?? "");
  const canSave = dirty && !!countryCode && !!gradeLevelId && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateSchooling({ countryCode, gradeLevelId });
      Alert.alert(
        "Scolarite mise a jour",
        `Vos contenus suivent desormais la classe ${gradeLabel}.`
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Modification impossible.");
    } finally {
      setSaving(false);
    }
  };

  // On vide les caches de contenu, pas la session : deconnecter l'eleve pour
  // rafraichir une liste serait disproportionne.
  const clearContentCache = async () => {
    setClearing(true);
    try {
      await invalidateReferentials();
      const keys = await AsyncStorage.getAllKeys();
      const notifKeys = keys.filter((k) => k.startsWith("notif:"));
      if (notifKeys.length) await AsyncStorage.multiRemove(notifKeys);
      Alert.alert("Cache vide", "Les contenus seront recharges depuis le serveur.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de vider le cache.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reglages</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scolarite</Text>
        <Text style={styles.sectionHint}>
          Vos cours, quiz et documents sont filtres sur ces deux informations. Mettez-les a jour
          quand vous changez de classe.
        </Text>

        <CountryField
          label="Pays"
          value={countryCode}
          countries={countries}
          loading={loadingCountries}
          onChange={setCountryCode}
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
        />

        {optionsError ? <Text style={styles.errorText}>{optionsError}</Text> : null}

        <Pressable
          onPress={save}
          disabled={!canSave}
          style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          )}
          <Text style={styles.primaryBtnText}>
            {saving ? "Enregistrement..." : "Enregistrer ma scolarite"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Application</Text>

        <Pressable
          onPress={clearContentCache}
          disabled={clearing}
          style={styles.row}
          accessibilityRole="button"
        >
          <Ionicons name="refresh-outline" size={18} color={COLOR.text} />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Vider le cache des contenus</Text>
            <Text style={styles.rowSub}>
              Force le rechargement des pays, classes et rappels. Vous restez connecte.
            </Text>
          </View>
          {clearing ? <ActivityIndicator size="small" color={COLOR.sub} /> : null}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compte</Text>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={18} color={COLOR.text} />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{user?.name || "Sans nom"}</Text>
            <Text style={styles.rowSub}>{user?.email || "Adresse inconnue"}</Text>
          </View>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>
              {user?.role === "teacher" ? "Professeur" : "Eleve"}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  content: { padding: 16, gap: 16, paddingBottom: 120 },
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading },

  section: {
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 4,
  },
  sectionTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  sectionHint: {
    color: COLOR.sub,
    fontFamily: FONT.body,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },

  notice: {
    color: COLOR.text,
    fontFamily: FONT.body,
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: COLOR.tint,
    borderWidth: 1,
    borderColor: COLOR.ring,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  errorText: { color: COLOR.danger, fontFamily: FONT.bodyBold, fontSize: 12, marginTop: 8 },

  primaryBtn: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLOR.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 14 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  rowBody: { flex: 1 },
  rowTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 14 },
  rowSub: { color: COLOR.sub, marginTop: 2, fontFamily: FONT.body, fontSize: 12, lineHeight: 17 },

  roleTag: {
    backgroundColor: COLOR.tint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleTagText: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 11 },
});
