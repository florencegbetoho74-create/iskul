// app/(app)/course/play.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  FlatList,
  Linking,
  ActivityIndicator,
  Platform,
  BackHandler,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ScreenOrientation from "expo-screen-orientation";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { getCourse } from "@/storage/courses";
import { useAuth } from "@/providers/AuthProvider";
import { getLessonProgress, updateLessonProgress } from "@/storage/progress";
import { createVideoPlayer, VideoView } from "expo-video";
import ChapterRow from "@/components/ChapterRow";
import PlayerControls, { PlayerProgressBar } from "@/components/player/PlayerControls";
import LessonNotes from "@/components/player/LessonNotes";
import { Button as UiButton } from "@/components/ui";
import TopBar from "@/components/TopBar";
import { fmtTime } from "@/utils/time";
import { addCourseView, addLessonView } from "@/storage/usage";
import { startThread } from "@/storage/chat";

type PlayerLangKey = "fr" | "fon" | "adja" | "yoruba" | "dendi";
const LANG_ORDER: PlayerLangKey[] = ["fr", "fon", "adja", "yoruba", "dendi"];
const LANG_LABELS: Record<PlayerLangKey, string> = {
  fr: "Francais",
  fon: "Fon",
  adja: "Adja",
  yoruba: "Yoruba",
  dendi: "Dendi",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v?: string | null) => !!v && UUID_RE.test(v);

const isDirectMedia = (u: string) =>
  /\.(mp4|m4v|mov|webm)(\?|$)/i.test(u) || /\.m3u8(\?|$)/i.test(u) || /\.mpd(\?|$)/i.test(u);

