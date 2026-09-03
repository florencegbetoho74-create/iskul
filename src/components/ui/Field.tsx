import React, { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";

export type FieldProps = TextInputProps & {
  label: string;
  /** Explique quoi saisir, avant toute erreur. */
  hint?: string;
  /** Ce qui ne va pas et comment le corriger. */
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  required?: boolean;
};

/**
 * Champ de saisie.
 *
 * La ref est transmise a l'entree elle-meme : un formulaire enchaine ses champs
 * au clavier plutot que d'obliger a viser le suivant.
 */
const Field = React.forwardRef<TextInput, FieldProps>(function FieldBase(
  { label, hint, error, icon, required, style, onFocus, onBlur, ...rest },
  ref
) {
  const { color, radius, space, hit, type } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? color.danger : focused ? color.primary : color.borderInteractive;

  return (
    <View style={{ gap: space.xs }}>
      <Text variant="captionStrong">
        {label}
        {required ? <Text variant="captionStrong" tone="danger"> *</Text> : null}
      </Text>

      {hint && !error ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}

      <View
        style={[
          styles.shell,
          {
            borderColor,
            // Le focus epaissit le trait : la seule couleur ne suffit pas a
            // signaler l'etat a qui la percoit mal.
            borderWidth: focused || error ? 2 : 1,
            borderRadius: radius.md,
            backgroundColor: color.surfaceSunk,
            minHeight: hit.min,
            paddingHorizontal: space.md,
            gap: space.sm,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={17} color={color.textMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={color.textFaint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          style={[styles.input, type.body, { color: color.text }, style]}
          {...rest}
        />
      </View>

      {error ? (
        <View style={[styles.errorRow, { gap: space.xs }]}>
          <Ionicons name="alert-circle" size={13} color={color.danger} />
          <Text variant="caption" tone="danger" style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

export default Field;

const styles = StyleSheet.create({
  shell: { flexDirection: "row", alignItems: "center" },
  input: { flex: 1, paddingVertical: 10 },
  errorRow: { flexDirection: "row", alignItems: "flex-start" },
  errorText: { flex: 1 },
});
