import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemedStyles } from "@/theme/useStyles";
import type { Theme } from "@/theme/ThemeProvider";
import { filterCountries, type Country } from "@/lib/referentialSupport";

type Props = {
  label: string;
  value: string;
  countries: readonly Country[];
  loading?: boolean;
  onChange: (code: string) => void;
  helperText?: string;
};

export default function CountryField({
  label,
  value,
  countries,
  loading = false,
  onChange,
  helperText,
}: Props) {
  const { styles, theme } = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => countries.find((c) => c.code === value) ?? null,
    [countries, value]
  );
  const results = useMemo(() => filterCountries(countries, query), [countries, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Ionicons name="earth-outline" size={16} color={theme.color.textMuted} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      <Pressable
        onPress={() => !loading && setOpen(true)}
        style={[styles.trigger, loading && styles.triggerDisabled]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: loading }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.color.textMuted} />
        ) : selected ? (
          <>
            <Text style={styles.flag}>{selected.flag}</Text>
            <Text style={styles.triggerText} numberOfLines={1}>
              {selected.nameFr}
            </Text>
          </>
        ) : (
          <Text style={[styles.triggerText, styles.placeholder]}>Selectionnez votre pays</Text>
        )}
        <Ionicons name="chevron-down" size={16} color={theme.color.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={close} style={styles.closeBtn} accessibilityLabel="Fermer">
                <Ionicons name="close" size={18} color={theme.color.text} />
              </Pressable>
            </View>

            <View style={styles.searchShell}>
              <Ionicons name="search-outline" size={16} color={theme.color.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Rechercher un pays"
                placeholderTextColor={theme.color.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} accessibilityLabel="Effacer">
                  <Ionicons name="close-circle" size={16} color={theme.color.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={results}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={16}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.empty}>Aucun pays ne correspond a cette recherche.</Text>
              }
              renderItem={({ item }) => {
                const active = item.code === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.code);
                      close();
                    }}
                    style={[styles.option, active && styles.optionActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text
                      style={[styles.optionText, active && styles.optionTextActive]}
                      numberOfLines={1}
                    >
                      {item.nameFr}
                    </Text>
                    {item.hasContent ? (
                      <View style={styles.contentTag}>
                        <Text style={styles.contentTagText}>Programme disponible</Text>
                      </View>
                    ) : null}
                    {active ? (
                      <Ionicons name="checkmark-circle" size={18} color={theme.color.primary} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
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
    gap: 8,
  },
  triggerDisabled: { opacity: 0.6 },
  triggerText: { color: t.color.text, fontFamily: t.type.body.fontFamily, fontSize: 14, flex: 1 },
  placeholder: { color: t.color.textMuted },
  flag: { fontSize: 18 },

  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: t.color.scrim },
  sheet: {
    backgroundColor: t.color.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: t.color.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    height: "78%",
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
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

  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceSunk,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: t.color.text,
    fontFamily: t.type.body.fontFamily,
    fontSize: 14,
    paddingVertical: 10,
  },

  listContent: { paddingBottom: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surfaceSunk,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionActive: { borderColor: t.color.primary, backgroundColor: t.color.primarySoft },
  optionText: { color: t.color.text, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 13, flex: 1 },
  optionTextActive: { color: t.color.primary },
  contentTag: {
    backgroundColor: t.color.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  contentTagText: { color: t.color.primary, fontFamily: t.type.bodyStrong.fontFamily, fontSize: 10 },
  empty: {
    color: t.color.textMuted,
    fontFamily: t.type.body.fontFamily,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },
});
