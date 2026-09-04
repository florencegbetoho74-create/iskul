import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import ConsolePage from "./pages/admin/ConsolePage";
import "./styles.css";

/**
 * Point d'entree de la console.
 *
 * La console vit desormais dans sa propre page et son propre bundle. Deux
 * gains, dont un seul depend de l'hebergeur :
 *
 *   - le site public cesse d'embarquer le code de la console. Ce gain est
 *     acquis des ce fichier.
 *   - servie depuis console.iskuledu.space, elle obtient une origine distincte :
 *     le stockage local, les cookies et les scripts du site public ne peuvent
 *     plus l'atteindre. Ce gain-la demande de faire pointer le sous-domaine sur
 *     console.html.
 *
 * Ce qui protege reellement reste cote serveur : les procedures `security
 * definer` refusent un appel sans droit, quelle que soit la page qui l'emet.
 */
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConsolePage />
    </BrowserRouter>
  </React.StrictMode>
);
