import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";
import type { WeeklyPoint } from "@/lib/studentDashboard";

const DAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

function initialFor(day: string): string {
  const parsed = new Date(`${day}T00:00:00`);
  const index = parsed.getDay();
  return Number.isNaN(index) ? "?" : DAY_INITIALS[index];
}

/**
 * Activite de la semaine.
 *
 * La regularite etait mesuree en base depuis le debut sans jamais etre montree
 * a l'eleve. Une barre par jour suffit : le but est de voir un trou, pas de
 * lire une valeur exacte.
 */
export default function WeeklyBars({ data }: { data: readonly WeeklyPoint[] }) {
  const { color, space, radius } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.minutes));
  const today = data.length - 1;

  return (
    <View style={[styles.row, { gap: space.sm }]} accessibilityRole="image"
      accessibilityLabel={`Activite des ${data.length} derniers jours`}>
      {data.map((point, i) => {
        const ratio = point.minutes / max;
        const isToday = i === today;
        const active = point.minutes > 0;
        return (
          <View key={point.day || i} style={[styles.col, { gap: space.xs }]}>
            <View style={[styles.track, { backgroundColor: color.surfaceSunk, borderRadius: radius.sm }]}>
              <View
                style={[
                  styles.fill,
                  {
                    // Une barre visible meme a une minute : un fil de deux
                    // pixels dit "peu", une absence dit "rien".
                    height: active ? `${Math.max(8, ratio * 100)}%` : 0,
                    backgroundColor: isToday ? color.primary : color.primarySoft,
                    borderRadius: radius.sm,
                  },
                ]}
              />
            </View>
            <Text
              variant="overline"
              tone={isToday ? "primary" : "faint"}
              align="center"
            >
              {initialFor(point.day)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  col: { flex: 1, alignItems: "center" },
  track: { width: "100%", height: 56, justifyContent: "flex-end", overflow: "hidden" },
  fill: { width: "100%" },
});
