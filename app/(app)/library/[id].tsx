import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DocumentReader from "@/components/library/DocumentReader";
import { getBook } from "@/storage/books";
import { formatExamLabel } from "@/lib/documentTaxonomy";
import { parseDocument, parseReference } from "@/lib/documentFormat";
import { getIngestionStatus, type IngestionStatus } from "@/storage/documentIngestion";
import type { Book } from "@/types/book";

/**
 * Un lien de partage cloud pointe sur une page, pas sur le fichier. Les
 * documents anterieurs a la chaine de traitement en contiennent encore.
 */
function normalizeCloudLink(raw?: string | null): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  if (value.includes("drive.google.com")) {
    const match = value.match(/\/d\/([^/]+)\//) || value.match(/[?&]id=([^&]+)/);
    if (match?.[1]) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  if (value.includes("dropbox.com")) {
    try {
      const url = new URL(value);
      url.searchParams.set("dl", "1");
      return url.toString();
    } catch {
      return value;
    }
  }
  return value;
}

const isPdf = (url: string) => /\.pdf(\?|$)/i.test(url);

export default function DocumentDetail() {
  const { color, space, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      const found = await getBook(id);
      if (!active) return;
      setBook(found ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const { user } = useAuth();
  const isOwner = !!user?.id && book?.ownerId === user.id;

  /*
   * L'auteur d'un depot doit savoir ou en est son document.
   *
   * Le traitement ne part plus au depot : l'equipe bibliotheque le declenche
   * apres avoir vu de quoi il s'agit. Sans ce qui suit, le professeur depose
   * un fichier, ne voit rien se passer, et conclut a un echec.
   */
  const [ingestion, setIngestion] = useState<IngestionStatus | null>(null);

  useEffect(() => {
    if (!isOwner || !book?.id) return;
    let active = true;
    getIngestionStatus(book.id)
      .then((status) => active && setIngestion(status))
      .catch(() => {
        // L'etat du traitement est une information de confort : son absence ne
        // doit pas empecher la fiche de s'afficher.
      });
    return () => {
      active = false;
    };
  }, [isOwner, book?.id]);

  const doc = useMemo(() => parseDocument(book?.content ?? null), [book?.content]);
  const reference = useMemo(() => parseReference(book?.reference ?? null), [book?.reference]);
  const structured = doc.blocks.length > 0;

  const fileUrl = useMemo(() => normalizeCloudLink(book?.fileUrl), [book?.fileUrl]);
  const viewerSrc = useMemo(() => {
    if (!fileUrl || !isPdf(fileUrl)) return null;
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(fileUrl)}`;
  }, [fileUrl]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  }

  if (!book) {
    return (
      <View style={[styles.center, { backgroundColor: color.bg, padding: space.lg }]}>
        <EmptyState
          tone="error"
          title="Document introuvable"
          message="Ce document a peut-être été retire de la bibliotheque."
          actionLabel="Revenir"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const meta = [book.subject, book.level, book.series ? `Serie ${book.series}` : null]
    .filter(Boolean)
    .join(" · ");

  const BackBar = (
    <View style={[styles.bar, { paddingTop: insets.top + space.md, paddingHorizontal: space.lg, gap: space.md }]}>
      <Pressable
        onPress={() => (reading ? setReading(false) : router.back())}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={reading ? "Quitter la lecture" : "Revenir"}
      >
        <Ionicons name="chevron-back" size={22} color={color.text} />
      </Pressable>
      <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
        {reading ? book.title : "Document"}
      </Text>
    </View>
  );

  // Le document porte son contenu : il se lit dans l'application.
  if (structured) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        {BackBar}
        <DocumentReader
          doc={doc}
          reference={reference}
          title={book.title}
          ListHeaderComponent={
            <View style={{ gap: space.sm }}>
              {meta ? (
                <Text variant="overline" tone="primary">
                  {meta.toUpperCase()}
                </Text>
              ) : null}
              {formatExamLabel(book) ? (
                <Badge tone="neutral">{formatExamLabel(book)}</Badge>
              ) : null}
            </View>
          }
        />
      </View>
    );
  }

  // Documents anterieurs a la chaine de traitement : il n'y a qu'un fichier.
  if (reading && viewerSrc) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        {BackBar}
        <WebView
          source={{ uri: viewerSrc }}
          style={{ flex: 1, backgroundColor: color.bg }}
          startInLoadingState
          javaScriptEnabled
          originWhitelist={["*"]}
          mixedContentMode="always"
          onError={(e) =>
            setWebError(e?.nativeEvent?.description || "Impossible d'afficher ce document.")
          }
        />
        {webError ? (
          <View
            style={[
              styles.errorBar,
              { backgroundColor: color.dangerSoft, padding: space.md, gap: space.sm },
            ]}
          >
            <Text variant="caption" tone="danger" style={styles.flex}>
              {webError}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {BackBar}
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.xxl,
          gap: space.lg,
        }}
      >
        <View style={[styles.head, { gap: space.lg }]}>
          <View style={[styles.cover, { backgroundColor: color.surfaceSunk, borderRadius: radius.md }]}>
            {book.coverUrl ? (
              <Image source={{ uri: book.coverUrl }} style={styles.coverImg} resizeMode="cover" />
            ) : (
              <Ionicons name="document-text-outline" size={26} color={color.textMuted} />
            )}
          </View>
          <View style={styles.flex}>
            <Text variant="title">{book.title}</Text>
            {meta ? (
              <Text variant="caption" tone="muted">
                {meta}
              </Text>
            ) : null}
            {formatExamLabel(book) ? (
              <Text variant="caption" tone="muted">
                {formatExamLabel(book)}
              </Text>
            ) : null}
            {book.author ? (
              <Text variant="caption" tone="muted">
                {book.author}
              </Text>
            ) : null}
            <Badge tone="success" style={{ marginTop: space.sm }}>
              Gratuit
            </Badge>
          </View>
        </View>

        {viewerSrc ? (
          <Button onPress={() => setReading(true)} icon="book-outline" block>
            Lire
          </Button>
        ) : isOwner ? (
          <EmptyState {...ownerWaitingState(ingestion)} />
        ) : (
          <EmptyState
            icon="hourglass-outline"
            title="Lecture indisponible"
            message="Ce document n'est pas encore lisible dans l'application. Il le deviendra une fois traité."
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center" },
  head: { flexDirection: "row" },
  cover: { width: 84, height: 108, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverImg: { width: "100%", height: "100%" },
  errorBar: { flexDirection: "row", alignItems: "center" },
});

/**
 * Ce que l'auteur doit lire selon l'etat de son depot.
 *
 * Quatre situations, quatre phrases. "En attente" n'est pas une panne et doit
 * le dire : c'est l'equipe qui declenche la conversion, pas le depot.
 */
function ownerWaitingState(status: IngestionStatus | null): {
  icon: "hourglass-outline" | "sync-outline" | "alert-circle-outline";
  title: string;
  message: string;
} {
  if (status?.state === "queued" || status?.state === "running") {
    return {
      icon: "sync-outline",
      title: "Conversion en cours",
      message:
        "Votre document est en train d'être converti. Revenez dans quelques minutes : il sera alors lisible dans l'application.",
    };
  }

  if (status?.state === "failed") {
    return {
      icon: "alert-circle-outline",
      title: "La conversion a échoué",
      message: status.error
        ? `${status.error} L'équipe est prévenue et peut relancer le traitement.`
        : "L'équipe est prévenue et peut relancer le traitement. Vous n'avez rien à refaire.",
    };
  }

  return {
    icon: "hourglass-outline",
    title: "En attente de traitement",
    message:
      "Votre fichier est bien enregistré. L'équipe bibliothèque le convertit en document lisible avant qu'il n'atteigne les élèves — cette étape se fait à la main et prend un peu de temps.",
  };
}
