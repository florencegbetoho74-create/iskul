import { AppleIcon, GooglePlayIcon } from "../../components/brand/StoreIcons";
import { ANDROID_URL, IS_APP_LIVE } from "../../config";

/** ---------------------------
 *  Store Badges (Google Play / App Store)
 *  --------------------------*/
export default function StoreButton({
  platform,
}: {
  platform: "android" | "ios";
  /** Conservé pour compatibilité d'appel, l'apparence est désormais celle d'un badge store. */
  variant?: "primary" | "secondary";
}) {
  if (platform === "ios") {
    return (
      <span className="store-badge ios soon" aria-disabled="true">
        <AppleIcon />
        <span className="store-badge-text">
          <small>Bientôt sur</small>
          <strong>App Store</strong>
        </span>
        <span className="store-badge-tag">Bientôt</span>
      </span>
    );
  }

  if (!IS_APP_LIVE) {
    return (
      <span className="store-badge android soon" aria-disabled="true">
        <GooglePlayIcon />
        <span className="store-badge-text">
          <small>Bientôt sur</small>
          <strong>Google Play</strong>
        </span>
        <span className="store-badge-tag">Bientôt</span>
      </span>
    );
  }

  return (
    <a className="store-badge android" href={ANDROID_URL} target="_blank" rel="noreferrer">
      <GooglePlayIcon />
      <span className="store-badge-text">
        <small>Disponible sur</small>
        <strong>Google Play</strong>
      </span>
    </a>
  );
}


/** ---------------------------
 *  Header / Footer
 *  --------------------------*/
