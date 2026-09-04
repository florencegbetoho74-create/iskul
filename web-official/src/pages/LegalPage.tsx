import { Link } from "react-router-dom";

export default function LegalPage() {
  return (
    <div className="page-wrap container">
      <header className="page-head">
        <span className="kicker">Mentions legales</span>
        <h1>Informations legales</h1>
        <p>Ce contenu est un minimum. Il peut etre complete selon votre structure juridique et vos obligations locales.</p>
      </header>

      <section className="content-card" data-reveal="up">
        <h3>Editeur</h3>
        <p>iSkul - Plateforme EdTech (informations d'editeur a completer).</p>

        <h3>Politique de confidentialite</h3>
        <p>
          La politique de confidentialite detaillee est disponible sur la page{" "}
          <Link to="/politique-confidentialite">Politique de confidentialite</Link>.
        </p>

        <h3>Suppression de compte</h3>
        <p>
          Une page dediee permet de demander la suppression du compte iSkul :{" "}
          <Link to="/delete-account">Suppression de compte</Link>.
        </p>

        <h3>Responsabilite</h3>
        <p>
          iSkul met a disposition des contenus pedagogiques et des fonctionnalites de suivi. Malgre notre attention,
          des erreurs peuvent exister. Les informations sont susceptibles d'evoluer.
        </p>

        <h3>Donnees personnelles</h3>
        <p>
          Les donnees sont utilisees pour fournir les services (progression, statistiques, experience utilisateur).
          Pour toute demande liee aux donnees, utilisez le formulaire de contact.
        </p>

        <h3>Contact</h3>
        <p>
          Pour nous joindre, utilisez la page <Link to="/contact">Contact</Link>.
        </p>
      </section>
    </div>
  );
}
