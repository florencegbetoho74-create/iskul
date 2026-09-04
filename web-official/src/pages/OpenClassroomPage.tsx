import { Link } from "react-router-dom";

import PageHero from "../components/page/PageHero";
import { OPEN_CLASSROOM_EVENTS } from "../content/site";

/**
 * Open Classroom.
 *
 * La page listait un planning sans jamais dire comment une seance se passe, ce
 * qu'il faut pour y assister, ni ce qu'il advient de celui qui la manque.
 * C'est pourtant la seule chose qui decide si l'on s'y connecte.
 */
export default function OpenClassroomPage() {
  return (
    <div className="page container">
      <PageHero
        eyebrow="Open Classroom"
        title="Poser la question qu'on n'ose pas en classe."
        lead="Une séance en direct avec un professeur, sur un point précis. On y entre pour comprendre ce qui bloque, pas pour réécouter le cours."
        actions={
          <Link className="btn primary" to="/cours">
            Voir les chapitres traités
          </Link>
        }
      />

      <section className="section" aria-labelledby="planning">
        <h2 id="planning" data-reveal="up">
          Les prochaines séances
        </h2>
        <ul className="session-list" data-stagger="90">
          {OPEN_CLASSROOM_EVENTS.map((event) => (
            <li key={`${event.day}-${event.hour}`} className="session" data-reveal="right">
              <div className="session-when">
                <strong>{event.day}</strong>
                <small>{event.hour}</small>
              </div>
              <div className="session-what">
                <h3>{event.topic}</h3>
                <p className="muted">{event.teacher}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="muted" data-reveal="up">
          Le planning complet et les séances de la semaine se consultent dans l'application.
        </p>
      </section>

      <section className="section" aria-labelledby="deroule">
        <h2 id="deroule" data-reveal="up">
          Comment une séance se passe
        </h2>
        <div className="grid grid--two" data-stagger="110">
          <article className="card" data-reveal="up">
            <h3>On entre, on écoute</h3>
            <p>
              Le professeur explique le point annoncé, souvent celui qui revient le plus dans les
              copies. Pas de tour de table, pas de présentation : on entre dans le sujet.
            </p>
          </article>
          <article className="card" data-reveal="up">
            <h3>On lève la main</h3>
            <p>
              La question s'écrit dans le fil ou se pose à voix haute quand le professeur donne la
              parole. Personne ne voit qui a demandé quoi dans la classe du lendemain.
            </p>
          </article>
          <article className="card" data-reveal="up">
            <h3>On revoit après</h3>
            <p>
              La séance reste disponible en rediffusion. Manquer un direct ne fait pas perdre le
              contenu — seulement la possibilité de poser sa question.
            </p>
          </article>
          <article className="card" data-reveal="up">
            <h3>Ce qu'il faut</h3>
            <p>
              L'application, un téléphone et une connexion qui tient. La vidéo s'ajuste au débit
              disponible ; en dernier recours, le son seul suffit à suivre.
            </p>
          </article>
        </div>
      </section>

      <section className="section" aria-labelledby="profs">
        <h2 id="profs" data-reveal="up">
          Qui anime
        </h2>
        <p data-reveal="up">
          Des professeurs du secondaire, qui enseignent le programme béninois et corrigent les
          mêmes copies toute l'année. Un compte enseignant ne suffit pas à ouvrir une séance
          publique : le contenu passe par la même relecture que les cours.
        </p>
        <div className="row" data-reveal="up">
          <Link className="btn ghost" to="/inscription-professeur">
            Enseigner sur iSkul
          </Link>
        </div>
      </section>
    </div>
  );
}
