import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";

import { getBook } from "@/storage/books";
import { addDocumentOpen } from "@/storage/usage";
import { useAuth } from "@/providers/AuthProvider";
import { COLOR, FONT } from "@/theme/colors";
import TopBar from "@/components/TopBar";

function isPdf(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

function normalizeCloudLink(raw?: string | null): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if (!u) return null;

  if (u.includes("drive.google.com")) {
    const m = u.match(/\/d\/([^/]+)\//) || u.match(/[?&]id=([^&]+)/);
    if (m?.[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }
  if (u.includes("dropbox.com")) {
    try {
      const url = new URL(u);
      url.searchParams.set("dl", "1");
      return url.toString();
    } catch {}
  }
  return u;
}

export default function ReadBook() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [book, setBook] = useState<any | null>(null);
  const [loadPct, setLoadPct] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const b = await getBook(id);
      setBook(b ?? null);
    })();
  }, [id]);

  useEffect(() => {
    if (!user?.id || !book?.id) return;
    if (trackedRef.current) return;
    trackedRef.current = true;
    addDocumentOpen(user.id).catch(() => {});
  }, [user?.id, book?.id]);

  if (!book) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLOR.sub }}>Livre introuvable.</Text>
      </View>
    );
  }
  if (!book.fileUrl) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLOR.sub }}>Aucun fichier a afficher.</Text>
      </View>
    );
  }

  const fileUrl = useMemo(() => normalizeCloudLink(book.fileUrl), [book.fileUrl]);
  const viewer = useMemo(() => {
    if (!fileUrl || !isPdf(fileUrl)) return null;
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(fileUrl)}`;
  }, [fileUrl]);

  const openInBrowser = async () => {
    if (!fileUrl) return;
    await WebBrowser.openBrowserAsync(fileUrl);
  };

  const copyLink = async () => {
    if (!fileUrl) return;
    await Clipboard.setStringAsync(fileUrl);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <TopBar
        title="Lecture"
        right={
          <Pressable onPress={openInBrowser} style={styles.topAction} accessibilityLabel="Ouvrir">
            <Ionicons name="open-outline" size={18} color={COLOR.text} />
          </Pressable>
        }
      />

      {!!viewer ? (
        <>
          {loadPct > 0 && loadPct < 1 ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(loadPct * 100)}%` }]} />
            </View>
          ) : null}
          <WebView
            source={{ uri: viewer }}
            style={{ flex: 1, backgroundColor: COLOR.bg }}
            startInLoadingState
            originWhitelist={["*"]}
            mixedContentMode="always"
            onLoadProgress={(e) => {
              const p = Number(e?.nativeEvent?.progress ?? 0);
              setLoadPct(p);
              if (p >= 1) setLoadError(null);
            }}
            onError={(e) => setLoadError(e?.nativeEvent?.description || "Impossible d'afficher le document.")}
            onHttpError={(e) => setLoadError(e?.nativeEvent?.description || "Erreur de chargement du document.")}
            renderLoading={() => (
              <View style={styles.center}>
                <ActivityIndicator color={COLOR.primary} />
                <Text style={{ color: COLOR.sub, marginTop: 8, fontFamily: FONT.body }}>Chargement...</Text>
              </View>
            )}
          />
        </>
      ) : (
        <View style={styles.center}>
          <Text style={{ color: COLOR.sub, textAlign: "center" }}>
            Ce document n'est pas un PDF. Utilisez "Ouvrir" depuis la fiche du livre.
          </Text>
        </View>
      )}

      {!!loadError && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText} numberOfLines={2}>{loadError}</Text>
          <View style={styles.errorActions}>
            <Pressable onPress={openInBrowser} style={styles.errorBtn}>
              <Text style={styles.errorBtnText}>Ouvrir</Text>
            </Pressable>
            <Pressable onPress={copyLink} style={styles.errorBtn}>
              <Text style={styles.errorBtnText}>Copier le lien</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: COLOR.bg, alignItems: "center", justifyContent: "center" },
  topAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLOR.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.border,
  },
  progressTrack: {
    height: 2,
    backgroundColor: COLOR.border,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLOR.primary,
  },
  errorBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    backgroundColor: COLOR.surface,
  },
  errorText: { color: COLOR.sub, fontFamily: FONT.body },
  errorActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  errorBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLOR.surface,
  },
  errorBtnText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
});
