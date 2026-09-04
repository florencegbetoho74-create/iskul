import { Link, NavLink } from "react-router-dom";
import iskulLogo from "../../assets/iskul-logo.png";
import StoreButton from "../../components/brand/StoreButton";
import { BLOG_URL } from "../../config";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <NavLink className="footer-brand-row" to="/">
            <img src={iskulLogo} alt="Logo iSkul" className="footer-logo" />
            <span className="footer-title">iSkul</span>
          </NavLink>
          <p>
            La plateforme scolaire des élèves du secondaire au Bénin : vidéos par chapitre, quiz de compréhension,
            suivi de progression, Open Classroom en direct et bibliothèque pédagogique.
          </p>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Navigation</span>
          <div className="footer-links">
            <Link to="/cours">Cours &amp; Quiz</Link>
            <Link to="/bibliotheque">Bibliothèque</Link>
            <Link to="/open-classroom">Open Classroom</Link>
            <Link to="/parents">Espace parents</Link>
            <Link to="/inscription-professeur">Devenir professeur</Link>
          </div>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Ressources</span>
          <div className="footer-links">
            <Link to="/contact">Contact</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/politique-confidentialite">Politique de confidentialité</Link>
            <Link to="/delete-account">Suppression de compte</Link>
            <Link to="/mentions-legales">Mentions légales</Link>
            {BLOG_URL ? (
              <a href={BLOG_URL} target="_blank" rel="noreferrer">
                Blog
              </a>
            ) : null}
          </div>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Application</span>
          <div className="footer-download">
            <StoreButton platform="android" variant="primary" />
            <StoreButton platform="ios" variant="secondary" />
          </div>
          <p className="footer-app-note">iSkul est disponible sur Google Play. Version iOS bientôt disponible.</p>
        </div>
      </div>
      <p className="footer-copy">iSkul © 2026 — Fait au Bénin, pour les élèves du secondaire.</p>
    </footer>
  );
}

/** ---------------------------
 *  Pages
 *  --------------------------*/
