import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";
import StoredImage from "@/components/ui/StoredImage";
import Badge from "@/components/ui/Badge";
import {
  documentOutline,
  totalPoints,
  type DocumentBlock,
  type DocumentReference,
  type LibraryDocument,
} from "@/lib/documentFormat";

type Props = {
  doc: LibraryDocument;
  reference?: DocumentReference | null;
  title: string;
  /** Affiche les figures sans image au lieu de les masquer. */
  showPendingFigures?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
};

/**
 * Lecteur de document.
 *
 * C'est ce que le format rend possible et qu'un PDF interdit : un texte qui se
 * reflow a la largeur de l'ecran, un sommaire qui saute a l'exercice voulu, et
 * une taille de caractere qui suit les reglages du telephone.
 */
export default function DocumentReader({
  doc,
  reference,
  title,
  showPendingFigures = false,
  ListHeaderComponent,
}: Props) {
  const { color, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<DocumentBlock>>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);

  // Une figure sans image n'a rien a montrer a un lecteur : elle n'apparait
  // qu'en relecture, ou c'est precisement ce qu'il faut corriger.
  const blocks = useMemo(
    () =>
      showPendingFigures
        ? doc.blocks
        : doc.blocks.filter((b) => b.kind !== "figure" || !!b.assetPath),
    [doc.blocks, showPendingFigures]
  );

  const outline = useMemo(() => documentOutline(doc), [doc]);
  const scored = useMemo(() => totalPoints(doc), [doc]);

  const jumpTo = useCallback(
    (blockId: string) => {
      const index = blocks.findIndex((b) => b.id === blockId);
      setOutlineOpen(false);
      if (index < 0) return;
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    },
    [blocks]
  );

  const Header = (
    <View style={{ gap: space.md, marginBottom: space.lg }}>
      {ListHeaderComponent}
      <Text variant="title">{title}</Text>
      {reference ? <ReferenceCard reference={reference} /> : null}
      {scored !== null ? (
        <Text variant="caption" tone="muted">
          Bareme total : {scored} point{scored > 1 ? "s" : ""}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={blocks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + 120,
        }}
        ListHeaderComponent={Header}
        renderItem={({ item }) => <Block block={item} />}
        // Les blocs ont des hauteurs tres inegales : sans ce rattrapage, un saut
        // vers un exercice lointain echoue silencieusement.
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({ offset: index * 120, animated: false });
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
          }, 80);
        }}
      />

      {outline.length > 1 ? (
        <Pressable
          onPress={() => setOutlineOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le sommaire"
          style={[
            styles.fab,
            {
              bottom: insets.bottom + space.xl,
              backgroundColor: color.primary,
              borderRadius: radius.pill,
            },
          ]}
        >
          <Ionicons name="list-outline" size={20} color={color.textOnPrimary} />
          <Text variant="captionStrong" tone="onPrimary">
            Sommaire
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={outlineOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setOutlineOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: color.scrim }]}
          onPress={() => setOutlineOpen(false)}
          accessibilityLabel="Fermer le sommaire"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: color.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <View style={{ padding: space.lg, gap: space.xs }}>
            <Text variant="heading">Sommaire</Text>
            <Text variant="caption" tone="muted">
              {outline.length} entrees
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg }}>
            {outline.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => jumpTo(entry.id)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.outlineRow,
                  {
                    paddingVertical: space.md,
                    paddingLeft: entry.kind === "question" ? space.xl : 0,
                    borderBottomColor: color.border,
                    gap: space.md,
                  },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text
                  variant={entry.kind === "exercise" ? "bodyStrong" : "body"}
                  style={styles.flex}
                  numberOfLines={2}
                >
                  {entry.label}
                </Text>
                {entry.points !== undefined ? (
                  <Text variant="caption" tone="muted">
                    {entry.points} pt{entry.points > 1 ? "s" : ""}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/* --- Rendu d'un bloc --- */

function Block({ block }: { block: DocumentBlock }) {
  const { color, space, radius } = useTheme();

  switch (block.kind) {
    case "exercise":
      return (
        <View style={{ marginTop: space.xxl, marginBottom: space.md, gap: space.xs }}>
          <View style={[styles.exerciseHead, { gap: space.sm }]}>
            <Text variant="heading" style={styles.flex}>
              {block.label || "Exercice"}
            </Text>
            {block.points !== undefined ? (
              <Badge tone="primary">{`${block.points} pt${block.points > 1 ? "s" : ""}`}</Badge>
            ) : null}
          </View>
          <View style={[styles.rule, { backgroundColor: color.primary }]} />
          {block.text ? (
            <Text style={{ marginTop: space.xs }}>{block.text}</Text>
          ) : null}
        </View>
      );

    case "question":
      return (
        <View style={[styles.question, { marginTop: space.lg, gap: space.sm }]}>
          {block.label ? (
            <Text variant="bodyStrong" tone="primary" style={styles.questionLabel}>
              {block.label}
            </Text>
          ) : null}
          <View style={styles.flex}>
            {block.text ? <Text>{block.text}</Text> : null}
            {block.points !== undefined ? (
              <Text variant="caption" tone="muted" style={{ marginTop: space.xxs }}>
                {block.points} point{block.points > 1 ? "s" : ""}
              </Text>
            ) : null}
          </View>
        </View>
      );

    case "heading":
      return (
        <Text
          variant={block.level === 1 ? "heading" : "bodyStrong"}
          style={{ marginTop: space.xl, marginBottom: space.xs }}
        >
          {block.text}
        </Text>
      );

    case "instruction":
      return (
        <View
          style={[
            styles.instruction,
            {
              marginTop: space.md,
              backgroundColor: color.primarySoft,
              borderLeftColor: color.primary,
              borderRadius: radius.sm,
              padding: space.md,
            },
          ]}
        >
          <Text variant="caption" tone="primary">
            {block.text}
          </Text>
        </View>
      );

    case "list":
      return (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          {(block.items ?? []).map((item, index) => (
            <View key={index} style={[styles.listRow, { gap: space.sm }]}>
              <Text tone="muted" style={styles.bullet}>
                {block.ordered ? `${index + 1}.` : "•"}
              </Text>
              <Text style={styles.flex}>{item}</Text>
            </View>
          ))}
        </View>
      );

    case "table":
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: space.md }}
        >
          <View style={[styles.table, { borderColor: color.border, borderRadius: radius.sm }]}>
            {(block.rows ?? []).map((row, rowIndex) => {
              const isHeader = block.headerRow !== false && rowIndex === 0;
              return (
                <View
                  key={rowIndex}
                  style={[
                    styles.tableRow,
                    {
                      backgroundColor: isHeader ? color.surfaceSunk : "transparent",
                      borderBottomColor: color.border,
                    },
                  ]}
                >
                  {row.map((cell, cellIndex) => (
                    <View
                      key={cellIndex}
                      style={[styles.cell, { padding: space.sm, borderRightColor: color.border }]}
                    >
                      <Text variant={isHeader ? "captionStrong" : "caption"}>{cell}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      );

    case "formula":
      return (
        <View
          style={[
            styles.formula,
            {
              marginTop: space.md,
              backgroundColor: color.surfaceSunk,
              borderRadius: radius.sm,
              padding: space.md,
            },
          ]}
        >
          <Text variant="caption" style={styles.mono}>
            {block.latex}
          </Text>
        </View>
      );

    case "figure":
      return (
        <View style={{ marginTop: space.lg, gap: space.xs }}>
          {block.assetPath ? (
            <StoredImage path={block.assetPath}
              style={[styles.figure, { borderRadius: radius.md, backgroundColor: color.surfaceSunk }]}
              resizeMode="contain"
              accessibilityLabel={block.description || block.caption || "Figure"}
            />
          ) : (
            <View
              style={[
                styles.figurePending,
                {
                  borderColor: color.warning,
                  borderRadius: radius.md,
                  padding: space.lg,
                  gap: space.sm,
                },
              ]}
            >
              <Ionicons name="image-outline" size={22} color={color.warning} />
              <Text variant="caption" tone="warning" style={styles.flex}>
                {block.description || "Figure a fournir"}
                {block.pageIndex !== undefined ? ` (page ${block.pageIndex + 1})` : ""}
              </Text>
            </View>
          )}
          {block.caption ? (
            <Text variant="caption" tone="muted" align="center">
              {block.caption}
            </Text>
          ) : null}
        </View>
      );

    default:
      return <Text style={{ marginTop: space.md }}>{block.text}</Text>;
  }
}

function ReferenceCard({ reference }: { reference: DocumentReference }) {
  const { color, space, radius } = useTheme();
  const lines: string[] = [];
  const place = [reference.institution?.name, reference.institution?.city]
    .filter(Boolean)
    .join(" · ");
  if (place) lines.push(place);
  const when = [reference.schoolYear, reference.session].filter(Boolean).join(" · ");
  if (when) lines.push(when);
  if (reference.series) lines.push(`Serie ${reference.series}`);
  if (reference.author) lines.push(reference.author);
  if (!lines.length) return null;

  return (
    <View
      style={[
        styles.reference,
        {
          backgroundColor: color.surfaceSunk,
          borderLeftColor: color.primary,
          borderRadius: radius.sm,
          padding: space.md,
          gap: space.xxs,
        },
      ]}
    >
      {lines.map((line) => (
        <Text key={line} variant="caption" tone="muted">
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  exerciseHead: { flexDirection: "row", alignItems: "center" },
  rule: { height: 2, width: 40 },
  question: { flexDirection: "row" },
  questionLabel: { minWidth: 40 },
  instruction: { borderLeftWidth: 3 },
  listRow: { flexDirection: "row" },
  bullet: { minWidth: 20 },
  table: { borderWidth: 1, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1 },
  cell: { minWidth: 96, borderRightWidth: 1 },
  formula: { alignItems: "center" },
  mono: { fontFamily: "monospace" },
  figure: { width: "100%", height: 220 },
  figurePending: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderStyle: "dashed" },
  reference: { borderLeftWidth: 3 },
  fab: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backdrop: { flex: 1 },
  sheet: { maxHeight: "70%" },
  outlineRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
});
