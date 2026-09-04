import { Link } from "react-router-dom";

import PageHero from "../components/page/PageHero";
import { SUPPORT_EMAIL } from "../config";

/**
 * A propos.
 *
 * La page tenait en deux paragraphes de generalites -- "comprendre change
 * tout", "transformer la comprehension en progres mesurables". Elle ne disait
 * ni quel probleme iSkul traite, ni comment, ni qui le fait. Trois questions
 * auxquelles une page "a propos" existe precisement pour repondre.
 */
export default function AboutPage() {
  return (
    <div className="page container">
      <PageHero
        eyebrow="À propos"
        title="Réciter n'est pas comprendre."
        lead="Un élève qui apprend sa leçon par cœur dans une langue qu'il maîtrise mal peut avoir la moyenne et ne rien savoir. iSkul s'attaque à cet écart-là."
      />

      <section className="section" aria-labelledby="probleme">
        <h2 id="probleme" data-reveal="up">
          Le problème qu'on traite
        </h2>
        <p data-reveal="up">
          Au Bénin, l'enseignement se fait en français. Beaucoup d'élèves parlent fon, adja, yoruba
          ou dendi à la maison, et découvrent une notion et la langue qui l'explique en même temps.
          Quand la notion résiste, impossible de savoir si c'est le raisonnement ou le vocabulaire
          qui bloque — alors on apprend par cœur, et on oublie après le devoir.
        </p>
        <p data-reveal="up">
          Ce n'est pas un problème de motivation ni de moyens. C'est un problème de langue
          d'explication, et il se règle en expliquant dans la langue où l'élève pense.
        </p>
      </section>

      <section className="section" aria-labelledby="reponse">
        <h2 id="reponse" data-reveal="up">
          Ce qu'on fait concrètement
        </h2>
        <div className="grid grid--two" data-stagger="110">
          <article className="card" data-reveal="up">
            <h3>La leçon dans deux langues</h3>
            <p>
              Chaque chapitre existe en français, et peut exister en fon, adja, yoruba ou dendi.
              L'élève bascule sans quitter la leçon, au moment où il bloque.
            </p>
          </article>
          <article className="card" data-reveal="up">
            <h3>Une vérification immédiate</h3>
            <p>
              Un quiz suit chaque séquence. La correction est calculée sur nos serveurs, pour que la
              note reflète ce que l'élève a compris et non ce que l'appareil a pu deviner.
            </p>
          </article>
          <article className="card" data-reveal="up">
            <h3>Une relecture avant publication</h3>
            <p>
              Aucun cours ni document n'est visible tant qu'un relecteur ne l'a pas validé. C'est
              plus lent, et c'est la seule façon de ne pas laisser une erreur devant un élève qui
              révise son examen.
            </p>
          </article>
          <article className="card" data-reveal="up">
            <h3>Un suivi que le parent comprend</h3>
            <p>
              Le parent voit la progression et les points faibles, pas la position de son enfant
              dans un classement. Accompagner n'est pas surveiller.
            </p>
          </article>
        </div>
      </section>

      <section className="section" aria-labelledby="qui">
        <h2 id="qui" data-reveal="up">
          Qui construit iSkul
        </h2>
        <p data-reveal="up">
          iSkul est développé par VERIION, au Bénin. Les cours et les documents viennent de
          professeurs du secondaire qui enseignent le programme béninois et corrigent les mêmes
          copies toute l'année.
        </p>
        <p data-reveal="up">
          La plateforme n'est pas terminée : les langues locales couvrent une partie des chapitres,
          pas encore tous, et la bibliothèque s'enrichit épreuve après épreuve. Nous préférons le
          dire plutôt que de le laisser découvrir.
        </p>
        <div className="row" data-reveal="up">
          <Link className="btn primary" to="/inscription-professeur">
            Enseigner sur iSkul
          </Link>
          <a className="btn ghost" href={`mailto:${SUPPORT_EMAIL}`}>
            Nous écrire
          </a>
        </div>
      </section>
    </div>
  );
}
