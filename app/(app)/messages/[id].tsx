import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator, Linking
} from "react-native";
import { COLOR } from "@/theme/colors";
import { useLocalSearchParams } from "expo-router";
import { addMessage, markRead, watchMessages, watchThread } from "@/storage/chat";
import { useAuth } from "@/providers/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { uploadOne } from "@/lib/upload";
import type { ChatAttachment } from "@/types/chat";
import Avatar from "@/components/Avatar";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

/* ---------- Utils ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const isImg = (m?: string | null) => !!m && m.startsWith("image/");
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
function labelDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = new Date(y, (m - 1), d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((+today - +target) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  const mo = target.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: (today.getFullYear() === y ? undefined : "numeric") });
  return mo.replace(".", "");
}

/* ---------- Header type Messenger ---------- */
function DuoHeader({ leftUri, rightUri, title, subtitle }: { leftUri?: string|null; rightUri?: string|null; title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      {/* Avatars superposés */}
      <View style={{ width: 48, height: 32, position: "relative", marginRight: 10 }}>
        <View style={{ position: "absolute", left: 0, top: 2 }}>
          <Avatar size={28} uri={leftUri || undefined} name={title} />
        </View>
        <View style={{ position: "absolute", left: 18, top: 2 }}>
          <Avatar size={28} uri={rightUri || undefined} name={title} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.meta}>{subtitle}</Text>}
      </View>
    </View>
  );
}

/* ---------- Divider ---------- */
function DateDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

