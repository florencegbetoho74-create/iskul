import React, { useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

export type YTHandle = {
  seekTo: (sec: number) => void;
  play: () => void;
  pause: () => void;
};

type Props = {
  videoId: string;
  onProgress?: (sec: number, duration?: number) => void;
};

const YouTubePlayer = React.forwardRef<YTHandle, Props>(({ videoId, onProgress }, ref) => {
  let webref: WebView | null = null;

  useImperativeHandle(ref, () => ({
    seekTo(sec: number) { webref?.postMessage(JSON.stringify({ type: "seekTo", sec })); },
    play() { webref?.postMessage(JSON.stringify({ type: "play" })); },
    pause() { webref?.postMessage(JSON.stringify({ type: "pause" })); }
  }));

  const html = `
<html><body style="margin:0;background:#000;height:100vh">
<div id="player"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
  let player;
  function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
      height: '100%', width: '100%',
      videoId: '${videoId}',
      playerVars: { rel:0, modestbranding:1, playsinline:1 },
      events: { 'onReady': onReady }
    });
  }
  function onReady() {
    setInterval(function(){
      if (!player || !player.getCurrentTime) return;
      const t = player.getCurrentTime();
      const d = player.getDuration ? player.getDuration() : 0;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type:'progress', t, d }));
    }, 1000);
  }
  document.addEventListener('message', function(e){
    try {
      const m = JSON.parse(e.data);
      if (!player) return;
      if (m.type==='seekTo') player.seekTo(m.sec, true);
      if (m.type==='play') player.playVideo();
      if (m.type==='pause') player.pauseVideo();
    } catch(_){}
  });
</script>
</body></html>`;

  function onMsg(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === "progress") onProgress?.(Number(m.t||0), Number(m.d||0));
    } catch {}
  }

  return (
    <View style={styles.wrap}>
      <WebView
        ref={(r) => (webref = r)}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={onMsg}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
});

export default YouTubePlayer;

const styles = StyleSheet.create({
  wrap: { width: "100%", aspectRatio: 16/9, backgroundColor: "#000" }
});
