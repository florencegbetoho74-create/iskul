import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import TopBar from "@/components/TopBar";
import { decideReview, getReviewQueue, type ReviewQueueItem } from "@/storage/review";
import type { ContentKind } from "@/lib/contentStatus";

const KIND_LABEL: Record<ContentKind, string> = {
  course: "Cours",
  book: "Document",
  quiz: "Quiz",
};

const KIND_ICON: Record<ContentKind, keyof typeof Ionicons.glyphMap> = {
  course: "book-outline",
  book: "library-outline",
  quiz: "help-circle-outline",
};

function waitingSince(ms?: number | null): string {
  if (!ms) return "Date inconnue";
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return "Soumis aujourd'hui";
  if (days === 1) return "En attente depuis 1 jour";
  return `En attente depuis ${days} jours`;
}

export default function ReviewQueue() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ReviewQueueItem | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const isReviewer = !!user?.isReviewer;

  const load = useCallback(async () => {
    if (!isReviewer) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItems(await getReviewQueue());
    } catch (e: any) {
      setError(e?.message || "File de relecture indisponible.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isReviewer]);

  useEffect(() => {
    void load();
  }, [load]);

  const openContent = useCallback(
    (item: ReviewQueueItem) => {
      if (item.kind === "course") router.push(`/(app)/course/${item.contentId}`);
      else if (item.kind === "book") router.push(`/(app)/library/${item.contentId}`);
      else router.push(`/(app)/course/quiz?quizId=${item.contentId}`);
    },
    [router]
  );

  const publish = useCallback(
    async (item: ReviewQueueItem) => {
      setBusyId(item.contentId);
      try {
        await decideReview({ kind: item.kind, contentId: item.contentId, decision: "published" });
        setItems((prev) => prev.filter((x) => x.contentId !== item.contentId));
      } catch (e: any) {
        Alert.alert("Erreur", e?.message || "Publication impossible.");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const confirmReject = useCallback(async () => {
    if (!rejecting) return;
    const clean = note.trim();
    if (!clean) {
      Alert.alert("Motif requis", "Expliquez a l'auteur ce qu'il doit corriger.");
      return;
    }
    setBusyId(rejecting.contentId);
    try {
      await decideReview({
        kind: rejecting.kind,
        contentId: rejecting.contentId,
        decision: "rejected",
        note: clean,
      });
      setItems((prev) => prev.filter((x) => x.contentId !== rejecting.contentId));
      setRejecting(null);
      setNote("");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Renvoi impossible.");
    } finally {
      setBusyId(null);
    }
  }, [rejecting, note]);

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {items.length ? `${items.length} contenu${items.length > 1 ? "s" : ""} a relire` : "File vide"}
        </Text>
        <Text style={styles.headerHint}>
          Les plus anciennes soumissions d'abord. Ouvrez le contenu avant de decider.
        </Text>
      </View>
    ),
    [items.length]
  );

  if (!isReviewer) {
    return (
      <View style={styles.root}>
        <TopBar title="Relecture" right={null} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={26} color={theme.color.textMuted} />
          <Text style={styles.emptyText}>
            La relecture est reservee aux relecteurs designes par l'administration.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar title="Relecture" right={null} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.kind}:${item.contentId}`}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.color.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-done-outline" size={26} color={theme.color.success} />
              <Text style={styles.emptyText}>
                {error || "Rien a relire pour le moment."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const busy = busyId === item.contentId;
            return (
              <View style={styles.card}>
                <Pressable onPress={() => openContent(item)} style={styles.cardHead}>
                  <View style={styles.kindChip}>
                    <Ionicons name={KIND_ICON[item.kind]} size={13} color={theme.color.primary} />
                    <Text style={styles.kindChipText}>{KIND_LABEL[item.kind]}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {[item.level, item.subject].filter(Boolean).join(" - ") || "Non classe"}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {item.ownerName} · {waitingSince(item.submittedAtMs)}
                  </Text>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => openContent(item)}
                    style={[styles.actionBtn, styles.actionGhost]}
                  >
                    <Ionicons name="eye-outline" size={15} color={theme.color.text} />
                    <Text style={styles.actionGhostText}>Ouvrir</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setRejecting(item);
                      setNote("");
                    }}
                    disabled={busy}
                    style={[styles.actionBtn, styles.actionReject, busy && styles.actionDisabled]}
                  >
                    <Ionicons name="arrow-undo-outline" size={15} color={theme.color.danger} />
                    <Text style={styles.actionRejectText}>Renvoyer</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => publish(item)}
                    disabled={busy}
                    style={[styles.actionBtn, styles.actionPublish, busy && styles.actionDisabled]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={theme.color.textOnPrimary} />
                    ) : (
                      <Ionicons name="checkmark-circle-outline" size={15} color={theme.color.textOnPrimary} />
                    )}
                    <Text style={styles.actionPublishText}>Publier</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={!!rejecting}
        transparent
        animationType="fade"
        onRequestClose={() => setRejecting(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setRejecting(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Renvoyer a l'auteur</Text>
            <Text style={styles.sheetHint}>
              Ce motif s'affichera sur sa fiche. Soyez precis : c'est la seule indication qu'il
              recevra.
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Ex : le chapitre 3 n'a pas de video, et la classe indiquee ne correspond pas au contenu."
              placeholderTextColor={theme.color.textMuted}
              style={styles.noteInput}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setRejecting(null)} style={[styles.actionBtn, styles.actionGhost]}>
                <Text style={styles.actionGhostText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={confirmReject}
                disabled={!note.trim() || !!busyId}
                style={[
                  styles.actionBtn,
                  styles.actionReject,
                  (!note.trim() || !!busyId) && styles.actionDisabled,
                ]}
              >
                <Text style={styles.actionRejectText}>Renvoyer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: t.color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  emptyText: {
    color: t.color.textMuted,
    fontFamily: t.type.body.fontFamily,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  list: { padding: 16, gap: 12 },
  header: { marginBottom: 4, gap: 4 },
  headerTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 18 },
  headerHint: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12, lineHeight: 17 },

  card: {
    backgroundColor: t.color.surface,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 14,
    gap: 12,
  },
  cardHead: { gap: 4 },
  kindChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: t.color.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 2,
  },
  kindChipText: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 10 },
  cardTitle: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 15 },
  cardMeta: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },

  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  actionDisabled: { opacity: 0.5 },
  actionGhost: { borderColor: t.color.border, backgroundColor: t.color.surfaceSunk },
  actionGhostText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  actionReject: { borderColor: t.color.danger, backgroundColor: t.color.dangerSoft },
  actionRejectText: { color: t.color.danger, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  actionPublish: { borderColor: "transparent", backgroundColor: t.color.success },
  actionPublishText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },

  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: t.color.scrim },
  sheet: {
    backgroundColor: t.color.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 16,
    gap: 10,
  },
  sheetTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 16 },
  sheetHint: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12, lineHeight: 17 },
  noteInput: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceSunk,
    padding: 12,
    color: t.color.text,
    fontFamily: t.type.body.fontFamily,
    fontSize: 13,
    textAlignVertical: "top",
  },
  sheetActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
});
