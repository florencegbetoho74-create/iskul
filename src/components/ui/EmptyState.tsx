import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";

export type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  /** Pourquoi c'est vide, et ce qui remplira l'ecran. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Vrai vide contre echec de chargement : ce ne sont pas les memes mots. */
  tone?: "empty" | "error";
};

/**
 * Ecran vide.
 *
 * Un vide sans explication laisse croire a une panne. On dit toujours pourquoi
 * c'est vide et ce qui le remplira.
 */
export default function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  tone = "empty",
}: EmptyStateProps) {
  const { color, space } = useTheme();
  const isError = tone === "error";

  return (
    <View style={[styles.root, { padding: space.xxl, gap: space.sm }]}>
      <Ionicons
        name={icon ?? (isError ? "cloud-offline-outline" : "sparkles-outline")}
        size={30}
        color={isError ? color.danger : color.textFaint}
      />
      <Text variant="subheading" align="center">
        {title}
      </Text>
      <Text variant="caption" tone="muted" align="center" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button onPress={onAction} variant={isError ? "ghost" : "primary"} size="sm" style={{ marginTop: space.sm }}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center" },
  message: { maxWidth: 320 },
});
