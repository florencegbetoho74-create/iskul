// app.config.ts
import type { ExpoConfig } from "@expo/config-types";

export default {
  name: "iSkul",
  slug: "iskul",
  scheme: "iskul",
  owner: "fredyr53",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#0B0B0C" },

  ios: { supportsTablet: true, bundleIdentifier: "com.iskul.app", buildNumber: "1" },

  android: {
    package: "com.iskul.app",
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#0B0B0C" },
    softwareKeyboardLayoutMode: "resize"
  },

  web: { bundler: "metro" },
  plugins: ["expo-router"],

  extra: { eas: { projectId: "1d550987-5f68-4317-9fcf-4f344738e1b8" } }
} satisfies ExpoConfig;
