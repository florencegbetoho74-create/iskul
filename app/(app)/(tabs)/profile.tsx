import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import StoredImage from "@/components/ui/StoredImage";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getProfile } from "@/storage/profile";
import { getUsageSummary } from "@/storage/usage";

const USAGE_DAYS = 30;

type Entry = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  href: string;
  tone?: "default" | "primary";
};

/**
 * Profil.
 *
 * L'ecran melangeait identite, statistiques et raccourcis de creation dans une
 * suite de cartes. Il redevient ce qu'il doit être : qui je suis, ce que j'ai
 * fait, et les reglages qui me concernent.
 */
export default function Profile() {
  const { color, space, radius } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<any | null>(null);
  const [usage, setUsage] = useState<{ timeSpentMs: number; lessonsViewed: number; quizAttempts: number } | null>(
    null
  );
  const [refreshing, setRefreshing] = useState(false);

  const isTeacher = String(user?.role || "") === "teacher";

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [p, u] = await Promise.all([
        getProfile(user.id),
        getUsageSummary(user.id, USAGE_DAYS),
      ]);
      setProfile(p);
      setUsage(u);
    } catch {
      // Un profil illisible ne doit pas vider l'ecran : l'identite de session
      // suffit a l'afficher.
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = profile?.name || user?.name || "Sans nom";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase())
    .join("");

  const hours = usage ? Math.floor(usage.timeSpentMs / 3600000) : 0;
  const minutes = usage ? Math.floor((usage.timeSpentMs % 3600000) / 60000) : 0;

  const entries: Entry[] = isTeacher
    ? [
        { icon: "person-outline", label: "Modifier mon profil", href: "/(app)/profile/edit" },
        { icon: "book-outline", label: "Mes cours", href: "/(app)/(tabs)/courses" },
        { icon: "radio-outline", label: "Mes séances live", href: "/(app)/live/mine" },
        {
          icon: "settings-outline",
          label: "Réglages",
          hint: "Apparence, notifications, cache",
          href: "/(app)/profile/settings",
        },
      ]
    : [
        { icon: "person-outline", label: "Modifier mon profil", href: "/(app)/profile/edit" },
        {
          icon: "school-outline",
          label: "Ma classe et mon pays",
          hint: user?.grade ? `Actuellement en ${user.grade}` : "Non renseignee",
          href: "/(app)/profile/settings",
          tone: "primary",
        },
        {
          icon: "people-outline",
          label: "Accès parental",
          hint: "Donner un code a mes parents",
          href: "/(app)/profile/settings",
        },
        {
          icon: "settings-outline",
          label: "Réglages",
          hint: "Apparence, notifications, cache",
          href: "/(app)/profile/settings",
        },
      ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + 120,
        gap: space.xxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={color.primary}
        />
      }
    >
      {/* --- Identite --- */}
      <View style={[styles.identity, { paddingHorizontal: space.lg, gap: space.md }]}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: color.primarySoft, borderRadius: radius.pill },
          ]}
        >
          {profile?.avatarUrl ? (
            <StoredImage path={profile.avatarUrl} style={styles.avatarImg} resizeMode="cover" />
          ) : (
            <Text variant="title" tone="primary">
              {initials || "?"}
            </Text>
          )}
        </View>

        <View style={styles.flex}>
          <Text variant="title" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {user?.email}
          </Text>
          <View style={[styles.badges, { gap: space.xs, marginTop: space.xs }]}>
            <Badge tone={isTeacher ? "primary" : "neutral"}>
              {isTeacher ? "Professeur" : "Élève"}
            </Badge>
            {user?.isReviewer ? <Badge tone="success">Relecteur</Badge> : null}
            {!isTeacher && user?.grade ? <Badge tone="neutral">{user.grade}</Badge> : null}
          </View>
        </View>
      </View>

      {/* --- Activite : ce que j'ai reellement fait --- */}
      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        <Text variant="heading">Sur 30 jours</Text>
        <View style={[styles.statRow, { gap: space.xl }]}>
          <Stat
            value={hours > 0 ? `${hours}` : `${minutes}`}
            unit={hours > 0 ? "h" : "min"}
            label="Temps passe"
          />
          <Stat value={String(usage?.lessonsViewed ?? 0)} label="Leçons ouvertes" />
          <Stat value={String(usage?.quizAttempts ?? 0)} label="Quiz passes" />
        </View>
      </View>

      {/* --- Entrees --- */}
      <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
        {entries.map((entry) => (
          <Pressable
            key={entry.label}
            onPress={() => router.push(entry.href as any)}
            accessibilityRole="button"
            accessibilityLabel={entry.label}
            style={({ pressed }) => [
              styles.entry,
              {
                backgroundColor: color.surface,
                borderColor: entry.tone === "primary" ? color.primary : color.border,
                borderRadius: radius.lg,
                padding: space.lg,
                gap: space.md,
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Ionicons
              name={entry.icon}
              size={19}
              color={entry.tone === "primary" ? color.primary : color.textMuted}
            />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{entry.label}</Text>
              {entry.hint ? (
                <Text variant="caption" tone="muted">
                  {entry.hint}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: space.lg }}>
        <Button
          onPress={() =>
            Alert.alert("Se déconnecter", "Vous devrez saisir vos identifiants a nouveau.", [
              { text: "Annuler", style: "cancel" },
              { text: "Se déconnecter", style: "destructive", onPress: () => signOut?.() },
            ])
          }
          icon="log-out-outline"
          variant="ghost"
          block
        >
          Se deconnecter
        </Button>
      </View>
    </ScrollView>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View style={styles.flex}>
      <View style={styles.statValue}>
        <Text variant="title">{value}</Text>
        {unit ? (
          <Text variant="caption" tone="muted" style={{ marginBottom: 3 }}>
            {unit}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 66, height: 66, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  badges: { flexDirection: "row", flexWrap: "wrap" },
  statRow: { flexDirection: "row" },
  statValue: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  entry: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
});