/* ---------- Bulle message + avatar en bas de groupe ---------- */
function Bubble({
  mine, text, attachments, atMs, compactTop, compactBottom, read, avatarUri
}: {
  mine: boolean;
  text?: string | null;
  attachments?: ChatAttachment[];
  atMs: number;
  compactTop: boolean;
  compactBottom: boolean;
  read: boolean;
  avatarUri?: string | null;
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

  return (
    <View style={[styles.bubbleRow, mine ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
      {/* Avatar coté “autre” en bas du groupe */}
      {!mine && !compactBottom ? (
        <View style={{ alignSelf: "flex-end", marginRight: 8 }}>
          <Avatar size={24} uri={avatarUri || undefined} name="?" />
        </View>
      ) : <View style={{ width: 32 }} />}

      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, radius]}>
        {!!text && <Text style={[styles.bubbleText, mine ? { color:"#fff" } : { color:"#e5e7eb" }]}>{text}</Text>}

        {!!attachments?.length && (
          <View style={{ gap: 8, marginTop: text ? 8 : 0 }}>
            {attachments.map((a) => (
              <TouchableOpacity
                key={a.id}
                activeOpacity={0.85}
                onPress={() => a.uri ? Linking.openURL(a.uri) : null}
                style={[styles.attRow, isImg(a.mime) && styles.attImgWrap]}
              >
                {isImg(a.mime) ? (
                  <Image source={{ uri: a.uri }} style={styles.attImg} resizeMode="cover" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={14} color="#fff" />
                    <Text style={styles.attText} numberOfLines={1}>{a.name || "fichier"}</Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.msgMetaRow}>
          <Text style={[styles.msgTime, mine ? { color:"#f3f4f6" } : { color:"#cbd5e1" }]}>{fmtTime(atMs)}</Text>
          {mine ? (
            <Ionicons
              name={read ? "checkmark-done" : "checkmark"}
              size={13}
              color={read ? "#a7f3d0" : "#e5e7eb"}
              style={{ marginLeft: 6 }}
            />
          ) : null}
        </View>
      </View>

      {/* Avatar côté “moi” en bas du groupe (optionnel, style Messenger) */}
      {mine && !compactBottom ? (
        <View style={{ alignSelf: "flex-end", marginLeft: 8 }}>
          <Avatar size={24} uri={avatarUri || undefined} name="Moi" />
        </View>
      ) : <View style={{ width: 32 }} />}
    </View>
  );
}

type RowDivider = { __type: "divider"; key: string; label: string };
type RowMsg = any;

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [thread, setThread] = useState<any | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [inputH, setInputH] = useState(40);
  const [pending, setPending] = useState<(ChatAttachment & { progress?: number })[]>([]);
  const [sending, setSending] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  // avatars/présence temps réel
  const [avatars, setAvatars] = useState<Record<string, string | null | undefined>>({});
  const [statusText, setStatusText] = useState<string | undefined>(undefined);

  const listRef = useRef<FlatList>(null);

  // Thread + messages
  useEffect(() => {
    if (!id) return;
    const unsubT = watchThread(id, async (t) => {
      setThread(t);
      if (t && user) await markRead(id, user.id);
    });
    const unsubM = watchMessages(id, async (rows) => {
      setMsgs(rows);
      if (atBottom) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 10);
      if (user) await markRead(id, user.id);
    });
    return () => { unsubT(); unsubM(); };
  }, [id, user?.id, atBottom]);

  // Avatars + statut des deux users (users/{uid} puis profiles/{uid})
  useEffect(() => {
    if (!thread) return;
    const ids = [thread.teacherId, thread.studentId].filter(Boolean);
    const unsubs: (() => void)[] = [];

    ids.forEach((uid: string) => {
      // users/{uid}
      unsubs.push(onSnapshot(doc(db, "users", uid), (snap) => {
        const d = snap.data() as any;
        if (!d) return;
        setAvatars(prev => ({ ...prev, [uid]: d.avatarUrl ?? prev[uid] }));
        if (uid !== user?.id) {
          const last = d.lastSeenMs as number | undefined;
          if (typeof last === "number") {
            const ago = Date.now() - last;
            if (ago < 2*60*1000) setStatusText("En ligne");
            else {
              const min = Math.round(ago/60000);
              setStatusText(min <= 1 ? "Vu il y a 1 min" : `Vu il y a ${min} min`);
            }
          }
        }
      }));
      // profiles/{uid} (si avatarUrl stocké là)
      unsubs.push(onSnapshot(doc(db, "profiles", uid), (snap) => {
        const d = snap.data() as any;
        if (!d) return;
        if (d.avatarUrl) setAvatars(prev => ({ ...prev, [uid]: d.avatarUrl }));
      }));
    });

    return () => unsubs.forEach(u => u());
  }, [thread?.teacherId, thread?.studentId, user?.id]);

  // last-read
  const otherId = useMemo(() => {
    if (!thread || !user) return null;
    return user.id === thread.teacherId ? thread.studentId : thread.teacherId;
  }, [thread, user?.id]);
  const lastReadOther = thread?.lastReadAtMs?.[otherId || ""] ?? 0;

  // Grouping + dividers (ordre asc par jour)
  const flatData: (RowDivider | RowMsg)[] = useMemo(() => {
    if (!msgs.length) return [];
    const groups: Record<string, any[]> = {};
    for (const m of msgs) {
      const k = dayKey(m.atMs);
      (groups[k] ||= []).push(m);
    }
    const days = Object.keys(groups).sort(); // asc
    const rows: (RowDivider | RowMsg)[] = [];
    for (const k of days) {
      rows.push({ __type: "divider", key: `div-${k}`, label: labelDay(k) });
      rows.push(...groups[k]);
    }
    return rows;
  }, [msgs]);

  // Scroll helpers
  const onScroll = (e: any) => {
    const viewport = e.nativeEvent.layoutMeasurement.height;
    const total = e.nativeEvent.contentSize.height;
    const y = e.nativeEvent.contentOffset.y;
    const distanceFromBottom = total - (y + viewport);
    const nearBottom = distanceFromBottom < 80;
    setAtBottom(nearBottom);
    setShowJump(!nearBottom);
  };

  // Pick + upload (progress si uploadOne le supporte)
  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true, type: "*/*" } as any);
    // @ts-ignore
    if (res.canceled) return;
    // @ts-ignore
    const docPicked = res.assets ? res.assets[0] : res;
    if (!docPicked?.uri) return;

    const tempId = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    setPending(prev => [...prev, { id: tempId, uri: docPicked.uri, name: docPicked.name || "fichier", mime: (docPicked.mimeType as any), size: (docPicked.size as any) ?? null, progress: 0 }]);

    try {
      const up = await uploadOne(
        { uri: docPicked.uri, name: docPicked.name || "fichier", contentType: (docPicked.mimeType as any) },
        `threads/${id}`,
        (percent?: number) => {
          if (percent == null) return;
          setPending(prev => prev.map(p => p.id === tempId ? { ...p, progress: percent } : p));
        }
      );
      setPending(prev => prev.map(p => p.id === tempId ? {
        ...p, id: up.path.split("/").pop()!, uri: up.url, name: up.name, progress: 100
      } : p));
    } catch {
      setPending(prev => prev.filter(p => p.id !== tempId));
    } finally {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 10);
    }
  };

  const removePending = (idx: number) => setPending(prev => prev.filter((_, i) => i !== idx));

  const send = async () => {
    if (!id || !user) return;
    const txt = input.trim();
    const hasTxt = !!txt;
    const allUploaded = pending.every(p => (p.progress ?? 100) >= 100);
    if (!hasTxt && pending.length === 0) return;
    if (!allUploaded) return;

    try {
      setSending(true);
      await addMessage(id, user.id, hasTxt ? txt : null, pending.map(({ progress, ...rest }) => rest));
      setInput(""); setPending([]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 10);
    } finally {
      setSending(false);
    }
  };

  if (!thread) {
    return <View style={{ flex:1, backgroundColor: COLOR.bg, alignItems:"center", justifyContent:"center" }}>
      <Text style={{ color: COLOR.sub }}>Conversation introuvable.</Text>
    </View>;
  }

  const otherName = user?.id === thread.teacherId ? thread.studentName : thread.teacherName;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLOR.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <DuoHeader
        leftUri={avatars[thread.teacherId]}
        rightUri={avatars[thread.studentId]}
        title={otherName}
        subtitle={statusText || (thread.courseTitle || "1:1")}
      />

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={flatData}
        keyExtractor={(it, idx) => (it as any).__type ? (it as RowDivider).key : (it as any).id || String(idx)}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onScroll={onScroll}
        renderItem={({ item, index }) => {
          if ((item as RowDivider).__type === "divider") {
            return <DateDivider label={(item as RowDivider).label} />;
          }
          const m = item as any;
          const mine = m.fromId === user?.id;

          // voisinage pour tails & avatar-bas-de-groupe
          const prev = index > 0 ? flatData[index - 1] : null;
          const next = index < flatData.length - 1 ? flatData[index + 1] : null;
          const prevSame = prev && !(prev as any).__type && (prev as any).fromId === m.fromId && dayKey((prev as any).atMs) === dayKey(m.atMs);
          const nextSame = next && !(next as any).__type && (next as any).fromId === m.fromId && dayKey((next as any).atMs) === dayKey(m.atMs);

          const compactTop = !!prevSame;
          const compactBottom = !!nextSame;

          const read = mine ? (m.atMs <= lastReadOther) : true;

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
            />
          );
        }}
        ListEmptyComponent={<Text style={{ color: COLOR.sub, textAlign: "center", marginTop: 24 }}>Aucun message pour l’instant.</Text>}
      />

      {/* Envois en attente */}
      {pending.length > 0 && (
        <FlatList
          data={pending}
          horizontal
          keyExtractor={(it, i) => it.id || String(i)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, gap: 8 }}
          renderItem={({ item, index }) => (
            <View style={styles.pendingChip}>
              <Ionicons name={isImg(item.mime) ? "image" : "document-text"} size={14} color="#fff" />
              <Text numberOfLines={1} style={styles.pendingText}>{item.name || "fichier"}</Text>
              {item.progress != null && item.progress < 100 ? (
                <Text style={styles.pendingPct}>{Math.round(item.progress)}%</Text>
              ) : null}
              <TouchableOpacity onPress={() => removePending(index)} style={{ marginLeft: 4 }}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />
      )}

      {/* Barre de saisie */}
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={pickFile} style={styles.attachBtn} activeOpacity={0.9}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>

        <TextInput
          placeholder="Écrire un message…"
          placeholderTextColor="#6b7280"
          style={[styles.input, { height: Math.min(120, Math.max(40, inputH)) }]}
          value={input}
          onChangeText={setInput}
          multiline
          onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height)}
          returnKeyType="send"
          onSubmitEditing={send}
        />

        <TouchableOpacity
          style={[styles.sendBtn, (sending || (!input.trim() && pending.length === 0)) && { opacity: 0.6 }]}
          onPress={send}
          disabled={sending || (!input.trim() && pending.length === 0)}
          activeOpacity={0.9}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* Descendre tout en bas */}
      {showJump && (
        <TouchableOpacity
          onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          style={styles.jump}
          activeOpacity={0.9}
        >
          <Ionicons name="chevron-down" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#1F2023", flexDirection: "row", alignItems: "center" },
  title: { color: COLOR.text, fontSize: 18, fontWeight: "900" },
  meta: { color: COLOR.sub, marginTop: 2 },

  divider: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", marginVertical: 8 },
  dividerLine: { height: 1, width: 46, backgroundColor: "#2a2b2f" },
  dividerText: { color: "#cbd5e1", fontSize: 12 },

  bubbleRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 3 },
  bubble: { maxWidth: "78%", borderRadius: 18, padding: 10, borderWidth: 1 },
  mine: { backgroundColor: "#6C5CE7", borderColor: "#584fdf" },      // toi = violet
  theirs: { backgroundColor: "#111214", borderColor: "#1F2023" },    // autre = anthracite
  bubbleText: { fontSize: 15, lineHeight: 20 },

  msgMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 6 },
  msgTime: { fontSize: 10 },

  attRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 8 },
  attText: { color: "#fff", fontSize: 12, maxWidth: 220 },
  attImgWrap: { padding: 0, borderRadius: 12, overflow: "hidden" },
  attImg: { width: 220, height: 160, borderRadius: 12 },

  pendingChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#4441b8", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#3532a1", maxWidth: 280 },
  pendingText: { color: "#fff", maxWidth: 180, fontSize: 12, fontWeight: "800" },
  pendingPct: { color: "#fff", fontSize: 12, opacity: 0.9 },

  inputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: "#1F2023" },
  input: { flex: 1, backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#24262a" },
  attachBtn: { backgroundColor: "#6C5CE7", borderRadius: 12, padding: 10, alignItems: "center", justifyContent: "center" },
  sendBtn: { backgroundColor: COLOR.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center" },

  jump: { position: "absolute", right: 16, bottom: 108, backgroundColor: "#111214", borderColor: "#2a2b2f", borderWidth: 1, padding: 10, borderRadius: 999 }
});
