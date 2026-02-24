// app/(app)/course/play.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ScrollView,
  FlatList,
  Linking,
  ActivityIndicator,
  Platform,
  BackHandler,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ScreenOrientation from "expo-screen-orientation";

import { COLOR, FONT } from "@/theme/colors";
import { getCourse } from "@/storage/courses";
import { useAuth } from "@/providers/AuthProvider";
import { getLessonProgress, updateLessonProgress } from "@/storage/progress";
import { createVideoPlayer, VideoView } from "expo-video";
import ChapterRow from "@/components/ChapterRow";
import TopBar from "@/components/TopBar";
import { fmtTime } from "@/utils/time";
import { addCourseView, addLessonView } from "@/storage/usage";
import { startThread } from "@/storage/chat";

type PlayerLangKey = "fr" | "fon" | "adja" | "yoruba" | "dindi";
const LANG_ORDER: PlayerLangKey[] = ["fr", "fon", "adja", "yoruba", "dindi"];
const LANG_LABELS: Record<PlayerLangKey, string> = {
  fr: "Francais",
  fon: "Fon",
  adja: "Adja",
  yoruba: "Yoruba",
  dindi: "Dindi",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v?: string | null) => !!v && UUID_RE.test(v);

const isDirectMedia = (u: string) =>
  /\.(mp4|m4v|mov|webm)(\?|$)/i.test(u) || /\.m3u8(\?|$)/i.test(u) || /\.mpd(\?|$)/i.test(u);

