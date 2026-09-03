import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";
import { addNote, deleteNote, listNotes, type LessonNote } from "@/storage/notes";
import { fmtTime } from "@/utils/time";

export type LessonNotesProps = {
  userId?: string | null;
  courseId: string;
  lessonId: string;
  /** Position courante, horodatage de la note prise maintenant. */
  currentSec: number;
  /** Ramene la video a l'instant d'une note. */
  onSeek: (sec: number) => void;
};

/**
 * Prise de notes horodatee.
 *
 * La table lesson_notes existait et fonctionnait depuis le debut, sans qu'aucun
 * ecran ne l'utilise. Sa place est ici : une note prise pendant le cours vaut
 * pour l'instant precis ou elle est prise, et doit y ramener.
 */
export default function LessonNotes({
  userId,
  courseId,
  lessonId,
  currentSec,
  onSeek,
}: LessonNotesProps) {
  const { color, space, radius, hit } = useTheme();
  const [notes, setNotes] = useState<LessonNote[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setNotes(await listNotes(userId, courseId, lessonId));
    } catch {
      // Une note illisible ne doit pas empecher de regarder le cours.
    } finally {
      setLoading(false);
    }
  }, [userId, courseId, lessonId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !userId) return;
    setBusy(true);
    try {
      // On fige l'instant avant l'aller-retour reseau : la video continue.
      const at = Math.max(0, Math.floor(currentSec));
      const created = await addNote(userId, courseId, lessonId, at, text);
      setNotes((prev) => [...prev, created].sort((a, b) => a.t - b.t));
      setDraft("");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Note non enregistree.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (note: LessonNote) => {
    Alert.alert("Supprimer la note", note.text, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteNote(note.id);
            setNotes((prev) => prev.filter((n) => n.id !== note.id));
          } catch (e: any) {
            Alert.alert("Erreur", e?.message ?? "Suppression impossible.");
          }
        },
      },
    ]);
  };

  if (!userId) {
    return (
      <Text variant="caption" tone="muted">
        Connectez-vous pour prendre des notes.
      </Text>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      <View
        style={[
          styles.composer,
          {
            borderColor: color.borderInteractive,
            borderRadius: radius.md,
            backgroundColor: color.surfaceSunk,
            paddingHorizontal: space.md,
            gap: space.sm,
          },
        ]}
      >
        <View style={[styles.stamp, { backgroundColor: color.primarySoft, borderRadius: radius.sm }]}>
          <Text variant="captionStrong" tone="primary">
            {fmtTime(currentSec)}
          </Text>
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Noter une idee a cet instant"
          placeholderTextColor={color.textFaint}
          style={[styles.input, { color: color.text, minHeight: hit.min }]}
          multiline
          accessibilityLabel="Nouvelle note"
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la note"
          style={[styles.send, (!draft.trim() || busy) && { opacity: 0.4 }]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={color.primary} />
          ) : (
            <Ionicons name="add-circle" size={26} color={color.primary} />
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={color.textFaint} />
      ) : notes.length ? (
        <View style={{ gap: space.sm }}>
          {notes.map((note) => (
            <View key={note.id} style={[styles.note, { gap: space.md }]}>
              <Pressable
                onPress={() => onSeek(note.t)}
                accessibilityRole="button"
                accessibilityLabel={`Revenir a ${fmtTime(note.t)}`}
                style={[
                  styles.noteStamp,
                  { backgroundColor: color.primarySoft, borderRadius: radius.sm },
                ]}
              >
                <Text variant="captionStrong" tone="primary">
                  {fmtTime(note.t)}
                </Text>
              </Pressable>
              <Text variant="body" style={styles.noteText}>
                {note.text}
              </Text>
              <Pressable
                onPress={() => remove(note)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Supprimer cette note"
              >
                <Ionicons name="close" size={16} color={color.textFaint} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="caption" tone="muted">
          Aucune note. Celles que vous prendrez ramenent au moment exact du cours.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  stamp: { paddingHorizontal: 8, paddingVertical: 4 },
  input: { flex: 1, paddingVertical: 10 },
  send: { alignItems: "center", justifyContent: "center" },
  note: { flexDirection: "row", alignItems: "flex-start" },
  noteStamp: { paddingHorizontal: 8, paddingVertical: 4 },
  noteText: { flex: 1 },
});
