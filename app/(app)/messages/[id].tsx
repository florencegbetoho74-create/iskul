import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLOR, FONT } from "@/theme/colors";
import { useAuth } from "@/providers/AuthProvider";
import Avatar from "@/components/Avatar";
import { addMessage, markRead, watchMessages, watchThread } from "@/storage/chat";
import { watchProfile } from "@/storage/profile";
import { uploadOne, type UploadOut } from "@/lib/upload";
import type { ChatAttachment, Thread } from "@/types/chat";

type Msg = {
  id: string;
  fromId: string;
  text?: string | null;
  attachments?: ChatAttachment[];
  atMs: number;
  local?: boolean;
  failed?: boolean;
};

const ACCENT = ["#1D4ED8", "#2563EB"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const isImg = (m?: string | null) => !!m && m.startsWith("image/");
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fmtBytes = (bytes?: number | null) => {
  if (!bytes || !Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};
const fileExt = (name?: string | null) => {
  const m = String(name || "").match(/\.([a-zA-Z0-9]{1,6})$/);
  return m ? m[1].toUpperCase() : "FICHIER";
};

function mergeMessages(primary: Msg[], extra: Msg[] = []) {
  const map = new Map<string, Msg>();
  [...primary, ...extra].forEach((m) => map.set(m.id, m));
  return Array.from(map.values()).sort((a, b) => a.atMs - b.atMs);
}

function labelDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((+today - +target) / 86400000);
  if (diff === 0) return "Aujourdhui";
  if (diff === 1) return "Hier";
  const mo = target
    .toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: today.getFullYear() === y ? undefined : "numeric" })
    .replace(".", "");
  return mo;
}

