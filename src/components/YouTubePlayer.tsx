import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

export type YTHandle = {
  seekTo: (sec: number) => void;
  play: () => void;
  pause: () => void;
};

type Props = {
  videoId: string;
  onProgress?: (sec: number, duration?: number) => void;
  onEnded?: () => void;
  onError?: (code?: number) => void;
};

const ORIGIN = "https://www.youtube.com";

const YouTubePlayer = React.forwardRef<YTHandle, Props>(
  ({ videoId, onProgress, onEnded, onError }, ref) => {
    const html = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
    <style>
      html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}
      .wrap{position:fixed;inset:0}
      iframe{border:0;width:100%;height:100%}
    </style>
  </head>
  <body>
    <div class="wrap">
      <iframe
        id="yt"
        src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(ORIGIN)}&autoplay=1&mute=1"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>

    <script>
      var lastT=0,dur=0,ready=false;
      var yt=document.getElementById("yt");

      function post(m){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }catch(e){} }
      function send(cmd){ if(!yt.contentWindow) return; yt.contentWindow.postMessage(JSON.stringify(cmd),"*"); }

      // API commands exposed to RN
      window.YT_BRIDGE = {
        seekTo: function(s){ send({event:"command", func:"seekTo", args:[s,true]}); },
        play:   function(){ send({event:"command", func:"playVideo", args:[]}); },
        pause:  function(){ send({event:"command", func:"pauseVideo", args:[]}); }
      };

      window.addEventListener("message", function(ev){
        try{
          var data = JSON.parse(ev.data||"{}");
          if(data && data.event==="onReady"){ ready=true; /* unmute when user interacts from RN */ }
          if(data && data.event==="onError"){ post({type:"error", code:data.info}); }
          if(data && data.event==="infoDelivery"){
            var info = data.info||{};
            if(typeof info.duration==="number"){ dur=info.duration; }
            if(typeof info.currentTime==="number"){
              var t=info.currentTime;
              if(Math.abs(t-lastT)>=0.9){ lastT=t; post({type:"progress", t:t, d:dur||0}); }
            }
            if(info.playerState===0){ post({type:"ended"}); }
          }
        }catch(_){}
      });

      // Start event flow
      function tick(){ send({event:"listening"}); }
      setInterval(tick, 1000); tick();
    </script>
  </body>
</html>`.trim();

    const onMsg = (e: WebViewMessageEvent) => {
      try {
        const m = JSON.parse(e.nativeEvent.data);
        if (m.type === "progress") onProgress?.(Number(m.t || 0), Number(m.d || 0));
        if (m.type === "ended") onEnded?.();
        if (m.type === "error") onError?.(m.code);
      } catch {}
    };

    // methods bridgées
    const injectedBridge = `
      (function(){
        window._ytCmd = function(name, arg){
          if(window.YT_BRIDGE && typeof window.YT_BRIDGE[name]==="function"){
            window.YT_BRIDGE[name](arg);
          }
        }
      })();
      true;`;

    React.useImperativeHandle(ref, () => ({
      seekTo: (sec: number) => webref?.current?.injectJavaScript(`window._ytCmd("seekTo", ${Math.max(0, Number(sec)||0)}); true;`),
      play: () => webref?.current?.injectJavaScript(`window._ytCmd("play"); true;`),
      pause: () => webref?.current?.injectJavaScript(`window._ytCmd("pause"); true;`),
    }));

    const webref = React.useRef<WebView>(null);

    return (
      <View style={styles.wrap}>
        <WebView
          ref={webref}
          originWhitelist={["*"]}
          source={{ html, baseUrl: ORIGIN }}
          onMessage={onMsg}
          injectedJavaScript={injectedBridge}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          mixedContentMode="always"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          androidLayerType="hardware"
          // Laisser passer les navigations nécessaires à YouTube
          onShouldStartLoadWithRequest={(req) => {
            const u = req?.url || "";
            // Autoriser data: et about: pour le document initial et sous-frames
            if (u.startsWith("about:") || u.startsWith("data:")) return true;
            // Autoriser les domaines YouTube/Google usuels
            if (/^https?:\/\/([a-z0-9-]+\.)*(youtube\.com|youtube-nocookie\.com|youtu\.be|google\.com|google\.[a-z.]+|gstatic\.com|ggpht\.com|ytimg\.com|googlevideo\.com|doubleclick\.net)\//i.test(u)) return true;
            // Bloquer ouvertures externes dans le WebView
            return false;
          }}
          // iOS process-kill recovery
          onContentProcessDidTerminate={() => webref.current?.reload()}
          // UA mobile crédible pour éviter des blocages côté YT
          userAgent={
            Platform.select({
              ios: undefined, // laisse Safari iOS par défaut
              android: "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
            }) as string | undefined
          }
        />
      </View>
    );
  }
);

export default YouTubePlayer;

const styles = StyleSheet.create({
  wrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
});
