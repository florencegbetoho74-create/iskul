/** Marques des magasins d'applications, redessinees en SVG. */

import Photo from "../../components/ui/Photo";

/** ---------------------------
 *  Icons (inline SVG, cohérents)
 *  --------------------------*/
export function GooglePlayIcon() {
  return (
    <svg className="store-badge-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path fill="#00d3ff" d="M48 59.5C45.4 63.2 44 68.5 44 75.2v361.6c0 6.7 1.4 12 4 15.7l1.6 1.6 202.6-202.6v-4.8L49.6 57.9 48 59.5z" />
      <path fill="#ffce00" d="M319.3 324.8 251.7 257v-4.8l67.6-67.6 1.5.9 80 45.5c22.9 13 22.9 34.3 0 47.3l-80 45.5-1.5.7z" />
      <path fill="#ff3d47" d="M320.8 324.1 251.7 255 48 458.5c7.5 8 20 9 34 1l238.8-135.4" />
      <path fill="#00f076" d="M320.8 185.9 82 50.5c-14-8-26.5-7-34 1l203.7 203.5 69.1-69.1z" />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg className="store-badge-icon" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  );
}

/** Photo avec traitement duotone de marque + repli propre si l'image échoue. */
