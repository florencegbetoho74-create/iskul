import { Link, NavLink } from "react-router-dom";

import iskulLogo from "../../assets/iskul-logo.png";
import { BLOG_URL, SUPPORT_EMAIL } from "../../config";
import StoreButton from "../brand/StoreButton";

/**
 * Pied de page.
 *
 * Les mentions legales ne sont pas du contenu : elles se consultent une fois,
 * sur demande, et n'ont pas a occuper une colonne a cote des cours. Elles
 * descendent dans la barre du bas, avec la mention de copyright.
 *
 * Les colonnes reprennent le decoupage de l'en-tete -- ce qui se lit, les
 * espaces, l'aide. Un pied de page qui range autrement que la navigation
 * oblige a reapprendre le site en bas de chaque page.
 */
export default function SiteFooter() {
  return (
    <footer className="shell-footer">
      <div className="container shell-footer-grid">
        <div className="shell-footer-brand">
          <NavLink className="shell-footer-mark" to="/" aria-label="iSkul, accueil">
            <img src={iskulLogo} alt="" width={36} height={36} />
            <span>iSkul</span>
          </NavLink>
          <p>
            La plateforme scolaire des élèves du secondaire au Bénin : chaque chapitre expliqué en
            vidéo, en français et en langues locales, puis vérifié par un quiz.
          </p>
          <div className="shell-footer-stores">
            <StoreButton platform="android" variant="primary" />
            <StoreButton platform="ios" variant="secondary" />
          </div>
        </div>

        <nav className="shell-footer-col" aria-label="La plateforme">
          <h2>La plateforme</h2>
          <Link to="/cours">Cours &amp; quiz</Link>
          <Link to="/bibliotheque">Bibliothèque</Link>
          <Link to="/open-classroom">Open Classroom</Link>
          <Link to="/a-propos">À propos</Link>
        </nav>

        <nav className="shell-footer-col" aria-label="Les espaces">
          <h2>Les espaces</h2>
          <Link to="/parents">Espace parents</Link>
          <Link to="/espace-professeur">Espace professeur</Link>
          <Link to="/inscription-professeur">Enseigner sur iSkul</Link>
        </nav>

        <nav className="shell-footer-col" aria-label="Aide">
          <h2>Aide</h2>
          <Link to="/faq">Questions fréquentes</Link>
          <Link to="/contact">Nous écrire</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          {BLOG_URL ? (
            <a href={BLOG_URL} target="_blank" rel="noreferrer">
              Blog
            </a>
          ) : null}
        </nav>
      </div>

      <div className="container shell-footer-bottom">
        <p>iSkul © {new Date().getFullYear()} — Fait au Bénin, pour les élèves du secondaire.</p>
        <nav aria-label="Mentions légales">
          <Link to="/politique-confidentialite">Confidentialité</Link>
          <Link to="/mentions-legales">Mentions légales</Link>
          <Link to="/delete-account">Supprimer mon compte</Link>
        </nav>
      </div>
    </footer>
  );
}
