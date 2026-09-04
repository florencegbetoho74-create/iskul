export default function AboutPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">À propos</span>
        <h1>Pourquoi iSkul existe</h1>
        <p>
          Notre mission : rendre la compréhension scolaire accessible aux élèves du secondaire au Bénin, en respectant
          leur langue, leur culture et leur rythme d'apprentissage.
        </p>
      </header>

      <section className="panel" data-reveal="up">
        <h2>Comprendre change tout</h2>
        <p>
          Quand un élève comprend vraiment, il reprend confiance. iSkul combine technologie et pédagogie pour
          transformer la compréhension en progrès mesurables — du collège jusqu'au baccalauréat.
        </p>
      </section>
    </div>
  );
}

/** ---------------------------
 *  Contact (email invisible)
 *  - Necessite une Edge Function: "contact-message"
 *  --------------------------*/
