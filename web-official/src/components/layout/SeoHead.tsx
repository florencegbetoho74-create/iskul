import { useLocation } from "react-router-dom";
import { useRouteSeo } from "../../seo";

export default function SeoHead() {
  const { pathname } = useLocation();
  useRouteSeo(pathname);
  return null;
}

/** ---------------------------
 *  Icons (inline SVG, cohérents)
 *  --------------------------*/