function DuoHeader({
  leftUri,
  rightUri,
  title,
  subtitle,
  onBack,
}: {
  leftUri?: string | null;
  rightUri?: string | null;
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={COLOR.text} />
      </TouchableOpacity>

      <View style={{ width: 48, height: 32, position: "relative", marginRight: 10 }}>
        <View style={{ position: "absolute", left: 0, top: 2 }}>
          <Avatar size={28} uri={leftUri || undefined} name={title} />
        </View>
        <View style={{ position: "absolute", left: 18, top: 2 }}>
          <Avatar size={28} uri={rightUri || undefined} name={title} />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.meta} numberOfLines={1}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function Bubble({
  mine,
  text,
  attachments,
  atMs,
  compactTop,
  compactBottom,
  read,
  avatarUri,
  local,
  failed,
  openingId,
  onOpenAttachment,
}: {
  mine: boolean;
  text?: string | null;
  attachments?: ChatAttachment[];
  atMs: number;
  compactTop: boolean;
  compactBottom: boolean;
  read: boolean;
  avatarUri?: string | null;
  local?: boolean;
  failed?: boolean;
  openingId?: string | null;
  onOpenAttachment: (att: ChatAttachment) => void;
}) {
  const radius = {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  };
  if (mine) {
    if (compactTop) radius.borderTopRightRadius = 6;
    if (compactBottom) radius.borderBottomRightRadius = 6;
  } else {
    if (compactTop) radius.borderTopLeftRadius = 6;
    if (compactBottom) radius.borderBottomLeftRadius = 6;
  }

  const sending = mine && !!local && !failed;

  const Content = (
    <>
      {!!text && <Text style={[styles.bubbleText, mine ? { color: "#fff" } : { color: COLOR.text }]}>{text}</Text>}

      {!!attachments?.length && (
        <View style={{ gap: 8, marginTop: text ? 8 : 0 }}>
          {attachments.map((a) => {
            const image = isImg(a.mime);
            return (
              <TouchableOpacity
                key={a.id}
                activeOpacity={0.85}
                onPress={() => onOpenAttachment(a)}
                style={[styles.attRow, image && styles.attImgWrap]}
              >
                {image ? (
                  <>
                    <Image source={{ uri: a.uri }} style={styles.attImg} resizeMode="cover" />
                    <View style={styles.attImgOverlay}>
                      <Text style={styles.attImgText} numberOfLines={1}>{a.name || "image"}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.attIcon}>
                      <Ionicons name="document-text" size={14} color={mine ? "#fff" : COLOR.text} />
                    </View>
                    <View style={styles.attBody}>
                      <Text style={[styles.attText, mine && { color: "#fff" }]} numberOfLines={1}>
                        {a.name || "fichier"}
                      </Text>
                      <Text style={[styles.attMeta, mine && { color: "rgba(255,255,255,0.7)" }]}>
                        {fmtBytes(a.size)}
                      </Text>
                    </View>
                    <View style={styles.attExt}>
                      <Text style={styles.attExtText}>{fileExt(a.name)}</Text>
                    </View>
                    {openingId === a.id ? (
                      <ActivityIndicator size="small" color={mine ? "#fff" : COLOR.text} />
                    ) : null}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.msgMetaRow}>
        {mine && (failed || sending) ? (
          <Text style={[styles.msgStatus, failed && styles.msgStatusFail]}>
            {failed ? "Echec" : "Envoi..."}
          </Text>
        ) : (
          <View />
        )}
        <View style={styles.msgMetaRight}>
          <Text style={[styles.msgTime, mine ? { color: "#fff" } : { color: COLOR.sub }]}>{fmtTime(atMs)}</Text>
          {mine ? (
            <Ionicons
              name={read ? "checkmark-done" : "checkmark"}
              size={13}
              color={read ? "#0d5c4b" : "#fff"}
              style={{ marginLeft: 6 }}
            />
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.bubbleRow, mine ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
      {!mine && !compactBottom ? (
        <View style={{ alignSelf: "flex-end", marginRight: 8 }}>
          <Avatar size={24} uri={avatarUri || undefined} name="?" />
        </View>
      ) : (
        <View style={{ width: 32 }} />
      )}

      {mine ? (
        <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.mine, radius]}>
          {Content}
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.theirs, radius]}>{Content}</View>
      )}

      {mine && !compactBottom ? (
        <View style={{ alignSelf: "flex-end", marginLeft: 8 }}>
          <Avatar size={24} uri={avatarUri || undefined} name="Moi" />
        </View>
      ) : (
        <View style={{ width: 32 }} />
      )}
    </View>
  );
}

type RowDivider = { __type: "divider"; key: string; label: string };

type PendingAttachment = ChatAttachment & { progress?: number };

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [thread, setThread] = useState<Thread | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [inputH, setInputH] = useState(40);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [viewer, setViewer] = useState<ChatAttachment | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [avatars, setAvatars] = useState<Record<string, string | null | undefined>>({});
  const [statusText, setStatusText] = useState<string | undefined>(undefined);

  const pendingLocalRef = useRef<Record<string, Msg>>({});
  const listRef = useRef<FlatList<any>>(null);

  useEffect(() => {
    if (!id) return;
    const unsubT = watchThread(id, (t) => {
      setThread(t);
    });
    const unsubM = watchMessages(id, (rows: Msg[]) => {
      setMsgs((prev) => {
        const locals = Object.values(pendingLocalRef.current);
        const failed = prev.filter((m) => m.failed);
        return mergeMessages(rows || [], [...locals, ...failed]);
      });
      if (user) markRead(id, user.id).catch(() => {});
    });
    return () => {
      unsubT?.();
      unsubM?.();
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (!thread) return;
    const ids = [thread.teacherId, thread.studentId].filter(Boolean);
    const unsubs: (() => void)[] = [];

    ids.forEach((uid: string) => {
      unsubs.push(
        watchProfile(uid, (p) => {
          if (!p) return;
          setAvatars((prev) => ({ ...prev, [uid]: p.avatarUrl ?? prev[uid] }));
          if (uid !== user?.id) {
            const last = p.lastSeenMs as number | undefined;
            if (typeof last === "number") {
              const ago = Date.now() - last;
              if (ago < 2 * 60 * 1000) setStatusText("En ligne");
              else {
                const min = Math.round(ago / 60000);
                setStatusText(min <= 1 ? "Vu il y a 1 min" : `Vu il y a ${min} min`);
              }
            }
          }
        })
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [thread?.teacherId, thread?.studentId, user?.id]);

  useEffect(() => {
    if (!atBottom) return;
    const t = setTimeout(() => listRef.current?.scrollToOffset({ animated: true, offset: 0 }), 10);
    return () => clearTimeout(t);
  }, [msgs.length, atBottom]);

  const otherId = useMemo(() => {
    if (!thread || !user) return null;
    return user.id === thread.teacherId ? thread.studentId : thread.teacherId;
  }, [thread, user?.id]);
  const otherName = useMemo(() => {
    if (!thread || !user) return "";
    return user.id === thread.teacherId ? thread.studentName || "Eleve" : thread.teacherName || "Professeur";
  }, [thread, user?.id]);

  const lastReadOther = thread?.lastReadAtMs?.[otherId || ""] ?? 0;

  const flatData: (RowDivider | Msg)[] = useMemo(() => {
    if (!msgs.length) return [];
    const groups: Record<string, Msg[]> = {};
    for (const m of msgs) {
      const k = dayKey(m.atMs);
      (groups[k] ||= []).push(m);
    }
    const days = Object.keys(groups).sort();
    const rows: (RowDivider | Msg)[] = [];
    for (const k of days) {
      rows.push({ __type: "divider", key: `div-${k}`, label: labelDay(k) });
      rows.push(...groups[k]);
    }
    return rows.reverse();
  }, [msgs]);

  const onScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const nearBottom = y < 80;
    setAtBottom(nearBottom);
    setShowJump(!nearBottom);
  }, []);

  const openAttachment = useCallback(async (att: ChatAttachment) => {
    if (!att?.uri) return;
    if (isImg(att.mime)) {
      setViewer(att);
      return;
    }
    try {
      setOpeningId(att.id);
      const name = String(att.name || att.id || "fichier").replace(/[^a-zA-Z0-9._-]/g, "_");
      const base = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
      if (!base) throw new Error("No cache dir");
      const target = `${base}${name}`;
      const result = await FileSystem.downloadAsync(att.uri, target);
      let openUri = result.uri;
      if (Platform.OS === "android") {
        openUri = await FileSystem.getContentUriAsync(result.uri);
      }
      await Linking.openURL(openUri);
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir le fichier.");
    } finally {
      setOpeningId(null);
    }
  }, []);

  const pickFile = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: "*/*",
    } as any);
    // @ts-ignore
    if (res.canceled) return;
    // @ts-ignore
    const docPicked = res.assets ? res.assets[0] : res;
    if (!docPicked?.uri) return;

    const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const pendingUnit: PendingAttachment = {
      id: tempId,
      uri: String(docPicked.uri),
      name: String(docPicked.name || "fichier"),
      mime: (docPicked.mimeType as string | null | undefined) ?? null,
      size: (docPicked.size as number | null | undefined) ?? null,
      progress: 0,
    };
    setPending((prev) => [...prev, pendingUnit]);

    try {
      const up: UploadOut = await uploadOne(
        { uri: pendingUnit.uri, name: pendingUnit.name, contentType: pendingUnit.mime || undefined },
        `threads/${id}`,
        {
          onProgress: (percent?: number) => {
            if (percent == null) return;
            setPending((prev) => prev.map((p) => (p.id === tempId ? { ...p, progress: percent } : p)));
          },
        }
      );
      setPending((prev) =>
        prev.map((p) =>
          p.id === tempId
            ? {
                ...p,
                id: up.path.split("/").pop() || up.fullPath.split("/").pop() || p.id,
                uri: up.url,
                name: up.name,
                progress: 100,
              }
            : p
        )
      );
    } catch {
      setPending((prev) => prev.filter((p) => p.id !== tempId));
    }
  }, [id]);

  const removePending = useCallback((idx: number) => {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const send = useCallback(async () => {
    if (!id || !user) return;
    const txt = input.trim();
    const hasTxt = !!txt;
    const allUploaded = pending.every((p) => (p.progress ?? 100) >= 100);
    if (!hasTxt && pending.length === 0) return;
    if (!allUploaded) return;

    const now = Date.now();
    const localId = `local_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const attachmentsToSend = pending.map(({ progress, ...rest }) => rest);
    const optimistic: Msg = {
      id: localId,
      fromId: user.id,
      text: hasTxt ? txt : null,
      attachments: attachmentsToSend,
      atMs: now,
      local: true,
    };

    pendingLocalRef.current[localId] = optimistic;
    setMsgs((prev) => mergeMessages(prev, [optimistic]));
    setInput("");
    setPending([]);

    try {
      setSending(true);
      const saved = await addMessage(id, user.id, hasTxt ? txt : null, attachmentsToSend);
      delete pendingLocalRef.current[localId];
      setMsgs((prev) => mergeMessages(prev.filter((m) => m.id !== localId), [saved]));
    } catch {
      delete pendingLocalRef.current[localId];
      setMsgs((prev) => prev.map((m) => (m.id === localId ? { ...m, failed: true, local: false } : m)));
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToOffset({ animated: true, offset: 0 }), 10);
    }
  }, [id, user?.id, input, pending]);

  if (!thread) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOR.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: COLOR.sub }}>Conversation introuvable.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLOR.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 64 : 0}
    >
      <DuoHeader
        leftUri={avatars[thread.teacherId]}
        rightUri={avatars[thread.studentId]}
        title={otherName}
        subtitle={statusText || thread.courseTitle || "1:1"}
        onBack={() => router.back()}
      />

      <FlatList
        ref={listRef}
        data={flatData}
        inverted
        keyExtractor={(it, idx) => ((it as any).__type ? (it as RowDivider).key : (it as any).id) || String(idx)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        renderItem={({ item, index }) => {
          if ((item as RowDivider).__type === "divider") {
            return <DateDivider label={(item as RowDivider).label} />;
          }
          const m = item as Msg;
          const mine = m.fromId === user?.id;

          const prev = index > 0 ? flatData[index - 1] : null;
          const next = index < flatData.length - 1 ? flatData[index + 1] : null;

          const prevSame =
            prev && !(prev as any).__type && (prev as any).fromId === m.fromId && dayKey((prev as any).atMs) === dayKey(m.atMs);
          const nextSame =
            next && !(next as any).__type && (next as any).fromId === m.fromId && dayKey((next as any).atMs) === dayKey(m.atMs);

          const compactTop = !!prevSame;
          const compactBottom = !!nextSame;

          const otherLastRead = lastReadOther || 0;
          const read = mine ? m.atMs <= otherLastRead : true;

          return (
            <Bubble
              mine={mine}
              text={m.text}
              attachments={m.attachments}
              atMs={m.atMs}
              compactTop={compactTop}
              compactBottom={compactBottom}
              read={read}
              avatarUri={mine ? avatars[user!.id] : avatars[otherId || ""]}
              local={m.local}
              failed={m.failed}
              openingId={openingId}
              onOpenAttachment={openAttachment}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: COLOR.sub, textAlign: "center", marginVertical: 24 }}>
            Aucun message pour l'instant.
          </Text>
        }
      />

      {pending.length > 0 && (
        <FlatList
          data={pending}
          horizontal
          keyExtractor={(it, i) => it.id || String(i)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          renderItem={({ item, index }) => (
            <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pendingCard}>
              <Ionicons name={isImg(item.mime) ? "image" : "document-text"} size={14} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.pendingText}>
                  {item.name || "fichier"}
                </Text>
                {item.progress != null && item.progress < 100 ? (
                  <View style={styles.pendingBar}>
                    <View style={[styles.pendingBarFill, { width: `${Math.round(item.progress)}%` }]} />
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => removePending(index)} style={{ marginLeft: 4 }} hitSlop={8}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          )}
          showsHorizontalScrollIndicator={false}
        />
      )}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
          <TouchableOpacity onPress={pickFile} activeOpacity={0.9} style={styles.actionBtnInner}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <TextInput
          placeholder="Ecrire un message"
          placeholderTextColor={COLOR.sub}
          style={[styles.input, { height: Math.min(120, Math.max(40, inputH)) }]}
          value={input}
          onChangeText={setInput}
          multiline
          onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height)}
          returnKeyType="send"
          onSubmitEditing={send}
        />

        <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
          <TouchableOpacity
            style={[styles.actionBtnInner, (sending || (!input.trim() && pending.length === 0)) && { opacity: 0.6 }]}
            onPress={send}
            disabled={sending || (!input.trim() && pending.length === 0)}
            activeOpacity={0.9}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {showJump && (
        <LinearGradient colors={ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.jump}>
          <TouchableOpacity onPress={() => listRef.current?.scrollToOffset({ animated: true, offset: 0 })} activeOpacity={0.9}>
            <Ionicons name="chevron-down" size={16} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      )}

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerWrap}>
          <Pressable style={styles.viewerBackdrop} onPress={() => setViewer(null)} />
          {viewer ? <Image source={{ uri: viewer.uri }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Pressable style={styles.viewerClose} onPress={() => setViewer(null)}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR.surface,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: COLOR.surface,
  },
  title: { color: COLOR.text, fontSize: 17, fontFamily: FONT.headingAlt },
  meta: { color: COLOR.sub, marginTop: 2, fontSize: 12, fontFamily: FONT.body },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginVertical: 6,
  },
  dividerLine: { height: 1, width: 46, backgroundColor: COLOR.border },
  dividerText: { color: COLOR.sub, fontSize: 12, marginHorizontal: 8, fontFamily: FONT.body },

  bubbleRow: { flexDirection: "row", alignItems: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: 18, padding: 10, borderWidth: 1, borderColor: COLOR.border },
  mine: { borderColor: "transparent" },
  theirs: { backgroundColor: COLOR.surface, borderColor: COLOR.border },
  bubbleText: { fontSize: 15, lineHeight: 20, fontFamily: FONT.body },

  msgMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  msgMetaRight: { flexDirection: "row", alignItems: "center" },
  msgTime: { fontSize: 10, fontFamily: FONT.body },
  msgStatus: { fontSize: 10, fontFamily: FONT.bodyBold, color: "rgba(255,255,255,0.8)" },
  msgStatusFail: { color: COLOR.danger },

  attRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLOR.tint,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: 12,
    padding: 8,
  },
  attIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  attBody: { flex: 1 },
  attText: { color: COLOR.text, fontSize: 12, fontFamily: FONT.bodyBold },
  attMeta: { color: COLOR.sub, fontSize: 11, fontFamily: FONT.body, marginTop: 2 },
  attExt: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  attExtText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 10 },
  attImgWrap: { padding: 0, borderRadius: 12, overflow: "hidden", borderWidth: 0 },
  attImg: { width: 220, height: 160, borderRadius: 12 },
  attImgOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  attImgText: { color: "#fff", fontSize: 11, fontFamily: FONT.bodyBold },

  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: 180,
  },
  pendingText: { color: "#fff", fontSize: 12, fontFamily: FONT.bodyBold },
  pendingBar: { height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, marginTop: 6 },
  pendingBarFill: { height: 4, backgroundColor: "#fff", borderRadius: 999 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    backgroundColor: COLOR.bg,
  },
  input: {
    flex: 1,
    backgroundColor: COLOR.muted,
    color: COLOR.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLOR.border,
    fontFamily: FONT.body,
  },

  actionBtn: {
    borderRadius: 12,
    overflow: "hidden",
  },
  actionBtnInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  jump: {
    position: "absolute",
    right: 16,
    bottom: 108,
    borderRadius: 999,
    overflow: "hidden",
  },

  viewerWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  viewerImage: { width: "100%", height: "100%" },
  viewerClose: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 999,
    padding: 8,
  },
});


