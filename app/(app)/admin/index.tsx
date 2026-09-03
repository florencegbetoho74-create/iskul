import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import {
  getAdminDashboard,
  getAdminPortalSettings,
  type AdminDashboardSnapshot,
  updateAdminPortalSettings,
  getPushHealth,
  type PushHealth,
} from "@/storage/admin";

type Kpi = { key: string; label: string; value: string; hint?: string; tint: string; icon: keyof typeof Ionicons.glyphMap };

export default function AdminDashboard() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [push, setPush] = useState<PushHealth | null>(null);
  const [portalOpen, setPortalOpen] = useState(true);
  const [portalMessage, setPortalMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, settings, pushHealth] = await Promise.all([
        getAdminDashboard(),
        getAdminPortalSettings(),
        getPushHealth().catch(() => null),
      ]);
      setSnapshot(dash);
      setPush(pushHealth);
      setPortalOpen(settings.teacherPortalOpen);
      setPortalMessage(settings.teacherPortalMessage || "");
    } catch (e: any) {
      setError(e?.message || "Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo<Kpi[]>(() => {
    if (!snapshot) return [];
    return [
      { key: "users", label: "Utilisateurs", value: String(snapshot.users), tint: theme.color.primarySoft, icon: "people-outline" },
      { key: "teachers", label: "Professeurs", value: String(snapshot.teachers), tint: theme.color.successSoft, icon: "school-outline" },
      { key: "courses", label: "Cours", value: String(snapshot.courses), hint: `${snapshot.coursesPublished} publies`, tint: theme.color.warningSoft, icon: "book-outline" },
      { key: "docs", label: "Documents", value: String(snapshot.documents), hint: `${snapshot.documentsPublished} publies`, tint: theme.color.primarySoft, icon: "library-outline" },
      { key: "lives", label: "Lives", value: String(snapshot.lives), hint: `${snapshot.livesActive} actifs`, tint: theme.color.dangerSoft, icon: "radio-outline" },
      { key: "quizzes", label: "Quiz", value: String(snapshot.quizzes), hint: `${snapshot.quizzesPublished} publies`, tint: theme.color.primarySoft, icon: "help-circle-outline" },
      { key: "threads", label: "Conversations", value: String(snapshot.threads), hint: `${snapshot.messages} messages`, tint: theme.color.surfaceSunk, icon: "chatbubbles-outline" },
      { key: "admins", label: "Admins", value: String(snapshot.admins), tint: theme.color.surfaceSunk, icon: "shield-checkmark-outline" },
    ];
  }, [snapshot]);

  // Une file dont la plus vieille ligne a plus d'une heure signale une
  // fonction de drainage non planifiee ou en echec.
  const pushStalled =
    !!push &&
    push.pending > 0 &&
    !!push.oldestPendingMs &&
    Date.now() - push.oldestPendingMs > 3600_000;

  const savePortal = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateAdminPortalSettings({
        teacherPortalOpen: portalOpen,
        teacherPortalMessage: portalMessage.trim() || null,
      });
      setNotice("Reglages du portail prof enregistres.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Impossible de sauvegarder les reglages.");
    } finally {
      setSaving(false);
    }
  };

  const quickLinks: { label: string; href: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: "Utilisateurs", href: "/(app)/admin/users", icon: "people-outline" },
    { label: "Cours", href: "/(app)/admin/courses", icon: "book-outline" },
    { label: "Documents", href: "/(app)/admin/books", icon: "library-outline" },
    { label: "Lives", href: "/(app)/admin/lives", icon: "radio-outline" },
    { label: "Quiz", href: "/(app)/admin/quizzes", icon: "help-circle-outline" },
    { label: "Messages", href: "/(app)/admin/messages", icon: "chatbubbles-outline" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Console Admin</Text>
          <Text style={styles.sub}>Pilotage global de la plateforme iSkul.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={17} color={theme.color.text} />
          <Text style={styles.refreshText}>{loading ? "Chargement..." : "Rafraichir"}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {push ? (
        <View style={[styles.pushCard, pushStalled && styles.pushCardAlert]}>
          <Text style={styles.pushTitle}>
            {pushStalled ? "Notifications bloquees" : "Notifications"}
          </Text>
          <Text style={styles.pushBody}>
            {push.pending} en attente · {push.failed} en echec · {push.devicesRegistered} appareil
            {push.devicesRegistered > 1 ? "s" : ""} enregistre
            {push.devicesRegistered > 1 ? "s" : ""}
          </Text>
          {pushStalled ? (
            <Text style={styles.pushHint}>
              La plus ancienne attend depuis plus d'une heure. Verifiez que la fonction
              push-dispatch est bien planifiee et que son secret est configure.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <View key={kpi.key} style={[styles.kpiCard, { backgroundColor: kpi.tint }]}>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Ionicons name={kpi.icon} size={18} color={theme.color.text} />
            </View>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
            {kpi.hint ? <Text style={styles.kpiHint}>{kpi.hint}</Text> : null}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Portail Inscription Prof</Text>
        <Text style={styles.cardSub}>
          URL fixe: <Text style={styles.mono}>/(public)/teacher-portal</Text>
        </Text>

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Etat du portail</Text>
            <Text style={styles.value}>{portalOpen ? "Ouvert" : "Ferme"}</Text>
          </View>
          <Switch value={portalOpen} onValueChange={setPortalOpen} />
        </View>

        <Text style={styles.label}>Message d'information (optionnel)</Text>
        <TextInput
          value={portalMessage}
          onChangeText={setPortalMessage}
          placeholder="Ex: Inscriptions suspendues jusqu'a lundi."
          placeholderTextColor={theme.color.textMuted}
          style={styles.input}
          multiline
        />

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={savePortal} disabled={saving}>
          <Ionicons name="save-outline" size={16} color={theme.color.textOnPrimary} />
          <Text style={styles.saveText}>{saving ? "Enregistrement..." : "Enregistrer les reglages"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Acces Rapides</Text>
        <View style={styles.quickGrid}>
          {quickLinks.map((x) => (
            <Pressable key={x.href} style={styles.quickCard} onPress={() => router.push(x.href as any)}>
              <Ionicons name={x.icon} size={16} color={theme.color.text} />
              <Text style={styles.quickText}>{x.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  pushCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    padding: 12,
    gap: 4,
    marginBottom: 12,
  },
  pushCardAlert: { borderColor: t.color.danger, backgroundColor: t.color.dangerSoft },
  pushTitle: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 13 },
  pushBody: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  pushHint: { color: t.color.danger, fontFamily: t.type.body.fontFamily, fontSize: 12, lineHeight: 17 },
  container: { padding: 18, paddingBottom: 30, gap: 14 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: t.color.text, fontFamily: t.type.title.fontFamily, fontSize: 26 },
  sub: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, marginTop: 4 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: 10,
    backgroundColor: t.color.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refreshText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  error: { color: t.color.danger, fontFamily: t.type.bodyStrong.fontFamily },
  notice: { color: t.color.success, fontFamily: t.type.bodyStrong.fontFamily },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: {
    minWidth: 180,
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 12,
    maxWidth: 260,
  },
  kpiRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kpiValue: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 22 },
  kpiLabel: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, marginTop: 8 },
  kpiHint: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: 14,
    backgroundColor: t.color.surface,
    padding: 14,
    gap: 10,
  },
  cardTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 16 },
  cardSub: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  mono: { fontFamily: "Menlo", color: t.color.text },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  value: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 15, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: 12,
    backgroundColor: t.color.bg,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: t.color.text,
    fontFamily: t.type.body.fontFamily,
    minHeight: 72,
  },
  saveBtn: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: t.color.primary,
    paddingVertical: 11,
  },
  saveText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: 12,
    backgroundColor: t.color.bg,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
});