export default function Play() {
  const { styles, theme } = useThemedStyles(makeStyles);
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
      <View style={[styles.center, { backgroundColor: theme.color.bg }]}> 
        <ActivityIndicator color={theme.color.primary} />
        <Text style={{ color: theme.color.textMuted, marginTop: 8, fontFamily: theme.type.body.fontFamily }}>Chargement...</Text>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={[styles.center, { backgroundColor: theme.color.bg }]}> 
        <Text style={{ color: theme.color.textMuted }}>Cours introuvable.</Text>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={styles.root}> 
        <TopBar title={course.title || "Cours"} right={null} />
        <View style={styles.center}>
          <Text style={{ color: theme.color.textMuted }}>Aucun chapitre disponible.</Text>
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

  const availableLangs = LANG_ORDER.filter((k) => !!getLangUrl(lesson, k));

  const Stage = (
    <View style={styles.stage}>
      <Pressable onPress={toggleControls} style={styles.stageTap} accessibilityRole="button">
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
          <View style={[styles.video, styles.stageFallback]}>
            <Ionicons name="videocam-off-outline" size={30} color={theme.color.onMedia} />
            <Text style={styles.fallbackTitle}>
              {playError
                ? "Lecture impossible"
                : isYouTube
                ? "Source non prise en charge"
                : !selectedUrl
                ? "Pas encore de video"
                : "Lecture externe requise"}
            </Text>
            <Text style={styles.fallbackText}>
              {playError
                ? "Essayez un autre chapitre ou une autre langue."
                : isYouTube
                ? "Les liens YouTube ne sont pas acceptes."
                : isExternal
                ? "Ce lien s'ouvre dans le navigateur."
                : "Ce chapitre n'a pas encore de video dans cette langue."}
            </Text>
            {isExternal ? (
              <UiButton onPress={openExternal} icon="open-outline" size="sm" variant="secondary">
                Ouvrir le lien
              </UiButton>
            ) : null}
          </View>
        )}
      </Pressable>

      {canPlay ? (
        <PlayerControls
          visible={showControls}
          playing={isPlaying}
          muted={muted}
          rate={rate}
          currentSec={curTime}
          durationSec={duration}
          onTogglePlay={togglePlay}
          onSeek={(v) => {
            curTimeRef.current = Math.floor(v);
            setCurTime(v);
          }}
          onSeekStart={() => {
            setDragging(true);
            bumpControls();
          }}
          onSeekEnd={(v) => {
            (player as any).currentTime = v;
            curTimeRef.current = Math.floor(v);
            setDragging(false);
            bumpControls();
          }}
          onBack={back10}
          onForward={fwd10}
          onToggleMute={toggleMute}
          onCycleRate={cycleRate}
          onFullscreen={isFullscreen ? exitFullscreen : enterFullscreen}
          isFullscreen={isFullscreen}
        />
      ) : null}

      {canPlay && !showControls ? (
        <PlayerProgressBar currentSec={curTime} durationSec={duration} />
      ) : null}
    </View>
  );

  const Header = (
    <View style={styles.body}>
      {/* Titre du chapitre : l'information la plus utile vient en premier. */}
      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>
          Chapitre {chapterIndex + 1} sur {Math.max(1, chapterCount)}
        </Text>
        <Text style={styles.lessonTitle} numberOfLines={3}>
          {lesson.title}
        </Text>
        <Text style={styles.courseMeta}>
          {[course.subject, course.level, course.ownerName].filter(Boolean).join(" \u00b7 ")}
        </Text>
      </View>

      {/*
        Le choix de la langue etait enfoui sous les metadonnees. C'est la
        promesse centrale d'iSkul : elle remonte juste sous la video.
      */}
      {availableLangs.length > 1 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Langue de la lecon</Text>
          <View style={styles.langRow}>
            {availableLangs.map((k) => {
              const active = lang === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => onLangPress(k)}
                  onLongPress={() => onLangLongPress(k)}
                  delayLongPress={300}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.langChip, active && styles.langChipActive]}
                >
                  <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                    {LANG_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* La boucle regarder puis se tester devient l'action principale. */}
      <View style={styles.actionRow}>
        <UiButton onPress={openQuiz} icon="checkmark-circle-outline" block>
          Passer le quiz
        </UiButton>
        {canContact ? (
          <UiButton onPress={onContact} icon="chatbubble-outline" variant="ghost" size="sm">
            Poser une question
          </UiButton>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mes notes</Text>
        <LessonNotes
          userId={user?.id}
          courseId={course.id}
          lessonId={lesson.id}
          currentSec={curTime}
          onSeek={seekTo}
        />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Chapitres</Text>
        <Text style={styles.sectionMeta}>{chapterCount} lecons</Text>
      </View>
    </View>
  );

  const Footer = (
    <View style={styles.footer}>
      <UiButton
        onPress={() => prev && setCurrentId(prev.id)}
        icon="arrow-back"
        variant="ghost"
        size="sm"
        disabled={!prev}
      >
        Precedent
      </UiButton>
      <UiButton
        onPress={() => next && setCurrentId(next.id)}
        icon="arrow-forward"
        size="sm"
        disabled={!next}
      >
        {next ? "Chapitre suivant" : "Dernier chapitre"}
      </UiButton>
    </View>
  );

  return (
    <View style={styles.root}>
      <TopBar title={course.title || "Cours"} right={null} />

      {/*
        La video reste epinglee : elle etait dans le ScrollView, donc defiler
        la page la faisait disparaitre.
      */}
      {Stage}

      {/*
        Un seul conteneur de defilement. La liste des chapitres etait une
        FlatList imbriquee dans un ScrollView, ce qui annule la virtualisation.
      */}
      <FlatList
        data={chapters}
        keyExtractor={(i: any) => i.id}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, index }: any) => (
          <View style={styles.chapterWrap}>
            <ChapterRow
              title={item.title}
              index={index + 1}
              hasVideo={!!item.videoUrl || !!item.videoByLang || !!item.langUrls}
              active={item.id === lesson.id}
              onPress={() => setCurrentId(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.body}>
            <Text style={styles.sectionMeta}>Aucun chapitre pour le moment.</Text>
          </View>
        }
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.color.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    /* --- Scene video, epinglee sous la barre de titre --- */
    stage: { width: "100%", backgroundColor: t.color.media },
    stageTap: { width: "100%", aspectRatio: 16 / 9 },
    video: { width: "100%", height: "100%", backgroundColor: t.color.media },
    stageFallback: {
      alignItems: "center",
      justifyContent: "center",
      gap: t.space.sm,
      paddingHorizontal: t.space.xl,
    },
    fallbackTitle: {
      color: t.color.onMedia,
      fontFamily: t.type.heading.fontFamily,
      fontSize: t.type.subheading.fontSize,
      textAlign: "center",
    },
    fallbackText: {
      color: "rgba(255,255,255,0.75)",
      fontFamily: t.type.body.fontFamily,
      fontSize: t.type.caption.fontSize,
      lineHeight: t.type.caption.lineHeight,
      textAlign: "center",
    },

    /* --- Corps en sections a plat, sans empilement de cartes --- */
    listContent: { paddingBottom: t.space.xxxl },
    body: { paddingHorizontal: t.space.lg },
    titleBlock: { paddingTop: t.space.lg, gap: t.space.xs },
    eyebrow: {
      color: t.color.primaryInk,
      fontFamily: t.type.overline.fontFamily,
      fontSize: t.type.overline.fontSize,
      letterSpacing: t.type.overline.letterSpacing,
      textTransform: "uppercase",
    },
    lessonTitle: {
      color: t.color.text,
      fontFamily: t.type.title.fontFamily,
      fontSize: t.type.title.fontSize,
      lineHeight: t.type.title.lineHeight,
    },
    courseMeta: {
      color: t.color.textMuted,
      fontFamily: t.type.body.fontFamily,
      fontSize: t.type.caption.fontSize,
    },

    section: { marginTop: t.space.xl, gap: t.space.sm },
    sectionHead: {
      marginTop: t.space.xxl,
      marginBottom: t.space.sm,
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    sectionTitle: {
      color: t.color.text,
      fontFamily: t.type.heading.fontFamily,
      fontSize: t.type.subheading.fontSize,
    },
    sectionMeta: {
      color: t.color.textMuted,
      fontFamily: t.type.body.fontFamily,
      fontSize: t.type.caption.fontSize,
    },

    langRow: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm },
    langChip: {
      minHeight: t.hit.compact,
      justifyContent: "center",
      paddingHorizontal: t.space.lg,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.color.border,
      backgroundColor: t.color.surfaceSunk,
    },
    langChipActive: { borderColor: t.color.primary, backgroundColor: t.color.primarySoft },
    langChipText: {
      color: t.color.textMuted,
      fontFamily: t.type.bodyStrong.fontFamily,
      fontSize: t.type.caption.fontSize,
    },
    langChipTextActive: { color: t.color.primaryInk },

    actionRow: { marginTop: t.space.xl, gap: t.space.sm },

    chapterWrap: { paddingHorizontal: t.space.lg },
    separator: { height: t.space.sm },

    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: t.space.sm,
      paddingHorizontal: t.space.lg,
      paddingTop: t.space.xxl,
    },
  });
