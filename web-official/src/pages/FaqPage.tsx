export default function FaqPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">FAQ</span>
        <h1>Questions frequentes</h1>
        <p>Voici les reponses aux questions les plus courantes sur iSkul.</p>
      </header>

      <div className="content-card">
        <h3>L'application iSkul est-elle deja disponible ?</h3>
        <p>
          Oui. iSkul est disponible des maintenant sur Google Play (Android). La version iOS arrive prochainement :
          le bouton "App Store" affiche "Bientot" en attendant.
        </p>

        <h3>En quelles langues sont les cours ?</h3>
        <p>Les cours sont en francais et progressivement en langues locales, pour faciliter la comprehension.</p>

        <h3>Comment fonctionnent les quiz ?</h3>
        <p>Chaque sequence est suivie d'un quiz de comprehension. Les resultats alimentent vos statistiques.</p>

        <h3>A quoi sert l'espace parents ?</h3>
        <p>L'espace parents permet de consulter les statistiques liees au compte de l'eleve (progression, scores, regularite).</p>

        <h3>A quoi sert l'espace professeur sur le web ?</h3>
        <p>
          Le web sert surtout a consulter des statistiques detaillees. La creation/organisation des contenus est pensee
          pour l'application iSkul.
        </p>
      </div>
    </div>
  );
}
