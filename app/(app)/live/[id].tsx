import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { COLOR } from "@/theme/colors";
import { getLive, setStatus, updateLive } from "@/storage/lives";
import { useAuth } from "@/providers/AuthProvider";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import YouTubePlayer, { YTHandle } from "@/components/YouTubePlayer";
import { getYouTubeId, isYouTubeUrl } from "@/utils/youtube";

function fmtWhen(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

type Msg = { id: string; author: string; text: string; at: number };

export default function LiveRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [live, setLive] = useState<any | null>(null);
  const [chat, setChat] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const yt = !!live?.streamingUrl && isYouTubeUrl(live.streamingUrl);
  const ytId = yt ? getYouTubeId(live?.streamingUrl) : null;
  const ytRef = useRef<YTHandle>(null);

  // Expo-video player (HLS/mp4)
  const player = useVideoPlayer(yt ? "" : (live?.streamingUrl ?? ""), (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 1;
  });

  useEffect(() => {
    (async () => {
      if (!id) return;
      const l = await getLive(id);
      setLive(l ?? null);
      if (!yt && l?.streamingUrl) player.replace(l.streamingUrl);
    })();
  }, [id]);

  const isOwner = user && live && live.ownerId === user.id;

  const startLive = async () => {
    if (!id) return;
    const next = await setStatus(id, "live");
    setLive(next);
  };
  const endLive = async () => {
    if (!id) return;
    const next = await setStatus(id, "ended");
    setLive(next);
  };

  const send = () => {
    if (!user || !input.trim()) return;
    const m: Msg = { id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, author: user.name, text: input.trim(), at: Date.now() };
    setChat((c) => [...c, m]);
    setInput("");
  };

  if (!live) {
    return <View style={{ flex: 1, backgroundColor: COLOR.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: COLOR.sub }}>Live introuvable.</Text>
    </View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLOR.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.container}>
        <Text style={styles.title}>{live.title}</Text>
        <Text style={styles.meta}>{live.ownerName} • {fmtWhen(live.startAt)} • <Text style={{ color: live.status === "live" ? "#10b981" : "#f59e0b" }}>{live.status}</Text></Text>

        <View style={styles.playerCard}>
          {yt && ytId ? (
            <YouTubePlayer ref={ytRef} videoId={ytId} />
          ) : live.streamingUrl ? (
            <VideoView style={styles.video} player={player} allowsFullscreen allowsPictureInPicture />
          ) : (
            <View style={styles.empty}>
              <Text style={{ color: COLOR.sub }}>Aucune URL de flux définie.</Text>
            </View>
          )}
        </View>

        {isOwner ? (
          <View style={styles.ownerRow}>
            {live.status !== "live" && live.status !== "ended" ? (
              <TouchableOpacity style={styles.primary} onPress={startLive}>
                <Ionicons name="radio" size={18} color="#fff" />
                <Text style={styles.primaryText}>Démarrer</Text>
              </TouchableOpacity>
            ) : null}
            {live.status === "live" ? (
              <TouchableOpacity style={styles.danger} onPress={endLive}>
                <Ionicons name="stop" size={18} color="#fff" />
                <Text style={styles.dangerText}>Terminer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.section}>Chat (local démo)</Text>
        <FlatList
          data={chat}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 8, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.msg}>
              <Text style={styles.msgAuthor}>{item.author}</Text>
              <Text style={styles.msgText}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: COLOR.sub }}>Aucun message pour l’instant.</Text>}
        />
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Écrire un message…"
            placeholderTextColor="#6b7280"
            value={input}
            onChangeText={setInput}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { color: COLOR.text, fontSize: 20, fontWeight: "900" },
  meta: { color: COLOR.sub },
  playerCard: { backgroundColor: "#111214", borderColor: "#1F2023", borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  video: { width: "100%", height: 230, backgroundColor: "#000" },
  empty: { padding: 24, alignItems: "center", justifyContent: "center" },
  ownerRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  primary: { backgroundColor: COLOR.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  primaryText: { color: "#fff", fontWeight: "800" },
  danger: { backgroundColor: "#e11d48", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  dangerText: { color: "#fff", fontWeight: "800" },
  section: { color: COLOR.text, fontWeight: "800", marginTop: 12 },
  msg: { backgroundColor: "#111214", borderColor: "#1F2023", borderWidth: 1, borderRadius: 12, padding: 10 },
  msgAuthor: { color: "#cbd5e1", fontWeight: "800", marginBottom: 4 },
  msgText: { color: COLOR.text },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#24262a" },
  sendBtn: { backgroundColor: COLOR.primary, borderRadius: 12, padding: 12, alignItems: "center", justifyContent: "center" }
});
