import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Thread } from "@/types/chat";
import { watchInbox, hasUnread } from "@/storage/chat";
import { LinearGradient } from "expo-linear-gradient";
import Segmented from "@/components/Segmented";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Degrades derives du theme : figes, ils ignoraient le mode sombre. */
const backgroundGradient = (t: Theme): readonly [string, string, string] =>
  t.name === "dark"
    ? [t.color.bg, t.color.surfaceSunk, t.color.bg]
    : [t.color.bg, t.color.primarySoft, t.color.bg];

const accentGradient = (t: Theme): readonly [string, string] => [
  t.color.primary,
  t.color.primaryPressed,
];

type FilterKey = "all" | "unread";

function fmtTime(ts?: number) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  try {
    if (sameDay) {
      return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
    }
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export default function Inbox() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Thread[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
    ).start();
  }, [shimmer]);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = watchInbox(user.id, (list) => {
      setRows(list || []);
      setReady(true);
      setRefreshing(false);
    });
    return () => unsub?.();
  }, [user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const unreadCount = useMemo(
    () => rows.reduce((acc, th) => acc + (user?.id ? (hasUnread(th, user.id) ? 1 : 0) : 0), 0),
    [rows, user?.id]
  );

  const data = useMemo(() => {
    const base = rows;
    const scoped = filter === "unread" && user?.id ? base.filter((t) => hasUnread(t, user.id)) : base;
    if (!q.trim()) return scoped;
    const s = q.trim().toLowerCase();
    return scoped.filter((t) => {
      const otherName = user?.id === t.teacherId ? t.studentName || "Élève" : t.teacherName || "Professeur";
      return (
        otherName.toLowerCase().includes(s) ||
        (t.courseTitle || "").toLowerCase().includes(s) ||
        (t.lastText || "").toLowerCase().includes(s)
      );
    });
  }, [rows, filter, q, user?.id]);

  const Header = (
    <LinearGradient colors={backgroundGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>{unreadCount} non lus</Text>
        </View>
      </View>

      <View style={styles.searchRow} accessible accessibilityRole="search">
        <Ionicons name="search-outline" size={18} color={theme.color.textMuted} style={{ marginHorizontal: 10 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un contact"
          placeholderTextColor={theme.color.textMuted}
          style={styles.input}
          returnKeyType="search"
          accessibilityLabel="Rechercher dans les conversations"
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ("")} hitSlop={8} accessibilityLabel="Effacer la recherche">
            <Ionicons name="close-circle" size={18} color={theme.color.textMuted} style={{ marginHorizontal: 10 }} />
          </Pressable>
        )}
      </View>

      <View style={styles.segmentWrap}>
        <Segmented
          value={filter}
          items={[
            { key: "all", label: "Tous" },
            { key: "unread", label: "Non lus" },
          ]}
          onChange={(k) => setFilter(k as FilterKey)}
        />
      </View>
    </LinearGradient>
  );

  const Empty = ready ? (
    <View style={styles.emptyWrap}>
      <LinearGradient colors={accentGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>Aucune conversation</Text>
      <Text style={styles.emptySub}>Vos messages apparaitront ici.</Text>
    </View>
  ) : (
    <SkeletonList shimmer={shimmer} />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={Header}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
        renderItem={({ item }) => {
          const otherName = user?.id === item.teacherId ? item.studentName || "Élève" : item.teacherName || "Professeur";
          const unread = user?.id ? hasUnread(item, user.id) : false;
          const subtitle = item.courseTitle || "1:1";
          const time = fmtTime((item as any).lastAtMs || (item as any).updatedAtMs || 0);

          return (
            <Link href={`/(app)/messages/${item.id}`} asChild>
              <TouchableOpacity style={styles.thread} activeOpacity={0.9}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={18} color={theme.color.textMuted} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
                      {otherName}
                    </Text>
                    {!!time && <Text style={styles.time}>{time}</Text>}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>{subtitle}</Text>
                  <Text style={[styles.last, unread && styles.lastUnread]} numberOfLines={1}>
                    {item.lastText || ""}
                  </Text>
                </View>

                {unread ? <LinearGradient colors={accentGradient(theme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dot} /> : null}
              </TouchableOpacity>
            </Link>
          );
        }}
        ListEmptyComponent={Empty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.color.text}
            colors={[theme.color.text]}
            progressBackgroundColor={theme.color.surface}
          />
        }
      />
    </View>
  );
}

function SkeletonList({ shimmer }: { shimmer: Animated.Value }) {
  const { styles, theme } = useThemedStyles(makeStyles);
  const items = Array.from({ length: 6 }).map((_, i) => i);
  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });
  return (
    <View style={{ paddingTop: 8 }}>
      {items.map((i) => (
        <View key={i} style={styles.skelRow}>
          <View style={styles.skelAvatar}>
            <Animated.View style={[styles.skelSheen, { transform: [{ translateX }] }]} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.skelLineShort}>
              <Animated.View style={[styles.skelSheenThin, { transform: [{ translateX }] }]} />
            </View>
            <View style={styles.skelLineLong}>
              <Animated.View style={[styles.skelSheenThin, { transform: [{ translateX }] }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.color.bg },

  headerBg: { paddingBottom: 12 },
  headerRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  title: { color: t.color.text, fontSize: 22, fontFamily: t.type.title.fontFamily },
  subtitle: { color: t.color.textMuted, fontSize: 12, marginTop: 2, fontFamily: t.type.body.fontFamily },

  searchRow: {
    marginTop: 6,
    marginHorizontal: 16,
    backgroundColor: t.color.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.color.border,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    shadowColor: t.color.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  input: { flex: 1, color: t.color.text, fontSize: 15, fontFamily: t.type.body.fontFamily },

  segmentWrap: { marginTop: 10, paddingHorizontal: 16 },

  thread: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.color.surface,
    borderColor: t.color.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: t.color.surfaceSunk,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  name: { color: t.color.text, fontFamily: t.type.heading.fontFamily, paddingRight: 8, maxWidth: "75%" },
  nameUnread: { color: t.color.primary },
  time: { color: t.color.textMuted, fontSize: 11, marginLeft: "auto", fontFamily: t.type.body.fontFamily },

  meta: { color: t.color.textMuted, fontSize: 12, marginTop: 2, fontFamily: t.type.body.fontFamily },
  last: { color: t.color.text, fontSize: 12, marginTop: 2, fontFamily: t.type.body.fontFamily },
  lastUnread: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily },

  dot: { width: 10, height: 10, borderRadius: 999, marginLeft: 10 },

  emptyWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: t.color.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.color.border,
  },
  emptyIcon: { width: 28, height: 28, borderRadius: 8, marginBottom: 8 },
  emptyTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 16 },
  emptySub: { color: t.color.textMuted, marginTop: 4, fontFamily: t.type.body.fontFamily },

  skelRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  skelAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: t.color.surfaceSunk,
    overflow: "hidden",
  },
  skelLineShort: {
    height: 12,
    width: "55%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: t.color.surfaceSunk,
    marginBottom: 8,
  },
  skelLineLong: {
    height: 10,
    width: "85%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: t.color.surfaceSunk,
  },
  skelSheen: { position: "absolute", top: 0, bottom: 0, width: 80, backgroundColor: t.color.surfaceRaised },
  skelSheenThin: { position: "absolute", top: 0, bottom: 0, width: 60, backgroundColor: t.color.surfaceRaised },
});




