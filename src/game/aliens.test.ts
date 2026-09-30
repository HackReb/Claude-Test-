import { describe, expect, it } from "vitest";
import { ALIENS } from "../config/aliens";
import { claimStreet } from "./claimStreet";
import { alienAttack, alienDueAt, alienTargets } from "./aliens";
import { actorOf } from "./mischief";

const HOUR = 3_600_000;
const start = () => claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0);

describe("Aliens", () => {
  it("kommen beim ersten Mal kurz nach dem Öffnen – jeder sieht sie einmal", () => {
    const { player } = start();
    expect(alienDueAt(player, 1000)).toBe(1000 + ALIENS.firstVisitAfterSeconds * 1000);
  });

  it("treffen ein eigenes Haus: kaputt, Meldung, nächster Besuch erst in Tagen", () => {
    const { player, street } = start();
    const [kiosk] = alienTargets(street, player.id);
    expect(kiosk.building?.name).toContain("Kiosk");

    const now = 10 * HOUR;
    const hit = alienAttack(player, street, kiosk.id, now, () => 0.5);
    expect(hit.street.plots.find((p) => p.id === kiosk.id)!.building!.damaged).toBe(true);
    expect(hit.street.incidents![0]).toMatchObject({ badBoyId: "aliens", at: now });
    expect(hit.street.incidents![0].text).toContain("UFO");
    expect(actorOf({ badBoyId: "aliens" }).emoji).toBe("👽");

    const gap = (hit.player.aliens!.nextAt - now) / HOUR;
    expect(gap).toBeGreaterThanOrEqual(ALIENS.minHoursBetween);
    expect(gap).toBeLessThanOrEqual(ALIENS.maxHoursBetween);
    // Danach nicht gleich wieder – auch nicht, wenn man die Straße neu öffnet.
    expect(alienDueAt(hit.player, now + HOUR)).toBe(hit.player.aliens!.nextAt);
    // Ist der Besuch fällig, kommt das UFO kurz nach dem Öffnen.
    const later = hit.player.aliens!.nextAt + HOUR;
    expect(alienDueAt(hit.player, later)).toBe(later + ALIENS.arriveAfterSeconds * 1000);
  });

  it("zielen lieber auf heile Häuser", () => {
    const { player, street } = start();
    const [kiosk] = alienTargets(street, player.id);
    const broken = { ...street, plots: street.plots.map((p) => (p.id === kiosk.id ? { ...p, building: { ...p.building!, damaged: true } } : p)) };
    // Nur ein Haus da – dann eben das kaputte.
    expect(alienTargets(broken, player.id).map((p) => p.id)).toEqual([kiosk.id]);
  });
});
