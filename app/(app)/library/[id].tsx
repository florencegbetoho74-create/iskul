import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import Text from "@/components/ui/Text";
import StoredImage from "@/components/ui/StoredImage";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DocumentReader from "@/components/library/DocumentReader";
import { getBook } from "@/storage/books";
import { formatExamLabel } from "@/lib/documentTaxonomy";
import { parseDocument, parseReference } from "@/lib/documentFormat";
import { getIngestionStatus, type IngestionStatus } from "@/storage/documentIngestion";
import type { Book } from "@/types/book";

export default function DocumentDetail() {
  const { color, space, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

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
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Revenir"
      >
        <Ionicons name="chevron-back" size={22} color={color.text} />
      </Pressable>
      <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
        Document
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
              <StoredImage path={book.coverUrl} style={styles.coverImg} resizeMode="cover" />
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

        {/*
          L'apercu passait par le visualiseur de Google : afficher un PDF
          exigeait d'en confier l'adresse a un tiers, ce qui imposait de garder
          les fichiers publics. Le bucket etant prive, seuls les documents
          convertis se lisent -- et c'est ce qui rend la fermeture possible.
        */}
        {isOwner ? (
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
