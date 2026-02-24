import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { COLOR, FONT } from "@/theme/colors";
import TopBar from "@/components/TopBar";
import SelectionSheetField from "@/components/SelectionSheetField";
import { useAuth } from "@/providers/AuthProvider";
import { getCourse } from "@/storage/courses";
import {
  getQuizById,
  getQuizByLesson,
  getQuizAttempt,
  saveQuiz,
  submitQuizAttempt,
  Quiz,
  QuizAttempt,
  QuizQuestion,
} from "@/storage/quizzes";
import { COURSE_SUBJECTS, isKnownCourseSubject } from "@/constants/courseSubjects";
import { GRADE_LEVELS, isKnownGradeLevel } from "@/constants/gradeLevels";

const SOUND_CORRECT = require("../../../assets/sounds/quiz-correct.wav");
const SOUND_WRONG = require("../../../assets/sounds/quiz-wrong.wav");
const POINTS_PER_GOOD_ANSWER = 10;

type PlayPhase = "intro" | "question" | "feedback" | "done";

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const makeQuestion = (): QuizQuestion => ({
  id: newId(),
  prompt: "",
  options: ["", ""],
  correctIndices: [0],
});

export default function QuizPage() {
  const { courseId, lessonId, quizId, mode } = useLocalSearchParams<{
    courseId?: string;
    lessonId?: string;
    quizId?: string;
    mode?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const [course, setCourse] = useState<any | null>(null);
  const [lesson, setLesson] = useState<any | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([makeQuestion()]);
  const [published, setPublished] = useState(false);
  const [standaloneLevel, setStandaloneLevel] = useState("");
  const [standaloneSubject, setStandaloneSubject] = useState("");

  const [playPhase, setPlayPhase] = useState<PlayPhase>("intro");
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [runAnswers, setRunAnswers] = useState<number[][]>([]);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [runScore, setRunScore] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<"correct" | "wrong" | null>(null);
  const [persistingAttempt, setPersistingAttempt] = useState(false);
  const [runSaved, setRunSaved] = useState(false);

  const runAnswersRef = useRef<number[][]>([]);
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  const isTeacher = user?.role === "teacher";
  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  const resolvedCourseId = Array.isArray(courseId) ? courseId[0] : courseId;
  const resolvedLessonId = Array.isArray(lessonId) ? lessonId[0] : lessonId;
  const resolvedQuizId = Array.isArray(quizId) ? quizId[0] : quizId;
  const standaloneMode = normalizedMode === "standalone";
  const isStandaloneQuiz = !!(quiz?.scope === "standalone" || (!resolvedCourseId && !resolvedLessonId && standaloneMode));
  const isOwnerCourse = !!user?.id && !!course?.ownerId && user.id === course.ownerId;
  const isOwnerStandalone = !!user?.id && (!quiz?.id || quiz.ownerId === user.id);
  const canEdit = isTeacher && (isStandaloneQuiz ? isOwnerStandalone : isOwnerCourse);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const cId = Array.isArray(courseId) ? courseId[0] : courseId;
      const lId = Array.isArray(lessonId) ? lessonId[0] : lessonId;
      const qId = Array.isArray(quizId) ? quizId[0] : quizId;
      const modeParam = Array.isArray(mode) ? mode[0] : mode;
      const standaloneRequested = modeParam === "standalone";

      try {
        if (qId) {
          const loadedQuiz = await getQuizById(qId);
          if (!active) return;
          setQuiz(loadedQuiz);

          if (loadedQuiz?.courseId) {
            const c = await getCourse(loadedQuiz.courseId);
            if (!active) return;
            setCourse(c);
            const l = loadedQuiz.lessonId
              ? c?.chapters?.find((ch: any) => ch.id === loadedQuiz.lessonId) || null
              : null;
            setLesson(l);
          } else {
            setCourse(null);
            setLesson(null);
          }

          if (user?.id && loadedQuiz?.id) {
            const a = await getQuizAttempt(loadedQuiz.id, user.id);
            if (active) setAttempt(a);
          } else {
            setAttempt(null);
          }
          return;
        }

        if (cId) {
          const c = await getCourse(cId);
          if (!active) return;
          setCourse(c);

          const l = lId
            ? c?.chapters?.find((ch: any) => ch.id === lId) || null
            : c?.chapters?.[0] || null;
          setLesson(l);

          const q = l?.id ? await getQuizByLesson(cId, l.id) : null;
          if (!active) return;
          setQuiz(q);

          if (user?.id && q?.id) {
            const a = await getQuizAttempt(q.id, user.id);
            if (active) setAttempt(a);
          } else {
            setAttempt(null);
          }
          return;
        }

        if (standaloneRequested && isTeacher) {
          setCourse(null);
          setLesson(null);
          setQuiz(null);
          setAttempt(null);
          return;
        }

        setCourse(null);
        setLesson(null);
        setQuiz(null);
        setAttempt(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [courseId, isTeacher, lessonId, mode, quizId, user?.id]);

  useEffect(() => {
    if (!quiz) {
      setTitle("");
      setDescription("");
      setQuestions([makeQuestion()]);
      setPublished(false);
      setStandaloneLevel("");
      setStandaloneSubject("");
      return;
    }
    setTitle(quiz.title || "");
    setDescription(quiz.description || "");
    setQuestions(
      quiz.questions?.length
        ? quiz.questions.map((q) => {
            const single = (Array.isArray(q.correctIndices) ? q.correctIndices : [])
              .map((v) => Number(v))
              .filter((v) => Number.isFinite(v))
              .map((v) => Math.floor(v))
              .filter((v) => v >= 0 && v < q.options.length)
              .slice(0, 1);
            return { ...q, correctIndices: single.length ? single : [0] };
          })
        : [makeQuestion()]
    );
    setPublished(!!quiz.published);
    setStandaloneLevel(quiz.level || "");
    setStandaloneSubject(quiz.subject || "");
  }, [quiz?.id]);

  const normalizeIndices = useCallback((input: number[] | undefined, max: number) => {
    const cleaned = (input || [])
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v))
      .map((v) => Math.floor(v))
      .filter((v) => v >= 0 && v < max);
    return Array.from(new Set(cleaned)).sort((a, b) => a - b);
  }, []);

  const initRun = useCallback(
    (phase: PlayPhase) => {
      const count = quiz?.questions?.length || 0;
      const base = Array.from({ length: count }, () => [] as number[]);
      runAnswersRef.current = base;
      setRunAnswers(base);
      setCurrentQIdx(0);
      setSelectedOpt(null);
      setRunScore(0);
      setLastOutcome(null);
      setRunSaved(false);
      feedbackAnim.setValue(0);
      setPlayPhase(phase);
    },
    [feedbackAnim, quiz?.id, quiz?.questions?.length]
  );

  useEffect(() => {
    if (isTeacher) return;
    initRun("intro");
  }, [isTeacher, initRun]);

  const totalQuestions = quiz?.questions?.length || 0;
  const currentQuestion = !isTeacher && quiz?.published ? quiz?.questions?.[currentQIdx] : null;
  const currentCorrectIndices = useMemo(() => {
    if (!currentQuestion) return [];
    return normalizeIndices(currentQuestion.correctIndices || [], currentQuestion.options.length).slice(0, 1);
  }, [currentQuestion, normalizeIndices]);

  const resultScore = attempt ? Math.max(0, Math.floor(attempt.score || 0)) : null;
  const resultMaxScore = attempt ? Math.max(1, attempt.maxScore || totalQuestions) : null;
  const hasResult = resultScore !== null && resultMaxScore !== null;
  const resultPercent = hasResult ? Math.round((resultScore / resultMaxScore) * 100) : 0;

  const completedCount =
    playPhase === "done"
      ? totalQuestions
      : playPhase === "feedback"
      ? Math.min(currentQIdx + 1, totalQuestions)
      : playPhase === "question"
      ? currentQIdx
      : 0;
  const progressRatio = totalQuestions > 0 ? completedCount / totalQuestions : 0;
  const runPercent = totalQuestions > 0 ? Math.round((runScore / totalQuestions) * 100) : 0;
  const gainedPoints = runScore * POINTS_PER_GOOD_ANSWER;
  const maxPoints = totalQuestions * POINTS_PER_GOOD_ANSWER;

  const setQuestion = (qid: string, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => setQuestions((prev) => [...prev, makeQuestion()]);
  const removeQuestion = (qid: string) => setQuestions((prev) => prev.filter((q) => q.id !== qid));

  const addOption = (qid: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, options: [...q.options, ""] } : q)));
  };

  const updateOption = (qid: string, idx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? { ...q, options: q.options.map((o, i) => (i === idx ? value : o)) }
          : q
      )
    );
  };

  const toggleCorrectIndex = (qid: string, idx: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        return { ...q, correctIndices: [idx] };
      })
    );
  };

  const validateQuiz = () => {
    if (!title.trim()) return "Titre requis.";
    if (!questions.length) return "Ajoutez au moins une question.";
    for (const q of questions) {
      if (!q.prompt.trim()) return "Chaque question doit avoir un texte.";
      if (!q.options || q.options.length < 2) return "Chaque question doit avoir au moins 2 options.";
      if (q.options.some((o) => !o.trim())) return "Les options ne doivent pas etre vides.";
      const correct = normalizeIndices(q.correctIndices || [], q.options.length);
      if (correct.length !== 1) return "Choisissez une seule reponse juste par question.";
    }
    return null;
  };

  const onSaveQuiz = async () => {
    if (!canEdit || !user?.id) return;
    const targetCourseId = isStandaloneQuiz ? null : course?.id || null;
    const targetLessonId = isStandaloneQuiz ? null : lesson?.id || null;
    if (!isStandaloneQuiz && (!targetCourseId || !targetLessonId)) return;
    if (isStandaloneQuiz) {
      if (!isKnownGradeLevel(standaloneLevel)) {
        Alert.alert("Classe requise", "Selectionnez une classe standard pour le quiz autonome.");
        return;
      }
      if (!isKnownCourseSubject(standaloneSubject)) {
        Alert.alert("Matiere requise", "Selectionnez une matiere standard pour le quiz autonome.");
        return;
      }
    }
    const err = validateQuiz();
    if (err) {
      Alert.alert("Quiz incomplet", err);
      return;
    }
    setSaving(true);
    try {
      const cleaned: QuizQuestion[] = questions.map((q) => ({
        ...q,
        prompt: q.prompt.trim(),
        options: q.options.map((o) => o.trim()),
        correctIndices: normalizeIndices(q.correctIndices || [], q.options.length).slice(0, 1),
      }));
      const saved = await saveQuiz({
        id: quiz?.id,
        courseId: targetCourseId,
        lessonId: targetLessonId,
        level: isStandaloneQuiz ? standaloneLevel.trim() : course?.level || null,
        subject: isStandaloneQuiz ? standaloneSubject.trim() : course?.subject || null,
        title: title.trim(),
        description: description.trim() || null,
        questions: cleaned,
        published,
        ownerId: user.id,
      });
      setQuiz(saved);
      Alert.alert("Enregistre", "Le quiz a ete sauvegarde.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible d'enregistrer le quiz.");
    } finally {
      setSaving(false);
    }
  };

  const playFeedbackSound = useCallback(async (kind: "correct" | "wrong") => {
    try {
      const source = kind === "correct" ? SOUND_CORRECT : SOUND_WRONG;
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 0.85 });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      // non-blocking
    }
  }, []);

  const saveRunAttempt = useCallback(
    async (answersToSave: number[][], scoreToSave: number) => {
      if (!quiz?.id || !user?.id) return;
      setPersistingAttempt(true);
      try {
        const saved = await submitQuizAttempt({
          quizId: quiz.id,
          userId: user.id,
          answers: answersToSave,
          score: scoreToSave,
          maxScore: totalQuestions,
        });
        setAttempt(saved);
        setRunSaved(true);
      } catch (e: any) {
        Alert.alert("Erreur", e?.message || "Impossible d'envoyer le quiz.");
      } finally {
        setPersistingAttempt(false);
      }
    },
    [quiz?.id, totalQuestions, user?.id]
  );

  const computeScore = useCallback(
    (sourceAnswers: number[][]) => {
      if (!quiz?.questions?.length) return 0;
      return quiz.questions.reduce((acc, q, idx) => {
        const correct = normalizeIndices(q.correctIndices || [], q.options.length).slice(0, 1);
        const chosen = normalizeIndices(sourceAnswers[idx] || [], q.options.length)[0];
        return typeof chosen === "number" && correct.includes(chosen) ? acc + 1 : acc;
      }, 0);
    },
    [normalizeIndices, quiz?.id]
  );

  const startRun = () => {
    if (!quiz?.published || !quiz?.questions?.length) return;
    initRun("question");
  };

  const onCheckAnswer = () => {
    if (playPhase !== "question" || !currentQuestion || selectedOpt === null) return;
    const isCorrect = currentCorrectIndices.includes(selectedOpt);
    setRunAnswers((prev) => {
      const next = [...prev];
      next[currentQIdx] = [selectedOpt];
      runAnswersRef.current = next;
      return next;
    });
    if (isCorrect) setRunScore((prev) => prev + 1);
    setLastOutcome(isCorrect ? "correct" : "wrong");
    feedbackAnim.setValue(0);
    Animated.spring(feedbackAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 180,
      mass: 0.6,
    }).start();
    setPlayPhase("feedback");
    void playFeedbackSound(isCorrect ? "correct" : "wrong");
  };

  const onContinue = async () => {
    if (playPhase !== "feedback" || !quiz) return;
    const nextIndex = currentQIdx + 1;
    if (nextIndex < totalQuestions) {
      setCurrentQIdx(nextIndex);
      setSelectedOpt(null);
      setLastOutcome(null);
      setPlayPhase("question");
      return;
    }

    const finalAnswers = quiz.questions.map((q, idx) =>
      normalizeIndices(runAnswersRef.current[idx] || [], q.options.length).slice(0, 1)
    );
    const finalScore = computeScore(finalAnswers);
    setRunScore(finalScore);
    await saveRunAttempt(finalAnswers, finalScore);
    setPlayPhase("done");
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLOR.bg }]}>
        <ActivityIndicator color={COLOR.primary} />
      </View>
    );
  }

  if (!isStandaloneQuiz && (!course || !lesson)) {
    return (
      <View style={styles.root}>
        <TopBar title="Quiz" right={null} />
        <View style={styles.center}>
          <Text style={{ color: COLOR.sub, fontFamily: FONT.body }}>
            {resolvedQuizId ? "Quiz introuvable." : "Cours ou chapitre introuvable."}
          </Text>
        </View>
      </View>
    );
  }

  const feedbackTranslateY = feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const runIsSuccess = totalQuestions > 0 ? runScore / totalQuestions >= 0.6 : false;
  const runLabel = `${runScore}/${Math.max(totalQuestions, 1)} (${runPercent}%)`;

  return (
    <View style={styles.root}>
      <TopBar title="Quiz" right={null} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          {isStandaloneQuiz ? (
            <>
              <View style={styles.heroPill}>
                <Ionicons name="sparkles-outline" size={14} color={COLOR.primary} />
                <Text style={styles.heroPillText}>Quiz autonome</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {title || quiz?.title || "Nouveau quiz autonome"}
              </Text>
              <Text style={styles.heroSub} numberOfLines={2}>
                {(standaloneSubject || quiz?.subject || "Matiere")} - {(standaloneLevel || quiz?.level || "Classe")}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heroTitle} numberOfLines={2}>{course?.title || "Cours"}</Text>
              <Text style={styles.heroSub} numberOfLines={2}>{lesson?.title || "Chapitre"}</Text>
            </>
          )}
        </View>

        {isTeacher ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {isStandaloneQuiz ? "Creation du quiz autonome" : "Creation du quiz de chapitre"}
            </Text>
            {!isStandaloneQuiz ? (
              <TouchableOpacity onPress={() => router.push("/(app)/course/quiz?mode=standalone")} style={styles.linkBtn}>
                <Ionicons name="sparkles-outline" size={14} color={COLOR.primary} />
                <Text style={styles.linkBtnText}>Creer un quiz autonome</Text>
              </TouchableOpacity>
            ) : null}
            {!canEdit ? (
              <Text style={styles.mutedText}>
                {isStandaloneQuiz
                  ? "Seul le createur du quiz peut le modifier."
                  : "Seul l'enseignant du cours peut modifier ce quiz."}
              </Text>
            ) : null}

            {isStandaloneQuiz ? (
              <>
                {canEdit ? (
                  <>
                    <SelectionSheetField
                      label="Classe"
                      icon="school-outline"
                      value={isKnownGradeLevel(standaloneLevel) ? standaloneLevel : ""}
                      placeholder="Choisir une classe"
                      options={GRADE_LEVELS}
                      onChange={setStandaloneLevel}
                      helperText="Ce quiz apparaitra dans la section eleve de cette classe."
                    />
                    <SelectionSheetField
                      label="Matiere"
                      icon="albums-outline"
                      value={isKnownCourseSubject(standaloneSubject) ? standaloneSubject : ""}
                      placeholder="Choisir une matiere"
                      options={COURSE_SUBJECTS}
                      onChange={setStandaloneSubject}
                    />
                  </>
                ) : (
                  <View style={styles.readonlyMetaRow}>
                    <View style={styles.readonlyMetaChip}>
                      <Ionicons name="school-outline" size={14} color={COLOR.sub} />
                      <Text style={styles.readonlyMetaText}>{standaloneLevel || quiz?.level || "Classe"}</Text>
                    </View>
                    <View style={styles.readonlyMetaChip}>
                      <Ionicons name="albums-outline" size={14} color={COLOR.sub} />
                      <Text style={styles.readonlyMetaText}>{standaloneSubject || quiz?.subject || "Matiere"}</Text>
                    </View>
                  </View>
                )}
              </>
            ) : null}

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Titre du quiz"
              placeholderTextColor={COLOR.sub}
              style={styles.input}
              editable={canEdit}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optionnel)"
              placeholderTextColor={COLOR.sub}
              style={[styles.input, { minHeight: 80 }]}
              multiline
              editable={canEdit}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Publier</Text>
              <Switch
                value={published}
                onValueChange={setPublished}
                disabled={!canEdit}
                trackColor={{ false: COLOR.border, true: COLOR.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        ) : null}

        {isTeacher ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Questions</Text>
            <Text style={styles.mutedText}>Choisissez une seule reponse juste par question.</Text>
            {questions.map((q, qIdx) => (
              <View key={q.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionTitle}>Question {qIdx + 1}</Text>
                  {canEdit ? (
                    <TouchableOpacity onPress={() => removeQuestion(q.id)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={16} color={COLOR.danger} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TextInput
                  value={q.prompt}
                  onChangeText={(t) => setQuestion(q.id, { prompt: t })}
                  placeholder="Texte de la question"
                  placeholderTextColor={COLOR.sub}
                  style={styles.input}
                  editable={canEdit}
                />
                {q.options.map((opt, optIdx) => (
                  <View key={`${q.id}-${optIdx}`} style={styles.optionRow}>
                    <TouchableOpacity
                      onPress={() => toggleCorrectIndex(q.id, optIdx)}
                      disabled={!canEdit}
                      style={styles.checkBtn}
                    >
                      <Ionicons
                        name={q.correctIndices?.includes(optIdx) ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={q.correctIndices?.includes(optIdx) ? COLOR.primary : COLOR.sub}
                      />
                    </TouchableOpacity>
                    <TextInput
                      value={opt}
                      onChangeText={(t) => updateOption(q.id, optIdx, t)}
                      placeholder={`Option ${optIdx + 1}`}
                      placeholderTextColor={COLOR.sub}
                      style={[styles.input, styles.optionInput]}
                      editable={canEdit}
                    />
                  </View>
                ))}
                {canEdit ? (
                  <TouchableOpacity onPress={() => addOption(q.id)} style={styles.secondaryBtn}>
                    <Ionicons name="add-circle-outline" size={16} color={COLOR.text} />
                    <Text style={styles.secondaryText}>Ajouter une option</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            {canEdit ? (
              <TouchableOpacity onPress={addQuestion} style={styles.secondaryBtn}>
                <Ionicons name="add" size={16} color={COLOR.text} />
                <Text style={styles.secondaryText}>Ajouter une question</Text>
              </TouchableOpacity>
            ) : null}
            {canEdit ? (
              <TouchableOpacity onPress={onSaveQuiz} disabled={saving} style={[styles.primaryBtn, saving && { opacity: 0.6 }]}>
                <Ionicons name="save-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>{saving ? "Enregistrement..." : "Enregistrer"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {!isTeacher ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quiz</Text>
            {!quiz || !quiz.published || !quiz.questions.length ? (
              <Text style={styles.mutedText}>
                {isStandaloneQuiz ? "Ce quiz n'est pas disponible pour le moment." : "Aucun quiz disponible pour ce chapitre."}
              </Text>
            ) : (
              <>
                <Text style={styles.quizTitle}>{quiz.title}</Text>
                {quiz.description ? <Text style={styles.quizDesc}>{quiz.description}</Text> : null}

                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(progressRatio * 100, 2)}%` }]} />
                  </View>
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressText}>
                      {playPhase === "done"
                        ? "Termine"
                        : `Question ${Math.min(currentQIdx + 1, totalQuestions)}/${totalQuestions}`}
                    </Text>
                    <Text style={styles.progressPts}>{gainedPoints} pts</Text>
                  </View>
                </View>

                {playPhase === "intro" ? (
                  <>
                    {hasResult ? (
                      <View style={[styles.resultCard, resultScore && resultMaxScore && resultScore / resultMaxScore >= 0.6 ? styles.resultCardSuccess : styles.resultCardWarn]}>
                        <View style={styles.resultIcon}>
                          <Ionicons name="stats-chart-outline" size={20} color={COLOR.primary} />
                        </View>
                        <View style={styles.resultContent}>
                          <Text style={styles.resultTitle}>Dernier resultat</Text>
                          <Text style={styles.resultDesc}>{resultScore}/{resultMaxScore} ({resultPercent}%)</Text>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.introCard}>
                      <Text style={styles.introTitle}>Mode progressif</Text>
                      <Text style={styles.introText}>
                        Une question a la fois, feedback immediat bonne ou mauvaise reponse, puis resultat total a la fin.
                      </Text>
                      <Text style={styles.introText}>Points max: {maxPoints}</Text>
                    </View>

                    <TouchableOpacity onPress={startRun} style={styles.primaryBtn}>
                      <Ionicons name={hasResult ? "refresh" : "play-circle-outline"} size={16} color="#fff" />
                      <Text style={styles.primaryText}>{hasResult ? "Recommencer" : "Commencer"}</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {(playPhase === "question" || playPhase === "feedback") && currentQuestion ? (
                  <View style={styles.questionCard}>
                    <Text style={styles.questionTitle}>Question {currentQIdx + 1}</Text>
                    <Text style={styles.quizPrompt}>{currentQuestion.prompt}</Text>

                    {currentQuestion.options.map((opt, optIdx) => {
                      const selected = selectedOpt === optIdx;
                      const correct = playPhase === "feedback" && currentCorrectIndices.includes(optIdx);
                      const wrong = playPhase === "feedback" && selected && !correct;
                      return (
                        <TouchableOpacity
                          key={`${currentQuestion.id}-opt-${optIdx}`}
                          onPress={() => {
                            if (playPhase === "question") setSelectedOpt(optIdx);
                          }}
                          disabled={playPhase !== "question"}
                          style={[
                            styles.answerRow,
                            selected && styles.answerRowActive,
                            correct && styles.answerRowCorrect,
                            wrong && styles.answerRowWrong,
                          ]}
                        >
                          <Ionicons
                            name={
                              playPhase === "feedback"
                                ? correct
                                  ? "checkmark-circle"
                                  : wrong
                                  ? "close-circle"
                                  : "ellipse-outline"
                                : selected
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={18}
                            color={
                              playPhase === "feedback"
                                ? correct
                                  ? COLOR.success
                                  : wrong
                                  ? COLOR.danger
                                  : COLOR.sub
                                : selected
                                ? COLOR.primary
                                : COLOR.sub
                            }
                          />
                          <Text style={[styles.answerText, selected && styles.answerTextActive, correct && styles.answerTextCorrect, wrong && styles.answerTextWrong]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {playPhase === "question" ? (
                  <TouchableOpacity
                    onPress={onCheckAnswer}
                    disabled={selectedOpt === null}
                    style={[styles.primaryBtn, selectedOpt === null && styles.disabledBtn]}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.primaryText}>Verifier</Text>
                  </TouchableOpacity>
                ) : null}

                {playPhase === "feedback" ? (
                  <>
                    <Animated.View
                      style={[
                        styles.feedbackCard,
                        lastOutcome === "correct" ? styles.feedbackGood : styles.feedbackBad,
                        { opacity: feedbackAnim, transform: [{ translateY: feedbackTranslateY }] },
                      ]}
                    >
                      <Ionicons
                        name={lastOutcome === "correct" ? "checkmark-circle" : "close-circle"}
                        size={22}
                        color={lastOutcome === "correct" ? COLOR.success : COLOR.danger}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.feedbackTitle}>{lastOutcome === "correct" ? "Bonne reponse" : "Mauvaise reponse"}</Text>
                        {lastOutcome === "wrong" && currentCorrectIndices.length ? (
                          <Text style={styles.feedbackText}>
                            Bonne reponse: {currentCorrectIndices.map((i) => currentQuestion?.options?.[i]).filter(Boolean).join(", ")}
                          </Text>
                        ) : (
                          <Text style={styles.feedbackText}>Continue comme ca.</Text>
                        )}
                      </View>
                    </Animated.View>

                    <TouchableOpacity
                      onPress={() => {
                        void onContinue();
                      }}
                      disabled={persistingAttempt}
                      style={[styles.primaryBtn, persistingAttempt && styles.disabledBtn]}
                    >
                      <Ionicons name={currentQIdx >= totalQuestions - 1 ? "flag-outline" : "arrow-forward"} size={16} color="#fff" />
                      <Text style={styles.primaryText}>
                        {persistingAttempt
                          ? "Enregistrement..."
                          : currentQIdx >= totalQuestions - 1
                          ? "Voir le resultat"
                          : "Question suivante"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {playPhase === "done" ? (
                  <>
                    <View style={[styles.resultCard, runIsSuccess ? styles.resultCardSuccess : styles.resultCardWarn]}>
                      <View style={styles.resultIcon}>
                        <Ionicons name={runIsSuccess ? "trophy-outline" : "sparkles-outline"} size={20} color={runIsSuccess ? COLOR.success : COLOR.warn} />
                      </View>
                      <View style={styles.resultContent}>
                        <Text style={styles.resultTitle}>{runIsSuccess ? "Bravo" : "Continue"}</Text>
                        <Text style={styles.resultDesc}>{runLabel}</Text>
                        <Text style={styles.resultDesc}>Points gagnes: {gainedPoints}</Text>
                      </View>
                    </View>

                    <Text style={styles.saveStatusText}>
                      {persistingAttempt ? "Enregistrement du resultat..." : runSaved ? "Resultat enregistre." : "Resultat local."}
                    </Text>

                    <TouchableOpacity onPress={startRun} style={styles.primaryBtn}>
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text style={styles.primaryText}>Rejouer</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  heroCard: {
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 14,
    marginBottom: 12,
  },
  heroTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 18 },
  heroSub: { color: COLOR.sub, fontFamily: FONT.body, marginTop: 4 },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.tint,
    marginBottom: 8,
  },
  heroPillText: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 12 },

  card: {
    backgroundColor: COLOR.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 16, marginBottom: 10 },
  mutedText: { color: COLOR.sub, fontFamily: FONT.body },
  linkBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    backgroundColor: COLOR.tint,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  linkBtnText: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 12 },
  readonlyMetaRow: { flexDirection: "row", gap: 8, marginBottom: 10, marginTop: 2 },
  readonlyMetaChip: {
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
  readonlyMetaText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },

  input: {
    backgroundColor: COLOR.muted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLOR.text,
    fontFamily: FONT.body,
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  toggleLabel: { color: COLOR.text, fontFamily: FONT.bodyBold },

  questionCard: {
    backgroundColor: COLOR.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 12,
    marginBottom: 12,
  },
  questionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  questionTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, marginBottom: 8 },
  quizPrompt: { color: COLOR.text, fontFamily: FONT.body, fontSize: 15, marginBottom: 8, lineHeight: 21 },
  iconBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: COLOR.muted,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  checkBtn: { padding: 4 },
  optionInput: { flex: 1, marginBottom: 0 },

  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.muted,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  secondaryText: { color: COLOR.text, fontFamily: FONT.bodyBold },

  primaryBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLOR.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledBtn: { opacity: 0.55 },
  primaryText: { color: "#fff", fontFamily: FONT.bodyBold },

  quizTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 16, marginBottom: 6 },
  quizDesc: { color: COLOR.sub, fontFamily: FONT.body, marginBottom: 10 },

  progressWrap: { marginBottom: 12 },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: COLOR.muted,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLOR.primary,
  },
  progressMeta: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressText: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },
  progressPts: { color: COLOR.primary, fontFamily: FONT.bodyBold, fontSize: 12 },

  introCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.muted,
    padding: 12,
    marginBottom: 4,
    gap: 6,
  },
  introTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 14 },
  introText: { color: COLOR.sub, fontFamily: FONT.body, lineHeight: 19 },

  feedbackCard: {
    marginTop: 2,
    marginBottom: 2,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  feedbackGood: {
    backgroundColor: "rgba(22,163,74,0.08)",
    borderColor: "rgba(22,163,74,0.25)",
  },
  feedbackBad: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.25)",
  },
  feedbackTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 14 },
  feedbackText: { color: COLOR.sub, fontFamily: FONT.body, marginTop: 2, lineHeight: 18 },

  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  resultCardSuccess: {
    backgroundColor: "rgba(22,163,74,0.08)",
    borderColor: "rgba(22,163,74,0.25)",
  },
  resultCardWarn: {
    backgroundColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.3)",
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.muted,
  },
  resultContent: { flex: 1 },
  resultTitle: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 14 },
  resultDesc: { color: COLOR.sub, fontFamily: FONT.body, marginTop: 2 },
  saveStatusText: { color: COLOR.sub, fontFamily: FONT.body, marginBottom: 2 },

  answerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    marginBottom: 8,
  },
  answerRowActive: {
    borderColor: COLOR.primary,
    backgroundColor: COLOR.tint,
  },
  answerRowCorrect: {
    borderColor: "rgba(22,163,74,0.55)",
    backgroundColor: "rgba(22,163,74,0.12)",
  },
  answerRowWrong: {
    borderColor: "rgba(239,68,68,0.55)",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  answerText: { color: COLOR.text, fontFamily: FONT.body, flex: 1 },
  answerTextActive: { color: COLOR.text, fontFamily: FONT.bodyBold },
  answerTextCorrect: { color: COLOR.success, fontFamily: FONT.bodyBold },
  answerTextWrong: { color: COLOR.danger, fontFamily: FONT.bodyBold },
});
