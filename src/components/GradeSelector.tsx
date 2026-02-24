import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLOR, FONT } from "@/theme/colors";
import { GRADE_LEVELS, type GradeLevel } from "@/constants/gradeLevels";

type Props = {
  value: string;
  onChange: (level: GradeLevel) => void;
  levels?: readonly GradeLevel[];
};

export default function GradeSelector({ value, onChange, levels = GRADE_LEVELS }: Props) {
  return (
    <View style={styles.grid}>
      {levels.map((lvl) => {
        const active = value === lvl;
        return (
          <Pressable
            key={lvl}
            onPress={() => onChange(lvl)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Classe ${lvl}`}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{lvl}</Text>
            {active ? <Ionicons name="checkmark-circle" size={14} color="#fff" style={{ marginLeft: 6 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.surface,
    flexDirection: "row",
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: COLOR.primary,
    borderColor: COLOR.primary,
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  chipText: { color: COLOR.text, fontFamily: FONT.bodyBold, fontSize: 12 },
  chipTextActive: { color: "#fff" },
});

