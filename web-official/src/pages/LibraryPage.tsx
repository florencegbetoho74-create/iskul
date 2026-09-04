import { Link } from "react-router-dom";

import PageHero from "../components/page/PageHero";

/**
 * Bibliotheque.
 *
 * "Documents pedagogiques" ne dit rien : chacun imagine autre chose. La page
 * enonce les types reels de la bibliotheque, ceux du modele de donnees, parce
 * qu'un eleve qui cherche une epreuve du BEPC 2023 veut savoir s'il la
 * trouvera, pas qu'il existe des ressources.
 */
const DOCUMENT_TYPES = [
  {
    label: "Épreuves",
    text: "Les sujets tombés aux examens nationaux et aux compositions, classés par établissement, par année et par session.",
  },
  {
    label: "Corrigés",
    text: "Rattachés à leur épreuve : on passe du sujet à sa correction sans quitter la page.",
  },
  {
    label: "Devoirs surveillés",
    text: "Les compositions de l'année, celles qui ressemblent le plus à ce qui tombera.",
  },
  {
    label: "Œuvres au programme",
    text: "Les textes littéraires étudiés en classe, disponibles en entier.",
  },
  {
    label: "Résumés de cours",
    text: "Le chapitre ramené à ce qu'il faut en retenir, pour une révision de dernière minute.",
  },
  {
    label: "Fiches de révision",
    text: "Formules, dates, définitions : ce qui se relit la veille au soir.",
  },
  {
    label: "Manuels",
    text: "Les ouvrages de référence utilisés dans les établissements.",
  },
  {
    label: "Exercices",
    text: "De l'entraînement supplémentaire quand le quiz du chapitre ne suffit plus.",
  },
];

export default function LibraryPage() {
  return (
    <div className="page container">
      <PageHero
        eyebrow="Bibliothèque"
        title="Les épreuves qu'on cherche la veille."
        lead="Une épreuve du BEPC ne se révise pas comme une œuvre au programme. La bibliothèque iSkul les range séparément, avec l'établissement, l'année et la session — parce que c'est comme ça qu'on les cherche."
        actions={
          <Link className="btn primary" to="/cours">
            Voir les cours associés
          </Link>
        }
      />

      <section className="section" aria-labelledby="types">
        <h2 id="types" data-reveal="up">
          Ce qu'on y trouve
        </h2>
        <div className="grid" data-stagger="70">
          {DOCUMENT_TYPES.map((type) => (
            <article key={type.label} className="card" data-reveal="up">
              <h3>{type.label}</h3>
              <p>{type.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="reference">
        <h2 id="reference" data-reveal="up">
          Chaque document porte sa provenance
        </h2>
        <p data-reveal="up">
          Une épreuve sans établissement ni année ne vaut rien pour qui révise : impossible de
          savoir si elle correspond au programme actuel, ni au niveau attendu. Chaque document de la
          bibliothèque porte donc sa fiche de référence — l'établissement qui l'a fait passer, sa
          ville, l'année scolaire, la session, et la série pour le lycée.
        </p>
        <p data-reveal="up">
          Ces informations sont relues par un humain avant publication. Un algorithme peut se
          tromper d'année ; sur un sujet d'examen, l'erreur coûte une révision entière.
        </p>
      </section>

      <section className="section" aria-labelledby="lecture">
        <h2 id="lecture" data-reveal="up">
          Lisible sur le téléphone qu'on a
        </h2>
        <p data-reveal="up">
          Un PDF est une mise en page conçue pour une feuille A4. Sur un écran de téléphone, il
          demande de zoomer, de déplacer, de rezoomer à chaque paragraphe — et il ne se cherche pas.
        </p>
        <p data-reveal="up">
          Les documents iSkul sont convertis en texte structuré : le contenu se remet à la largeur
          de l'écran, les exercices et les questions gardent leur numérotation imprimée, et un
          sommaire mène directement à l'exercice 3.
        </p>
      </section>
    </div>
  );
}
