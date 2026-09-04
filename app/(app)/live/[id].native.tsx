import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ScreenOrientation from "expo-screen-orientation";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import TopBar from "@/components/TopBar";
import { getLive, setStatus } from "@/storage/lives";
import { addLiveJoin } from "@/storage/usage";
import { useAuth } from "@/providers/AuthProvider";
import { fetchAgoraToken } from "@/lib/agora";
import { supabase } from "@/lib/supabase";
import {
  getAttendance,
  heartbeatLive,
  joinLive,
  leaveLive,
  moderateParticipant,
  postLiveMessage,
  setHandRaised,
  watchLiveMessages,
  watchParticipants,
  type AttendanceRow,
  type LiveMessage,
  type LiveParticipant,
} from "@/storage/liveRoom";
import {
  formatDuration,
  micDisabled,
  presentOnly,
  raisedHands,
  sortRoster,
  tileLabel,
} from "@/lib/liveRoster";

type AgoraModule = {
  ChannelProfileType: { ChannelProfileLiveBroadcasting: number };
  ClientRoleType: { ClientRoleBroadcaster: number; ClientRoleAudience: number };
  createAgoraRtcEngine: () => any;
  RtcSurfaceView: React.ComponentType<any>;
};

type Panel = "none" | "chat" | "people" | "attendance";

const HEARTBEAT_MS = 30_000;

