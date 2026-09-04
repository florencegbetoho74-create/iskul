export default function CoursesPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Cours &amp; Quiz</span>
        <h1>Comprendre avant de mémoriser, du collège à la terminale</h1>
        <p>
          Chaque cours iSkul suit la même logique : une vidéo explicative par chapitre, un quiz de compréhension par
          séquence, puis des statistiques de progression — alignés sur le programme béninois.
        </p>
      </header>

      <section className="section" data-reveal="up">
        <h2>Ce que contient un cours iSkul</h2>
        <div className="three-cols">
          <article className="content-card">
            <h3>Vidéo par chapitre</h3>
            <p>Une explication claire et structurée, en français et en langues locales (Fon, Yoruba, Dendi…).</p>
          </article>

          <article className="content-card">
            <h3>Quiz par séquence</h3>
            <p>Des questions ciblées pour tester la compréhension immédiatement, séquence après séquence.</p>
          </article>

          <article className="content-card">
            <h3>Statistiques personnelles</h3>
            <p>Le suivi des scores, de la progression par matière et par chapitre, pour savoir quoi réviser.</p>
          </article>
        </div>
      </section>

      <section className="section" data-reveal="up">
        <h2>Niveaux et examens couverts</h2>
        <div className="three-cols">
          <article className="content-card">
            <h3>Collège · 6ᵉ → 3ᵉ</h3>
            <p>Les fondamentaux par classe et par matière, pour bâtir des bases solides jusqu'au BEPC.</p>
          </article>

          <article className="content-card">
            <h3>Lycée · 2ⁿᵈᵉ → Tˡᵉ</h3>
            <p>Approfondissement, méthodologie et préparation progressive au baccalauréat.</p>
          </article>

          <article className="content-card">
            <h3>Examens · BEPC &amp; BAC</h3>
            <p>Révisions ciblées, annales et quiz d'entraînement pour aborder les examens en confiance.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
