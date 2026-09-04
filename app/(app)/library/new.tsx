// app/(app)/library/new.tsx
import React, { useEffect, useMemo, useState } from "react";
import StoredImage from "@/components/ui/StoredImage";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { uploadOne } from "@/lib/upload";
import { addBook } from "@/storage/books";
import { submitForReview } from "@/storage/review";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "expo-router";
import SelectionSheetField from "@/components/SelectionSheetField";
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { DEFAULT_CONTENT_COUNTRY } from "@/storage/referentials";
import { listDocumentTypes, type DocumentType } from "@/storage/documentTypes";
import { isValidExamYear } from "@/lib/documentTaxonomy";

type SourceType = "link" | "upload";

export default function NewBook() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { user, canAccessAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const canPublish = user?.role === "teacher" || canAccessAdmin;

  const [title, setTitle] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [examName, setExamName] = useState("");
  const [examSession, setExamSession] = useState("");
  const [examYear, setExamYear] = useState("");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    let cancelled = false;
    listDocumentTypes()
      .then((types) => {
        if (cancelled) return;
        setDocumentTypes(types);
      })
      .catch(() => {
        if (!cancelled) setDocumentTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedType = useMemo(
    () => documentTypes.find((t) => t.id === documentTypeId) ?? null,
    [documentTypes, documentTypeId]
  );
  const typeOptions = useMemo(() => documentTypes.map((t) => t.label), [documentTypes]);
  const isOeuvre = selectedType?.code === "oeuvre";

  const countryCode = user?.countryCode || DEFAULT_CONTENT_COUNTRY;
  const { gradeLevels, subjects, loadingGrades, scope, error: optionsError } =
    useSchoolingOptions(countryCode);

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

  useEffect(() => {
    if (gradeLevelId && !gradeLevels.some((l) => l.id === gradeLevelId)) setGradeLevelId("");
    if (subjectId && !subjects.some((x) => x.id === subjectId)) setSubjectId("");
  }, [gradeLevels, subjects, gradeLevelId, subjectId]);

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [fileProgress, setFileProgress] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("link");
  const [externalUrl, setExternalUrl] = useState("");

  const isValidUrl = (u: string) => {
    try {
      const parsed = new URL(u);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const normalizedExternalUrl = useMemo(() => normalizeCloudLink(externalUrl), [externalUrl]);
  const previewFileUrl = useMemo(
    () => (sourceType === "upload" ? fileUrl : normalizedExternalUrl || null),
    [sourceType, fileUrl, normalizedExternalUrl]
  );

  if (!canPublish) {
    return (
      <View style={[styles.container, { padding: 16 }]}>
        <Text style={styles.title}>Accès refusé</Text>
        <Text style={{ color: theme.color.textMuted, marginTop: 4 }}>Seuls les enseignants peuvent ajouter des documents.</Text>
      </View>
    );
  }

  const pickCover = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["image/*"], multiple: false, copyToCacheDirectory: true } as any);
    // @ts-ignore
    if (res.canceled) return;
    // @ts-ignore
    const doc = res.assets ? res.assets[0] : res;
    if (!doc?.uri) return;
    setBusy(true);
    try {
      const name = doc.name ?? "cover.jpg";
      const contentType = doc.mimeType ?? (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      setCoverProgress(0);
      const up = await uploadOne(
        { uri: doc.uri, name, contentType },
        `books/covers`,
        { onProgress: (pct) => setCoverProgress(pct == null ? null : Math.round(pct)) }
      );
      setCoverUrl(up.url);
      setCoverProgress(100);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Upload cover echoue");
      setCoverProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const pickFileAndUpload = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/epub+zip", "public.item", "application/octet-stream"],
      multiple: false,
      copyToCacheDirectory: true,
    } as any);
    // @ts-ignore
    if (res.canceled) return;
    // @ts-ignore
    const doc = res.assets ? res.assets[0] : res;
    if (!doc?.uri) return;
    setBusy(true);
    try {
      const name = doc.name ?? "book.pdf";
      const contentType = doc.mimeType ?? (name.toLowerCase().endsWith(".epub") ? "application/epub+zip" : "application/pdf");
      setFileProgress(0);
      const up = await uploadOne(
        { uri: doc.uri, name, contentType },
        `books/files`,
        { onProgress: (pct) => setFileProgress(pct == null ? null : Math.round(pct)) }
      );
      setFileUrl(up.url);
      setExternalUrl("");
      setFileProgress(100);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Upload fichier echoue");
      setFileProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert("Champs requis", "Le titre est obligatoire.");
      return;
    }

    let finalUrl: string | null = null;
    if (sourceType === "link") {
      const u = normalizedExternalUrl.trim();
      if (!u || !isValidUrl(u)) {
        Alert.alert("Lien invalide", "Merci de coller une URL http(s) valide.");
        return;
      }
      finalUrl = u;
    } else {
      if (!fileUrl) {
        Alert.alert("Fichier manquant", "Choisissez un fichier ou passez en mode lien externe.");
        return;
      }
      finalUrl = fileUrl;
    }

    setBusy(true);
    try {
      const trimmedYear = examYear.trim();
      if (selectedType?.isExam && trimmedYear && !isValidExamYear(trimmedYear)) {
        Alert.alert("Année invalide", "Indiquez une annee d'examen entre 1960 et 2100.");
        setBusy(false);
        return;
      }

      const created = await addBook({
        title: title.trim(),
        documentTypeId: documentTypeId || null,
        examName: selectedType?.isExam ? examName.trim() || null : null,
        examSession: selectedType?.isExam ? examSession.trim() || null : null,
        examYear: selectedType?.isExam && trimmedYear ? Number(trimmedYear) : null,
        author: author.trim() || null,
        // level et subject sont derives du referentiel par un trigger.
        subject: subjectLabel || undefined,
        level: gradeLevels.find((l) => l.id === gradeLevelId)?.code || undefined,
        countryCode: scope?.countryCode ?? countryCode,
        gradeLevelId: gradeLevelId || null,
        subjectId: subjectId || null,
        // La bibliotheque est gratuite tant qu'aucun paiement n'est branche :
        // afficher un prix non encaissable induirait l'eleve en erreur.
        price: 0,
        coverUrl: coverUrl || null,
        fileUrl: finalUrl,
        ownerId: user.id,
        ownerName: user.name || user.email,
      } as any);

      // Le message promettait un envoi en relecture que rien ne declenchait :
      // le document restait en brouillon et son auteur le croyait en attente.
      Alert.alert(
        "Document enregistré",
        "Il est en brouillon. L'équipe bibliothèque le convertit d'abord en document lisible, puis un relecteur le valide avant qu'il atteigne les élèves.",
        [
          {
            text: "Plus tard",
            style: "cancel",
            onPress: () => router.replace(`/(app)/library/${created.id}`),
          },
          {
            text: "Envoyer en relecture",
            onPress: async () => {
              try {
                await submitForReview("book", created.id);
              } catch (err: any) {
                Alert.alert("Envoi impossible", err?.message || "Reessayez depuis la bibliotheque.");
              }
              router.replace(`/(app)/library/${created.id}`);
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Création impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <Text style={styles.title}>Ajouter un document</Text>
      <Text style={styles.subtitle}>Publiez un document pour votre classe.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Titre</Text>
        <TextInput placeholder="Titre" placeholderTextColor={theme.color.textMuted} style={styles.input} value={title} onChangeText={setTitle} />

        <SelectionSheetField
          label="Type de document"
          icon="pricetag-outline"
          value={selectedType?.label ?? ""}
          placeholder={documentTypes.length ? "Choisir un type" : "Chargement des types..."}
          options={typeOptions}
          onChange={(label) => {
            const match = documentTypes.find((t) => t.label === label);
            if (match) setDocumentTypeId(match.id);
          }}
          helperText="Les épreuves sont rangees a part des oeuvres et des manuels."
        />

        {selectedType?.isExam ? (
          <>
            <Text style={styles.label}>Examen</Text>
            <TextInput
              placeholder="Ex: BEPC, BAC, Composition"
              placeholderTextColor={theme.color.textMuted}
              style={styles.input}
              value={examName}
              onChangeText={setExamName}
            />

            <Text style={styles.label}>Session</Text>
            <TextInput
              placeholder="Ex: Juin"
              placeholderTextColor={theme.color.textMuted}
              style={styles.input}
              value={examSession}
              onChangeText={setExamSession}
            />

            <Text style={styles.label}>Année</Text>
            <TextInput
              placeholder="Ex: 2024"
              placeholderTextColor={theme.color.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.input}
              value={examYear}
              onChangeText={setExamYear}
            />
          </>
        ) : null}

        {isOeuvre ? (
          <>
            <Text style={styles.label}>Auteur</Text>
            <TextInput
              placeholder="Ex: Olympe Bhely-Quenum"
              placeholderTextColor={theme.color.textMuted}
              style={styles.input}
              value={author}
              onChangeText={setAuthor}
            />
          </>
        ) : null}

        <SelectionSheetField
          label="Classe"
          icon="school-outline"
          value={gradeLabel}
          placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une classe"}
          options={gradeOptions}
          onChange={(label) => {
            const match = gradeLevels.find((l) => l.label === label);
            if (match) setGradeLevelId(match.id);
          }}
          helperText="Laissez vide pour un document tous niveaux."
        />

        <SelectionSheetField
          label="Matière"
          icon="albums-outline"
          value={subjectLabel}
          placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une matière"}
          options={subjectOptions}
          onChange={(label) => {
            const match = subjects.find((x) => x.label === label);
            if (match) setSubjectId(match.id);
          }}
        />

        {optionsError ? <Text style={styles.errorText}>{optionsError}</Text> : null}
      </View>

      <Pressable style={[styles.secondary, busy && { opacity: 0.6 }]} onPress={pickCover} disabled={busy}>
        <Ionicons name="image" size={18} color={theme.color.text} />
        <Text style={styles.secondaryText}>{coverUrl ? "Changer la couverture" : "Importer une couverture"}</Text>
      </Pressable>
      {coverProgress != null && <ProgressLine label="Upload couverture" value={coverProgress} />}

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, sourceType === "link" && styles.toggleActive]}
          onPress={() => setSourceType("link")}
        >
          <Ionicons name="link" size={14} color={sourceType === "link" ? theme.color.textOnPrimary : theme.color.textMuted} />
          <Text style={[styles.toggleText, sourceType === "link" && styles.toggleTextActive]}>Lien externe</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, sourceType === "upload" && styles.toggleActive]}
          onPress={() => setSourceType("upload")}
        >
          <Ionicons name="cloud-upload" size={14} color={sourceType === "upload" ? theme.color.textOnPrimary : theme.color.textMuted} />
          <Text style={[styles.toggleText, sourceType === "upload" && styles.toggleTextActive]}>Uploader un fichier</Text>
        </Pressable>
      </View>

      {sourceType === "link" ? (
        <View style={styles.card}>
          <Text style={styles.label}>Lien du document</Text>
          <TextInput
            placeholder="URL du PDF/EPUB"
            placeholderTextColor={theme.color.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={externalUrl}
            onChangeText={setExternalUrl}
          />
          {!!externalUrl && normalizedExternalUrl !== externalUrl && (
            <Text style={styles.note}>Lien normalise : {normalizedExternalUrl}</Text>
          )}
          <Text style={styles.note}>Astuce : rendez le fichier public avant de partager.</Text>
        </View>
      ) : null}

      {sourceType === "upload" ? (
        <Pressable style={[styles.secondary, busy && { opacity: 0.6 }]} onPress={pickFileAndUpload} disabled={busy}>
          <Ionicons name="document-text-outline" size={18} color={theme.color.text} />
          <Text style={styles.secondaryText}>{fileUrl ? "Remplacer le fichier" : "Importer le fichier"}</Text>
        </Pressable>
      ) : null}
      {sourceType === "upload" && fileProgress != null && <ProgressLine label="Upload fichier" value={fileProgress} />}

      {(coverUrl || previewFileUrl) ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Prévisualisation</Text>
          {coverUrl ? (
            <View style={styles.previewBlock}>
              <Text style={styles.previewLabel}>Couverture</Text>
              <StoredImage path={coverUrl} style={styles.coverPreview} resizeMode="cover" />
            </View>
          ) : null}
          {previewFileUrl ? (
            <View style={styles.previewBlock}>
              <Text style={styles.previewLabel}>Document</Text>
              {/*
                L'apercu passait par le visualiseur de Google, ce qui exigeait
                que le fichier soit public. Le stockage etant ferme, il n'y a
                plus d'apercu avant conversion -- et il n'y en a pas besoin :
                c'est l'equipe bibliotheque qui verra le document au moment de
                lancer le traitement.
              */}
              <Text style={styles.loaderText}>
                Fichier joint. Il sera converti par l'equipe avant d'atteindre les eleves.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

        <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? "En cours..." : "Enregistrer"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProgressLine({ label, value }: { label: string; value: number }) {
  const { styles, theme } = useThemedStyles(makeStyles);
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

function isPdf(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

function normalizeCloudLink(raw: string): string {
  if (!raw) return "";
  let u = raw.trim();

  if (u.includes("drive.google.com")) {
    const fileIdMatch = u.match(/\/d\/([^/]+)\//) || u.match(/[?&]id=([^&]+)/);
    if (fileIdMatch?.[1]) {
      const id = fileIdMatch[1];
      return `https://drive.google.com/uc?export=download&id=${id}`;
    }
  }

  if (u.includes("dropbox.com")) {
    try {
      const url = new URL(u);
      url.searchParams.set("dl", "1");
      return url.toString();
    } catch {}
  }

  if (u.includes("1drv.ms") || u.includes("sharepoint.com")) {
    return u;
  }

  return u;
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  errorText: { color: t.color.danger, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12, marginTop: 4 },
  container: { flex: 1, backgroundColor: t.color.bg },
  title: { color: t.color.text, fontSize: 22, fontFamily: t.type.title.fontFamily },
  subtitle: { color: t.color.textMuted, marginTop: 6, fontFamily: t.type.body.fontFamily },

  card: {
    marginTop: 16,
    backgroundColor: t.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 14,
    gap: 10,
  },
  label: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  input: {
    backgroundColor: t.color.surfaceSunk,
    color: t.color.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    fontFamily: t.type.body.fontFamily,
  },

  secondary: {
    marginTop: 12,
    backgroundColor: t.color.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  secondaryText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily },

  toggleRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  toggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    gap: 6,
  },
  toggleActive: { backgroundColor: t.color.primary, borderColor: t.color.primary },
  toggleText: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  toggleTextActive: { color: t.color.textOnPrimary },

  note: { color: t.color.textMuted, fontSize: 12, marginTop: 6, fontFamily: t.type.body.fontFamily },

  primary: {
    marginTop: 16,
    backgroundColor: t.color.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  primaryText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily },

  previewCard: {
    marginTop: 16,
    backgroundColor: t.color.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    padding: 14,
    gap: 12,
  },
  previewTitle: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 14 },
  previewBlock: { gap: 8 },
  previewLabel: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  coverPreview: { width: "100%", height: 160, borderRadius: 12, borderWidth: 1, borderColor: t.color.border },
  viewer: { height: 280, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: t.color.border },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.color.surfaceSunk },
  loaderText: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily },

  progressWrap: { marginTop: 6, gap: 4 },
  progressLabel: { color: t.color.textMuted, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 11 },
  progressBar: {
    height: 8,
    borderRadius: 8,
    backgroundColor: t.color.surfaceSunk,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.color.border,
  },
  progressFill: { height: "100%", backgroundColor: t.color.primary },
});
