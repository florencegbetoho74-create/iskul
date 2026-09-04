import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import EmptyState from "@/components/ui/EmptyState";
import Segmented from "@/components/Segmented";
import SelectionSheetField from "@/components/SelectionSheetField";
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { DEFAULT_CONTENT_COUNTRY } from "@/storage/referentials";
import { uploadOne } from "@/lib/upload";
import { getCourse, updateCourse, deleteCourse, addChapter, deleteChapter } from "@/storage/courses";
import { submitForReview, withdrawFromReview } from "@/storage/review";
import {
  authorActionLabel,
  canSubmit,
  canWithdraw,
  presentStatus,
  rejectionNote,
  type ContentStatus,
} from "@/lib/contentStatus";

type LangKey = "fon" | "adja" | "yoruba" | "dendi";
type VideoByLang = Partial<Record<LangKey, string>>;
type UploadTarget = "generic" | LangKey;
type Mode = "chapters" | "meta";

const LANGS: { key: LangKey; label: string }[] = [
  { key: "fon", label: "Fon" },
  { key: "adja", label: "Adja" },
  { key: "yoruba", label: "Yoruba" },
  { key: "dendi", label: "Dendi" },
];

const isForbiddenVideoUrl = (u: string) =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test((u || "").trim());
const isDirectMediaUrl = (u: string) =>
  /\.(mp4|m4v|mov|webm)(\?|$)/i.test(u) || /\.m3u8(\?|$)/i.test(u) || /\.mpd(\?|$)/i.test(u);

const badgeTone = (tone: string): "neutral" | "primary" | "success" | "warning" | "danger" =>
  ({ neutral: "neutral", pending: "warning", success: "success", danger: "danger" } as const)[tone] ??
  "neutral";

/**
 * Editeur de cours.
 *
 * Un professeur qui ouvre un cours vient presque toujours travailler ses
 * chapitres ; il ne revient a la fiche que pour la corriger ou l'envoyer en
 * relecture. Les deux taches sont separees plutot qu'empilees, et le formulaire
 * d'ajout ne s'ouvre que lorsqu'on ajoute.
 */
