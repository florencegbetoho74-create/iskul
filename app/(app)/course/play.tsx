import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, FlatList } from "react-native";
import { useLocalSearchParams, Link, useRouter } from "expo-router";
import { COLOR } from "@/theme/colors";
import { getCourse } from "@/storage/courses";
import { useAuth } from "@/providers/AuthProvider";
import { updateLessonProgress } from "@/storage/progress";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Slider from "@react-native-community/slider";
import QuizCard from "@/components/QuizCard";
import Segmented from "@/components/Segmented";
import ChapterRow from "@/components/ChapterRow";
import TopBar from "@/components/TopBar";
import { fmtTime } from "@/utils/time";
import { addNote, deleteNote, listNotes, LessonNote } from "@/storage/notes";
import YouTubePlayer, { YTHandle } from "@/components/YouTubePlayer";
import { isYouTubeUrl, getYouTubeId } from "@/utils/youtube";
import { startThread } from "@/storage/chat";

const TABS = [
  { key: "plan", label: "Plan" },
  { key: "quiz", label: "Quiz" },
  { key: "notes", label: "Notes" }
] as const;

const SAMPLE_QUIZ = [
  { id: "q1", question: "La suite (u_n) arithmétique a pour raison r. Quelle relation est vraie ?", choices: ["u_{n+1} = u_n + r", "u_{n+1} = r * u_n", "u_{n+1} = u_n - r"], answer: 0 }
];

