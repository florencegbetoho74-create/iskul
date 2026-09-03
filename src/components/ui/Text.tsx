import React from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import type { TypeVariant } from "@/theme/tokens";

export type TextTone = "default" | "muted" | "faint" | "primary" | "success" | "warning" | "danger" | "onPrimary";

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Aligne le texte sans passer par un style ad hoc. */
  align?: TextStyle["textAlign"];
};

/**
 * Texte de l'application.
 *
 * Chaque niveau porte sa taille ET son interligne : c'est l'absence
 * d'interligne coherent qui donnait au produit son aspect disparate.
 */
export default function Text({
  variant = "body",
  tone = "default",
  align,
  style,
  ...rest
}: TextProps) {
  const { color, type } = useTheme();

  const toneColor: Record<TextTone, string> = {
    default: color.text,
    muted: color.textMuted,
    faint: color.textFaint,
    primary: color.primaryInk,
    success: color.success,
    warning: color.warning,
    danger: color.danger,
    onPrimary: color.textOnPrimary,
  };

  return (
    <RNText
      style={[type[variant], { color: toneColor[tone] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
