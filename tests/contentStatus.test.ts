import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authorActionLabel,
  canSubmit,
  canWithdraw,
  parseContentStatus,
  presentStatus,
  rejectionNote,
} from "../src/lib/contentStatus.ts";

describe("parseContentStatus", () => {
  it("accepte les statuts connus", () => {
    assert.equal(parseContentStatus("draft"), "draft");
    assert.equal(parseContentStatus("in_review"), "in_review");
    assert.equal(parseContentStatus("published"), "published");
    assert.equal(parseContentStatus("rejected"), "rejected");
  });

  it("normalise la casse et les espaces", () => {
    assert.equal(parseContentStatus("  PUBLISHED "), "published");
  });

  // Un statut inconnu ne doit jamais faire passer un contenu pour publie.
  it("retombe sur brouillon plutot que d'ouvrir l'acces", () => {
    assert.equal(parseContentStatus(null), "draft");
    assert.equal(parseContentStatus(""), "draft");
    assert.equal(parseContentStatus("approved"), "draft");
    assert.equal(parseContentStatus("live"), "draft");
  });
});

describe("canSubmit", () => {
  it("autorise depuis un brouillon ou un refus", () => {
    assert.equal(canSubmit("draft"), true);
    assert.equal(canSubmit("rejected"), true);
  });

  it("refuse ce qui est deja en file ou en ligne", () => {
    assert.equal(canSubmit("in_review"), false);
    assert.equal(canSubmit("published"), false);
  });
});

describe("canWithdraw", () => {
  it("n'autorise le retrait que depuis la file", () => {
    assert.equal(canWithdraw("in_review"), true);
    assert.equal(canWithdraw("draft"), false);
    assert.equal(canWithdraw("published"), false);
    assert.equal(canWithdraw("rejected"), false);
  });
});

describe("authorActionLabel", () => {
  it("propose l'action correspondant au statut", () => {
    assert.equal(authorActionLabel("draft"), "Envoyer en relecture");
    assert.equal(authorActionLabel("rejected"), "Renvoyer en relecture");
    assert.equal(authorActionLabel("in_review"), "Retirer de la file");
  });

  // Depublier n'appartient pas a l'auteur : c'est tout l'objet du circuit.
  it("ne propose rien sur un contenu publie", () => {
    assert.equal(authorActionLabel("published"), null);
  });
});

describe("presentStatus", () => {
  it("donne un libelle et une explication pour chaque statut", () => {
    for (const status of ["draft", "in_review", "published", "rejected"] as const) {
      const p = presentStatus(status);
      assert.ok(p.label.length > 0, `libelle manquant pour ${status}`);
      assert.ok(p.hint.length > 0, `explication manquante pour ${status}`);
    }
  });

  it("distingue les tonalites", () => {
    assert.equal(presentStatus("published").tone, "success");
    assert.equal(presentStatus("rejected").tone, "danger");
    assert.equal(presentStatus("in_review").tone, "pending");
    assert.equal(presentStatus("draft").tone, "neutral");
  });
});

describe("rejectionNote", () => {
  it("ne renvoie un motif que sur un refus", () => {
    assert.equal(rejectionNote("published", "peu importe"), null);
    assert.equal(rejectionNote("draft", "peu importe"), null);
    assert.equal(rejectionNote("rejected", "Chapitre 3 incomplet"), "Chapitre 3 incomplet");
  });

  it("comble un motif vide plutot que d'afficher du blanc", () => {
    assert.equal(
      rejectionNote("rejected", "   "),
      "Le relecteur n'a pas laisse de motif."
    );
    assert.equal(rejectionNote("rejected", null), "Le relecteur n'a pas laisse de motif.");
  });
});
