import { OPEN_CLASSROOM_EVENTS } from "../content/site";

export default function OpenClassroomPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Open Classroom · en direct</span>
        <h1>Le planning live pour apprendre en direct</h1>
        <p>
          Des sessions interactives : explications, questions-réponses, méthodologie et entraînements, animées par
          l'équipe iSkul.
        </p>
      </header>

      <div className="grid-cards">
        {OPEN_CLASSROOM_EVENTS.map((event) => (
          <article key={`${event.day}-${event.hour}`} className="content-card">
            <h3>
              {event.day} · {event.hour}
            </h3>
            <p>{event.topic}</p>
            <p className="muted">{event.teacher}</p>
          </article>
        ))}
      </div>

      <section className="panel archive-panel" data-reveal="up">
        <h2>Archives (replays)</h2>
        <p>
          Les replays restent disponibles pour revoir les points difficiles, avancer à son rythme et consolider chaque
          chapitre avant le BEPC ou le BAC.
        </p>
      </section>
    </div>
  );
}
