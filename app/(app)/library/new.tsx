// app/(app)/library/new.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as DocumentPicker from "expo-document-picker";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLOR, FONT } from "@/theme/colors";
import { uploadOne } from "@/lib/upload";
import { addBook } from "@/storage/books";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "expo-router";
import SelectionSheetField from "@/components/SelectionSheetField";
import { useSchoolingOptions } from "@/hooks/useSchoolingOptions";
import { DEFAULT_CONTENT_COUNTRY } from "@/storage/referentials";
import { listDocumentTypes, type DocumentType } from "@/storage/documentTypes";
import { isValidExamYear } from "@/lib/documentTaxonomy";

type SourceType = "link" | "upload";

export default function NewBook() {
  const { user, canAccessAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role === "teacher" || canAccessAdmin;

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
  const viewerUrl = useMemo(() => {
    if (!previewFileUrl) return null;
    if (isPdf(previewFileUrl)) {
      return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(previewFileUrl)}`;
    }
    return previewFileUrl;
  }, [previewFileUrl]);

  if (!isAdmin) {
    return (
      <View style={[styles.container, { padding: 16 }]}>
        <Text style={styles.title}>Acces refuse</Text>
        <Text style={{ color: COLOR.sub, marginTop: 4 }}>Seuls les enseignants peuvent ajouter des documents.</Text>
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
        Alert.alert("Annee invalide", "Indiquez une annee d'examen entre 1960 et 2100.");
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

      Alert.alert(
        "Document enregistre",
        "Il part en relecture avant d'etre visible par les eleves.",
        [{ text: "OK", onPress: () => router.replace(`/(app)/library/${created.id}`) }]
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Creation impossible.");
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
        <TextInput placeholder="Titre" placeholderTextColor={COLOR.sub} style={styles.input} value={title} onChangeText={setTitle} />

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
          helperText="Les epreuves sont rangees a part des oeuvres et des manuels."
        />

        {selectedType?.isExam ? (
          <>
            <Text style={styles.label}>Examen</Text>
            <TextInput
              placeholder="Ex: BEPC, BAC, Composition"
              placeholderTextColor={COLOR.sub}
              style={styles.input}
              value={examName}
              onChangeText={setExamName}
            />

            <Text style={styles.label}>Session</Text>
            <TextInput
              placeholder="Ex: Juin"
              placeholderTextColor={COLOR.sub}
              style={styles.input}
              value={examSession}
              onChangeText={setExamSession}
            />

            <Text style={styles.label}>Annee</Text>
            <TextInput
              placeholder="Ex: 2024"
              placeholderTextColor={COLOR.sub}
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
              placeholderTextColor={COLOR.sub}
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
          label="Matiere"
          icon="albums-outline"
          value={subjectLabel}
          placeholder={loadingGrades ? "Chargement du programme..." : "Choisir une matiere"}
          options={subjectOptions}
          onChange={(label) => {
            const match = subjects.find((x) => x.label === label);
            if (match) setSubjectId(match.id);
          }}
        />

        {optionsError ? <Text style={styles.errorText}>{optionsError}</Text> : null}
      </View>

      <Pressable style={[styles.secondary, busy && { opacity: 0.6 }]} onPress={pickCover} disabled={busy}>
        <Ionicons name="image" size={18} color={COLOR.text} />
        <Text style={styles.secondaryText}>{coverUrl ? "Changer la couverture" : "Importer une couverture"}</Text>
      </Pressable>
      {coverProgress != null && <ProgressLine label="Upload couverture" value={coverProgress} />}

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, sourceType === "link" && styles.toggleActive]}
          onPress={() => setSourceType("link")}
        >
          <Ionicons name="link" size={14} color={sourceType === "link" ? "#fff" : COLOR.sub} />
          <Text style={[styles.toggleText, sourceType === "link" && styles.toggleTextActive]}>Lien externe</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, sourceType === "upload" && styles.toggleActive]}
          onPress={() => setSourceType("upload")}
        >
          <Ionicons name="cloud-upload" size={14} color={sourceType === "upload" ? "#fff" : COLOR.sub} />
          <Text style={[styles.toggleText, sourceType === "upload" && styles.toggleTextActive]}>Uploader un fichier</Text>
        </Pressable>
      </View>

      {sourceType === "link" ? (
        <View style={styles.card}>
          <Text style={styles.label}>Lien du document</Text>
          <TextInput
            placeholder="URL du PDF/EPUB"
            placeholderTextColor={COLOR.sub}
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
          <Ionicons name="document-text" size={18} color={COLOR.text} />
          <Text style={styles.secondaryText}>{fileUrl ? "Remplacer le fichier" : "Importer le fichier"}</Text>
        </Pressable>
      ) : null}
      {sourceType === "upload" && fileProgress != null && <ProgressLine label="Upload fichier" value={fileProgress} />}

      {(coverUrl || viewerUrl) ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Prévisualisation</Text>
          {coverUrl ? (
            <View style={styles.previewBlock}>
              <Text style={styles.previewLabel}>Couverture</Text>
              <Image source={{ uri: coverUrl }} style={styles.coverPreview} resizeMode="cover" />
            </View>
          ) : null}
          {viewerUrl ? (
            <View style={styles.previewBlock}>
              <Text style={styles.previewLabel}>Document</Text>
              {isPdf(previewFileUrl || "") ? (
                <View style={styles.viewer}>
                  <WebView
                    source={{ uri: viewerUrl }}
                    startInLoadingState
                    renderLoading={() => (
                      <View style={styles.loader}>
                        <ActivityIndicator color={COLOR.primary} />
                        <Text style={styles.loaderText}>Chargement du PDF…</Text>
                      </View>
                    )}
                  />
                </View>
              ) : (
                <Pressable style={styles.openBtn} onPress={() => viewerUrl && WebBrowser.openBrowserAsync(viewerUrl)}>
                  <Ionicons name="link" size={14} color="#fff" />
                  <Text style={styles.openBtnText}>Ouvrir l'aperçu</Text>
                </Pressable>
              )}
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

const styles = StyleSheet.create({
  errorText: { color: COLOR.danger, fontFamily: FONT.bodyBold, fontSize: 12, marginTop: 4 },
  container: { flex: 1, backgroundColor: COLOR.bg },
  title: { color: COLOR.text, fontSize: 22, fontFamily: FONT.heading },
  subtitle: { color: COLOR.sub, marginTop: 6, fontFamily: FONT.body },

  card: {
    marginTop: 16,
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 14,
    gap: 10,
  },
  label: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  input: {
    backgroundColor: COLOR.muted,
    color: COLOR.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    fontFamily: FONT.body,
  },

  secondary: {
    marginTop: 12,
    backgroundColor: COLOR.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  secondaryText: { color: COLOR.text, fontFamily: FONT.bodyBold },

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
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    gap: 6,
  },
  toggleActive: { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
  toggleText: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },
  toggleTextActive: { color: "#fff" },

  note: { color: COLOR.sub, fontSize: 12, marginTop: 6, fontFamily: FONT.body },

  primary: {
    marginTop: 16,
    backgroundColor: COLOR.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontFamily: FONT.bodyBold },

  previewCard: {
    marginTop: 16,
    backgroundColor: COLOR.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 14,
    gap: 12,
  },
  previewTitle: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 14 },
  previewBlock: { gap: 8 },
  previewLabel: { color: COLOR.sub, fontFamily: FONT.bodyBold, fontSize: 12 },
  coverPreview: { width: "100%", height: 160, borderRadius: 12, borderWidth: 1, borderColor: COLOR.border },
  viewer: { height: 280, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: COLOR.border },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLOR.muted },
  loaderText: { color: COLOR.sub, fontFamily: FONT.body },
  openBtn: {
    alignSelf: "flex-start",
    backgroundColor: COLOR.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  openBtnText: { color: "#fff", fontFamily: FONT.bodyBold, fontSize: 12 },

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
});
