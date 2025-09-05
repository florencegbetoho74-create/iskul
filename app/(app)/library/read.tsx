import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";
import { getBook } from "@/storage/books";
import { COLOR } from "@/theme/colors";

export default function ReadBook() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const b = await getBook(id);
      setBook(b ?? null);
    })();
  }, [id]);

  if (!book) {
    return <View style={styles.center}><Text style={{ color: COLOR.sub }}>Livre introuvable.</Text></View>;
  }
  if (!book.fileUrl) {
    return <View style={styles.center}><Text style={{ color: COLOR.sub }}>Aucun fichier à afficher.</Text></View>;
  }

  // Astuce simple : viewer Google Docs pour PDF (affichage intégré)
  const viewer = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(book.fileUrl)}`;

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <WebView
        source={{ uri: viewer }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}><ActivityIndicator /><Text style={{ color: COLOR.sub, marginTop: 8 }}>Chargement…</Text></View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: COLOR.bg, alignItems: "center", justifyContent: "center" }
});
