export default function LibraryPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Bibliothèque</span>
        <h1>Documents pédagogiques, livres et ressources utiles</h1>
        <p>
          Une bibliothèque pour lire, réviser et approfondir : supports scolaires, documents pédagogiques et ouvrages de
          référence, adaptés aux élèves du secondaire au Bénin.
        </p>
      </header>

      <div className="three-cols">
        <article className="content-card">
          <h3>Documents pédagogiques</h3>
          <p>Fiches, supports de cours, exercices et documents structurés par matière et par niveau.</p>
        </article>
        <article className="content-card">
          <h3>Livres &amp; lecture</h3>
          <p>Des ouvrages utiles pour la culture générale, la lecture et la consolidation des acquis.</p>
        </article>
        <article className="content-card">
          <h3>Ressources à jour</h3>
          <p>Une amélioration continue des contenus pour rester aligné sur le programme et les besoins du terrain.</p>
        </article>
      </div>
    </div>
  );
}
