import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/**
 * Bloc de chargement.
 *
 * Preferable au tourniquet : il montre la forme de ce qui arrive, donc l'ecran
 * ne se reorganise pas sous les yeux au moment ou les donnees tombent.
 */
export default function Skeleton({ width = "100%", height = 14, radius, style }: SkeletonProps) {
  const { color, radius: radii } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? radii.sm,
          backgroundColor: color.surfaceSunk,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
        style,
      ]}
    />
  );
}

/** Silhouette d'une carte de contenu, reprenant ses proportions reelles. */
export function SkeletonCard() {
  const { color, radius, space } = useTheme();
  const { width } = useWindowDimensions();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: color.surface,
          borderColor: color.border,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.sm,
        },
      ]}
    >
      <Skeleton width={Math.min(width * 0.55, 220)} height={16} />
      <Skeleton width={Math.min(width * 0.35, 140)} height={12} />
      <Skeleton height={10} style={{ marginTop: space.xs }} />
    </View>
  );
}

/** Plusieurs silhouettes, pour une liste en cours de chargement. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      {Array.from({ length: Math.max(1, count) }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth * 2 },
});
