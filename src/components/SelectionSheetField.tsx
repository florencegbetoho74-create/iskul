import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";

type Props = {
  label: string;
  value: string;
  placeholder: string;
  options: readonly string[];
  onChange: (value: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  helperText?: string;
  warningText?: string;
};

export default function SelectionSheetField({
  label,
  value,
  placeholder,
  options,
  onChange,
  icon = "chevron-down",
  helperText,
  warningText,
}: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={16} color={theme.color.textMuted} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      {warningText ? <Text style={styles.warning}>{warningText}</Text> : null}

      <Pressable onPress={() => setOpen(true)} style={styles.trigger} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={theme.color.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={theme.color.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {options.map((opt) => {
                const active = value === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    style={[styles.option, active && styles.optionActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={18} color={theme.color.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  wrap: { marginTop: 10 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  label: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12 },
  helper: { color: t.color.textMuted, fontFamily: t.type.body.fontFamily, fontSize: 12, marginBottom: 8 },
  warning: { color: t.color.warning, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 12, marginBottom: 8 },
  trigger: {
    backgroundColor: t.color.surfaceSunk,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  triggerText: { color: t.color.text, fontFamily: t.type.body.fontFamily, fontSize: 14, flex: 1 },
  triggerPlaceholder: { color: t.color.textMuted },

  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.4)" },
  sheet: {
    backgroundColor: t.color.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    maxHeight: "70%",
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sheetTitle: { color: t.color.text, fontFamily: t.type.heading.fontFamily, fontSize: 16 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.color.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.color.surfaceSunk,
  },
  list: { flexGrow: 0 },
  listContent: { paddingBottom: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceSunk,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionActive: { borderColor: t.color.primary, backgroundColor: t.color.primarySoft },
  optionText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 13 },
  optionTextActive: { color: t.color.primary },
});
