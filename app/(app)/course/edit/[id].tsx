import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLOR } from "@/theme/colors";
import { getCourse, updateCourse, deleteCourse, addChapter, deleteChapter } from "@/storage/courses";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { uploadOne } from "@/lib/upload";

export default function EditCourse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [published, setPublished] = useState(false);

  const [chTitle, setChTitle] = useState("");
  const [chVideoUrl, setChVideoUrl] = useState(""); // URL finale (YouTube ou Storage)
  const [chapters, setChapters] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const levelRef = useRef<TextInput>(null);
  const subjectRef = useRef<TextInput>(null);
  const chVideoRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const c = await getCourse(id);
      if (!c) {
        Alert.alert("Introuvable", "Ce cours n'existe pas.", [{ text: "OK", onPress: () => router.back() }]);
        return;
      }
      setTitle(c.title);
      setLevel(c.level);
      setSubject(c.subject);
      setPublished(c.published);
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
    if (!title.trim() || !level.trim() || !subject.trim()) {
      Alert.alert("Champs requis", "Merci de compléter tous les champs.");
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
      { text: "Supprimer", style: "destructive", onPress: async () => {
        await deleteCourse(id);
        router.replace("/(app)/course/mine");
      }}
    ]);
  };

  const pickVideoAndUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "public.movie", "application/octet-stream"],
        multiple: false,
        copyToCacheDirectory: true
      } as any);
      // @ts-ignore
      if (res.canceled) return;
      // @ts-ignore
      const doc = res.assets ? res.assets[0] : res;
      if (!doc?.uri) return;

      setUploading(true);
      const up = await uploadOne(
        {
          uri: doc.uri,
          name: doc.name ?? "video.mp4",
          contentType: (doc.mimeType as string | undefined)
        },
        `courses/${id}/videos`
      );
      setChVideoUrl(up.url);
      Alert.alert("Vidéo importée", "Le fichier a été uploadé. Vous pouvez maintenant ajouter le chapitre.");
    } catch (e: any) {
      Alert.alert("Upload échoué", e?.message || "Impossible d'uploader la vidéo.");
    } finally {
      setUploading(false);
    }
  };

  const add = async () => {
    if (!id) return;
    if (!chTitle.trim()) {
      Alert.alert("Champs requis", "Titre du chapitre requis.");
      return;
    }
    await addChapter(id, { title: chTitle.trim(), videoUrl: chVideoUrl.trim() || undefined });
    setChTitle(""); setChVideoUrl("");
    await refresh();
  };

  const remove = async (chapterId: string) => {
    if (!id) return;
    await deleteChapter(id, chapterId);
    await refresh();
  };

  if (loading) return <View style={{ flex:1, backgroundColor: COLOR.bg }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>Éditer le cours</Text>

          <TextInput
            placeholder="Titre du cours"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => levelRef.current?.focus()}
          />
          <TextInput
            ref={levelRef}
            placeholder="Niveau (Seconde, Première, Terminale)"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={level}
            onChangeText={setLevel}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => subjectRef.current?.focus()}
          />
          <TextInput
            ref={subjectRef}
            placeholder="Matière (Maths, Physique, ...)"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            returnKeyType="done"
          />

          <TouchableOpacity style={styles.primary} onPress={save}>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.primaryText}>Sauvegarder</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.secondary, published && { borderColor: "#10b981" }]} onPress={togglePublish}>
            <MaterialCommunityIcons name={published ? "check-decagram" : "decagram-outline"} size={18} color={published ? "#10b981" : "#cbd5e1"} />
            <Text style={[styles.secondaryText, published && { color: "#10b981" }]}>{published ? "Publié" : "Mettre en ligne"}</Text>
          </TouchableOpacity>

          <View style={{ height: 8 }} />
          <Text style={styles.section}>Chapitres</Text>

          <FlatList
            data={chapters}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ gap: 8 }}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.chapterItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chapterTitle}>{item.title}</Text>
                  <Text style={styles.chapterSub}>{item.videoUrl ? "Vidéo liée" : "Aucune vidéo"}</Text>
                </View>
                <TouchableOpacity onPress={() => remove(item.id)} style={styles.trash}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: COLOR.sub }}>Aucun chapitre pour l'instant.</Text>}
          />

          <View style={{ height: 8 }} />
          <Text style={styles.section}>Ajouter un chapitre</Text>

          <TextInput
            placeholder="Titre du chapitre"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={chTitle}
            onChangeText={setChTitle}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => chVideoRef.current?.focus()}
          />

          {/* Choix 1 : URL (YouTube/HLS/MP4 distant) */}
          <TextInput
            ref={chVideoRef}
            placeholder="URL vidéo (YouTube, mp4, HLS...) — optionnel"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={chVideoUrl}
            onChangeText={setChVideoUrl}
            keyboardType="url"
            textContentType="URL"
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
            onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
            returnKeyType="done"
          />

          {/* Choix 2 : Importer depuis l’appareil */}
          <TouchableOpacity style={[styles.secondary, uploading && { opacity: 0.6 }]} onPress={pickVideoAndUpload} disabled={uploading}>
            <Ionicons name="cloud-upload" size={18} color="#cbd5e1" />
            <Text style={styles.secondaryText}>
              {uploading ? "Upload en cours…" : (chVideoUrl ? "Remplacer la vidéo (upload)" : "Importer une vidéo depuis l’appareil")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primary, uploading && { opacity: 0.6 }]} onPress={add} disabled={uploading}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.primaryText}>Ajouter le chapitre</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.danger} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.dangerText}>Supprimer le cours</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { color: COLOR.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
  section: { color: COLOR.text, fontSize: 16, fontWeight: "800" },
  input: { backgroundColor: "#1A1B1E", color: COLOR.text, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLOR.border },
  primary: { backgroundColor: COLOR.primary, borderRadius: 14, padding: 14, alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondary: { backgroundColor: "#111214", borderRadius: 14, padding: 12, alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", borderWidth: 1, borderColor: COLOR.border },
  secondaryText: { color: "#cbd5e1", fontWeight: "800" },

  chapterItem: { backgroundColor: "#111214", borderColor: COLOR.border, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  chapterTitle: { color: COLOR.text, fontWeight: "800" },
  chapterSub: { color: COLOR.sub, marginTop: 4 },
  trash: { backgroundColor: "#e11d48", padding: 8, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  danger: { backgroundColor: "#e11d48", borderRadius: 14, padding: 12, alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 12 },
  dangerText: { color: "#fff", fontWeight: "800" }
});