export default function Play() {
  const { courseId, lessonId, startSec } = useLocalSearchParams<{ courseId: string; lessonId?: string; startSec?: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<any | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(lessonId ?? null);
  const [lang, setLang] = useState<PlayerLangKey>("fr");
  const [loading, setLoading] = useState(true);

  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const RATES = [0.5, 1, 1.25, 1.5, 1.75, 2];

  const trackedCourseRef = useRef(false);
  const trackedLessonRef = useRef<string | null>(null);
  const initialLessonIdRef = useRef<string | null>(lessonId ?? null);
  const initialStartSecRef = useRef<number>(Math.max(0, Math.floor(Number(startSec || 0) || 0)));
  const seekAppliedLessonRef = useRef<string | null>(null);
  const progressDisabledRef = useRef(false);
  const progressErrorRef = useRef(0);
  const curTimeRef = useRef(0);
  const durationRef = useRef(0);
  const draggingRef = useRef(false);
  const videoRef = useRef<any>(null);
  const prevOrientationRef = useRef<ScreenOrientation.OrientationLock | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resumeSec, setResumeSec] = useState(-1);

  useEffect(() => {
    const rawLesson = Array.isArray(lessonId) ? lessonId[0] : lessonId;
    initialLessonIdRef.current = rawLesson ?? null;
    const rawStart = Array.isArray(startSec) ? startSec[0] : startSec;
    const parsed = Math.max(0, Math.floor(Number(rawStart || 0) || 0));
    initialStartSecRef.current = parsed;
    seekAppliedLessonRef.current = null;
  }, [lessonId, startSec]);

  useEffect(() => {
    if (!lessonId) return;
    const raw = Array.isArray(lessonId) ? lessonId[0] : lessonId;
    if (raw) setCurrentId(raw);
  }, [lessonId]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!courseId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const c = await getCourse(courseId);
      if (!active) return;
      if (!c) {
        Alert.alert("Introuvable", "Cours introuvable.");
        setLoading(false);
        return;
      }
      setCourse(c);
      setCurrentId((prev) => prev ?? lessonId ?? c?.chapters?.[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [courseId, lessonId]);

  const lesson = useMemo(() => {
    const list = course?.chapters || [];
    if (!list.length) return null;
    return list.find((ch: any) => ch.id === currentId) || list[0];
  }, [course, currentId]);

  useEffect(() => {
    if (lesson?.id && currentId !== lesson.id) setCurrentId(lesson.id);
  }, [lesson?.id]);

  useEffect(() => {
    if (!user?.id || !course?.id) return;
    if (trackedCourseRef.current) return;
    trackedCourseRef.current = true;
    addCourseView(user.id).catch(() => {});
  }, [user?.id, course?.id]);

  useEffect(() => {
    if (!user?.id || !lesson?.id) return;
    if (trackedLessonRef.current === lesson.id) return;
    trackedLessonRef.current = lesson.id;
    addLessonView(user.id).catch(() => {});
  }, [user?.id, lesson?.id]);

  useEffect(() => {
    if (!user?.id || !course?.id || !lesson?.id) {
      setResumeSec(-1);
      return;
    }
    let active = true;
    setResumeSec(-1);
    getLessonProgress(user.id, course.id, lesson.id)
      .then((row) => {
        if (!active) return;
        const watched = Math.max(0, Math.floor(Number(row?.watchedSec || 0)));
        setResumeSec(watched);
      })
      .catch(() => {
        if (active) setResumeSec(0);
      });
    return () => {
      active = false;
    };
  }, [user?.id, course?.id, lesson?.id]);

  useEffect(() => {
    progressDisabledRef.current = false;
    progressErrorRef.current = 0;
  }, [lesson?.id, user?.id]);

  useEffect(() => {
    let active = true;
    if (Platform.OS === "web") return () => {};
    (async () => {
      try {
        const lock = await ScreenOrientation.getOrientationLockAsync();
        if (active) prevOrientationRef.current = lock;
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
      if (Platform.OS === "web") return;
      const prev = prevOrientationRef.current;
      if (prev == null) return;
      ScreenOrientation.lockAsync(prev).catch(() => {});
    };
  }, []);

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const getLangUrl = (l: any, k: PlayerLangKey): string | null => {
    if (!l) return null;
    const byLang = l?.videoByLang || l?.langUrls || {};
    if (byLang && typeof byLang[k] === "string" && byLang[k]) return byLang[k];
    if (k === "fr" && l.videoUrl) return l.videoUrl;
    return null;
  };

  useEffect(() => {
    if (!lesson) return;
    const selectedUrl = getLangUrl(lesson, lang);
    if (!selectedUrl) {
      const firstAvailable = LANG_ORDER.find((k) => !!getLangUrl(lesson, k));
      if (firstAvailable && firstAvailable !== lang) setLang(firstAvailable);
    }
  }, [lesson?.id]);

  const hasValidOwner = useMemo(() => isValidUuid(course?.ownerId), [course?.ownerId]);
  const canContact = !!user && hasValidOwner && user.id !== course?.ownerId && user.role !== "teacher";

  async function onContact() {
    if (!user || !course) return;
    if (!hasValidOwner) {
      Alert.alert("Impossible", "Ce cours n'est pas associe a un professeur valide.");
      return;
    }
    try {
      const th = await startThread({
        teacherId: course.ownerId,
        teacherName: course.ownerName || "",
        studentId: user.id,
        studentName: user.name || "",
        courseId: course.id,
        courseTitle: course.title || "",
      });
      router.push(`/(app)/messages/${th.id}`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de demarrer la discussion.");
    }
  }

  const selectedUrl = lesson ? getLangUrl(lesson, lang) : null;
  const isYouTube = !!selectedUrl && /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(selectedUrl);
  const isPlayable = !!selectedUrl && !isYouTube && isDirectMedia(selectedUrl);
  const isExternal = !!selectedUrl && !isYouTube && !isDirectMedia(selectedUrl);

  const [player, setPlayer] = useState<any | null>(null);
  const playerRef = useRef<any>(null);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!isPlayable || !player || !isPlaying) return;
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  }, [clearHideTimer, isPlayable, player, isPlaying]);

  const bumpControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (!showControls) {
      clearHideTimer();
      return;
    }
    scheduleHide();
    return () => clearHideTimer();
  }, [showControls, scheduleHide, clearHideTimer]);

  useEffect(() => {
    if (!isPlayable || !selectedUrl) {
      if (playerRef.current?.release) {
        playerRef.current.release();
      }
      playerRef.current = null;
      setPlayer(null);
      return;
    }
    let next: any = null;
    try {
      next = createVideoPlayer(selectedUrl);
      next.loop = false;
      next.timeUpdateEventInterval = 1;
      next.volume = 1;
    } catch {
      next = null;
    }
    if (playerRef.current?.release) {
      playerRef.current.release();
    }
    playerRef.current = next;
    setPlayer(next);
    return () => {
      if (playerRef.current?.release) {
        playerRef.current.release();
      }
      playerRef.current = null;
      setPlayer(null);
    };
  }, [selectedUrl, isPlayable]);

  const canPlay = isPlayable && !!player;
  const playError = isPlayable && !player;

  useEffect(() => {
    if (!player || !isPlayable || !selectedUrl) return;
    try {
      player.play();
      setIsPlaying(true);
      setCurTime(0);
      setDuration(0);
      curTimeRef.current = 0;
      durationRef.current = 0;
    } catch {
      // ignore play failures
    }
  }, [player, selectedUrl, isPlayable]);

  useEffect(() => {
    if (!isPlayable || !player) return;
    player.volume = muted ? 0 : 1;
  }, [muted, isPlayable, player]);

  useEffect(() => {
    if (!isPlayable || !player) return;
    if (typeof (player as any).playbackRate !== "undefined") {
      (player as any).playbackRate = rate;
    }
  }, [rate, isPlayable, player]);

  useEffect(() => {
    if (!isPlayable || !player) return;
    const timeSub = player.addListener("timeUpdate", (payload: any) => {
      const current = Math.floor(payload?.currentTime ?? 0);
      curTimeRef.current = current;
      if (!draggingRef.current) setCurTime(current);
    });
    const loadSub = player.addListener("sourceLoad", (payload: any) => {
      const dur = Math.floor(payload?.duration ?? 0);
      if (dur > 0) {
        durationRef.current = dur;
        setDuration(dur);
      }
    });
    return () => {
      timeSub.remove();
      loadSub.remove();
    };
  }, [isPlayable, selectedUrl, player]);

  useEffect(() => {
    if (!isPlayable || !player || !lesson?.id) return;
    if (resumeSec < 0) return;
    if (seekAppliedLessonRef.current === lesson.id) return;

    const fromParam = initialLessonIdRef.current === lesson.id ? initialStartSecRef.current : 0;
    const target = Math.max(0, fromParam || 0, resumeSec || 0);
    seekAppliedLessonRef.current = lesson.id;
    if (target <= 3) return;

    const safe = durationRef.current > 0
      ? Math.max(0, Math.min(target, Math.max(0, Math.floor(durationRef.current) - 2)))
      : target;
    try {
      (player as any).currentTime = safe;
      setCurTime(safe);
      curTimeRef.current = safe;
    } catch {
      // noop
    }
  }, [isPlayable, player, lesson?.id, resumeSec]);

  useEffect(() => {
    if (!isPlayable || !player) return;
    if (!user || !course || !lesson) return;
    const t = setInterval(() => {
      if (progressDisabledRef.current) return;
      const current = Math.floor(curTimeRef.current ?? 0);
      const dur = durationRef.current ? Math.floor(durationRef.current) : undefined;
      updateLessonProgress(user.id, course.id, lesson.id, { watchedSec: current, durationSec: dur }).catch(() => {
        progressErrorRef.current += 1;
        if (progressErrorRef.current >= 3) progressDisabledRef.current = true;
      });
    }, 1500);
    return () => clearInterval(t);
  }, [isPlayable, user?.id, course?.id, lesson?.id]);

  const togglePlay = () => {
    if (!isPlayable || !player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      player.play();
      setIsPlaying(true);
      bumpControls();
    }
  };

  const toggleMute = () => {
    setMuted((m) => !m);
    bumpControls();
  };

  const toggleControls = () => {
    setShowControls((v) => {
      const next = !v;
      if (next) scheduleHide();
      else clearHideTimer();
      return next;
    });
  };

  const enterFullscreen = () => {
    bumpControls();
    videoRef.current?.enterFullscreen?.().catch?.(() => {});
  };

  const exitFullscreen = useCallback(() => {
    const fn = videoRef.current?.exitFullscreen;
    if (typeof fn !== "function") return false;
    try {
      const maybePromise = fn.call(videoRef.current);
      maybePromise?.catch?.(() => {});
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" || !isFullscreen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      return exitFullscreen();
    });
    return () => sub.remove();
  }, [isFullscreen, exitFullscreen]);

  const onFullscreenEnter = () => {
    setIsFullscreen(true);
    if (Platform.OS === "web") return;
    ScreenOrientation.unlockAsync().catch(() => {});
  };

  const onFullscreenExit = () => {
    setIsFullscreen(false);
    if (Platform.OS === "web") return;
    const prev = prevOrientationRef.current;
    if (prev != null) {
      ScreenOrientation.lockAsync(prev).catch(() => {});
    } else {
      ScreenOrientation.unlockAsync().catch(() => {});
    }
  };

  const cycleRate = () => {
    const idx = RATES.indexOf(rate);
    const next = RATES[(idx + 1) % RATES.length];
    setRate(next);
    bumpControls();
  };

  const seekTo = (sec: number) => {
    if (!isPlayable || !player) return;
    const max = duration || sec;
    const next = Math.max(0, Math.min(sec, max));
    (player as any).currentTime = next;
    setCurTime(next);
    curTimeRef.current = next;
    bumpControls();
  };

  const back10 = () => seekTo((curTimeRef.current ?? curTime) - 10);
  const fwd10 = () => seekTo((curTimeRef.current ?? curTime) + 10);

  const onLangPress = (k: PlayerLangKey) => {
    const url = getLangUrl(lesson, k);
    if (!url) return;
    setLang(k);
    bumpControls();
  };

  const onLangLongPress = async (k: PlayerLangKey) => {
    const url = getLangUrl(lesson, k);
    if (!url) return;
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert("Lien copie", "Le lien de la video a ete copie.");
    } catch {
      Alert.alert("Erreur", "Impossible de copier le lien.");
    }
  };

  const openExternal = async () => {
    if (!selectedUrl) return;
    try {
      const ok = await Linking.canOpenURL(selectedUrl);
      if (!ok) throw new Error("bad url");
      await Linking.openURL(selectedUrl);
    } catch {
      Alert.alert("Lien invalide", "Impossible d'ouvrir le lien.");
    }
  };

  const openQuiz = () => {
    if (!course?.id || !lesson?.id) return;
    router.push(`/(app)/course/quiz?courseId=${course.id}&lessonId=${lesson.id}`);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLOR.bg }]}> 
        <ActivityIndicator color={COLOR.primary} />
        <Text style={{ color: COLOR.sub, marginTop: 8, fontFamily: FONT.body }}>Chargement...</Text>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={[styles.center, { backgroundColor: COLOR.bg }]}> 
        <Text style={{ color: COLOR.sub }}>Cours introuvable.</Text>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={styles.root}> 
        <TopBar title={course.title || "Cours"} right={null} />
        <View style={styles.center}>
          <Text style={{ color: COLOR.sub }}>Aucun chapitre disponible.</Text>
        </View>
      </View>
    );
  }

  const chapters = course.chapters || [];
  const chapterCount = chapters.length || 0;
  const idx = lesson ? chapters.findIndex((ch: any) => ch.id === lesson.id) : -1;
  const chapterIndex = idx >= 0 ? idx : 0;
  const prev = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const next = chapterIndex < chapterCount - 1 ? chapters[chapterIndex + 1] : null;

  return (
    <View style={styles.root}>
      <TopBar
        title={course.title || "Cours"}
        right={canContact ? (
          <TouchableOpacity onPress={onContact} style={styles.chatBtn}>
            <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
            <Text style={styles.chatBtnText}>Message</Text>
          </TouchableOpacity>
        ) : null}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.playerCard}>
          <Pressable onPress={toggleControls} style={styles.videoTap}>
            {canPlay ? (
              <VideoView
                ref={videoRef}
                style={styles.video}
                player={player}
                  nativeControls={isFullscreen}
                  fullscreenOptions={{ enable: true, orientation: "landscape", autoExitOnRotate: true }}
                  allowsPictureInPicture={false}
                  surfaceType={Platform.OS === "android" ? "textureView" : undefined}
                  onFullscreenEnter={onFullscreenEnter}
                  onFullscreenExit={onFullscreenExit}
                />
            ) : (
              <View style={[styles.video, styles.videoFallback]}>
                <Ionicons name="play-circle" size={42} color="#fff" />
                <Text style={styles.fallbackTitle}>
                  {playError
                    ? "Lecteur indisponible"
                    : isYouTube
                    ? "Source non supportee"
                    : !selectedUrl
                    ? "Aucune video pour ce chapitre"
                    : "Lecture externe requise"}
                </Text>
                <Text style={styles.fallbackText}>
                  {playError
                    ? "La lecture ne peut pas demarrer. Essayez un autre chapitre."
                    : isYouTube
                    ? "Les liens YouTube ne sont pas acceptes."
                    : isExternal
                    ? "Ce lien ne peut pas etre lu ici. Ouvrez-le dans le navigateur."
                    : "Ajoutez une video pour demarrer la lecture."}
                </Text>
                {isExternal ? (
                  <TouchableOpacity onPress={openExternal} style={styles.fallbackBtn}>
                    <Ionicons name="open-outline" size={16} color="#fff" />
                    <Text style={styles.fallbackBtnText}>Ouvrir le lien</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </Pressable>

          <LinearGradient
            colors={["rgba(0,0,0,0.65)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.topGrad}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.botGrad}
            pointerEvents="none"
          />

          <View style={styles.playerTop} pointerEvents="none">
            <View style={styles.playerTopRow}>
              <Text style={styles.playerTitle} numberOfLines={1}>{lesson.title}</Text>
              <View style={styles.playerBadge}>
                <Text style={styles.playerBadgeText}>
                  Chapitre {chapterIndex + 1}/{Math.max(1, chapterCount)}
                </Text>
              </View>
            </View>
            <Text style={styles.playerSub} numberOfLines={1}>
              {course.subject || "Matiere"} - {course.level || "Niveau"}
            </Text>
          </View>

          {canPlay && showControls ? (
            <View style={styles.playerBottom} pointerEvents="box-none">
              <View style={styles.seekRow}>
                <Text style={styles.time}>{fmtTime(curTime)}</Text>
              <Slider
                style={{ flex: 1 }}
                value={curTime}
                minimumValue={0}
                maximumValue={Math.max(1, duration || curTime + 1)}
                onSlidingStart={() => {
                  setDragging(true);
                  bumpControls();
                }}
                onSlidingComplete={(v) => {
                  (player as any).currentTime = v;
                  curTimeRef.current = Math.floor(v);
                  setDragging(false);
                  bumpControls();
                }}
                onValueChange={(v) => {
                  curTimeRef.current = Math.floor(v);
                  setCurTime(v);
                }}
                  minimumTrackTintColor="#fff"
                  maximumTrackTintColor="rgba(148,163,184,0.45)"
                  thumbTintColor="#fff"
                />
                <Text style={styles.time}>{fmtTime(duration || curTime)}</Text>
              </View>

              <View style={styles.ctrlRow}>
                <View style={styles.ctrlGroup}>
                  <TouchableOpacity onPress={back10} style={styles.ctrlBtn} hitSlop={8}>
                    <Ionicons name="play-back" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={togglePlay} style={[styles.ctrlBtn, styles.ctrlBtnPrimary]} hitSlop={8}>
                    <Ionicons name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={fwd10} style={styles.ctrlBtn} hitSlop={8}>
                    <Ionicons name="play-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.ctrlGroup}>
                  <TouchableOpacity onPress={toggleMute} style={styles.ctrlBtn} hitSlop={8}>
                    <Ionicons name={muted ? "volume-mute" : "volume-high"} size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cycleRate} style={styles.rateBtn} hitSlop={8}>
                    <Text style={styles.rateText}>{rate.toString()}x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={isFullscreen ? exitFullscreen : enterFullscreen} style={styles.ctrlBtn} hitSlop={8}>
                    <Ionicons name={isFullscreen ? "contract" : "expand"} size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
          <Text style={styles.courseMeta}>{course.subject || "Matiere"} - {course.level || "Niveau"}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="albums-outline" size={14} color={COLOR.text} />
              <Text style={styles.metaPillText}>Chapitres {chapterCount}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="person-outline" size={14} color={COLOR.text} />
              <Text style={styles.metaPillText}>{course.ownerName || "Enseignant"}</Text>
            </View>
            {isExternal ? (
              <View style={styles.metaPill}>
                <Ionicons name="link-outline" size={14} color={COLOR.text} />
                <Text style={styles.metaPillText}>Lecture externe</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={openQuiz} style={styles.quizBtn}>
            <Ionicons name="help-circle-outline" size={16} color="#fff" />
            <Text style={styles.quizBtnText}>Quiz</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.langCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Langues</Text>
            <Text style={styles.sectionMeta}>Choisir la version</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langBar}>
            {LANG_ORDER.map((k) => {
              const available = !!getLangUrl(lesson, k);
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => onLangPress(k)}
                  onLongPress={() => onLangLongPress(k)}
                  delayLongPress={300}
                  style={[
                    styles.langBtn,
                    lang === k && styles.langBtnActive,
                    !available && styles.langBtnDisabled,
                  ]}
                  disabled={!available}
                >
                  <Text style={[styles.langText, lang === k && styles.langTextActive]}>{LANG_LABELS[k]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.chapterCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Chapitres</Text>
            <Text style={styles.sectionMeta}>{chapterCount} lecons</Text>
          </View>
          <FlatList
            data={chapters}
            keyExtractor={(i) => i.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingBottom: 6 }}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <ChapterRow
                title={item.title}
                index={index + 1}
                hasVideo={!!item.videoUrl || !!item.videoByLang || !!item.langUrls}
                active={item.id === lesson.id}
                onPress={() => setCurrentId(item.id)}
              />
            )}
            ListEmptyComponent={<Text style={{ color: COLOR.sub, marginTop: 6 }}>Aucun chapitre pour le moment.</Text>}
          />
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            disabled={!prev}
            onPress={() => (prev ? setCurrentId(prev.id) : null)}
            style={[styles.navBtn, !prev && { opacity: 0.5 }]}
          >
            <Ionicons name="arrow-back" size={18} color="#fff" />
            <Text style={styles.navText}>Precedent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!next}
            onPress={() => (next ? setCurrentId(next.id) : null)}
            style={[styles.navBtn, !next && { opacity: 0.5 }]}
          >
            <Text style={styles.navText}>Suivant</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  content: { paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  playerCard: {
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
    margin: 16,
    shadowColor: "#0B1D39",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  video: { width: "100%", height: 230, backgroundColor: "#0b0b0c" },
  videoTap: { width: "100%", height: 230 },
  videoFallback: { alignItems: "center", justifyContent: "center", padding: 16, gap: 8 },
  fallbackTitle: { color: "#fff", fontFamily: FONT.headingAlt, fontSize: 16, textAlign: "center" },
  fallbackText: { color: "rgba(255,255,255,0.8)", fontFamily: FONT.body, textAlign: "center" },
  fallbackBtn: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  fallbackBtnText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 12 },

  topGrad: { position: "absolute", left: 0, right: 0, top: 0, height: 90 },
  botGrad: { position: "absolute", left: 0, right: 0, bottom: 0, height: 130 },

  playerTop: { position: "absolute", left: 12, right: 12, top: 10 },
  playerTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  playerTitle: { flex: 1, color: "#fff", fontFamily: FONT.headingAlt, fontSize: 16 },
  playerSub: { color: "rgba(255,255,255,0.8)", fontFamily: FONT.body, marginTop: 4 },
  playerBadge: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  playerBadgeText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 11 },
  playerBottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: 8 },

  seekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  time: {
    color: "rgba(255,255,255,0.85)",
    width: 46,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    fontFamily: FONT.body,
    fontSize: 11,
  },

  ctrlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  ctrlGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  ctrlBtn: {
    backgroundColor: "rgba(15,23,42,0.45)",
    height: 32,
    minWidth: 32,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnPrimary: {
    backgroundColor: "rgba(59,130,246,0.85)",
    borderColor: "rgba(255,255,255,0.4)",
  },
  rateBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  rateText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 11 },

  metaCard: {
    marginHorizontal: 16,
    marginTop: 2,
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  lessonTitle: { color: COLOR.text, fontSize: 20, fontFamily: FONT.headingAlt },
  courseMeta: { color: COLOR.sub, fontFamily: FONT.body },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  quizBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: COLOR.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quizBtnText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 13 },

  langCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
  },
  chapterCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, marginBottom: 6 },
  sectionTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 15 },
  sectionMeta: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 12 },

  langBar: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    marginRight: 8,
  },
  langBtnActive: { borderColor: COLOR.primary, backgroundColor: COLOR.tint },
  langBtnDisabled: { opacity: 0.5 },
  langText: { color: COLOR.sub, fontFamily: FONT.bodyBold },
  langTextActive: { color: COLOR.text },

  navRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingHorizontal: 16 },
  navBtn: {
    backgroundColor: COLOR.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navText: { color: "#fff", fontFamily: FONT.bodyBold },

  chatBtn: { backgroundColor: COLOR.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6, marginRight: 8 },
  chatBtnText: { color: "#fff", fontFamily: FONT.bodyBold },
});
