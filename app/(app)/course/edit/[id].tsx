import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLOR, FONT } from "@/theme/colors";
import { getCourse, updateCourse, deleteCourse, addChapter, deleteChapter } from "@/storage/courses";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { uploadOne } from "@/lib/upload";
import SelectionSheetField from "@/components/SelectionSheetField";
import { GRADE_LEVELS, canonicalizeGradeLabel, isKnownGradeLevel } from "@/constants/gradeLevels";
import { COURSE_SUBJECTS, canonicalizeCourseSubject, isKnownCourseSubject } from "@/constants/courseSubjects";

/* --------------------- Palette / Constantes spacing --------------------- */
const BLUE_START = "#1D4ED8";
const BLUE_END = "#2563EB";
const GLASS_BG = COLOR.surface;
const GLASS_BORDER = COLOR.border;
const SUCCESS = COLOR.success;
const DANGER = COLOR.danger;
const WARNING = COLOR.warn;

const SP = 12;              // spacing de base
const RADIUS = 14;          // rayon standard
const BTN_H = 46;           // hauteur minimale des boutons

type LangKey = "fon" | "adja" | "yoruba" | "dindi";
const LANGS: { key: LangKey; label: string }[] = [
  { key: "fon", label: "Fon" },
  { key: "adja", label: "Adja" },
  { key: "yoruba", label: "Yoruba" },
  { key: "dindi", label: "Dindi" },
];

type VideoByLang = Partial<Record<LangKey, string>>;

const isForbiddenVideoUrl = (u: string) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test((u || '').trim());
const isDirectMediaUrl = (u: string) =>
  /\.(mp4|m4v|mov|webm)(\?|$)/i.test(u) || /\.m3u8(\?|$)/i.test(u) || /\.mpd(\?|$)/i.test(u);


