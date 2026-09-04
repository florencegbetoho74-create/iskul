/** Reglages d'environnement du site. */

/** ---------------------------
 *  CONFIG / ENV
 *  --------------------------*/
export type AppReleaseStatus = "coming_soon" | "live";

export const APP_RELEASE_STATUS: AppReleaseStatus =
  (import.meta.env.VITE_APP_RELEASE_STATUS || "live") === "live" ? "live" : "coming_soon";

export const IS_APP_LIVE = APP_RELEASE_STATUS === "live";

export const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.iskul.app";

export const IOS_URL = (import.meta.env.VITE_IOS_URL || "").trim();

export const BLOG_URL = (import.meta.env.VITE_BLOG_URL || "").trim();

export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || "contact@veriion.com").trim();

/** ---------------------------
 *  NAVIGATION
 *  --------------------------*/
