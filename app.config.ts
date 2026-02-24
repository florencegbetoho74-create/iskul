// app.config.ts
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "iSkul",
  slug: "iskul",
  scheme: "iskul",
  version: "1.0.1",
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: "./assets/logo.png",

  // Splash: logo only, dark background
  splash: {
    image: "./assets/logo.png",
    resizeMode: "contain",
    backgroundColor: "#0B0B0C"
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.iskul.app",
    buildNumber: "2",
    infoPlist: {
      NSCameraUsageDescription: "Camera access is required for live classes.",
      NSMicrophoneUsageDescription: "Microphone access is required for live classes."
    }
  },

  android: {
    package: "com.iskul.app",
    versionCode: 2,
    // Fix Android 12+ system splash white screen
    backgroundColor: "#0B0B0C",
    adaptiveIcon: {
      backgroundColor: "#0B0B0C"
    },
    softwareKeyboardLayoutMode: "resize",
    permissions: ["CAMERA", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"]
  },

  web: { bundler: "metro" },
  plugins: [
    "expo-router",
    ["expo-build-properties", { android: { minSdkVersion: 28 } }]
  ],

  extra: {
    eas: {
      projectId: "1d550987-5f68-4317-9fcf-4f344738e1b8"
    }
  }
});
