import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLOR, ELEVATION, FONT, RADIUS } from "@/theme/colors";
import SectionHeader from "@/components/SectionHeader";
import LiveItem from "@/components/LiveItem";
import Segmented from "@/components/Segmented";
import { listUpcoming } from "@/storage/lives";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG = ["#F4F7FC", "#EAF0FF", "#F1F7FF"] as const;
const ACCENT = ["#2F5BFF", "#5B85FF"] as const;

type LiveRow = {
  id: string;
  title: string;
  startAt: number;
  ownerName?: string;
  status?: "live" | "upcoming" | "ended";
};

type FilterKey = "all" | "upcoming" | "ended";

const LOCALE = "fr-FR";

function fmtDate(ts: number) {
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function fmtRelative(ts: number) {
  const now = Date.now();
  const diff = ts - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);

  if (minutes < 1) return diff >= 0 ? "dans un instant" : "a l'instant";
  if (minutes < 60) return diff >= 0 ? `dans ${minutes} min` : `il y a ${minutes} min`;
  if (hours < 24) return diff >= 0 ? `dans ${hours} h` : `il y a ${hours} h`;
  return diff >= 0 ? `dans ${days} j` : `il y a ${days} j`;
}

export default function LiveTab() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
    ).start();
  }, [shimmer]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listUpcoming();
      const mapped: LiveRow[] = (list || []).map((r: any) => {
        const now = Date.now();
        const start = Number(r.startAt ?? r.start_at ?? r.when ?? 0);
        let status: LiveRow["status"] = r.status;
        if (!status) {
          status = start <= now && now - start < 4 * 3600_000 ? "live" : start > now ? "upcoming" : "ended";
        }
        return {
          id: r.id,
          title: r.title || "Live",
          startAt: start,
          ownerName: r.ownerName || r.teacher || "",
          status,
        };
      });

      const sorted = mapped.sort((a, b) => {
        const rank = (s?: string) => (s === "live" ? 0 : s === "upcoming" ? 1 : 2);
        const ra = rank(a.status);
        const rb = rank(b.status);
        if (ra !== rb) return ra - rb;
        return a.status === "ended" ? b.startAt - a.startAt : a.startAt - b.startAt;
      });

      setRows(sorted);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger les lives.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const data = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const ListHeader = () => (
    <LinearGradient colors={BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerBg}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Live</Text>
          <Text style={styles.subtitle}>Cours en direct et sessions a venir</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Segmented
          value={filter}
          items={[
            { key: "all", label: "Tous" },
            { key: "upcoming", label: "A venir" },
            { key: "ended", label: "Termines" },
          ]}
          onChange={(k) => setFilter(k as FilterKey)}
        />
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <SectionHeader title="Programmation" />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </LinearGradient>
  );

  const ListEmpty = () =>
    loading ? (
      <SkeletonList shimmer={shimmer} />
    ) : (
      <View style={styles.emptyWrap}>
        <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Aucun direct pour le moment</Text>
        <Text style={styles.emptySub}>Revenez plus tard ou verifiez vos notifications.</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        ListHeaderComponent={ListHeader}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <LiveItem
              item={{
                id: item.id,
                title: item.title,
                when: `${fmtDate(item.startAt)} - ${fmtRelative(item.startAt)}`,
                teacher: item.ownerName || "Professeur",
                status: item.status,
              }}
            />
          </View>
        )}
        ListEmptyComponent={ListEmpty}
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
  const items = Array.from({ length: 5 }).map((_, i) => i);
  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {items.map((i) => (
        <View key={i} style={styles.skelCard}>
          <View style={styles.skelBadge}>
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

  errorText: { color: COLOR.danger, marginTop: 6, fontFamily: FONT.body },

  emptyWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    ...ELEVATION.card,
  },
  emptyIcon: { borderRadius: 12, padding: 8, marginBottom: 6, height: 28, width: 28 },
  emptyTitle: { color: COLOR.text, fontSize: 16, fontFamily: FONT.headingAlt },
  emptySub: { color: COLOR.sub, fontSize: 13, fontFamily: FONT.body },

  skelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    marginBottom: 12,
    ...ELEVATION.card,
  },
  skelBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
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