function fmtWhen(ts: number) {
  return new Date(ts).toLocaleString();
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function makeUid(userId?: string | null) {
  if (!userId) return Math.floor(Math.random() * 1_000_000_000) + 1;
  const hex = String(userId).replace(/-/g, "").slice(0, 8);
  const parsed = parseInt(hex || "0", 16);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}

function isHttpUrl(value?: string | null) {
  return /^https?:\/\/\S+$/i.test(String(value || "").trim());
}

export default function LiveRoom() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const liveId = String(id || "");
  const { user } = useAuth();
  const appId = (process.env as any)?.EXPO_PUBLIC_AGORA_APP_ID || "";
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

  const [roster, setRoster] = useState<LiveParticipant[]>([]);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [panel, setPanel] = useState<Panel>("none");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [moderating, setModerating] = useState<LiveParticipant | null>(null);

  const RtcSurface = agoraModule?.RtcSurfaceView;
  const isOwner = !!user && !!live && user.id === live.ownerId;
  const externalUrl = useMemo(
    () => (isHttpUrl(live?.streamingUrl) ? String(live?.streamingUrl).trim() : null),
    [live?.streamingUrl]
  );

  const me = useMemo(
    () => roster.find((p) => p.userId === user?.id) ?? null,
    [roster, user?.id]
  );
  const present = useMemo(() => sortRoster(presentOnly(roster)), [roster]);
  const hands = useMemo(() => raisedHands(roster), [roster]);
  const handRaised = !!me?.handRaisedAtMs;
  const forcedMute = micDisabled(me);

  /* ---------------------------------------------------------------- seance */
  useEffect(() => {
    (async () => {
      if (!liveId) return;
      setLoading(true);
      setLive((await getLive(liveId)) ?? null);
      setLoading(false);
    })();
  }, [liveId]);

  useEffect(() => {
    if (!liveId) return;
    const channel = supabase
      .channel(`live-status-${liveId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lives", filter: `id=eq.${liveId}` },
        async () => {
          const next = await getLive(liveId);
          if (next) setLive(next);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  // La video merite l'ecran entier : le verrou portrait du layout racine est
  // leve le temps de la seance.
  useEffect(() => {
    if (Platform.OS === "web") return;
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  /* ------------------------------------------------------------- roster */
  useEffect(() => {
    if (!liveId || !joined) return;
    const stopRoster = watchParticipants(liveId, setRoster);
    const stopMessages = watchLiveMessages(liveId, setMessages);
    return () => {
      stopRoster();
      stopMessages();
    };
  }, [liveId, joined]);

  useEffect(() => {
    if (!liveId || !joined) return;
    const timer = setInterval(() => {
      heartbeatLive(liveId).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [liveId, joined]);

  // Quitter l'ecran sans prevenir la base laisserait le participant "present"
  // indefiniment sur la feuille de presence.
  useEffect(() => {
    return () => {
      if (liveId) leaveLive(liveId).catch(() => {});
    };
  }, [liveId]);

  // Le silence impose par l'animateur doit couper le flux, pas seulement
  // l'affichage.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !joined) return;
    if (forcedMute && micOn) {
      engine.muteLocalAudioStream(true);
      setMicOn(false);
    }
  }, [forcedMute, joined, micOn]);

  // Un participant exclu est sorti de la salle sans attendre son accord.
  useEffect(() => {
    if (!joined || !me?.isBanned) return;
    const engine = engineRef.current;
    if (engine) {
      engine.stopPreview();
      engine.leaveChannel();
    }
    setJoined(false);
    Alert.alert("Séance quittee", "L'animateur vous a retire de cette seance.");
  }, [joined, me?.isBanned]);

  /* -------------------------------------------------------------- agora */
  const ensurePermissions = useCallback(async () => {
    if (Platform.OS !== "android") return true;
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      return (
        result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !appId) return;
    let mod: AgoraModule | null = null;
    try {
      const runtimeRequire = (globalThis as any).require ?? (0, eval)("require");
      mod = runtimeRequire("react-native-agora") as AgoraModule;
    } catch {
      setAgoraError("Agora indisponible sur cette build. Utilisez un dev build, pas Expo Go.");
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
      onJoinChannelSuccess: (_c: any, uid: number) => {
        setJoined(true);
        setLocalUid(uid);
        setActiveUid((prev) => prev ?? uid);
      },
      onUserJoined: (_c: any, uid: number) => {
        setRemoteUids((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
        setActiveUid((prev) => prev ?? uid);
      },
      onUserOffline: (_c: any, uid: number) => {
        setRemoteUids((prev) => prev.filter((u) => u !== uid));
        setActiveUid((prev) => (prev === uid ? null : prev));
      },
      onLeaveChannel: () => {
        setJoined(false);
        setRemoteUids([]);
        setActiveUid(null);
      },
      onError: (err: number) => {
        if (Number.isFinite(err)) Alert.alert("Agora", `Erreur ${err}`);
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

  const joinSession = useCallback(
    async (role: "host" | "attendee") => {
      if (!user?.id || !live) return;
      if (!appId) {
        Alert.alert("Indisponible", "AGORA_APP_ID manquant dans l'app.");
        return;
      }

      const uid = makeUid(user.id);
      try {
        setJoining(true);

        // L'inscription en base precede la connexion video : c'est elle qui
        // associe l'identifiant Agora a un nom.
        await joinLive(live.id, uid);

        if (externalUrl) {
          if (role === "host" && live.status !== "live") setLive(await setStatus(live.id, "live"));
          if (role === "attendee") addLiveJoin(user.id).catch(() => {});
          await Linking.openURL(externalUrl);
          return;
        }

        const engine = engineRef.current;
        if (!engine || !engineReady || !agoraModule) {
          Alert.alert("Indisponible", "Agora indisponible sur cet appareil.");
          return;
        }
        if (!(await ensurePermissions())) {
          Alert.alert("Permissions", "Autorisez la camera et le micro pour rejoindre.");
          return;
        }

        const channel = live.streamingUrl || live.id;
        const tokenRes = await fetchAgoraToken({ channelName: channel, uid, role });
        setChannelName(tokenRes.channelName);
        setLocalUid(uid);

        const clientRole =
          role === "host"
            ? agoraModule.ClientRoleType.ClientRoleBroadcaster
            : agoraModule.ClientRoleType.ClientRoleAudience;
        engine.setClientRole(clientRole);
        engine.joinChannel(tokenRes.token, tokenRes.channelName, uid, {
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
          publishCameraTrack: role === "host",
          publishMicrophoneTrack: role === "host",
          clientRoleType: clientRole,
        });

        if (role === "attendee") addLiveJoin(user.id).catch(() => {});
        if (role === "host") {
          engine.startPreview();
          setLive(await setStatus(live.id, "live"));
        }
      } catch (e: any) {
        Alert.alert("Erreur", e?.message || "Impossible de rejoindre la séance.");
      } finally {
        setJoining(false);
      }
    },
    [live, user?.id, ensurePermissions, appId, engineReady, agoraModule, externalUrl]
  );

  const leaveSession = useCallback(
    async (endForAll: boolean) => {
      if (!live) return;
      const engine = engineRef.current;
      if (engine) {
        engine.stopPreview();
        engine.leaveChannel();
      }
      await leaveLive(live.id).catch(() => {});
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

  /* ------------------------------------------------------------ actions */
  const toggleMic = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (forcedMute) {
      Alert.alert("Micro coupe", "L'animateur a coupe votre micro.");
      return;
    }
    engine.muteLocalAudioStream(micOn);
    setMicOn((v) => !v);
  }, [micOn, forcedMute]);

  const toggleCam = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.muteLocalVideoStream(camOn);
    setCamOn((v) => !v);
  }, [camOn]);

  const toggleHand = useCallback(async () => {
    if (!liveId) return;
    try {
      await setHandRaised(liveId, !handRaised);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Action impossible.");
    }
  }, [liveId, handRaised]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !liveId || sending) return;
    setSending(true);
    try {
      await postLiveMessage(liveId, text);
      setDraft("");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Message non envoye.");
    } finally {
      setSending(false);
    }
  }, [draft, liveId, sending]);

  const runModeration = useCallback(
    async (target: LiveParticipant, action: "mute" | "unmute" | "lower_hand" | "kick") => {
      try {
        await moderateParticipant(liveId, target.userId, action);
        setModerating(null);
      } catch (e: any) {
        Alert.alert("Erreur", e?.message || "Moderation impossible.");
      }
    },
    [liveId]
  );

  const openAttendance = useCallback(async () => {
    try {
      setAttendance(await getAttendance(liveId));
      setPanel("attendance");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Feuille de presence indisponible.");
    }
  }, [liveId]);

  const copySession = useCallback(async () => {
    const value = externalUrl || channelName || live?.streamingUrl || live?.id;
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert("Copie", externalUrl ? "Lien copie." : "Code de session copie.");
  }, [channelName, live?.streamingUrl, live?.id, externalUrl]);

  /* ------------------------------------------------------------- rendu */
  const statusTone =
    live?.status === "live" ? theme.color.success : live?.status === "ended" ? theme.color.textMuted : theme.color.warning;
  const statusLabel =
    live?.status === "live" ? "En direct" : live?.status === "ended" ? "Termine" : "Programme";
  const primaryUid = activeUid ?? remoteUids[0] ?? (localUid || null);

  // Les flux effectivement publies : l'animateur et, plus tard, les
  // intervenants promus. Les autres apparaissent dans le panneau Participants.
  const videoUids = useMemo(() => {
    const list = localUid ? [localUid, ...remoteUids] : [...remoteUids];
    return Array.from(new Set(list)).filter((u) => Number.isFinite(u) && u > 0);
  }, [localUid, remoteUids]);

  const participantByUid = useMemo(() => {
    const map = new Map<number, LiveParticipant>();
    roster.forEach((p) => {
      if (p.agoraUid !== null) map.set(p.agoraUid, p);
    });
    return map;
  }, [roster]);

  const stageMessage = useMemo(() => {
    if (externalUrl) {
      return live?.status === "ended" ? "La séance est terminee." : "Cette séance passe par un lien externe.";
    }
    if (!appId) return "AGORA_APP_ID manquant dans l'app.";
    if (agoraError) return agoraError;
    if (!engineReady) return "Agora indisponible. Reconstruisez l'application.";
    if (live?.status === "ended") return "La séance est terminee.";
    if (live?.status === "live") return joined ? "Connexion..." : "Rejoignez pour voir la séance.";
    return "La seance n'a pas encore commence.";
  }, [live?.status, joined, engineReady, appId, agoraError, externalUrl]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.color.primary} />
      </View>
    );
  }

  if (!live) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Séance introuvable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar title="Séance en direct" right={null} />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{live.title}</Text>
          <Text style={styles.meta}>
            {live.ownerName || "Professeur"} · {fmtWhen(live.startAt)}
          </Text>
          <View style={styles.headerRow}>
            <View style={[styles.pill, { borderColor: statusTone }]}>
              <View style={[styles.dot, { backgroundColor: statusTone }]} />
              <Text style={styles.pillText}>{statusLabel}</Text>
            </View>
            {(externalUrl || channelName) && (
              <Pressable style={styles.pill} onPress={copySession}>
                <Ionicons name="copy-outline" size={13} color={theme.color.text} />
                <Text style={styles.pillText} numberOfLines={1}>
                  {externalUrl ? "Lien" : "Code"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.stage}>
          {joined && primaryUid && engineReady && RtcSurface ? (
            <>
              <RtcSurface style={styles.video} canvas={{ uid: primaryUid }} />
              <View style={styles.stageLabel}>
                <Text style={styles.stageLabelText}>
                  {tileLabel(primaryUid, roster, localUid)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyStage}>
              <Ionicons name="videocam-outline" size={28} color={theme.color.textMuted} />
              <Text style={styles.emptyStageText}>{stageMessage}</Text>
              {externalUrl && (
                <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(externalUrl)}>
                  <Ionicons name="open-outline" size={15} color={theme.color.textOnPrimary} />
                  <Text style={styles.linkBtnText}>Ouvrir le lien</Text>
                </Pressable>
              )}
            </View>
          )}

          {joining && (
            <View style={styles.overlay}>
              <ActivityIndicator color={theme.color.textOnPrimary} />
              <Text style={styles.overlayText}>Connexion...</Text>
            </View>
          )}

          {joined && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE · {present.length}</Text>
            </View>
          )}
        </View>

        {joined && videoUids.length > 1 && engineReady && RtcSurface && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {videoUids.map((uid) => {
              const entry = participantByUid.get(uid) ?? null;
              return (
                <Pressable
                  key={uid}
                  style={[styles.thumb, activeUid === uid && styles.thumbActive]}
                  onPress={() => setActiveUid(uid)}
                  onLongPress={() =>
                    isOwner && entry && entry.userId !== user?.id && setModerating(entry)
                  }
                >
                  <RtcSurface style={styles.thumbVideo} canvas={{ uid }} />
                  <View style={styles.thumbLabel}>
                    <Text style={styles.thumbLabelText} numberOfLines={1}>
                      {tileLabel(uid, roster, localUid)}
                    </Text>
                  </View>
                  {entry?.handRaisedAtMs ? (
                    <View style={styles.thumbHand}>
                      <Text style={styles.thumbHandText}>✋</Text>
                    </View>
                  ) : null}
                  {entry?.mutedByHost ? (
                    <View style={styles.thumbMuted}>
                      <Ionicons name="mic-off" size={11} color={theme.color.textOnPrimary} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {joined && isOwner && hands.length > 0 && (
          <View style={styles.handsBar}>
            <Text style={styles.handsTitle}>
              {hands.length} main{hands.length > 1 ? "s" : ""} levee{hands.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.handsNames} numberOfLines={2}>
              {hands.map((h) => h.displayName).join(", ")}
            </Text>
          </View>
        )}

        <View style={styles.controls}>
          {live.status === "ended" ? (
            <Control icon="checkmark-circle" label="Termine" onPress={() => {}} disabled />
          ) : isOwner ? (
            joined || live.status === "live" ? (
              <>
                <Control icon={micOn ? "mic" : "mic-off"} label="Micro" onPress={toggleMic} />
                <Control icon={camOn ? "videocam" : "videocam-off"} label="Camera" onPress={toggleCam} />
                <Control
                  icon="camera-reverse"
                  label="Flip"
                  onPress={() => engineRef.current?.switchCamera()}
                />
                <Control icon="stop" label="Terminer" onPress={() => leaveSession(true)} danger />
              </>
            ) : (
              <Control icon="radio" label="Demarrer" onPress={() => joinSession("host")} primary />
            )
          ) : live.status === "live" ? (
            joined ? (
              <>
                <Control
                  icon={handRaised ? "hand-left" : "hand-left-outline"}
                  label={handRaised ? "Baisser" : "Lever la main"}
                  onPress={toggleHand}
                  primary={handRaised}
                />
                <Control icon={micOn ? "mic" : "mic-off"} label="Micro" onPress={toggleMic} />
                <Control icon="exit" label="Quitter" onPress={() => leaveSession(false)} danger />
              </>
            ) : (
              <Control icon="play" label="Rejoindre" onPress={() => joinSession("attendee")} primary />
            )
          ) : (
            <Control icon="time" label="En attente" onPress={() => {}} disabled />
          )}
        </View>

        {joined && (
          <View style={styles.panelTabs}>
            <PanelTab
              icon="chatbubbles-outline"
              label={`Chat${messages.length ? ` (${messages.length})` : ""}`}
              active={panel === "chat"}
              onPress={() => setPanel(panel === "chat" ? "none" : "chat")}
            />
            <PanelTab
              icon="people-outline"
              label={`Participants (${present.length})`}
              active={panel === "people"}
              onPress={() => setPanel(panel === "people" ? "none" : "people")}
            />
            {isOwner && (
              <PanelTab
                icon="clipboard-outline"
                label="Presence"
                active={panel === "attendance"}
                onPress={() => (panel === "attendance" ? setPanel("none") : openAttendance())}
              />
            )}
          </View>
        )}

        {panel === "chat" && joined && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.panel}>
              {messages.length === 0 ? (
                <Text style={styles.muted}>Aucun message. Posez votre question ici.</Text>
              ) : (
                messages.slice(-50).map((m) => (
                  <View key={m.id} style={styles.message}>
                    <Text style={[styles.messageAuthor, m.isHost && styles.messageAuthorHost]}>
                      {m.authorName}
                      {m.isHost ? " · animateur" : ""} · {fmtTime(m.atMs)}
                    </Text>
                    <Text style={styles.messageText}>{m.text}</Text>
                  </View>
                ))
              )}
              <View style={styles.composer}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Votre question..."
                  placeholderTextColor={theme.color.textMuted}
                  style={styles.composerInput}
                  multiline
                  maxLength={1000}
                />
                <Pressable
                  onPress={sendMessage}
                  disabled={!draft.trim() || sending}
                  style={[styles.sendBtn, (!draft.trim() || sending) && styles.disabled]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={theme.color.textOnPrimary} />
                  ) : (
                    <Ionicons name="send" size={16} color={theme.color.textOnPrimary} />
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {panel === "people" && joined && (
          <View style={styles.panel}>
            {present.map((p) => (
              <Pressable
                key={p.userId}
                style={styles.personRow}
                onPress={() => isOwner && p.userId !== user?.id && setModerating(p)}
              >
                <Ionicons
                  name={p.role === "host" ? "school" : "person-circle-outline"}
                  size={18}
                  color={p.role === "host" ? theme.color.primary : theme.color.textMuted}
                />
                <Text style={styles.personName} numberOfLines={1}>
                  {p.userId === user?.id ? `${p.displayName} (vous)` : p.displayName}
                </Text>
                {p.handRaisedAtMs && <Text style={styles.personHand}>✋</Text>}
                {p.mutedByHost && <Ionicons name="mic-off" size={15} color={theme.color.danger} />}
                {isOwner && p.userId !== user?.id && (
                  <Ionicons name="ellipsis-horizontal" size={16} color={theme.color.textMuted} />
                )}
              </Pressable>
            ))}
          </View>
        )}

        {panel === "attendance" && isOwner && (
          <View style={styles.panel}>
            {attendance.length === 0 ? (
              <Text style={styles.muted}>Personne n'a encore rejoint.</Text>
            ) : (
              attendance.map((row) => (
                <View key={row.userId} style={styles.personRow}>
                  <Ionicons
                    name={row.stillPresent ? "ellipse" : "ellipse-outline"}
                    size={11}
                    color={row.stillPresent ? theme.color.success : theme.color.textMuted}
                  />
                  <Text style={styles.personName} numberOfLines={1}>
                    {row.displayName}
                    {row.isBanned ? " · exclu" : ""}
                  </Text>
                  <Text style={styles.personTime}>{formatDuration(row.totalMs)}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!moderating} transparent animationType="fade" onRequestClose={() => setModerating(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setModerating(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{moderating?.displayName}</Text>
            {moderating?.handRaisedAtMs && (
              <ModAction
                icon="hand-left-outline"
                label="Baisser la main"
                onPress={() => moderating && runModeration(moderating, "lower_hand")}
              />
            )}
            <ModAction
              icon={moderating?.mutedByHost ? "mic" : "mic-off"}
              label={moderating?.mutedByHost ? "Rendre le micro" : "Couper le micro"}
              onPress={() =>
                moderating && runModeration(moderating, moderating.mutedByHost ? "unmute" : "mute")
              }
            />
            <ModAction
              icon="exit-outline"
              label="Retirer de la séance"
              danger
              onPress={() =>
                moderating &&
                Alert.alert(
                  "Retirer ce participant",
                  `${moderating.displayName} ne pourra plus revenir dans cette seance.`,
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Retirer",
                      style: "destructive",
                      onPress: () => runModeration(moderating, "kick"),
                    },
                  ]
                )
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Control({
  icon,
  label,
  onPress,
  primary,
  danger,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { styles, theme } = useThemedStyles(makeStyles);
  const bg = danger ? theme.color.danger : primary ? theme.color.primary : theme.color.surface;
  const fg = danger || primary ? theme.color.textOnPrimary : theme.color.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.control,
        { backgroundColor: bg, borderColor: danger || primary ? "transparent" : theme.color.border },
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={16} color={fg} />
      <Text style={[styles.controlText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function PanelTab({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { styles, theme } = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.panelTab, active && styles.panelTabActive]}>
      <Ionicons name={icon} size={15} color={active ? theme.color.primary : theme.color.textMuted} />
      <Text style={[styles.panelTabText, active && styles.panelTabTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ModAction({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { styles, theme } = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={styles.modAction}>
      <Ionicons name={icon} size={18} color={danger ? theme.color.danger : theme.color.text} />
      <Text style={[styles.modActionText, danger && { color: theme.color.danger }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: t.color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.color.bg },
  container: { padding: 16, gap: 12, paddingBottom: 140 },
  muted: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 13 },

  header: { gap: 5 },
  title: { color: t.color.text, fontSize: 20, fontFamily: t.type.heading.fontFamily },
  meta: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12 },
  headerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: 999 },

  stage: {
    height: 320,
    backgroundColor: t.color.media,
    borderRadius: t.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.color.border,
  },
  video: { width: "100%", height: "100%" },
  stageLabel: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: t.color.mediaScrim,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stageLabelText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  emptyStage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
  emptyStageText: { color: t.color.textOnPrimary, fontFamily: t.type.heading.fontFamily, fontSize: 14, textAlign: "center" },
  linkBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: t.color.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkBtnText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: t.color.mediaScrim,
  },
  overlayText: { color: t.color.onMedia, fontFamily: t.type.body.fontFamily, fontSize: 12, marginTop: 4 },
  liveBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: t.color.mediaScrim,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: t.color.danger },
  liveBadgeText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },

  thumbRow: { gap: 8, paddingVertical: 2 },
  thumb: {
    width: 110,
    height: 78,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.media,
  },
  thumbActive: { borderColor: t.color.primary, borderWidth: 2 },
  thumbVideo: { width: "100%", height: "100%" },
  thumbLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: t.color.mediaScrim,
  },
  thumbLabelText: { color: t.color.onMedia, fontFamily: t.type.body.fontFamily, fontSize: 10 },
  thumbHand: { position: "absolute", top: 4, right: 4 },
  thumbHandText: { fontSize: 13 },
  thumbMuted: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: t.color.danger,
    borderRadius: 999,
    padding: 3,
  },

  handsBar: {
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color.borderStrong,
    backgroundColor: t.color.primarySoft,
    padding: 10,
    gap: 2,
  },
  handsTitle: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  handsNames: { color: t.color.text, fontFamily: t.type.body.fontFamily, fontSize: 12 },

  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  control: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  controlText: { fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  disabled: { opacity: 0.5 },

  panelTabs: { flexDirection: "row", gap: 8 },
  panelTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  panelTabActive: { borderColor: t.color.primary, backgroundColor: t.color.primarySoft },
  panelTabText: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
  panelTabTextActive: { color: t.color.primary },

  panel: {
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    padding: 12,
    gap: 8,
  },

  message: { gap: 2 },
  messageAuthor: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 10 },
  messageAuthorHost: { color: t.color.primary },
  messageText: { color: t.color.text, fontFamily: t.type.body.fontFamily, fontSize: 13, lineHeight: 18 },

  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
  composerInput: {
    flex: 1,
    maxHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceSunk,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: t.color.text,
    fontFamily: t.type.body.fontFamily,
    fontSize: 13,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: t.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  personRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7 },
  personName: { flex: 1, color: t.color.text, fontFamily: t.type.body.fontFamily, fontSize: 13 },
  personHand: { fontSize: 14 },
  personTime: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },

  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: t.color.scrim },
  sheet: {
    backgroundColor: t.color.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 16,
    gap: 4,
  },
  sheetTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 16, marginBottom: 6 },
  modAction: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  modActionText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 14 },
});