export default function Play() {
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId?: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<any | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(lessonId ?? null);
  const [tab, setTab] = useState<string>("plan");

  // Notes
  const [notes, setNotes] = useState<LessonNote[]>([]);
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    (async () => {
      if (!courseId) return;
      const c = await getCourse(courseId);
      if (!c) {
        Alert.alert("Introuvable", "Cours introuvable.");
        return;
      }
      setCourse(c);
      setCurrentId(prev => prev ?? c?.chapters?.[0]?.id ?? null);
    })();
  }, [courseId]);

  const lesson = useMemo(() =>
    course?.chapters?.find((ch: any) => ch.id === currentId) ?? null, [course, currentId]
  );

  const canContact = !!user && user.role !== "teacher" && course && user.id !== course.ownerId;

  const onContact = async () => {
    if (!user || !course) return;
    try {
      const th = await startThread({
        teacherId: course.ownerId,
        teacherName: course.ownerName || "",
        studentId: user.id,
        studentName: user.name || "",
        courseId: course.id,
        courseTitle: course.title || ""
      });
      router.push(`/(app)/messages/${th.id}`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de démarrer la discussion.");
    }
  };

  const yt = !!lesson?.videoUrl && isYouTubeUrl(lesson.videoUrl);
  const ytId = yt ? getYouTubeId(lesson?.videoUrl) : null;
  const ytRef = useRef<YTHandle>(null);

  // --- PLAYER expo-video (pour mp4/m3u8)
  const player = useVideoPlayer(yt ? "" : (lesson?.videoUrl ?? ""), (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 1;
  });

  useEffect(() => {
    if (yt) return;
    if (!lesson?.videoUrl) return;
    player.replace(lesson.videoUrl);
    player.play();
  }, [lesson?.videoUrl, yt]);

  useEffect(() => {
    if (yt) return;
    const t = setInterval(async () => {
      if (!user || !course || !lesson) return;
      const current = Math.floor(player.currentTime ?? 0);
      // @ts-ignore
      const dur = (player as any)?.duration ? Math.floor((player as any).duration) : undefined;
      await updateLessonProgress(user.id, course.id, lesson.id, { watchedSec: current, durationSec: dur });
    }, 1500);
    return () => clearInterval(t);
  }, [user?.id, course?.id, lesson?.id, yt]);

  useEffect(() => {
    (async () => {
      if (!user || !course || !lesson) return;
      const rows = await listNotes(user.id, course.id, lesson.id);
      setNotes(rows);
    })();
  }, [user?.id, course?.id, lesson?.id]);

  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (yt) return;
    const i = setInterval(() => {
      if (!dragging) {
        setCurTime(Math.floor(player.currentTime ?? 0));
        const d = (player as any)?.duration;
        if (d && Number.isFinite(d)) setDuration(Math.floor(d));
      }
    }, 300);
    return () => clearInterval(i);
  }, [dragging, yt]);

  if (!course || !lesson) {
    return <View style={{ flex: 1, backgroundColor: COLOR.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: COLOR.sub }}>Chargement…</Text>
    </View>;
  }

  const idx = course.chapters.findIndex((c: any) => c.id === lesson.id);
  const prev = idx > 0 ? course.chapters[idx - 1] : null;
  const next = idx < course.chapters.length - 1 ? course.chapters[idx + 1] : null;

  const play = () => player.play();
  const pause = () => player.pause();
  const back10 = () => (player.currentTime = Math.max(0, (player.currentTime ?? 0) - 10));
  const fwd10  = () => (player.currentTime = (player.currentTime ?? 0) + 10);

  const addCurrentNote = async () => {
    if (!user || !course || !lesson) return;
    const t = Math.floor(yt ? (curTime ?? 0) : (player.currentTime ?? 0));
    if (!noteInput.trim()) return;
    await addNote(user.id, course.id, lesson.id, t, noteInput.trim());
    const rows = await listNotes(user.id, course.id, lesson.id);
    setNotes(rows); setNoteInput("");
  };

  const removeNote = async (noteId: string) => {
    if (!user || !course || !lesson) return;
    await deleteNote(user.id, course.id, lesson.id, noteId);
    const rows = await listNotes(user.id, course.id, lesson.id);
    setNotes(rows);
  };

  return (
    <View style={styles.root}>
      {/* HEADER avec bouton message */}
      <TopBar
        title={course.title}
        right={canContact ? (
          <TouchableOpacity onPress={onContact} style={styles.chatBtn}>
            <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
            <Text style={styles.chatBtnText}>Message</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* PLAYER CARD */}
      <View style={styles.playerCard}>
        {yt && ytId ? (
          <>
            <YouTubePlayer
              ref={ytRef}
              videoId={ytId}
              onProgress={async (sec, dur) => {
                setCurTime(sec);
                if (dur && dur !== duration) setDuration(dur);
                if (user && course && lesson) {
                  await updateLessonProgress(user.id, course.id, lesson.id, { watchedSec: sec, durationSec: dur });
                }
              }}
            />
            <View style={styles.ctrlRowBelow}>
              <TouchableOpacity onPress={() => ytRef.current?.seekTo(Math.max(0, curTime - 10))} style={styles.ctrlBtn}>
                <Ionicons name="play-back" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => ytRef.current?.play()} style={styles.ctrlBtn}>
                <Ionicons name="play" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => ytRef.current?.pause()} style={styles.ctrlBtn}>
                <Ionicons name="pause" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => ytRef.current?.seekTo(curTime + 10)} style={styles.ctrlBtn}>
                <Ionicons name="play-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.seekRow}>
              <Text style={styles.time}>{fmtTime(curTime)}</Text>
              <Slider
                style={{ flex: 1 }}
                value={curTime}
                minimumValue={0}
                maximumValue={Math.max(1, duration || curTime + 1)}
                onSlidingStart={() => setDragging(true)}
                onSlidingComplete={(v) => { ytRef.current?.seekTo(v); setDragging(false); }}
                onValueChange={(v) => setCurTime(v)}
                minimumTrackTintColor="#fff"
                maximumTrackTintColor="#6b7280"
                thumbTintColor="#fff"
              />
              <Text style={styles.time}>{fmtTime(duration || curTime)}</Text>
            </View>
          </>
        ) : (
          <>
            <VideoView style={styles.video} player={player} allowsFullscreen allowsPictureInPicture />
            <LinearGradient colors={["rgba(0,0,0,0.6)", "transparent"]} start={{x:0,y:0}} end={{x:0,y:1}} style={styles.topGrad} />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} start={{x:0,y:0}} end={{x:0,y:1}} style={styles.botGrad} />
            <View style={styles.ctrlRow}>
              <TouchableOpacity onPress={back10} style={styles.ctrlBtn}><Ionicons name="play-back" size={18} color="#fff" /></TouchableOpacity>
              <TouchableOpacity onPress={play} style={styles.ctrlBtn}><Ionicons name="play" size={18} color="#fff" /></TouchableOpacity>
              <TouchableOpacity onPress={pause} style={styles.ctrlBtn}><Ionicons name="pause" size={18} color="#fff" /></TouchableOpacity>
              <TouchableOpacity onPress={fwd10} style={styles.ctrlBtn}><Ionicons name="play-forward" size={18} color="#fff" /></TouchableOpacity>
            </View>
            <View style={styles.seekRow}>
              <Text style={styles.time}>{fmtTime(curTime)}</Text>
              <Slider
                style={{ flex: 1 }}
                value={curTime}
                minimumValue={0}
                maximumValue={Math.max(1, duration || curTime + 1)}
                onSlidingStart={() => setDragging(true)}
                onSlidingComplete={(v) => { (player as any).currentTime = v; setDragging(false); }}
                onValueChange={(v) => setCurTime(v)}
                minimumTrackTintColor="#fff"
                maximumTrackTintColor="#6b7280"
                thumbTintColor="#fff"
              />
              <Text style={styles.time}>{fmtTime(duration || curTime)}</Text>
            </View>
          </>
        )}
      </View>

      {/* META */}
      <View style={styles.metaWrap}>
        <Text style={styles.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
        <Text style={styles.courseMeta}>{course.subject} • {course.level}</Text>
      </View>

      {/* TABS */}
      <View style={{ paddingHorizontal: 16, gap: 12, flex: 1 }}>
        <Segmented value={tab} items={TABS as any} onChange={setTab} />

        {tab === "plan" && (
          <FlatList
            data={course.chapters ?? []}
            keyExtractor={(i) => i.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item, index }) => (
              <ChapterRow
                title={item.title}
                index={index + 1}
                hasVideo={!!item.videoUrl}
                active={item.id === lesson.id}
                onPress={() => setCurrentId(item.id)}
              />
            )}
            ListEmptyComponent={<Text style={{ color: COLOR.sub, marginTop: 6 }}>Aucun chapitre pour le moment.</Text>}
          />
        )}

        {tab === "quiz" && (
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <QuizCard data={SAMPLE_QUIZ[0]} />
          </ScrollView>
        )}

        {tab === "notes" && (
          <View style={{ gap: 12 }}>
            <View style={styles.noteRow}>
              <TextInput placeholder="Ajouter une note…" placeholderTextColor="#6b7280" value={noteInput} onChangeText={setNoteInput} style={styles.noteInput} />
              <TouchableOpacity style={styles.noteBtn} onPress={addCurrentNote}>
                <Ionicons name="add-circle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={notes}
              keyExtractor={(n) => n.id}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <View style={styles.noteItem}>
                  <TouchableOpacity
                    onPress={() => {
                      if (yt) ytRef.current?.seekTo(item.t);
                      else (player as any).currentTime = item.t;
                      setCurTime(item.t);
                    }}
                    style={styles.noteTimeBtn}
                  >
                    <Text style={styles.noteTime}>{fmtTime(item.t)}</Text>
                  </TouchableOpacity>
                  <Text style={styles.noteText}>{item.text}</Text>
                  <TouchableOpacity onPress={() => removeNote(item.id)} style={styles.noteDel}>
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: COLOR.sub }}>Aucune note pour ce chapitre.</Text>}
            />
          </View>
        )}

        <View style={styles.navRow}>
          <TouchableOpacity disabled={!course.chapters?.length || !course.chapters[idx - 1]} onPress={() => setCurrentId(course.chapters[idx - 1]?.id)} style={[styles.navBtn, (!course.chapters?.length || !course.chapters[idx - 1]) && { opacity: 0.5 }]}>
            <Ionicons name="arrow-back" size={18} color="#fff" /><Text style={styles.navText}>Précédent</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={!course.chapters?.length || !course.chapters[idx + 1]} onPress={() => setCurrentId(course.chapters[idx + 1]?.id)} style={[styles.navBtn, (!course.chapters?.length || !course.chapters[idx + 1]) && { opacity: 0.5 }]}>
            <Text style={styles.navText}>Suivant</Text><Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <Link href={`/(app)/course/${course.id}`}><Text style={styles.back}>← Retour au cours</Text></Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  playerCard: { backgroundColor: "#111214", borderColor: "#1F2023", borderWidth: 1, borderRadius: 16, overflow: "hidden", margin: 16 },
  video: { width: "100%", height: 230, backgroundColor: "#000" },
  topGrad: { position: "absolute", left: 0, right: 0, top: 0, height: 80 },
  botGrad: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  ctrlRow: { position: "absolute", bottom: 52, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 10 },
  ctrlRowBelow: { flexDirection: "row", justifyContent: "center", gap: 10, paddingTop: 10 },
  ctrlBtn: { backgroundColor: "rgba(0,0,0,0.45)", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  seekRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  time: { color: "#cbd5e1", width: 52, textAlign: "center", fontVariant: ["tabular-nums"] },
  metaWrap: { paddingHorizontal: 16, gap: 4 },
  lessonTitle: { color: COLOR.text, fontSize: 18, fontWeight: "900" },
  courseMeta: { color: COLOR.sub },
  navRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  navBtn: { backgroundColor: "#6C5CE7", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  navText: { color: "#fff", fontWeight: "800" },
  back: { color: "#cbd5e1", textDecorationLine: "underline", marginTop: 12 },

  noteRow: { flexDirection: "row", gap: 8 },
  noteInput: { flex: 1, backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#24262a" },
  noteBtn: { backgroundColor: COLOR.primary, borderRadius: 12, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  noteItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111214", borderWidth: 1, borderColor: "#1F2023", borderRadius: 12, padding: 10 },
  noteTimeBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#0b0b0c", borderWidth: 1, borderColor: "#2a2b2f" },
  noteTime: { color: "#fff", fontWeight: "800", fontVariant: ["tabular-nums"] },
  noteText: { color: COLOR.text, flex: 1 },
  noteDel: { padding: 6, borderRadius: 8, backgroundColor: "#e11d48" },

  chatBtn: { backgroundColor: COLOR.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6, marginRight: 8 },
  chatBtnText: { color: "#fff", fontWeight: "900" }
});
