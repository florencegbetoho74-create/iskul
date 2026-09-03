import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDuration,
  micDisabled,
  nameForAgoraUid,
  presentOnly,
  raisedHands,
  sortRoster,
  tileLabel,
  type RosterEntry,
} from "../src/lib/liveRoster.ts";

function entry(over: Partial<RosterEntry> & { userId: string }): RosterEntry {
  return {
    agoraUid: null,
    displayName: "Participant",
    role: "attendee",
    joinedAtMs: 1_000,
    leftAtMs: null,
    handRaisedAtMs: null,
    mutedByHost: false,
    isBanned: false,
    present: true,
    ...over,
  };
}

const PROF = entry({
  userId: "u-prof",
  agoraUid: 111,
  displayName: "M. Adjovi",
  role: "host",
});
const AWA = entry({ userId: "u-awa", agoraUid: 222, displayName: "Awa" });
const KOFI = entry({ userId: "u-kofi", agoraUid: 333, displayName: "Kofi" });

describe("nameForAgoraUid", () => {
  it("retrouve le nom derriere l'identifiant Agora", () => {
    assert.equal(nameForAgoraUid(222, [PROF, AWA, KOFI]), "Awa");
    assert.equal(nameForAgoraUid(111, [PROF, AWA]), "M. Adjovi");
  });

  // On prefere ne rien affirmer plutot que d'inventer un nom.
  it("renvoie null quand l'identifiant n'est rattache a personne", () => {
    assert.equal(nameForAgoraUid(999, [PROF, AWA]), null);
    assert.equal(nameForAgoraUid(null, [PROF]), null);
    assert.equal(nameForAgoraUid(undefined, [PROF]), null);
    assert.equal(nameForAgoraUid(NaN, [PROF]), null);
  });

  it("ignore les participants sans identifiant Agora", () => {
    const sansUid = entry({ userId: "u-x", displayName: "Sans flux" });
    assert.equal(nameForAgoraUid(null, [sansUid]), null);
  });
});

describe("tileLabel", () => {
  it("nomme sa propre vignette", () => {
    assert.equal(tileLabel(222, [PROF, AWA], 222), "Vous");
  });

  it("nomme les autres", () => {
    assert.equal(tileLabel(111, [PROF, AWA], 222), "M. Adjovi");
  });

  // C'est exactement ce que la salle affichait avant : un nombre brut.
  it("retombe sur un libelle generique, jamais sur l'identifiant", () => {
    assert.equal(tileLabel(4242, [PROF, AWA], 222), "Participant");
    assert.equal(tileLabel(null, [PROF], 222), "Participant");
  });
});

describe("sortRoster", () => {
  it("place l'animateur en tete", () => {
    assert.equal(sortRoster([AWA, KOFI, PROF])[0].userId, "u-prof");
  });

  it("classe les mains levees avant les autres, dans l'ordre de levee", () => {
    const tardif = entry({ ...KOFI, handRaisedAtMs: 5_000 });
    const precoce = entry({ ...AWA, handRaisedAtMs: 2_000 });
    const calme = entry({ userId: "u-z", displayName: "Zoe" });

    assert.deepEqual(
      sortRoster([calme, tardif, precoce]).map((p) => p.userId),
      ["u-awa", "u-kofi", "u-z"]
    );
  });

  it("classe les autres par ordre alphabetique francais", () => {
    const eve = entry({ userId: "u-eve", displayName: "Eve" });
    const elodie = entry({ userId: "u-elodie", displayName: "Élodie" });
    assert.deepEqual(
      sortRoster([eve, elodie]).map((p) => p.displayName),
      ["Élodie", "Eve"]
    );
  });

  it("ne modifie pas le tableau source", () => {
    const input = [AWA, PROF];
    sortRoster(input);
    assert.equal(input[0].userId, "u-awa");
  });
});

describe("presentOnly", () => {
  it("ecarte ceux qui ont quitte ou ete exclus", () => {
    const parti = entry({ userId: "u-1", present: false, leftAtMs: 9_000 });
    const exclu = entry({ userId: "u-2", present: false, isBanned: true });
    assert.deepEqual(
      presentOnly([PROF, parti, exclu]).map((p) => p.userId),
      ["u-prof"]
    );
  });
});

describe("raisedHands", () => {
  it("donne la file dans l'ordre de levee", () => {
    const a = entry({ userId: "a", handRaisedAtMs: 300 });
    const b = entry({ userId: "b", handRaisedAtMs: 100 });
    const c = entry({ userId: "c", handRaisedAtMs: 200 });
    assert.deepEqual(
      raisedHands([a, b, c]).map((p) => p.userId),
      ["b", "c", "a"]
    );
  });

  // Une main levee par quelqu'un qui est parti resterait sinon dans la file.
  it("ignore les mains levees de participants absents", () => {
    const parti = entry({ userId: "parti", handRaisedAtMs: 50, present: false });
    const present = entry({ userId: "present", handRaisedAtMs: 100 });
    assert.deepEqual(
      raisedHands([parti, present]).map((p) => p.userId),
      ["present"]
    );
  });

  it("renvoie une liste vide quand personne ne leve la main", () => {
    assert.deepEqual(raisedHands([PROF, AWA]), []);
  });
});

describe("formatDuration", () => {
  it("formate les durees courantes", () => {
    assert.equal(formatDuration(45 * 60_000), "45 min");
    assert.equal(formatDuration(90 * 60_000), "1 h 30");
    assert.equal(formatDuration(2 * 3600_000), "2 h 00");
  });

  it("evite d'afficher zero pour une presence tres breve", () => {
    assert.equal(formatDuration(0), "moins d'une minute");
    assert.equal(formatDuration(5_000), "moins d'une minute");
    assert.equal(formatDuration(-100), "moins d'une minute");
    assert.equal(formatDuration(NaN), "moins d'une minute");
  });
});

describe("micDisabled", () => {
  it("coupe le micro d'un participant reduit au silence", () => {
    assert.equal(micDisabled(entry({ userId: "u", mutedByHost: true })), true);
  });

  // L'animateur ne peut pas se couper lui-meme par ce chemin.
  it("n'applique jamais la coupure a l'animateur", () => {
    assert.equal(micDisabled({ ...PROF, mutedByHost: true }), false);
  });

  it("tolere l'absence d'entree", () => {
    assert.equal(micDisabled(null), false);
    assert.equal(micDisabled(undefined), false);
  });
});
