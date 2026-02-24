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
import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Thread } from "@/types/chat";
import { watchInbox, hasUnread } from "@/storage/chat";
import { LinearGradient } from "expo-linear-gradient";
import Segmented from "@/components/Segmented";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG = ["#F5F4F1", "#EAF0FF", "#F6F1EA"] as const;
const ACCENT = ["#1D4ED8", "#2563EB"] as const;

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
      const otherName = user?.id === t.teacherId ? t.studentName || "Eleve" : t.teacherName || "Professeur";
      return (
        otherName.toLowerCase().includes(s) ||
        (t.courseTitle || "").toLowerCase().includes(s) ||
        (t.lastText || "").toLowerCase().includes(s)
      );
    });
  }, [rows, filter, q, user?.id]);

  const Header = (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>{unreadCount} non lus</Text>
        </View>
      </View>

      <View style={styles.searchRow} accessible accessibilityRole="search">
        <Ionicons name="search" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un contact"
          placeholderTextColor={COLOR.sub}
          style={styles.input}
          returnKeyType="search"
          accessibilityLabel="Rechercher dans les conversations"
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ("")} hitSlop={8} accessibilityLabel="Effacer la recherche">
            <Ionicons name="close" size={18} color={COLOR.sub} style={{ marginHorizontal: 10 }} />
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
      <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyIcon} />
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
          const otherName = user?.id === item.teacherId ? item.studentName || "Eleve" : item.teacherName || "Professeur";
          const unread = user?.id ? hasUnread(item, user.id) : false;
          const subtitle = item.courseTitle || "1:1";
          const time = fmtTime((item as any).lastAtMs || (item as any).updatedAtMs || 0);

          return (
            <Link href={`/(app)/messages/${item.id}`} asChild>
              <TouchableOpacity style={styles.thread} activeOpacity={0.9}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={18} color={COLOR.sub} />
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

                {unread ? <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dot} /> : null}
              </TouchableOpacity>
            </Link>
          );
        }}
        ListEmptyComponent={Empty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLOR.text}
            colors={[COLOR.text]}
            progressBackgroundColor={COLOR.surface}
          />
        }
      />
    </View>
  );
}

function SkeletonList({ shimmer }: { shimmer: Animated.Value }) {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },

  headerBg: { paddingBottom: 12 },
  headerRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading },
  subtitle: { color: COLOR.sub, fontSize: 12, marginTop: 2, fontFamily: FONT.body },

  searchRow: {
    marginTop: 6,
    marginHorizontal: 16,
    backgroundColor: COLOR.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    shadowColor: "#0B1D39",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  input: { flex: 1, color: COLOR.text, fontSize: 15, fontFamily: FONT.body },

  segmentWrap: { marginTop: 10, paddingHorizontal: 16 },

  thread: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLOR.muted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  name: { color: COLOR.text, fontFamily: FONT.headingAlt, paddingRight: 8, maxWidth: "75%" },
  nameUnread: { color: COLOR.primary },
  time: { color: COLOR.sub, fontSize: 11, marginLeft: "auto", fontFamily: FONT.body },

  meta: { color: COLOR.sub, fontSize: 12, marginTop: 2, fontFamily: FONT.body },
  last: { color: COLOR.text, fontSize: 12, marginTop: 2, fontFamily: FONT.body },
  lastUnread: { color: COLOR.text, fontFamily: FONT.bodyBold },

  dot: { width: 10, height: 10, borderRadius: 999, marginLeft: 10 },

  emptyWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
  },
  emptyIcon: { width: 28, height: 28, borderRadius: 8, marginBottom: 8 },
  emptyTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 16 },
  emptySub: { color: COLOR.sub, marginTop: 4, fontFamily: FONT.body },

  skelRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  skelAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLOR.muted,
    overflow: "hidden",
  },
  skelLineShort: {
    height: 12,
    width: "55%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLOR.muted,
    marginBottom: 8,
  },
  skelLineLong: {
    height: 10,
    width: "85%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLOR.muted,
  },
  skelSheen: { position: "absolute", top: 0, bottom: 0, width: 80, backgroundColor: "rgba(255,255,255,0.5)" },
  skelSheenThin: { position: "absolute", top: 0, bottom: 0, width: 60, backgroundColor: "rgba(255,255,255,0.5)" },
});




