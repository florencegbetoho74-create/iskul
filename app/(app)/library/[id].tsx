import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLOR } from "@/theme/colors";
import { getBook } from "@/storage/books";
import type { Book } from "@/types/book";
import { WebView } from "react-native-webview";
import TopBar from "@/components/TopBar";

function isPdf(url: string) { return /\.pdf(\?|$)/i.test(url); }

export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [showReader, setShowReader] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const b = await getBook(id);
      if (!b) {
        Alert.alert("Introuvable", "Livre inexistant.", [{ text: "OK", onPress: () => router.back() }]);
        return;
      }
      setBook(b);
    })();
  }, [id]);

  const viewerSrc = useMemo(() => {
    if (!book?.fileUrl) return null;
    if (Platform.OS === "android" && isPdf(book.fileUrl)) {
      const enc = encodeURIComponent(book.fileUrl);
      return `https://docs.google.com/gview?embedded=1&url=${enc}`;
    }
    return book.fileUrl; // iOS affiche le PDF nativement dans WebView
  }, [book?.fileUrl]);

  if (!book) return <View style={{ flex: 1, backgroundColor: COLOR.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <TopBar title="Livre" right={null} />

      {!showReader ? (
        <View style={styles.header}>
          <View style={styles.coverWrap}>
            {book.coverUrl ? (
              <Image source={{ uri: book.coverUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, { alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ color: "#cbd5e1" }}>Sans couverture</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.meta}>{book.subject} • {book.level}</Text>
            <Text style={styles.badge}>{!book.price ? "Gratuit" : `${book.price} FCFA`}</Text>

            <TouchableOpacity style={styles.primary} onPress={() => setShowReader(true)}>
              <Text style={styles.primaryText}>Lire</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.back}>← Retour</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.readerBar}>
            <TouchableOpacity onPress={() => setShowReader(false)}><Text style={styles.back}>← Quitter la lecture</Text></TouchableOpacity>
            <Text style={styles.readerTitle} numberOfLines={1}>{book.title}</Text>
          </View>
          {viewerSrc ? (
            <WebView
              source={{ uri: viewerSrc }}
              style={{ flex: 1, backgroundColor: COLOR.bg }}
              startInLoadingState
              javaScriptEnabled
              allowsInlineMediaPlayback
              originWhitelist={["*"]}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: COLOR.sub }}>Fichier non disponible.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: "#1F2023" },
  coverWrap: { width: 120, height: 120, borderRadius: 12, overflow: "hidden", backgroundColor: "#0b0b0c", borderWidth: 1, borderColor: "#1F2023" },
  cover: { width: "100%", height: "100%" },
  title: { color: COLOR.text, fontSize: 18, fontWeight: "900" },
  meta: { color: COLOR.sub },
  badge: { alignSelf: "flex-start", color: "#fff", backgroundColor: "#4441b8", borderColor: "#3532a1", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: "800", marginTop: 6 },
  primary: { backgroundColor: COLOR.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  primaryText: { color: "#fff", fontWeight: "900" },
  back: { color: "#cbd5e1", textDecorationLine: "underline", marginTop: 10 },

  readerBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1F2023", flexDirection: "row", alignItems: "center", gap: 10 },
  readerTitle: { color: COLOR.text, fontWeight: "800", flex: 1 }
});
