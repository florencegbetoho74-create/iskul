import { Link } from "react-router-dom";

import PageHero from "../components/page/PageHero";
import { SUPPORT_EMAIL } from "../config";

/**
 * Questions frequentes.
 *
 * La page etait un seul bloc de titres empiles, entierement sans accents, et
 * annoncait que l'espace professeur du web ne servait qu'a consulter des
 * statistiques -- ce qui n'est plus vrai depuis qu'il cree des cours.
 *
 * Le depliant natif remplace l'empilement : il se referme, se cherche au
 * clavier, et fonctionne sans une ligne de script.
 */
const QUESTIONS = [
  {
    q: "L'application est-elle disponible ?",
    a: "Oui, sur Google Play. La version iOS n'est pas encore publiée : le bouton App Store affiche « Bientôt » en attendant, plutôt que de mener nulle part.",
  },
  {
    q: "Est-ce que c'est payant ?",
    a: "Les cours, les quiz et la bibliothèque sont gratuits. Aucun compte n'est demandé pour consulter le site ; l'application, elle, demande un compte pour retenir la progression.",
  },
  {
    q: "En quelles langues sont les cours ?",
    a: "En français, et en fon, adja, yoruba ou dendi selon les chapitres. La couverture en langues locales n'est pas complète : un chapitre qui n'a pas encore sa version locale reste disponible en français.",
  },
  {
    q: "Faut-il une bonne connexion ?",
    a: "La vidéo s'ajuste au débit disponible. Les séances live restent suivables au son seul si la connexion faiblit, et les rediffusions permettent de revoir plus tard.",
  },
  {
    q: "Comment fonctionnent les quiz ?",
    a: "Chaque séquence est suivie d'un quiz. La correction est calculée sur nos serveurs : les bonnes réponses ne sont jamais envoyées à l'appareil avant la fin, pour que la note veuille dire quelque chose.",
  },
  {
    q: "Que voit un parent, exactement ?",
    a: "Le temps passé, les chapitres ouverts, les scores aux quiz et les matières où les réponses tombent à côté. Pas le détail des réponses, pas les messages, et rien tant que l'élève n'a pas remis son code d'accès.",
  },
  {
    q: "Que peut-on faire depuis l'espace professeur web ?",
    a: "Créer et modifier ses cours, ajouter les chapitres et leurs vidéos — y compris les versions en langue locale —, déposer des documents, écrire des quiz, programmer des séances live, et suivre l'engagement de ses classes.",
  },
  {
    q: "Pourquoi mon cours n'apparaît-il pas tout de suite ?",
    a: "Il attend une relecture. Un relecteur vérifie que le contenu correspond à la classe annoncée, que les vidéos se lisent et que le quiz porte sur la leçon. S'il renvoie le cours, le motif est écrit et visible dans votre espace.",
  },
  {
    q: "Comment devenir professeur sur iSkul ?",
    a: "Par le formulaire d'inscription. La candidature est examinée avant que le compte puisse publier ; un compte enseignant ne suffit pas à mettre un cours en ligne.",
  },
  {
    q: "Comment supprimer mon compte ?",
    a: "Par la page de suppression de compte, ou en écrivant à l'adresse de contact. La demande est traitée sans qu'on cherche à vous retenir.",
  },
];

export default function FaqPage() {
  return (
    <div className="page container container--narrow">
      <PageHero
        eyebrow="Aide"
        title="Questions fréquentes."
        lead="Si votre question n'est pas là, écrivez-nous : la réponse rejoindra cette page."
      />

      <div className="faq" data-stagger="60">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="faq-item" data-reveal="up">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>

      <section className="section" aria-labelledby="reste">
        <h2 id="reste" data-reveal="up">
          Il reste une question
        </h2>
        <div className="row" data-reveal="up">
          <Link className="btn primary" to="/contact">
            Nous écrire
          </Link>
          <a className="btn ghost" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </section>
    </div>
  );
}