export default function EditCourse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // meta cours
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [published, setPublished] = useState(false);

  // chapitres
  const [chapters, setChapters] = useState<any[]>([]);

  // création de chapitre
  const [chTitle, setChTitle] = useState("");
  const [chVideoUrl, setChVideoUrl] = useState(""); // fallback
  const [chVideoByLang, setChVideoByLang] = useState<VideoByLang>({});
  const [uploadingKey, setUploadingKey] = useState<"generic" | LangKey | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // refs
  const scrollRef = useRef<ScrollView>(null);
  const chVideoRef = useRef<TextInput>(null);

  // UI state
  const [openMeta, setOpenMeta] = useState(true);
  const [openChapters, setOpenChapters] = useState(true);
  const [openAddChapter, setOpenAddChapter] = useState(true);
  const [openDanger, setOpenDanger] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const c = await getCourse(id);
      if (!c) {
        Alert.alert("Introuvable", "Ce cours n'existe pas.", [{ text: "OK", onPress: () => router.back() }]);
        return;
      }
      setTitle(c.title || "");
      setLevel(canonicalizeGradeLabel(c.level || ""));
      setSubject(canonicalizeCourseSubject(c.subject || ""));
      setPublished(!!c.published);
      setChapters(c.chapters ?? []);
      setLoading(false);
    })();
  }, [id]);

  const refresh = async () => {
    if (!id) return;
    const c = await getCourse(id);
    setChapters(c?.chapters ?? []);
  };

  const save = async () => {
    if (!id) return;
    if (!title.trim() || !subject.trim()) {
      Alert.alert("Champs requis", "Merci de compléter tous les champs.");
      return;
    }
    if (!isKnownGradeLevel(level)) {
      Alert.alert("Classe requise", "Veuillez selectionner une classe standard.");
      return;
    }
    if (!isKnownCourseSubject(subject)) {
      Alert.alert("Matiere requise", "Veuillez selectionner une matiere standard.");
      return;
    }
    await updateCourse(id, { title: title.trim(), level: level.trim(), subject: subject.trim() });
    Alert.alert("Enregistré", "Modifications sauvegardées.");
  };

  const togglePublish = async () => {
    if (!id) return;
    const next = !published;
    await updateCourse(id, { published: next });
    setPublished(next);
  };

  const onDelete = async () => {
    if (!id) return;
    Alert.alert("Supprimer", "Voulez-vous vraiment supprimer ce cours ?", [
      { text: "Annuler" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteCourse(id);
          router.replace("/(app)/course/mine");
        },
      },
    ]);
  };

  type PickTarget = "generic" | LangKey;

  const pickVideoAndUpload = async (target: PickTarget = "generic") => {
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

      const name: string = doc?.name ?? "video.mp4";
      const mimeFromPicker: string | undefined = doc?.mimeType;
      const guessFromName =
        name.toLowerCase().endsWith(".m3u8")
          ? "application/vnd.apple.mpegurl"
          : name.toLowerCase().endsWith(".mpd")
          ? "application/dash+xml"
          : name.toLowerCase().endsWith(".mov")
          ? "video/quicktime"
          : name.toLowerCase().endsWith(".webm")
          ? "video/webm"
          : name.toLowerCase().endsWith(".mkv")
          ? "video/x-matroska"
          : "video/mp4";

      const contentType = mimeFromPicker || guessFromName;
      const up = await uploadOne(
        { uri, name, contentType },
        `courses/${id}/videos`,
        {
          onProgress: (pct) => {
            if (pct == null) return;
            const clamped = Math.max(0, Math.min(100, Math.round(pct)));
            setUploadProgress(clamped);
          },
        }
      );
      if (!up?.url) throw new Error("L'upload n'a pas renvoyé d'URL");

      if (target === "generic") setChVideoUrl(up.url);
      else setChVideoByLang((prev) => ({ ...prev, [target]: up.url }));

      Alert.alert("Vidéo importée", "Le fichier a été uploadé et lié.");

    } catch (e: any) {
      console.error(e);
      Alert.alert("Upload échoué", e?.message || "Impossible d'uploader la vidéo.");
    } finally {
      setUploadingKey(null);
      setUploadProgress(null);
    }
  };

  const add = async () => {
    if (!id) return;
    if (!chTitle.trim()) {
      Alert.alert("Champs requis", "Titre du chapitre requis.");
      return;
    }

    const anySource = !!(chVideoUrl.trim() || Object.values(chVideoByLang).some((v) => !!(v && String(v).trim())));
    if (!anySource) {
      Alert.alert("Source requise", "Ajoutez au moins une vidéo (upload recommandé) ou un lien cloud direct (mp4/m3u8/mpd).");
      return;
    }

    const allUrls = [chVideoUrl, ...Object.values(chVideoByLang)].filter(Boolean).map((v) => String(v).trim());
    const bad = allUrls.find((u) => isForbiddenVideoUrl(u));
    if (bad) {
      Alert.alert("Lien non autorisé", "Les liens YouTube ne sont pas acceptés. Uploadez un fichier ou utilisez un lien cloud direct.");
      return;
    }

    const nonDirect = allUrls.find((u) => /^https?:\/\//i.test(u) && !isDirectMediaUrl(u));
    if (nonDirect) {
      Alert.alert("Lien cloud", "Ce lien ne ressemble pas à un flux direct (mp4/m3u8/mpd). Il pourra s’ouvrir en externe mais ne sera pas lu dans le lecteur intégré.");
    }
    const cleanByLang: VideoByLang = Object.fromEntries(
      Object.entries(chVideoByLang).filter(([, v]) => !!(v && String(v).trim()))
    ) as VideoByLang;

    await addChapter(id, {
      title: chTitle.trim(),
      videoUrl: chVideoUrl.trim() || undefined,
      videoByLang: Object.keys(cleanByLang).length ? cleanByLang : undefined,
    });

    setChTitle("");
    setChVideoUrl("");
    setChVideoByLang({});
    await refresh();
  };

  const remove = async (chapterId: string) => {
    if (!id) return;
    await deleteChapter(id, chapterId);
    await refresh();
  };

  const openPreview = (lessonId?: string) => {
    if (!id) return;
    const qs = lessonId ? `?courseId=${id}&lessonId=${lessonId}` : `?courseId=${id}`;
    router.push(`/(app)/course/play${qs}`);
  };

  const hasLegacyLevel = useMemo(() => !!level && !isKnownGradeLevel(level), [level]);
  const hasLegacySubject = useMemo(() => !!subject && !isKnownCourseSubject(subject), [subject]);
  const chapterCount = chapters.length;
  const chapterWithVideoCount = useMemo(
    () =>
      chapters.filter((item) => {
        const base = !!(item?.videoUrl && String(item.videoUrl).trim());
        const byLang = Object.values(item?.videoByLang || {}).some((v) => !!(v && String(v).trim()));
        return base || byLang;
      }).length,
    [chapters]
  );
  const chapterWithLangCount = useMemo(
    () =>
      chapters.filter((item) => Object.values(item?.videoByLang || {}).some((v) => !!(v && String(v).trim()))).length,
    [chapters]
  );
  const completion = chapterCount ? Math.round((chapterWithVideoCount / chapterCount) * 100) : 0;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.bg }}>
        <View style={styles.center}>
          <LinearGradient colors={[BLUE_START, BLUE_END]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loadingBadge}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.loadingText}>Chargement…</Text>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Header stable */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color={COLOR.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>Éditer le cours</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {(title?.trim() || "Sans titre")} • {(level?.trim() || "Niveau ?")} • {(subject?.trim() || "Matière ?")}
            </Text>
          </View>

          <PublishPill published={published} onPress={togglePublish} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: SP, paddingBottom: SP * 2 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.kpiRow}>
            <KpiCard label="Chapitres" value={String(chapterCount)} icon="albums-outline" />
            <KpiCard label="Complets" value={`${completion}%`} icon="checkmark-done-outline" />
            <KpiCard label="Par langue" value={String(chapterWithLangCount)} icon="language-outline" />
          </View>

          <View style={{ height: SP }} />
          <CollapsibleGlassCard
            title="Informations du cours"
            subtitle="Titre, classe, matiere et publication"
            icon="book-outline"
            open={openMeta}
            onToggle={() => setOpenMeta((v) => !v)}
          >
            <SoftInput
              icon="book-outline"
              placeholder="Titre du cours"
              value={title}
              onChangeText={setTitle}
              returnKeyType="done"
            />
            <SelectionSheetField
              label="Classe"
              icon="school-outline"
              value={isKnownGradeLevel(level) ? level : ""}
              placeholder="Choisir une classe"
              options={GRADE_LEVELS}
              onChange={setLevel}
              helperText="Selectionnez une classe standard pour harmoniser le catalogue eleve."
              warningText={hasLegacyLevel ? `Classe actuelle non standard detectee: "${level}"` : undefined}
            />
            <SelectionSheetField
              label="Matiere"
              icon="albums-outline"
              value={isKnownCourseSubject(subject) ? subject : ""}
              placeholder="Choisir une matiere"
              options={COURSE_SUBJECTS}
              onChange={setSubject}
              warningText={hasLegacySubject ? `Matiere actuelle non standard detectee: "${subject}"` : undefined}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <GradientButton onPress={save} leftIcon={<Ionicons name="save-outline" size={18} color="#fff" />}>
                  Sauvegarder
                </GradientButton>
              </View>
              <View style={[styles.rowItem, { marginLeft: SP }]}>
                <OutlineButton
                  onPress={togglePublish}
                  active={published}
                  leftIcon={
                    <MaterialCommunityIcons
                      name={published ? "check-decagram" : "decagram-outline"}
                      size={18}
                      color={published ? SUCCESS : COLOR.sub}
                    />
                  }
                >
                  {published ? "Publié" : "Mettre en ligne"}
                </OutlineButton>
              </View>
            </View>
            <View style={{ marginTop: SP }}>
              <OutlineButton
                onPress={() => openPreview()}
                leftIcon={<Ionicons name="play-circle-outline" size={18} color={COLOR.sub} />}
              >
                Previsualiser le cours
              </OutlineButton>
            </View>
          </CollapsibleGlassCard>

          <View style={{ height: SP }} />
          <CollapsibleGlassCard
            title="Chapitres"
            subtitle={`${chapterWithVideoCount}/${chapterCount} avec source video`}
            icon="list-outline"
            open={openChapters}
            onToggle={() => setOpenChapters((v) => !v)}
          >
            <FlatList
              data={chapters}
              keyExtractor={(i) => i.id}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <View style={{ marginTop: index === 0 ? 0 : SP }}>
                  <ChapterItem
                    title={item.title}
                    hasLang={!!(item.videoByLang?.fon || item.videoByLang?.adja || item.videoByLang?.yoruba || item.videoByLang?.dindi)}
                    hasVideo={!!item.videoUrl}
                    onPreview={() => openPreview(item.id)}
                    onDelete={() => remove(item.id)}
                  />
                </View>
              )}
              ListEmptyComponent={<Text style={{ color: COLOR.sub, paddingTop: 2 }}>Aucun chapitre pour l'instant.</Text>}
            />
          </CollapsibleGlassCard>

          <View style={{ height: SP }} />
          <CollapsibleGlassCard
            title="Ajouter un chapitre"
            subtitle="Ajoutez une source video simple ou multilingue"
            icon="add-circle-outline"
            open={openAddChapter}
            onToggle={() => setOpenAddChapter((v) => !v)}
          >
            <SoftInput
              icon="create-outline"
              placeholder="Titre du chapitre"
              value={chTitle}
              onChangeText={setChTitle}
              returnKeyType="next"
              onSubmitEditing={() => chVideoRef.current?.focus()}
            />

            <SoftInput
              forwardRef={chVideoRef}
              icon="link-outline"
              placeholder="Lien cloud direct (mp4, m3u8, mpd) - optionnel"
              value={chVideoUrl}
              onChangeText={setChVideoUrl}
              keyboardType="url"
              textContentType="URL"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
            />

            <OutlineButton
              onPress={() => pickVideoAndUpload("generic")}
              disabled={uploadingKey === "generic"}
              leftIcon={<Ionicons name="cloud-upload" size={18} color={COLOR.sub} />}
            >
              {uploadingKey === "generic" ? "Upload en cours..." : chVideoUrl ? "Remplacer la video (upload)" : "Uploader une video depuis l'appareil"}
            </OutlineButton>
            {uploadingKey === "generic" && uploadProgress != null ? (
              <ProgressLine label="Upload video" value={uploadProgress} />
            ) : null}

            <Text style={styles.langLegend}>Videos par langue (optionnel)</Text>
            <View style={styles.langGrid}>
              {LANGS.map(({ key, label }) => {
                const val = chVideoByLang[key] || "";
                const hasValue = !!val;
                return (
                  <View key={key} style={styles.langCol}>
                    <LangChip label={label} active={hasValue} />
                    <SoftInput
                      compact
                      placeholder={`Lien cloud ${label} (optionnel)`}
                      value={val}
                      onChangeText={(t) => setChVideoByLang((p) => ({ ...p, [key]: t }))}
                      keyboardType="url"
                      textContentType="URL"
                      autoCapitalize="none"
                      autoCorrect={false}
                      icon="link-outline"
                    />
                    <OutlineButton
                      onPress={() => pickVideoAndUpload(key)}
                      disabled={uploadingKey === key}
                      leftIcon={<Ionicons name="cloud-upload" size={18} color={COLOR.sub} />}
                    >
                      {uploadingKey === key ? `Upload ${label}...` : hasValue ? `Remplacer (${label})` : `Importer (${label})`}
                    </OutlineButton>
                    {uploadingKey === key && uploadProgress != null ? (
                      <ProgressLine label={`Upload ${label}`} value={uploadProgress} />
                    ) : null}
                  </View>
                );
              })}
            </View>

            <GradientButton onPress={add} disabled={!!uploadingKey} leftIcon={<Ionicons name="add-circle" size={18} color="#fff" />}>
              Ajouter le chapitre
            </GradientButton>
          </CollapsibleGlassCard>

          <View style={{ height: SP }} />
          <CollapsibleGlassCard
            title="Zone sensible"
            subtitle="Action irreversible"
            icon="warning-outline"
            open={openDanger}
            onToggle={() => setOpenDanger((v) => !v)}
            danger
          >
            <DangerButton onPress={onDelete} leftIcon={<Ionicons name="trash-outline" size={18} color="#fff" />}>
              Supprimer le cours
            </DangerButton>
          </CollapsibleGlassCard>

          <View style={{ height: SP }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* -------------------- UI Building Blocks (stables) -------------------- */

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {/* Gradient léger non intrusif */}
      <LinearGradient
        colors={["rgba(125,211,252,0.04)", "rgba(96,165,250,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiIcon}>
        <Ionicons name={icon} size={15} color={COLOR.primary} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function CollapsibleGlassCard({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  danger,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  open: boolean;
  onToggle: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <GlassCard>
      <Pressable
        onPress={onToggle}
        style={styles.sectionHead}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
      >
        <View style={[styles.sectionIcon, danger && styles.sectionIconDanger]}>
          <Ionicons name={icon} size={16} color={danger ? DANGER : COLOR.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sectionTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={COLOR.sub} />
      </Pressable>

      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </GlassCard>
  );
}

type SoftInputProps = React.ComponentProps<typeof TextInput> & {
  icon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
  forwardRef?: React.Ref<TextInput>;
};
const SoftInput = React.forwardRef<TextInput, SoftInputProps>(function SoftInputBase(
  { icon = "create-outline", compact, forwardRef, style, ...rest },
  _ref
) {
  return (
    <View style={[styles.inputWrap, compact && { paddingVertical: 8 }]}>
      <View style={styles.inputIcon}>
        <Ionicons name={icon} size={18} color="#94a3b8" />
      </View>
      <TextInput
        ref={forwardRef as any}
        placeholderTextColor="#6b7280"
        style={[styles.input, compact && { paddingVertical: 8 }, style]}
        {...rest}
      />
    </View>
  );
});

function GradientButton({
  children,
  leftIcon,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={{ opacity: disabled ? 0.6 : 1 }}>
      <LinearGradient colors={[BLUE_START, BLUE_END]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
        <Text style={styles.primaryBtnText} numberOfLines={1}> {children} </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function OutlineButton({
  children,
  leftIcon,
  onPress,
  disabled,
  active,
}: {
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.secondaryBtn, active && { borderColor: SUCCESS }, disabled && { opacity: 0.6 }]}
    >
      {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
      <Text style={[styles.secondaryBtnText, active && { color: SUCCESS }]} numberOfLines={1}>{children}</Text>
    </TouchableOpacity>
  );
}

function DangerButton({
  children,
  leftIcon,
  onPress,
}: {
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.dangerBtn}>
      {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
      <Text style={styles.dangerBtnText} numberOfLines={1}>{children}</Text>
    </TouchableOpacity>
  );
}

function PublishPill({ published, onPress }: { published: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.publishPill, published && { borderColor: SUCCESS }]} activeOpacity={0.85}>
      <MaterialCommunityIcons name={published ? "check-decagram" : "decagram-outline"} size={16} color={published ? SUCCESS : COLOR.sub} />
      <Text style={[styles.publishPillText, published && { color: SUCCESS }]} numberOfLines={1}>
        {published ? "Publié" : "Brouillon"}
      </Text>
    </TouchableOpacity>
  );
}

function LangChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.langChip, active && { borderColor: BLUE_END }]}>
      <LinearGradient colors={[BLUE_START, BLUE_END]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.langDot} />
      <Text style={styles.langChipText} numberOfLines={1}>{label}</Text>
      {active && <View style={styles.langBadge}><Text style={styles.langBadgeText}>?</Text></View>}
    </View>
  );
}

function ChapterItem({
  title,
  hasLang,
  hasVideo,
  onPreview,
  onDelete,
}: {
  title: string;
  hasLang: boolean;
  hasVideo: boolean;
  onPreview?: () => void;
  onDelete: () => void;
}) {
  const statusText = hasLang ? "Sources par langue présentes" : hasVideo ? "Vidéo liée" : "Aucune vidéo";
  const statusTint = hasLang ? BLUE_END : hasVideo ? "#94a3b8" : WARNING;
  const canPreview = hasLang || hasVideo;

  return (
    <View style={styles.chapterItem}>
      <LinearGradient colors={[BLUE_START, BLUE_END]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chapterRing} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.chapterTitle} numberOfLines={1}>{title}</Text>
        <Text style={[styles.chapterSub, { color: statusTint }]} numberOfLines={1}>{statusText}</Text>
      </View>
      <View style={styles.chapterActions}>
        <TouchableOpacity
          onPress={onPreview}
          style={[styles.previewBtn, !canPreview && styles.previewBtnDisabled]}
          activeOpacity={0.9}
          disabled={!canPreview}
        >
          <Ionicons name="play" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.trash} activeOpacity={0.9}>
          <Ionicons name="trash-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProgressLine({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <View style={styles.progressWrap} accessibilityRole="progressbar" accessibilityValue={{ now: pct, min: 0, max: 100 }}>
      <Text style={styles.progressLabel}>{label} ({pct}%)</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

/* --------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: SP,
    paddingVertical: SP - 2,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    backgroundColor: COLOR.bg,
    minHeight: 56,
  },
  headerIcon: {
    height: 36,
    width: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GLASS_BG,
    marginRight: SP,
  },
  headerTitle: { color: COLOR.text, fontSize: 18, fontFamily: FONT.headingAlt, lineHeight: 22 },
  headerSub: { color: COLOR.sub, fontSize: 12, marginTop: 2, lineHeight: 16, fontFamily: FONT.body },

  loadingBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: { fontFamily: FONT.bodyBold, color: "#fff", marginLeft: 8 },

  card: {
    backgroundColor: GLASS_BG,
    borderRadius: RADIUS,
    padding: SP,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 2 },
  kpiCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
  },
  kpiIcon: {
    alignSelf: "flex-start",
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.tint,
    marginBottom: 6,
  },
  kpiValue: { color: COLOR.text, fontFamily: FONT.headingAlt, fontSize: 16, lineHeight: 20 },
  kpiLabel: { color: COLOR.sub, fontFamily: FONT.body, fontSize: 11, marginTop: 2 },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionIconDanger: { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.35)" },
  sectionTitle: { color: COLOR.text, fontSize: 15, fontFamily: FONT.headingAlt, lineHeight: 20 },
  sectionSubtitle: { color: COLOR.sub, fontSize: 12, marginTop: 2, fontFamily: FONT.body, lineHeight: 16 },
  sectionBody: { marginTop: SP - 2 },

  inputWrap: {
    backgroundColor: COLOR.muted,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginTop: SP,
  },
  inputIcon: {
    height: 30,
    width: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: COLOR.tint,
  },
  input: {
    flex: 1,
    color: COLOR.text,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT.body,
  },

  row: { flexDirection: "row", alignItems: "stretch", marginTop: SP },
  rowItem: { flex: 1 },

  primaryBtn: {
    borderRadius: RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: BTN_H,
  },
  primaryBtnText: { color: "#fff", fontFamily: FONT.bodyBold },

  secondaryBtn: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLOR.border,
    minHeight: BTN_H,
  },
  secondaryBtnText: { color: COLOR.text, fontFamily: FONT.bodyBold },

  publishPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS_BG,
    marginLeft: SP,
  },
  publishPillText: { color: COLOR.text, fontSize: 12, fontFamily: FONT.bodyBold },

  langLegend: { color: COLOR.sub, fontSize: 12, marginTop: SP, marginBottom: 6, fontFamily: FONT.body },
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
    marginRight: -SP,
  },
  langCol: {
    flexBasis: "48%",
    minWidth: 140,
    marginRight: SP,
    marginBottom: SP,
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: COLOR.surface,
    marginBottom: 8,
  },
  langDot: { width: 10, height: 10, borderRadius: 99, marginRight: 8 },
  langChipText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  langBadge: {
    marginLeft: 6,
    height: 14,
    minWidth: 14,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: COLOR.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  langBadgeText: { color: COLOR.primary, fontSize: 10, fontFamily: FONT.bodyBold, lineHeight: 12 },

  progressWrap: { marginTop: 6, gap: 4 },
  progressLabel: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 11 },
  progressBar: {
    height: 8,
    borderRadius: 8,
    backgroundColor: COLOR.muted,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  progressFill: { height: "100%", backgroundColor: COLOR.primary },

  chapterItem: {
    backgroundColor: COLOR.surface,
    borderColor: COLOR.border,
    borderWidth: 1,
    borderRadius: RADIUS,
    padding: SP,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  chapterRing: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  chapterTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, lineHeight: 20 },
  chapterSub: { color: COLOR.sub, marginTop: 4, fontSize: 12, lineHeight: 16, fontFamily: FONT.body },
  chapterActions: { flexDirection: "row", alignItems: "center", marginLeft: SP },
  previewBtn: {
    backgroundColor: COLOR.primary,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 8,
  },
  previewBtnDisabled: { backgroundColor: "#94a3b8", opacity: 0.6 },
  trash: { backgroundColor: DANGER, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12 },

  dangerBtn: {
    backgroundColor: DANGER,
    borderRadius: RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    minHeight: BTN_H,
  },
  dangerBtnText: { color: "#fff", fontFamily: FONT.bodyBold },
});



