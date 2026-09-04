import { Link } from "react-router-dom";

import PageHero from "../components/page/PageHero";
import { LEVELS, SUBJECTS } from "../content/site";

/**
 * Cours et quiz.
 *
 * La question que se pose le visiteur n'est pas "qu'est-ce qu'un cours en
 * ligne" -- il le sait. Elle est : est-ce que ma classe et ma matiere y sont,
 * et a quoi ressemble une lecon. La page repond a ces deux questions avant
 * toute autre chose.
 */
export default function CoursesPage() {
  return (
    <div className="page container">
      <PageHero
        eyebrow="Cours & quiz"
        title="Comprendre avant de mémoriser."
        lead="Un chapitre, une vidéo, un quiz. iSkul suit le programme béninois du collège à la terminale, et explique en français comme en langues locales quand le français devient l'obstacle."
        actions={
          <>
            <Link className="btn primary" to="/bibliotheque">
              Voir la bibliothèque
            </Link>
            <Link className="btn ghost" to="/open-classroom">
              Assister à une séance live
            </Link>
          </>
        }
      />

      <section className="section" aria-labelledby="deroule">
        <h2 id="deroule" data-reveal="up">
          Ce qui se passe quand un élève ouvre un chapitre
        </h2>
        <ol className="walkthrough" data-stagger="110">
          <li data-reveal="up">
            <span className="walkthrough-step">1</span>
            <div>
              <h3>Il regarde l'explication</h3>
              <p>
                Une vidéo par chapitre, pas par matière. Si le français est l'obstacle, il bascule
                sur la version fon, adja, yoruba ou dendi sans quitter la leçon.
              </p>
            </div>
          </li>
          <li data-reveal="up">
            <span className="walkthrough-step">2</span>
            <div>
              <h3>Il prend ses notes au moment utile</h3>
              <p>
                Une note se rattache à l'instant de la vidéo où elle a été écrite. En relisant, il
                retombe sur le passage exact plutôt que sur le chapitre entier.
              </p>
            </div>
          </li>
          <li data-reveal="up">
            <span className="walkthrough-step">3</span>
            <div>
              <h3>Il répond au quiz</h3>
              <p>
                Les questions portent sur ce qu'il vient de voir. La correction est calculée sur nos
                serveurs : les bonnes réponses ne sont jamais envoyées à l'appareil avant la fin.
              </p>
            </div>
          </li>
          <li data-reveal="up">
            <span className="walkthrough-step">4</span>
            <div>
              <h3>Il voit ce qui reste à revoir</h3>
              <p>
                Le suivi ne récompense pas la régularité pour elle-même : il désigne les chapitres
                où les réponses tombent à côté, matière par matière.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="section" aria-labelledby="couverture">
        <h2 id="couverture" data-reveal="up">
          Ce qui est couvert
        </h2>
        <p className="lead" data-reveal="up">
          Tout le secondaire, organisé par classe et par matière comme au tableau — pas par thème
          générique.
        </p>

        <div className="grid grid--two" data-stagger="120">
          <article className="card" data-reveal="up">
            <h3>Collège</h3>
            <p className="muted">De la 6ᵉ à la 3ᵉ, jusqu'au BEPC.</p>
            <ul className="tag-list">
              {LEVELS.slice(0, 4).map((level) => (
                <li key={level} className="badge primary">
                  {level}
                </li>
              ))}
              <li className="badge success">BEPC</li>
            </ul>
          </article>

          <article className="card" data-reveal="up">
            <h3>Lycée</h3>
            <p className="muted">De la seconde à la terminale, jusqu'au baccalauréat.</p>
            <ul className="tag-list">
              {LEVELS.slice(4).map((level) => (
                <li key={level} className="badge primary">
                  {level}
                </li>
              ))}
              <li className="badge success">BAC</li>
            </ul>
          </article>
        </div>

        <div className="card card--flat" data-reveal="up">
          <h3>Les matières</h3>
          <ul className="tag-list">
            {SUBJECTS.map((subject) => (
              <li key={subject} className="badge">
                {subject}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="qualite">
        <h2 id="qualite" data-reveal="up">
          Pourquoi un cours n'apparaît pas le jour où il est écrit
        </h2>
        <p data-reveal="up">
          N'importe quel professeur inscrit peut déposer un cours. Aucun n'est visible tant qu'un
          relecteur ne l'a pas validé : il vérifie que le contenu correspond à la classe annoncée,
          que les vidéos se lisent, et que le quiz porte bien sur la leçon. Un cours renvoyé
          revient à son auteur avec le motif écrit.
        </p>
        <p data-reveal="up">
          C'est plus lent qu'une publication immédiate. C'est la seule façon de garantir qu'un élève
          qui révise à trois jours du BEPC ne tombe pas sur une erreur.
        </p>
      </section>
    </div>
  );
}
