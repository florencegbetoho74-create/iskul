import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  PermissionsAndroid,
  Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { COLOR, FONT } from "@/theme/colors";
import TopBar from "@/components/TopBar";
import { getLive, setStatus } from "@/storage/lives";
import { addLiveJoin } from "@/storage/usage";
import { useAuth } from "@/providers/AuthProvider";
import { fetchAgoraToken } from "@/lib/agora";
import { supabase } from "@/lib/supabase";

type Participant = { uid: number; userName: string };
type AgoraModule = {
  ChannelProfileType: { ChannelProfileLiveBroadcasting: number };
  ClientRoleType: { ClientRoleBroadcaster: number; ClientRoleAudience: number };
  createAgoraRtcEngine: () => any;
  RtcSurfaceView: React.ComponentType<any>;
};

function fmtWhen(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function makeUid(userId?: string | null) {
  if (!userId) return Math.floor(Math.random() * 1_000_000_000) + 1;
  const hex = String(userId).replace(/-/g, "").slice(0, 8);
  const parsed = parseInt(hex || "0", 16);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}

function isHttpUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  return /^https?:\/\/\S+$/i.test(raw);
}

export default function LiveRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const appId = (process.env as any)?.EXPO_PUBLIC_AGORA_APP_ID || "43e30d99341342d2b81b14e67ad3edd0";
  const engineRef = useRef<any | null>(null);

  const [live, setLive] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [agoraModule, setAgoraModule] = useState<AgoraModule | null>(null);
  const [agoraError, setAgoraError] = useState<string | null>(null);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [activeUid, setActiveUid] = useState<number | null>(null);
  const [localUid, setLocalUid] = useState<number>(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [channelName, setChannelName] = useState("");
  const RtcSurface = agoraModule?.RtcSurfaceView;

  const isOwner = !!user && live && user.id === live.ownerId;
  const statusTone = live?.status === "live" ? COLOR.success : live?.status === "ended" ? COLOR.sub : COLOR.warn;
  const externalUrl = useMemo(
    () => (isHttpUrl(live?.streamingUrl) ? String(live?.streamingUrl).trim() : null),
    [live?.streamingUrl]
  );

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      const l = await getLive(id);
      setLive(l ?? null);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`live-status-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lives", filter: `id=eq.${id}` }, async () => {
        const next = await getLive(id);
        if (next) setLive(next);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const ensurePermissions = useCallback(async () => {
    if (Platform.OS !== "android") return true;
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      const okCamera = result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
      const okAudio = result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      return okCamera && okAudio;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!appId) return;
    let mod: AgoraModule | null = null;
    try {
      // Keep Agora loading runtime-only so web bundling does not resolve the native module.
      const runtimeRequire = (globalThis as any).require ?? (0, eval)("require");
      mod = runtimeRequire("react-native-agora") as AgoraModule;
    } catch {
      setAgoraError("Agora SDK indisponible sur cette build. Utilisez un dev build, pas Expo Go.");
      setAgoraModule(null);
      setEngineReady(false);
      return;
    }
    setAgoraModule(mod);
    setAgoraError(null);

    const engine = mod.createAgoraRtcEngine();
    engine.initialize({ appId, channelProfile: mod.ChannelProfileType.ChannelProfileLiveBroadcasting });
    engine.enableVideo();
    engine.enableAudio();
    engineRef.current = engine;
    setEngineReady(true);

    const handler: any = {
      onJoinChannelSuccess: (_connection: any, uid: number) => {
        setJoined(true);
        setLocalUid(uid);
        setActiveUid((prev) => prev ?? uid);
      },
      onUserJoined: (_connection: any, uid: number) => {
        setRemoteUids((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
        setActiveUid((prev) => prev ?? uid);
      },
      onUserOffline: (_connection: any, uid: number) => {
        setRemoteUids((prev) => prev.filter((u) => u !== uid));
        setActiveUid((prev) => (prev === uid ? null : prev));
      },
      onLeaveChannel: () => {
        setJoined(false);
        setRemoteUids([]);
        setActiveUid(null);
      },
      onError: (err: number) => {
        if (Number.isFinite(err)) Alert.alert("Agora", `Erreur: ${err}`);
      },
    };
    engine.registerEventHandler(handler);

    return () => {
      engine.unregisterEventHandler(handler);
      engine.leaveChannel();
      engine.release();
      engineRef.current = null;
      setEngineReady(false);
      setAgoraModule(null);
      setJoined(false);
      setRemoteUids([]);
      setActiveUid(null);
    };
  }, [appId]);

  useEffect(() => {
    if (!joined) return;
    if (activeUid && (activeUid === localUid || remoteUids.includes(activeUid))) return;
    const next = remoteUids[0] || localUid || null;
    if (next) setActiveUid(next);
  }, [activeUid, remoteUids, localUid, joined]);

  const participants = useMemo<Participant[]>(() => {
    if (!joined) return [];
    const list: Participant[] = [];
    if (localUid) list.push({ uid: localUid, userName: user?.name || "Moi" });
    remoteUids.forEach((uid) => list.push({ uid, userName: `Participant ${uid}` }));
    return list;
  }, [joined, localUid, remoteUids, user?.name]);

  const joinSession = useCallback(
    async (role: "host" | "attendee") => {
      if (!user?.id || !live) return;
      if (Platform.OS === "web") {
        Alert.alert("Indisponible", "Le live video n'est pas supporte sur web.");
        return;
      }
      if (!appId) {
        Alert.alert("Indisponible", "AGORA_APP_ID manquant dans l'app.");
        return;
      }
      const engine = engineRef.current;
      if (!engine || !engineReady || !agoraModule) {
        Alert.alert("Indisponible", "Agora SDK indisponible sur cet appareil.");
        return;
      }
      const okPerms = await ensurePermissions();
      if (!okPerms) {
        Alert.alert("Permissions", "Autorisez la camera et le micro pour rejoindre le live.");
        return;
      }
      try {
        setJoining(true);
        const uid = makeUid(user.id);
        if (externalUrl) {
          if (role === "host" && live.status !== "live") {
            const next = await setStatus(live.id, "live");
            setLive(next);
          }
          if (role === "attendee") {
            addLiveJoin(user.id).catch(() => {});
          }
          await Linking.openURL(externalUrl);
          return;
        }

        const channel = live.streamingUrl || live.id;
        const tokenRes = await fetchAgoraToken({ channelName: channel, uid, role });
        setChannelName(tokenRes.channelName);
        setLocalUid(uid);
        engine.setClientRole(
          role === "host"
            ? agoraModule.ClientRoleType.ClientRoleBroadcaster
            : agoraModule.ClientRoleType.ClientRoleAudience
        );
        engine.joinChannel(tokenRes.token, tokenRes.channelName, uid, {
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
          publishCameraTrack: role === "host",
          publishMicrophoneTrack: role === "host",
          clientRoleType:
            role === "host"
              ? agoraModule.ClientRoleType.ClientRoleBroadcaster
              : agoraModule.ClientRoleType.ClientRoleAudience,
        });
        if (role === "attendee") {
          addLiveJoin(user.id).catch(() => {});
        }
        if (role === "host") engine.startPreview();
        if (role === "host") {
          const next = await setStatus(live.id, "live");
          setLive(next);
        }
      } catch (e: any) {
        Alert.alert("Erreur", e?.message || "Impossible de rejoindre le live.");
      } finally {
        setJoining(false);
      }
    },
    [live, user?.id, user?.name, user?.email, ensurePermissions, appId, engineReady, agoraModule, externalUrl]
  );

  const openExternal = useCallback(async () => {
    if (!externalUrl) return;
    try {
      await Linking.openURL(externalUrl);
    } catch {
      Alert.alert("Lien invalide", "Impossible d'ouvrir ce lien live.");
    }
  }, [externalUrl]);

  const endLiveForAll = useCallback(async () => {
    if (!live) return;
    const next = await setStatus(live.id, "ended").catch(() => null);
    if (next) setLive(next);
    const engine = engineRef.current;
    if (engine) {
      engine.stopPreview();
      engine.leaveChannel();
    }
    setJoined(false);
    setRemoteUids([]);
    setActiveUid(null);
  }, [live]);

  const leaveSession = useCallback(
    async (endForAll: boolean) => {
      if (!live) return;
      const engine = engineRef.current;
      if (!engine) return;
      engine.stopPreview();
      engine.leaveChannel();
      if (endForAll) {
        const next = await setStatus(live.id, "ended").catch(() => null);
        if (next) setLive(next);
      }
      setJoined(false);
      setRemoteUids([]);
      setActiveUid(null);
    },
    [live]
  );

  const toggleMic = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.muteLocalAudioStream(micOn);
      setMicOn((v) => !v);
    } catch {
      // ignore
    }
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.muteLocalVideoStream(camOn);
      setCamOn((v) => !v);
    } catch {
      // ignore
    }
  }, [camOn]);

  const switchCam = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.switchCamera();
  }, []);

  const copySession = useCallback(async () => {
    const value = externalUrl || channelName || live?.streamingUrl || live?.id;
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert("Copie", externalUrl ? "Lien live copie." : "Code de session copie.");
  }, [channelName, live?.streamingUrl, live?.id, externalUrl]);

  const statusLabel = live?.status === "live" ? "En direct" : live?.status === "ended" ? "Termine" : "Programme";
  const displaySession = externalUrl || channelName || live?.streamingUrl || live?.id || "";
  const primaryUid = activeUid ?? remoteUids[0] ?? (localUid || null);
  const emptyMessage = useMemo(() => {
    if (externalUrl) {
      if (live?.status === "ended") return "Le live est termine.";
      return "Ce live se fait via un lien externe.";
    }
    if (Platform.OS === "web") return "Le live video est disponible uniquement sur mobile.";
    if (!appId) return "AGORA_APP_ID manquant dans l'app.";
    if (agoraError) return agoraError;
    if (!engineReady) return "Agora SDK indisponible. Rebuild l'app.";
    if (live?.status === "ended") return "Le live est termine.";
    if (live?.status === "live") return joined ? "Connexion au live..." : "Rejoignez pour voir le live.";
    return "Le live n'a pas encore demarre.";
  }, [live?.status, joined, engineReady, appId, agoraError, externalUrl]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLOR.bg }]}>
        <ActivityIndicator color={COLOR.primary} />
        <Text style={{ color: COLOR.sub, marginTop: 8, fontFamily: FONT.body }}>Chargement...</Text>
      </View>
    );
  }

  if (!live) {
    return (
      <View style={[styles.center, { backgroundColor: COLOR.bg }]}>
        <Text style={{ color: COLOR.sub }}>Live introuvable.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <TopBar title="Live" right={null} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{live.title}</Text>
          <Text style={styles.meta}>{live.ownerName || "Professeur"} - {fmtWhen(live.startAt)}</Text>
          <View style={styles.headerRow}>
            <View style={[styles.statusPill, { borderColor: statusTone }]}>
              <View style={[styles.statusDot, { backgroundColor: statusTone }]} />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
            {displaySession ? (
              <Pressable style={styles.sessionPill} onPress={copySession}>
                <Ionicons name="copy-outline" size={14} color={COLOR.text} />
                <Text style={styles.sessionText} numberOfLines={1}>
                  {externalUrl ? "Lien: " : "Code: "}
                  {displaySession}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.stage}>
          {joined && primaryUid && engineReady && RtcSurface ? (
            <RtcSurface style={styles.video} canvas={{ uid: primaryUid }} />
          ) : (
            <View style={styles.emptyStage}>
              <Ionicons name="videocam-outline" size={28} color={COLOR.sub} />
              <Text style={styles.emptyTitle}>{emptyMessage}</Text>
              {externalUrl ? (
                <Pressable style={styles.openLinkBtn} onPress={openExternal}>
                  <Ionicons name="open-outline" size={15} color="#fff" />
                  <Text style={styles.openLinkText}>Ouvrir le lien live</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          {joining ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingText}>Connexion...</Text>
            </View>
          ) : null}
          {joined ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
              <Text style={styles.liveCount}>{participants.length}</Text>
            </View>
          ) : null}
        </View>

        {joined && participants.length && engineReady && RtcSurface ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {participants.map((p) => (
              <Pressable
                key={p.uid}
                style={[styles.thumb, activeUid === p.uid && styles.thumbActive]}
                onPress={() => setActiveUid(p.uid)}
              >
                <RtcSurface style={styles.thumbVideo} canvas={{ uid: p.uid }} />
                <View style={styles.thumbLabel}>
                  <Text style={styles.thumbText} numberOfLines={1}>
                    {p.userName || "Participant"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.controls}>
          {externalUrl ? (
            isOwner ? (
              live.status === "ended" ? (
                <ControlButton icon="checkmark-circle" label="Termine" onPress={() => {}} disabled />
              ) : live.status === "live" ? (
                <>
                  <ControlButton icon="open-outline" label="Ouvrir lien" onPress={openExternal} primary />
                  <ControlButton icon="stop" label="Terminer" onPress={endLiveForAll} danger />
                </>
              ) : (
                <ControlButton icon="radio" label="Demarrer" onPress={() => joinSession("host")} primary />
              )
            ) : live.status === "live" ? (
              <ControlButton icon="open-outline" label="Rejoindre via lien" onPress={openExternal} primary />
            ) : live.status === "ended" ? (
              <ControlButton icon="checkmark-circle" label="Termine" onPress={() => {}} disabled />
            ) : (
              <ControlButton icon="time" label="En attente" onPress={() => {}} disabled />
            )
          ) : (
            isOwner ? (
              live.status === "ended" ? (
                <ControlButton icon="checkmark-circle" label="Termine" onPress={() => {}} disabled />
              ) : joined || live.status === "live" ? (
                <>
                  <ControlButton icon={micOn ? "mic" : "mic-off"} label="Micro" onPress={toggleMic} active={micOn} />
                  <ControlButton icon={camOn ? "videocam" : "videocam-off"} label="Camera" onPress={toggleCam} active={camOn} />
                  <ControlButton icon="camera-reverse" label="Flip" onPress={switchCam} />
                  <ControlButton icon="stop" label="Terminer" onPress={() => leaveSession(true)} danger />
                </>
              ) : (
                <ControlButton icon="radio" label="Demarrer" onPress={() => joinSession("host")} primary />
              )
            ) : (
              <>
                {live.status === "live" ? (
                  joined ? (
                    <ControlButton icon="exit" label="Quitter" onPress={() => leaveSession(false)} danger />
                  ) : (
                    <ControlButton icon="play" label="Rejoindre" onPress={() => joinSession("attendee")} primary />
                  )
                ) : live.status === "ended" ? (
                  <ControlButton icon="checkmark-circle" label="Termine" onPress={() => {}} disabled />
                ) : (
                  <ControlButton icon="time" label="En attente" onPress={() => {}} disabled />
                )}
              </>
            )
          )}
        </View>

        {Platform.OS === "web" ? (
          <Text style={styles.webNote}>Live video n'est pas supporte sur web.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  primary,
  danger,
  disabled,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
}) {
  const tone = danger ? COLOR.danger : primary ? COLOR.primary : COLOR.surface;
  const border = danger || primary ? "transparent" : COLOR.border;
  const text = danger || primary ? "#fff" : COLOR.text;
  return (
    <Pressable
      style={[
        styles.ctrlBtn,
        { backgroundColor: tone, borderColor: border },
        disabled && { opacity: 0.5 },
        active === false && !primary && !danger ? { backgroundColor: COLOR.muted } : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={16} color={text} />
      <Text style={[styles.ctrlText, { color: text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: { gap: 6 },
  title: { color: COLOR.text, fontSize: 20, fontFamily: FONT.headingAlt },
  meta: { color: COLOR.sub, fontFamily: FONT.body },
  headerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLOR.surface,
  },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  statusText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  sessionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    maxWidth: "100%",
  },
  sessionText: { color: COLOR.text, fontFamily: FONT.body, fontSize: 12 },

  stage: {
    height: 360,
    backgroundColor: "#0b0b0c",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  video: { width: "100%", height: "100%" },
  emptyStage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  emptyTitle: { color: "#fff", fontFamily: FONT.headingAlt, textAlign: "center" },
  openLinkBtn: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLOR.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  openLinkText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 12 },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  loadingText: { color: "#fff", fontFamily: FONT.body, fontSize: 12, marginTop: 4 },
  liveBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: "#EF4444" },
  liveText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 12 },
  liveCount: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 12 },

  thumbRow: { gap: 10, paddingVertical: 4 },
  thumb: {
    width: 120,
    height: 84,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: "#0b0b0c",
  },
  thumbActive: { borderColor: COLOR.primary },
  thumbVideo: { width: "100%", height: "100%" },
  thumbLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  thumbText: { color: "#fff", fontFamily: FONT.body, fontSize: 11 },

  controls: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  ctrlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctrlText: { fontFamily: FONT.bodyBold, fontSize: 12 },

  webNote: { color: COLOR.sub, fontFamily: FONT.body, textAlign: "center" },
});
