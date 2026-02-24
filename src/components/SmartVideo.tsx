import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import YouTubePlayer, { YTHandle } from "./YouTubePlayer";
import { isYouTubeUrl, getYouTubeId } from "@/utils/youtube";

export type SmartVideoHandle = {
  play: () => void;
  pause: () => void;
  seekTo: (sec: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
};

type Props = {
  url: string;
  onProgress?: (sec: number, dur?: number) => void;
};

const SmartVideo = React.forwardRef<SmartVideoHandle, Props>(({ url, onProgress }, ref) => {
  const isYT = useMemo(() => isYouTubeUrl(url), [url]);
  const ytId = useMemo(() => (isYT ? (getYouTubeId(url || "") || "") : ""), [isYT, url]);

  // expo-video player (toujours initialisé, source injectée si non-YouTube)
  const player = useVideoPlayer("", (p) => { p.loop = false; p.timeUpdateEventInterval = 1; });

  // injecte la source fichier quand url change (non-YouTube)
  useEffect(() => {
    if (isYT || !url) return;
    let active = true;
    (async () => {
      try {
        if (typeof (player as any).replaceAsync === "function") {
          await (player as any).replaceAsync(url);
        } else {
          player.replace(url);
        }
      } catch {
        // ignore replace failures
      } finally {
        if (!active) return;
      }
    })();
    return () => {
      active = false;
    };
  }, [isYT, url]);

  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  // Progress pour les fichiers via polling léger
  useEffect(() => {
    if (isYT) return;
    const t = setInterval(() => {
      const c = Math.floor(player.currentTime ?? 0);
      const d = (player as any).duration ? Math.floor((player as any).duration) : 0;
      setCur(c); if (d) setDur(d);
      onProgress?.(c, d || undefined);
    }, 1000);
    return () => clearInterval(t);
  }, [isYT, url]);

  // YouTube ref
  const ytRef = useRef<YTHandle>(null);

  useImperativeHandle(ref, () => ({
    play() {
      if (isYT) ytRef.current?.play();
      else player.play();
    },
    pause() {
      if (isYT) ytRef.current?.pause();
      else player.pause();
    },
    seekTo(sec: number) {
      if (isYT) ytRef.current?.seekTo(sec);
      else (player as any).currentTime = sec;
      setCur(sec);
    },
    getCurrentTime() { return cur; },
    getDuration() { return dur; }
  }), [isYT, cur, dur]);

  return (
    <View style={styles.wrap}>
      {isYT ? (
        <YouTubePlayer
          ref={ytRef}
          videoId={ytId}
          onProgress={(s, d) => { if (Number.isFinite(s)) setCur(Math.floor(s)); if (d) setDur(Math.floor(d)); onProgress?.(s, d); }}
        />
      ) : (
        <VideoView
          style={styles.video}
          player={player}
          nativeControls={false}
          allowsFullscreen
          allowsPictureInPicture
        />
      )}
    </View>
  );
});

export default SmartVideo;

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#000", borderRadius: 12, overflow: "hidden" },
  video: { width: "100%", aspectRatio: 16/9, backgroundColor: "#000" }
});
