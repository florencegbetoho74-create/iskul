// app/(app)/(tabs)/profile.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/providers/AuthProvider";
import { getProfile } from "@/storage/profile";
import { listByOwner } from "@/storage/courses";
import { listMine } from "@/storage/lives";
import { listBooksByOwner } from "@/storage/books";
import { listRecentProgress } from "@/storage/progress";
import { listPurchased } from "@/storage/purchases";
import { listThreadsForUser } from "@/storage/chat";
import { getUsageSummary } from "@/storage/usage";

type Stat = { label: string; value: number };
type UsageSummary = {
  timeSpentMs: number;
  coursesViewed: number;
  lessonsViewed: number;
  documentsOpened: number;
  quizAttempts: number;
};

/** Degrades derives du theme : figes, ils ignoraient le mode sombre. */
const backgroundGradient = (t: Theme): readonly [string, string, string] =>
  t.name === "dark"
    ? [t.color.bg, t.color.surfaceSunk, t.color.bg]
    : [t.color.bg, t.color.primarySoft, t.color.bg];

const accentGradient = (t: Theme): readonly [string, string] => [
  t.color.primary,
  t.color.primaryPressed,
];
const USAGE_DAYS = 7;

function fmtDuration(ms: number) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ProfileTab() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [prof, setProf] = useState<any | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isTeacher = useMemo(() => {
    return !!(prof?.isTeacher || prof?.role === "teacher" || user?.role === "teacher");
  }, [prof?.isTeacher, prof?.role, user?.role]);

  const displayName = prof?.name || user?.name || "Profil";
  const subtitle = isTeacher
    ? prof?.subjects?.length
      ? `Prof - ${prof.subjects.join(", ")}`
      : "Professeur"
    : prof?.grade
    ? `Eleve - ${prof.grade}`
    : "Eleve";

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setRefreshing(true);
      const p = await getProfile(user.id);
      setProf(p || null);

      if (isTeacher || user.role === "teacher") {
        const [courses, lives, books] = await Promise.all([
          listByOwner(user.id),
          listMine(user.id),
          listBooksByOwner(user.id),
        ]);
        setStats([
          { label: "Cours", value: courses.length },
          { label: "Lives", value: lives.length },
          { label: "Livres", value: books.length },
        ]);
        setUsage(null);
      } else {
        const [prog, bought, threads, usageSummary] = await Promise.all([
          listRecentProgress(user.id, 1000),
          listPurchased(user.id),
          listThreadsForUser(user.id, "student"),
          getUsageSummary(user.id, USAGE_DAYS),
        ]);
        const unread = threads.reduce((s: number, t: any) => s + (t.unreadForStudent || 0), 0);
        setStats([
          { label: "Lecons suivies", value: prog.length },
          { label: "Mes livres", value: bought.length },
          { label: "Non lus", value: unread },
        ]);
        setUsage(usageSummary);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isTeacher, user?.role]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  if (!user) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={backgroundGradient(theme)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerBg, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerTop}>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{isTeacher ? "Espace prof" : "Mon espace"}</Text>
          </View>
          <LinearGradient colors={accentGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroTag}>
            <Text style={styles.heroTagText}>iSkul 2026</Text>
          </LinearGradient>
        </View>

        <View style={styles.headerRow}>
          <Avatar uri={prof?.avatarUrl} name={displayName} size={80} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text>
            {prof?.school ? <Text style={styles.sub} numberOfLines={1}>{prof.school}</Text> : null}
          </View>
        </View>

        {prof?.bio ? <Text style={styles.bio} numberOfLines={3}>{prof.bio}</Text> : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/(app)/profile/edit")} activeOpacity={0.9}>
            <LinearGradient colors={accentGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
              <Ionicons name="create-outline" size={16} color={theme.color.textOnPrimary} />
              <Text style={styles.primaryTxt}>Modifier</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/(app)/profile/settings")} activeOpacity={0.9}>
            <Ionicons name="settings-outline" size={16} color={theme.color.text} />
            <Text style={styles.secondaryTxt}>Reglages</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 14, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={theme.color.text}
            colors={[theme.color.text]}
            progressBackgroundColor={theme.color.surface}
          />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes stats</Text>
          {isTeacher ? (
            <TouchableOpacity onPress={() => router.push("/(app)/course/mine")} hitSlop={8}>
              <Text style={styles.link}>Voir mes cours</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.statsSkeletonRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skelCard} />
            ))}
          </View>
        ) : (
          <FlatList
            data={stats}
            keyExtractor={(i) => i.label}
            numColumns={3}
            scrollEnabled={false}
            columnWrapperStyle={{ paddingHorizontal: 16 }}
            contentContainerStyle={{ rowGap: 10 }}
            renderItem={({ item, index }) => (
              <View style={[styles.statCard, index % 3 !== 2 && { marginRight: 10 }]}>
                <Text style={styles.statVal}>{item.value}</Text>
                <Text style={styles.statLbl}>{item.label}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: theme.color.textMuted, paddingHorizontal: 16 }}>
                Aucune donnee disponible.
              </Text>
            }
          />
        )}

        {!isTeacher ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suivi parental</Text>
              <Text style={styles.sectionMeta}>{USAGE_DAYS} derniers jours</Text>
            </View>
            <View style={styles.usageCard}>
              <View style={styles.usageItem}>
                <Text style={styles.usageValue}>{fmtDuration(usage?.timeSpentMs || 0)}</Text>
                <Text style={styles.usageLabel}>Temps sur l'appli</Text>
              </View>
              <View style={styles.usageItem}>
                <Text style={styles.usageValue}>{usage?.coursesViewed ?? 0}</Text>
                <Text style={styles.usageLabel}>Cours vus</Text>
              </View>
              <View style={styles.usageItem}>
                <Text style={styles.usageValue}>{usage?.lessonsViewed ?? 0}</Text>
                <Text style={styles.usageLabel}>Lecons vues</Text>
              </View>
              <View style={styles.usageItem}>
                <Text style={styles.usageValue}>{usage?.quizAttempts ?? 0}</Text>
                <Text style={styles.usageLabel}>Quiz completes</Text>
              </View>
            </View>
          </>
        ) : null}

        {isTeacher ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Actions rapides</Text>
            </View>
            <View style={styles.quickRow}>
              <TouchableOpacity style={styles.quickItem} onPress={() => router.push("/(app)/course/new")} activeOpacity={0.9}>
                <Ionicons name="add-circle" size={18} color={theme.color.text} />
                <Text style={styles.quickTxt}>Nouveau cours</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickItem} onPress={() => router.push("/(app)/live/new")} activeOpacity={0.9}>
                <Ionicons name="videocam-outline" size={18} color={theme.color.text} />
                <Text style={styles.quickTxt}>Programmer un live</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickItem} onPress={() => router.push("/(app)/library/new")} activeOpacity={0.9}>
                <Ionicons name="book-outline" size={18} color={theme.color.text} />
                <Text style={styles.quickTxt}>Ajouter un livre</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <TouchableOpacity
            style={styles.logout}
            onPress={() => (signOut ? signOut() : null)}
            activeOpacity={0.9}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.color.textOnPrimary} />
            <Text style={styles.logoutTxt}>Se deconnecter</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },

  headerBg: { paddingBottom: 12 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  rolePill: {
    backgroundColor: t.color.primarySoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.color.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleText: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  heroTag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroTagText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },

  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  name: { color: t.color.text, fontSize: 20, fontFamily: t.type.heading.fontFamily },
  sub: { color: t.color.textMuted, marginTop: 2, fontFamily: t.type.body.fontFamily },

  bio: {
    color: t.color.text,
    backgroundColor: t.color.surface,
    borderColor: t.color.border,
    borderWidth: 1,
    borderRadius: t.radius.md,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
    fontFamily: t.type.body.fontFamily,
    ...t.elevation(2),
  },

  actionsRow: { flexDirection: "row", paddingHorizontal: 16, marginTop: 10 },
  primaryBtn: { borderRadius: t.radius.md, overflow: "hidden", marginRight: 10 },
  primaryGrad: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  primaryTxt: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily },

  secondaryBtn: {
    backgroundColor: t.color.surface,
    borderRadius: t.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.elevation(2),
  },
  secondaryTxt: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily },
  sectionMeta: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  link: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily },

  statsSkeletonRow: { flexDirection: "row", paddingHorizontal: 16, marginTop: 4 },
  skelCard: {
    flex: 1,
    height: 70,
    borderRadius: t.radius.md,
    marginRight: 10,
    backgroundColor: t.color.surfaceSunk,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.color.border,
  },

  statCard: {
    flex: 1,
    backgroundColor: t.color.surface,
    borderColor: t.color.border,
    borderWidth: 1,
    borderRadius: t.radius.md,
    padding: 14,
    alignItems: "center",
    ...t.elevation(2),
  },
  statVal: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 18 },
  statLbl: { color: t.color.textMuted, marginTop: 4, textAlign: "center", fontFamily: t.type.body.fontFamily },

  usageCard: {
    marginHorizontal: 16,
    backgroundColor: t.color.surface,
    borderColor: t.color.border,
    borderWidth: 1,
    borderRadius: t.radius.lg,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    ...t.elevation(2),
  },
  usageItem: {
    flexBasis: "48%",
    backgroundColor: t.color.surfaceSunk,
    borderRadius: t.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  usageValue: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 18 },
  usageLabel: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, marginTop: 6 },

  quickRow: { flexDirection: "row", paddingHorizontal: 16, marginTop: 4 },
  quickItem: {
    flex: 1,
    backgroundColor: t.color.surface,
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.color.border,
    paddingVertical: 12,
    alignItems: "center",
    marginRight: 10,
    ...t.elevation(2),
  },
  quickTxt: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, marginTop: 6, textAlign: "center" },

  logout: {
    backgroundColor: t.color.danger,
    borderRadius: t.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutTxt: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily },
});




