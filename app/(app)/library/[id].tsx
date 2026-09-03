import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Image, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { WebView } from "react-native-webview";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { getBook } from "@/storage/books";
import { formatExamLabel } from "@/lib/documentTaxonomy";
import type { Book } from "@/types/book";
import TopBar from "@/components/TopBar";

function isPdf(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}
function isEpub(url: string) {
  return /\.epub(\?|$)/i.test(url);
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

export default function BookDetail() {
  const { styles, theme } = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [showReader, setShowReader] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [loadPct, setLoadPct] = useState(0);

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
  }, [id, router]);

  const fileUrl = useMemo(() => normalizeCloudLink(book?.fileUrl), [book?.fileUrl]);

  const viewerSrc = useMemo(() => {
    if (!fileUrl) return null;
    if (isPdf(fileUrl)) {
      const enc = encodeURIComponent(fileUrl);
      return `https://docs.google.com/gview?embedded=1&url=${enc}`;
    }
    return null;
  }, [fileUrl]);

  const canEmbed = !!viewerSrc;

  const openInBrowser = async () => {
    if (!fileUrl) return;
    setShowReader(false);
    await WebBrowser.openBrowserAsync(fileUrl);
  };

  const copyLink = async () => {
    if (!fileUrl) return;
    await Clipboard.setStringAsync(fileUrl);
    Alert.alert("Lien copie", "L'URL du document est dans le presse-papiers.");
  };

  if (!book) return <View style={{ flex: 1, backgroundColor: theme.color.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <TopBar title="Livre" right={null} />

      {!showReader ? (
        <View style={styles.header}>
          <View style={styles.coverWrap}>
            {book.coverUrl ? (
              <Image source={{ uri: book.coverUrl }} style={styles.cover} resizeMode="cover" />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Text style={{ color: theme.color.textMuted }}>Sans couverture</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
            <Text style={styles.meta}>{book.subject || "-"} - {book.level || "-"}</Text>
            {formatExamLabel(book) ? (
              <Text style={styles.meta}>{formatExamLabel(book)}</Text>
            ) : null}
            {book.author ? <Text style={styles.meta}>{book.author}</Text> : null}
            <View style={styles.badge}><Text style={styles.badgeText}>Gratuit</Text></View>

            {canEmbed ? (
              <Pressable style={styles.primary} onPress={() => { setWebError(null); setShowReader(true); }}>
                <Text style={styles.primaryText}>Lire</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.primary} onPress={openInBrowser} disabled={!fileUrl}>
                <Text style={styles.primaryText}>{isEpub(fileUrl || "") ? "Ouvrir (EPUB)" : "Ouvrir dans le navigateur"}</Text>
              </Pressable>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={styles.ghost} onPress={openInBrowser} disabled={!fileUrl}>
                <Text style={styles.ghostText}>Ouvrir</Text>
              </Pressable>
              <Pressable style={styles.ghost} onPress={copyLink} disabled={!fileUrl}>
                <Text style={styles.ghostText}>Copier le lien</Text>
              </Pressable>
              <Pressable onPress={() => router.back()} style={[styles.ghost, { paddingHorizontal: 10 }]}>
                <Text style={styles.ghostText}>Retour</Text>
              </Pressable>
            </View>

            {!canEmbed && !!fileUrl && (
              <Text style={styles.note}>
                Astuce : certains hebergeurs bloquent l'integration en app. Utilisez "Ouvrir" si l'apercu echoue.
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.readerBar}>
            <Pressable onPress={() => setShowReader(false)}>
              <Text style={styles.back}>Quitter la lecture</Text>
            </Pressable>
            <Text style={styles.readerTitle} numberOfLines={1}>{book.title}</Text>
            <Pressable onPress={openInBrowser}>
              <Text style={styles.open}>Ouvrir</Text>
            </Pressable>
          </View>

          {viewerSrc ? (
            <>
              {loadPct > 0 && loadPct < 1 ? (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(loadPct * 100)}%` }]} />
                </View>
              ) : null}
              <WebView
                source={{ uri: viewerSrc }}
                style={{ flex: 1, backgroundColor: theme.color.bg }}
                startInLoadingState
                javaScriptEnabled
                allowsInlineMediaPlayback
                originWhitelist={["*"]}
                mixedContentMode="always"
                onLoadProgress={(e) => {
                  const p = Number(e?.nativeEvent?.progress ?? 0);
                  setLoadPct(p);
                  if (p >= 1) setWebError(null);
                }}
                onError={(e) => {
                  setWebError(e?.nativeEvent?.description || "Impossible d'afficher le document.");
                }}
              />
            </>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: theme.color.textMuted }}>Apercu non disponible.</Text>
            </View>
          )}

          {!!webError && (
            <View style={styles.errorBar}>
              <Text style={styles.errorText} numberOfLines={2}>{webError}</Text>
              <Pressable onPress={openInBrowser}>
                <Text style={styles.errorAction}>Ouvrir dans le navigateur</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  header: { flexDirection: "row", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: t.color.border },
  coverWrap: { width: 120, height: 120, borderRadius: 12, overflow: "hidden", backgroundColor: t.color.surfaceSunk, borderWidth: 1, borderColor: t.color.border },
  cover: { width: "100%", height: "100%" },
  coverFallback: { alignItems: "center", justifyContent: "center" },

  title: { color: t.color.text, fontSize: 18, fontFamily: t.type.heading.fontFamily },
  meta: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: t.color.primarySoft,
    borderColor: t.color.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  badgeText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },

  primary: {
    backgroundColor: t.color.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  primaryText: { color: t.color.textOnPrimary, fontFamily: t.type.bodyStrong.fontFamily },

  ghost: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    marginTop: 8,
  },
  ghostText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily },

  note: { color: t.color.textMuted, fontSize: 12, marginTop: 6, fontFamily: t.type.body.fontFamily },

  back: { color: t.color.textMuted, textDecorationLine: "underline", fontFamily: t.type.bodyStrong.fontFamily },
  open: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily },

  readerBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.color.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: t.color.surface,
  },
  readerTitle: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, flex: 1 },

  errorBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: t.color.border,
    backgroundColor: t.color.surface,
  },
  errorText: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily },
  errorAction: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily, marginTop: 6 },
  progressTrack: {
    height: 2,
    backgroundColor: t.color.border,
  },
  progressFill: {
    height: "100%",
    backgroundColor: t.color.primary,
  },
});
