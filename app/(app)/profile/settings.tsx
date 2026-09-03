import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";

import { COLOR, FONT, RADIUS } from "@/theme/colors";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { invalidateReferentials } from "@/storage/referentials";
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from "@/storage/profile";
import CountryField from "@/components/CountryField";
import {
  createPairingCode,
  listParentLinks,
  revokeParentLink,
  type PairingCode,
  type ParentLink,
} from "@/storage/parentLinks";
import SelectionSheetField from "@/components/SelectionSheetField";

const THEME_CHOICES: Array<{ key: ThemePreference; label: string; hint: string }> = [
  { key: "system", label: "Automatique", hint: "Suit le reglage de votre telephone" },
  { key: "light", label: "Clair", hint: "Toujours en clair" },
  { key: "dark", label: "Sombre", hint: "Toujours en sombre" },
];

export default function Settings() {
  const { user, updateSchooling } = useAuth();
  const theme = useTheme();

  const [countryCode, setCountryCode] = useState<string>(user?.countryCode ?? "");
  const [gradeLevelId, setGradeLevelId] = useState<string>(user?.gradeLevelId ?? "");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [pairingCode, setPairingCode] = useState<PairingCode | null>(null);
  const [parentBusy, setParentBusy] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [notifsBusy, setNotifsBusy] = useState(false);

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

  const refreshParentLinks = useCallback(async () => {
    if (!user?.id) return;
    try {
      setParentLinks(await listParentLinks());
    } catch {
      // Un acces parental illisible ne doit pas bloquer l'ecran entier.
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshParentLinks();
  }, [refreshParentLinks]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getNotificationsEnabled(user.id)
      .then((value) => {
        if (!cancelled) setNotifsEnabled(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggleNotifications = async (next: boolean) => {
    // On affiche le nouvel etat tout de suite, puis on revient en arriere si
    // le serveur refuse : un interrupteur qui ne bouge pas passe pour casse.
    setNotifsEnabled(next);
    setNotifsBusy(true);
    try {
      await setNotificationsEnabled(next);
    } catch (e: any) {
      setNotifsEnabled(!next);
      Alert.alert("Erreur", e?.message ?? "Preference non enregistree.");
    } finally {
      setNotifsBusy(false);
    }
  };

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

  const generateCode = async () => {
    setParentBusy(true);
    try {
      const created = await createPairingCode();
      setPairingCode(created);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Code non genere.");
    } finally {
      setParentBusy(false);
    }
  };

  const copyCode = async () => {
    if (!pairingCode) return;
    await Clipboard.setStringAsync(pairingCode.code);
    Alert.alert("Copie", "Le code a ete copie.");
  };

  const removeLink = (link: ParentLink) => {
    Alert.alert(
      "Retirer cet acces",
      `${link.label || "Ce parent"} ne pourra plus consulter votre progression.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: async () => {
            try {
              await revokeParentLink(link.id);
              await refreshParentLinks();
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "Retrait impossible.");
            }
          },
        },
      ]
    );
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
        <Text style={styles.sectionTitle}>Apparence</Text>
        <Text style={styles.sectionHint}>
          Le mode sombre repose les yeux le soir et economise la batterie sur les ecrans OLED.
        </Text>

        <View style={styles.themeRow}>
          {THEME_CHOICES.map((choice) => {
            const active = theme.preference === choice.key;
            return (
              <Pressable
                key={choice.key}
                onPress={() => theme.setPreference(choice.key)}
                style={[styles.themeOption, active && styles.themeOptionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={
                    choice.key === "system"
                      ? "phone-portrait-outline"
                      : choice.key === "light"
                      ? "sunny-outline"
                      : "moon-outline"
                  }
                  size={18}
                  color={active ? COLOR.primary : COLOR.sub}
                />
                <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>
                  {choice.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.rowSub}>
          {THEME_CHOICES.find((c) => c.key === theme.preference)?.hint}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Application</Text>

        <View style={styles.row}>
          <Ionicons name="notifications-outline" size={18} color={COLOR.text} />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Notifications</Text>
            <Text style={styles.rowSub}>
              Nouveaux cours de votre classe, demarrage des lives et reponses de vos professeurs.
            </Text>
          </View>
          <Switch
            value={notifsEnabled}
            onValueChange={toggleNotifications}
            disabled={notifsBusy}
            trackColor={{ false: COLOR.border, true: COLOR.primary }}
            thumbColor="#fff"
          />
        </View>

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
        <Text style={styles.sectionTitle}>Acces parental</Text>
        <Text style={styles.sectionHint}>
          Vos parents peuvent suivre votre progression depuis le site. Donnez-leur un code : il
          est valable 15 minutes et ne sert qu'une fois. Vous pouvez retirer un acces a tout
          moment.
        </Text>

        {pairingCode ? (
          <Pressable onPress={copyCode} style={styles.codeBox} accessibilityRole="button">
            <Text style={styles.codeValue}>{pairingCode.code}</Text>
            <Text style={styles.codeHint}>
              Valable {pairingCode.validForMinutes} minutes. Touchez pour copier.
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={generateCode}
          disabled={parentBusy}
          style={[styles.secondaryBtn, parentBusy && styles.primaryBtnDisabled]}
          accessibilityRole="button"
        >
          {parentBusy ? (
            <ActivityIndicator size="small" color={COLOR.primary} />
          ) : (
            <Ionicons name="key-outline" size={18} color={COLOR.primary} />
          )}
          <Text style={styles.secondaryBtnText}>
            {pairingCode ? "Generer un nouveau code" : "Generer un code parent"}
          </Text>
        </Pressable>

        {parentLinks.length ? (
          parentLinks.map((link) => (
            <View key={link.id} style={styles.row}>
              <Ionicons name="people-outline" size={18} color={COLOR.text} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{link.label || "Parent"}</Text>
                <Text style={styles.rowSub}>
                  {link.lastUsedAtMs
                    ? `Derniere consultation le ${new Date(link.lastUsedAtMs).toLocaleDateString("fr-FR")}`
                    : "Jamais consulte"}
                </Text>
              </View>
              <Pressable onPress={() => removeLink(link)} accessibilityLabel="Retirer l'acces">
                <Text style={styles.revokeText}>Retirer</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.rowSub}>Aucun parent n'a acces a votre progression.</Text>
        )}
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

  secondaryBtn: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.ring,
    backgroundColor: COLOR.tint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 13 },

  codeBox: {
    marginTop: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.ring,
    backgroundColor: COLOR.tint,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  codeValue: {
    color: COLOR.primary,
    fontFamily: FONT.mono,
    fontSize: 26,
    letterSpacing: 4,
  },
  codeHint: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 11, marginTop: 6 },
  revokeText: { color: COLOR.danger, fontFamily: FONT.bodyBold, fontSize: 12 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  rowBody: { flex: 1 },
  rowTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 14 },
  rowSub: { color: COLOR.sub, marginTop: 2, fontFamily: FONT.body, fontSize: 12, lineHeight: 17 },

  themeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  themeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.muted,
  },
  themeOptionActive: { borderColor: COLOR.primary, backgroundColor: COLOR.tint },
  themeLabel: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },
  themeLabelActive: { color: COLOR.primary },

  roleTag: {
    backgroundColor: COLOR.tint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleTagText: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 11 },
});
