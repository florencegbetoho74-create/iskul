import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";

import { useTheme } from "@/theme/ThemeProvider";
import Text from "@/components/ui/Text";
import { fmtTime } from "@/utils/time";

export type PlayerControlsProps = {
  visible: boolean;
  playing: boolean;
  muted: boolean;
  rate: number;
  currentSec: number;
  durationSec: number;
  onTogglePlay: () => void;
  onSeek: (sec: number) => void;
  onSeekStart: () => void;
  onSeekEnd: (sec: number) => void;
  onBack: () => void;
  onForward: () => void;
  onToggleMute: () => void;
  onCycleRate: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
};

/**
 * Commandes du lecteur.
 *
 * Sorties de l'ecran pour que la scene video ne soit plus un bloc de 200
 * lignes ou logique de lecture et mise en page se melangent.
 */
export default function PlayerControls({
  visible,
  playing,
  muted,
  rate,
  currentSec,
  durationSec,
  onTogglePlay,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onBack,
  onForward,
  onToggleMute,
  onCycleRate,
  onFullscreen,
  isFullscreen,
}: PlayerControlsProps) {
  const { color, space, radius } = useTheme();
  const max = Math.max(1, durationSec || currentSec + 1);

  if (!visible) return null;

  return (
    <View style={[styles.root, { padding: space.md, gap: space.xs }]} pointerEvents="box-none">
      <View style={[styles.seekRow, { gap: space.sm }]}>
        <Text variant="caption" style={{ color: color.onMedia }}>
          {fmtTime(currentSec)}
        </Text>
        <Slider
          style={styles.slider}
          value={currentSec}
          minimumValue={0}
          maximumValue={max}
          onSlidingStart={onSeekStart}
          onSlidingComplete={onSeekEnd}
          onValueChange={onSeek}
          minimumTrackTintColor={color.onMedia}
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          thumbTintColor={color.onMedia}
          accessibilityLabel="Position dans la video"
        />
        <Text variant="caption" style={{ color: color.onMedia }}>
          {fmtTime(durationSec || currentSec)}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.group, { gap: space.xs }]}>
          <Ctrl icon="play-back" label="Reculer de 10 secondes" onPress={onBack} />
          <Ctrl
            icon={playing ? "pause" : "play"}
            label={playing ? "Mettre en pause" : "Lire"}
            onPress={onTogglePlay}
            primary
          />
          <Ctrl icon="play-forward" label="Avancer de 10 secondes" onPress={onForward} />
        </View>

        <View style={[styles.group, { gap: space.xs }]}>
          <Ctrl
            icon={muted ? "volume-mute" : "volume-high"}
            label={muted ? "Retablir le son" : "Couper le son"}
            onPress={onToggleMute}
          />
          <Pressable
            onPress={onCycleRate}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Vitesse de lecture ${rate}x`}
            style={[
              styles.rate,
              { borderRadius: radius.pill, paddingHorizontal: space.sm },
            ]}
          >
            <Text variant="captionStrong" style={{ color: color.onMedia }}>
              {rate}x
            </Text>
          </Pressable>
          <Ctrl
            icon={isFullscreen ? "contract" : "expand"}
            label={isFullscreen ? "Quitter le plein ecran" : "Plein ecran"}
            onPress={onFullscreen}
          />
        </View>
      </View>
    </View>
  );
}

function Ctrl({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { color, hit } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.ctrl,
        {
          width: primary ? hit.min : hit.compact,
          height: primary ? hit.min : hit.compact,
          borderRadius: 999,
          backgroundColor: primary ? "rgba(255,255,255,0.18)" : "transparent",
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={icon} size={primary ? 22 : 18} color={color.onMedia} />
    </Pressable>
  );
}

/**
 * Barre de progression permanente, affichee quand les commandes sont masquees.
 * Sans elle, l'eleve perd tout repere des que l'habillage disparait.
 */
export function PlayerProgressBar({
  currentSec,
  durationSec,
}: {
  currentSec: number;
  durationSec: number;
}) {
  const { color } = useTheme();
  const ratio = durationSec > 0 ? Math.max(0, Math.min(1, currentSec / durationSec)) : 0;
  return (
    <View
      style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.22)" }]}
      accessibilityElementsHidden
    >
      <View
        style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: color.primary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", left: 0, right: 0, bottom: 0 },
  seekRow: { flexDirection: "row", alignItems: "center" },
  slider: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  group: { flexDirection: "row", alignItems: "center" },
  ctrl: { alignItems: "center", justifyContent: "center" },
  rate: { height: 32, alignItems: "center", justifyContent: "center" },
  progressTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },
  progressFill: { height: 3 },
});