export default function EditCourse() {
  const { color, space, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("chapters");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const [metaError, setMetaError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  const [chapters, setChapters] = useState<any[]>([]);

  const [composing, setComposing] = useState(false);
  const [chTitle, setChTitle] = useState("");
  const [chVideoUrl, setChVideoUrl] = useState("");
  const [chVideoByLang, setChVideoByLang] = useState<VideoByLang>({});
  const [showLangs, setShowLangs] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<UploadTarget | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const linkRef = useRef<TextInput>(null);

  const countryCode = user?.countryCode || DEFAULT_CONTENT_COUNTRY;
  const { gradeLevels, subjects, loadingGrades, scope } = useSchoolingOptions(countryCode);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      const c = await getCourse(id);
      if (!active) return;
      if (!c) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setTitle(c.title || "");
      setLevel(c.level || "");
      setSubject(c.subject || "");
      setGradeLevelId(c.gradeLevelId || "");
      setSubjectId(c.subjectId || "");
      setStatus(c.status);
      setReviewNote(c.reviewNote ?? null);
      setChapters(c.chapters ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // La confirmation d'enregistrement s'efface d'elle-meme : une alerte a
  // fermer pour un succes attendu n'apporte rien.
  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(0), 2600);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const refresh = useCallback(async () => {
    if (!id) return;
    const c = await getCourse(id);
    setChapters(c?.chapters ?? []);
  }, [id]);

  const gradeOptions = useMemo(() => gradeLevels.map((l) => l.label), [gradeLevels]);
  const subjectOptions = useMemo(() => subjects.map((x) => x.label), [subjects]);
  const gradeLabel = useMemo(
    () => gradeLevels.find((l) => l.id === gradeLevelId)?.label ?? "",
    [gradeLevels, gradeLevelId]
  );
  const subjectLabel = useMemo(
    () => subjects.find((x) => x.id === subjectId)?.label ?? "",
    [subjects, subjectId]
  );

  // Un cours anterieur au referentiel garde un libelle texte sans equivalent :
  // on le signale au professeur plutot que de le remplacer en silence.
  const legacyLevel = !loadingGrades && !gradeLevelId && !!level;
  const legacySubject = !loadingGrades && !subjectId && !!subject;

  const withVideo = useMemo(
    () => chapters.filter((c) => hasAnySource(c)).length,
    [chapters]
  );

  const save = async () => {
    if (!id || saving) return;
    if (!title.trim()) {
      setMetaError("Le titre ne peut pas rester vide.");
      return;
    }
    if (!gradeLevelId || !subjectId) {
      setMetaError("Choisissez la classe et la matiere avant d'enregistrer.");
      return;
    }
    setMetaError(null);
    setSaving(true);
    try {
      await updateCourse(id, {
        title: title.trim(),
        countryCode: scope?.countryCode ?? countryCode,
        gradeLevelId,
        subjectId,
      });
      setSavedAt(Date.now());
    } catch (e: any) {
      setMetaError(e?.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  // L'auteur ne publie plus lui-meme : il soumet, un relecteur decide.
  const onReviewAction = async () => {
    if (!id || reviewBusy) return;
    setReviewBusy(true);
    setMetaError(null);
    try {
      if (canSubmit(status)) {
        setStatus(await submitForReview("course", id));
        setReviewNote(null);
      } else if (canWithdraw(status)) {
        setStatus(await withdrawFromReview("course", id));
      }
    } catch (e: any) {
      setMetaError(e?.message || "Action impossible.");
    } finally {
      setReviewBusy(false);
    }
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert(
      "Supprimer ce cours",
      "Les chapitres et les videos liees seront perdus. Cette action est definitive.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await deleteCourse(id);
            router.replace("/(app)/(tabs)/courses");
          },
        },
      ]
    );
  };

  const pickVideoAndUpload = async (target: UploadTarget) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "public.movie", "application/octet-stream"],
        multiple: false,
        copyToCacheDirectory: true,
      } as any);

      // @ts-ignore
      if (res?.canceled || res?.type === "cancel") return;
      // @ts-ignore
      const doc = res?.assets?.[0] ?? res;
      const uri: string | undefined = doc?.uri;
      if (!uri) return;

      setUploadingKey(target);
      setUploadProgress(0);
      setChapterError(null);

      const name: string = doc?.name ?? "video.mp4";
      const contentType = doc?.mimeType || guessContentType(name);
      const up = await uploadOne({ uri, name, contentType }, `courses/${id}/videos`, {
        onProgress: (pct) => {
          if (pct == null) return;
          setUploadProgress(Math.max(0, Math.min(100, Math.round(pct))));
        },
      });
      if (!up?.url) throw new Error("L'upload n'a pas renvoye d'adresse.");

      if (target === "generic") setChVideoUrl(up.url);
      else setChVideoByLang((prev) => ({ ...prev, [target]: up.url }));
    } catch (e: any) {
      setChapterError(e?.message || "Impossible d'importer cette video.");
    } finally {
      setUploadingKey(null);
      setUploadProgress(null);
    }
  };

  const add = async () => {
    if (!id || adding) return;

    if (!chTitle.trim()) {
      setTitleError("Donnez un titre au chapitre.");
      return;
    }
    setTitleError(null);

    const byLang = Object.fromEntries(
      Object.entries(chVideoByLang).filter(([, v]) => !!(v && String(v).trim()))
    ) as VideoByLang;
    const urls = [chVideoUrl, ...Object.values(byLang)]
      .filter(Boolean)
      .map((v) => String(v).trim());

    if (!urls.length) {
      setChapterError("Importez une video ou collez un lien direct avant d'ajouter le chapitre.");
      return;
    }
    if (urls.some(isForbiddenVideoUrl)) {
      setChapterError(
        "Les liens YouTube ne sont pas lisibles dans l'application. Importez le fichier ou utilisez un lien direct."
      );
      return;
    }
    setChapterError(null);

    setAdding(true);
    try {
      await addChapter(id, {
        title: chTitle.trim(),
        videoUrl: chVideoUrl.trim() || undefined,
        videoByLang: Object.keys(byLang).length ? byLang : undefined,
      });
      setChTitle("");
      setChVideoUrl("");
      setChVideoByLang({});
      setShowLangs(false);
      await refresh();
    } catch (e: any) {
      setChapterError(e?.message || "Ajout impossible.");
    } finally {
      setAdding(false);
    }
  };

  const openPreview = (lessonId?: string) => {
    if (!id) return;
    const qs = lessonId ? `?courseId=${id}&lessonId=${lessonId}` : `?courseId=${id}`;
    router.push(`/(app)/course/play${qs}`);
  };

  const removeChapter = (chapterId: string, chapterTitle: string) => {
    if (!id) return;
    Alert.alert("Supprimer le chapitre", `« ${chapterTitle} » sera retire du cours.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteChapter(id, chapterId);
          await refresh();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: color.bg }]}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (missing) {
    return (
      <View style={[styles.center, { backgroundColor: color.bg, padding: space.lg }]}>
        <EmptyState
          tone="error"
          title="Cours introuvable"
          message="Ce cours a peut-etre ete supprime."
          actionLabel="Revenir a mes cours"
          onAction={() => router.replace("/(app)/(tabs)/courses")}
        />
      </View>
    );
  }

  const view = presentStatus(status);
  const note = rejectionNote(status, reviewNote);
  const reviewAction = authorActionLabel(status);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ paddingTop: insets.top + space.md, gap: space.md }}>
        <View style={[styles.head, { paddingHorizontal: space.lg, gap: space.md }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Revenir"
          >
            <Ionicons name="chevron-back" size={22} color={color.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {title.trim() || "Sans titre"}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {[gradeLabel || level, subjectLabel || subject].filter(Boolean).join(" · ") ||
                "Fiche a completer"}
            </Text>
          </View>
          <Badge tone={badgeTone(view.tone)}>{view.label}</Badge>
        </View>

        <View style={{ paddingHorizontal: space.lg }}>
          <Segmented
            value={mode}
            onChange={(k) => setMode(k as Mode)}
            items={[
              { key: "chapters", label: `Chapitres (${chapters.length})` },
              { key: "meta", label: "Fiche" },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {mode === "chapters" ? (
          <>
            {chapters.length ? (
              <>
                <Text variant="caption" tone="muted">
                  {withVideo === chapters.length
                    ? "Tous les chapitres ont une video."
                    : `${withVideo} chapitre${withVideo > 1 ? "s" : ""} sur ${chapters.length} avec une video.`}
                </Text>
                <View style={{ gap: space.sm }}>
                  {chapters.map((item, index) => (
                    <ChapterEditRow
                      key={item.id}
                      index={index + 1}
                      title={item.title || "Sans titre"}
                      langs={langsOf(item)}
                      hasVideo={hasAnySource(item)}
                      onPreview={() => openPreview(item.id)}
                      onDelete={() => removeChapter(item.id, item.title || "Sans titre")}
                    />
                  ))}
                </View>
              </>
            ) : composing ? null : (
              <EmptyState
                icon="albums-outline"
                title="Aucun chapitre"
                message="Un cours se lit chapitre par chapitre. Ajoutez le premier, avec sa video."
                actionLabel="Ajouter un chapitre"
                onAction={() => setComposing(true)}
              />
            )}

            {composing ? (
              <View
                style={[
                  styles.composer,
                  {
                    backgroundColor: color.surface,
                    borderColor: color.border,
                    borderRadius: radius.lg,
                    padding: space.lg,
                    gap: space.lg,
                  },
                ]}
              >
                <View style={[styles.head, { gap: space.sm }]}>
                  <Text variant="bodyStrong" style={styles.flex}>
                    Nouveau chapitre
                  </Text>
                  <Pressable
                    onPress={() => {
                      setComposing(false);
                      setChapterError(null);
                      setTitleError(null);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Fermer le formulaire"
                  >
                    <Ionicons name="close" size={20} color={color.textMuted} />
                  </Pressable>
                </View>

                <Field
                  label="Titre du chapitre"
                  required
                  placeholder="Additionner deux fractions"
                  value={chTitle}
                  onChangeText={(v) => {
                    setChTitle(v);
                    if (titleError) setTitleError(null);
                  }}
                  error={titleError}
                  returnKeyType="next"
                  onSubmitEditing={() => linkRef.current?.focus()}
                />

                <View style={{ gap: space.sm }}>
                  <Field
                    ref={linkRef}
                    label="Video en francais"
                    hint="Importez le fichier, ou collez un lien direct terminant par .mp4, .m3u8 ou .mpd."
                    placeholder="https://..."
                    value={chVideoUrl}
                    onChangeText={(v) => {
                      setChVideoUrl(v);
                      if (chapterError) setChapterError(null);
                    }}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    icon="link-outline"
                  />
                  {chVideoUrl.trim() &&
                  /^https?:\/\//i.test(chVideoUrl.trim()) &&
                  !isDirectMediaUrl(chVideoUrl.trim()) ? (
                    <Text variant="caption" tone="warning">
                      Ce lien ne ressemble pas a un flux direct : il s'ouvrira hors de
                      l'application au lieu d'etre lu dans le lecteur.
                    </Text>
                  ) : null}
                  <UploadRow
                    label={chVideoUrl ? "Remplacer par un fichier" : "Importer un fichier"}
                    busy={uploadingKey === "generic"}
                    progress={uploadingKey === "generic" ? uploadProgress : null}
                    onPress={() => pickVideoAndUpload("generic")}
                  />
                </View>

                <Pressable
                  onPress={() => setShowLangs((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showLangs }}
                  style={[styles.head, { gap: space.sm }]}
                >
                  <Ionicons
                    name={showLangs ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={color.textMuted}
                  />
                  <Text variant="bodyStrong" style={styles.flex}>
                    Versions en langue locale
                  </Text>
                  {countLangs(chVideoByLang) ? (
                    <Badge tone="primary">{`${countLangs(chVideoByLang)} ajoutee${
                      countLangs(chVideoByLang) > 1 ? "s" : ""
                    }`}</Badge>
                  ) : (
                    <Text variant="caption" tone="faint">
                      Facultatif
                    </Text>
                  )}
                </Pressable>

                {showLangs ? (
                  <View style={{ gap: space.lg }}>
                    {LANGS.map(({ key, label }) => (
                      <View key={key} style={{ gap: space.sm }}>
                        <Field
                          label={label}
                          placeholder="https://..."
                          value={chVideoByLang[key] || ""}
                          onChangeText={(v) => setChVideoByLang((p) => ({ ...p, [key]: v }))}
                          keyboardType="url"
                          autoCapitalize="none"
                          autoCorrect={false}
                          icon="link-outline"
                        />
                        <UploadRow
                          label={chVideoByLang[key] ? `Remplacer (${label})` : `Importer (${label})`}
                          busy={uploadingKey === key}
                          progress={uploadingKey === key ? uploadProgress : null}
                          onPress={() => pickVideoAndUpload(key)}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}

                {chapterError ? (
                  <Text variant="caption" tone="danger">
                    {chapterError}
                  </Text>
                ) : null}

                <Button onPress={add} icon="add" loading={adding} disabled={!!uploadingKey} block>
                  Ajouter le chapitre
                </Button>
              </View>
            ) : chapters.length ? (
              <Button onPress={() => setComposing(true)} icon="add" variant="secondary" block>
                Ajouter un chapitre
              </Button>
            ) : null}

            {chapters.length ? (
              <Button onPress={() => openPreview()} icon="play-outline" variant="ghost" block>
                Previsualiser le cours
              </Button>
            ) : null}

            {/* La publication se decide ou le travail se fait. Reservee a
                l'onglet Fiche, elle restait introuvable pour un professeur qui
                n'en change jamais. */}
            {chapters.length && reviewAction ? (
              <View
                style={[
                  styles.review,
                  {
                    backgroundColor: color.surfaceSunk,
                    borderColor: note ? color.danger : color.border,
                    borderRadius: radius.lg,
                    padding: space.lg,
                    gap: space.sm,
                  },
                ]}
              >
                <Text variant="bodyStrong">{view.label}</Text>
                <Text variant="caption" tone="muted">
                  {view.hint}
                </Text>
                {note ? (
                  <Text variant="caption" tone="danger">
                    {note}
                  </Text>
                ) : null}
                <Button
                  onPress={onReviewAction}
                  icon={canSubmit(status) ? "send-outline" : "arrow-undo-outline"}
                  variant={canSubmit(status) ? "primary" : "secondary"}
                  loading={reviewBusy}
                  block
                >
                  {reviewAction}
                </Button>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Field
              label="Titre"
              required
              placeholder="Les fractions"
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                if (metaError) setMetaError(null);
              }}
              returnKeyType="done"
            />

            <SelectionSheetField
              label="Classe"
              icon="school-outline"
              value={gradeLabel}
              placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une classe"}
              options={gradeOptions}
              onChange={(label) => {
                const match = gradeLevels.find((l) => l.label === label);
                if (match) setGradeLevelId(match.id);
                setMetaError(null);
              }}
              helperText="Le cours n'apparaitra qu'aux eleves de cette classe."
              warningText={legacyLevel ? `Classe non reconnue a reclasser : « ${level} »` : undefined}
            />

            <SelectionSheetField
              label="Matiere"
              icon="albums-outline"
              value={subjectLabel}
              placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une matiere"}
              options={subjectOptions}
              onChange={(label) => {
                const match = subjects.find((x) => x.label === label);
                if (match) setSubjectId(match.id);
                setMetaError(null);
              }}
              warningText={
                legacySubject ? `Matiere non reconnue a reclasser : « ${subject} »` : undefined
              }
            />

            {metaError ? (
              <Text variant="caption" tone="danger">
                {metaError}
              </Text>
            ) : null}

            <View style={styles.saveRow}>
              <Button onPress={save} icon="save-outline" loading={saving} style={styles.flex}>
                Enregistrer
              </Button>
              {savedAt ? (
                <Text variant="caption" tone="success" style={{ marginLeft: space.md }}>
                  Enregistre
                </Text>
              ) : null}
            </View>

            {/* Relecture */}
            <View
              style={[
                styles.review,
                {
                  backgroundColor: color.surfaceSunk,
                  borderColor: note ? color.danger : color.border,
                  borderRadius: radius.lg,
                  padding: space.lg,
                  gap: space.sm,
                },
              ]}
            >
              <Text variant="bodyStrong">Publication</Text>
              <Text variant="caption" tone="muted">
                {view.hint}
              </Text>
              {note ? (
                <Text variant="caption" tone="danger">
                  {note}
                </Text>
              ) : null}
              {reviewAction ? (
                <Button
                  onPress={onReviewAction}
                  icon={canSubmit(status) ? "send-outline" : "arrow-undo-outline"}
                  variant="secondary"
                  loading={reviewBusy}
                  block
                >
                  {reviewAction}
                </Button>
              ) : null}
            </View>

            <Button onPress={onDelete} icon="trash-outline" variant="danger" block>
              Supprimer le cours
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* --- Fragments propres a cet ecran --- */

function ChapterEditRow({
  index,
  title,
  langs,
  hasVideo,
  onPreview,
  onDelete,
}: {
  index: number;
  title: string;
  langs: string[];
  hasVideo: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const { color, space, radius } = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: color.surface,
          borderColor: color.border,
          borderRadius: radius.lg,
          padding: space.md,
          gap: space.md,
        },
      ]}
    >
      <View
        style={[
          styles.rank,
          { backgroundColor: color.surfaceSunk, borderRadius: radius.sm },
        ]}
      >
        <Text variant="captionStrong" tone="muted">
          {String(index).padStart(2, "0")}
        </Text>
      </View>

      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {hasVideo ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {langs.length ? `Francais + ${langs.join(", ")}` : "Francais"}
          </Text>
        ) : (
          <Text variant="caption" tone="warning">
            Aucune video
          </Text>
        )}
      </View>

      <Pressable
        onPress={onPreview}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Previsualiser ${title}`}
        style={{ padding: space.xs }}
      >
        <Ionicons name="play-outline" size={19} color={color.textMuted} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Supprimer ${title}`}
        style={{ padding: space.xs }}
      >
        <Ionicons name="trash-outline" size={18} color={color.danger} />
      </Pressable>
    </View>
  );
}

function UploadRow({
  label,
  busy,
  progress,
  onPress,
}: {
  label: string;
  busy: boolean;
  progress: number | null;
  onPress: () => void;
}) {
  const { color, space, radius } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Button
        onPress={onPress}
        icon="cloud-upload-outline"
        variant="ghost"
        size="sm"
        disabled={busy}
        block
      >
        {busy ? "Import en cours..." : label}
      </Button>
      {busy && progress != null ? (
        <View
          style={[
            styles.track,
            { backgroundColor: color.surfaceSunk, borderRadius: radius.pill },
          ]}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${progress}%`,
                backgroundColor: color.primary,
                borderRadius: radius.pill,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

/* --- Lecture des chapitres --- */

function hasAnySource(chapter: any): boolean {
  if (chapter?.videoUrl && String(chapter.videoUrl).trim()) return true;
  return Object.values(chapter?.videoByLang || {}).some((v) => !!(v && String(v).trim()));
}

function langsOf(chapter: any): string[] {
  return LANGS.filter(({ key }) => {
    const v = chapter?.videoByLang?.[key];
    return !!(v && String(v).trim());
  }).map(({ label }) => label);
}

function countLangs(byLang: VideoByLang): number {
  return Object.values(byLang).filter((v) => !!(v && String(v).trim())).length;
}

function guessContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (lower.endsWith(".mpd")) return "application/dash+xml";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  return "video/mp4";
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center" },
  composer: { borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  rank: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  review: { borderWidth: 1 },
  saveRow: { flexDirection: "row", alignItems: "center" },
  track: { height: 4, overflow: "hidden" },
  fill: { height: 4 },
});
