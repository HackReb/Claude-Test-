import { carModel } from "../config/cars";
import { CAR_OUTINGS, PETS, species } from "../config/pets";
import type { Mischief, Pet, Player, Street } from "../model/types";
import { createId } from "./ids";
import { possessive } from "./names";
import { hashString } from "./random";

const HOUR = 3_600_000;

export type BuyPetResult = { ok: true; player: Player; pet: Pet } | { ok: false; reason: "unknown" | "full" | "too-expensive" | "no-name" };

export function cleanPetName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, PETS.nameMaxLength);
}

/** Tier in der Tierhandlung kaufen. */
export function buyPet(player: Player, speciesId: string, name: string, now: number): BuyPetResult {
  const sp = species(speciesId);
  if (!sp) return { ok: false, reason: "unknown" };
  if ((player.pets?.length ?? 0) >= PETS.maxPets) return { ok: false, reason: "full" };
  if (player.coins < sp.price) return { ok: false, reason: "too-expensive" };
  const clean = cleanPetName(name);
  if (!clean) return { ok: false, reason: "no-name" };
  const pet: Pet = { id: createId(), speciesId, name: clean, boughtAt: now, nextOutingAt: now + sp.outingEveryHours * HOUR };
  return { ok: true, pet, player: { ...player, coins: player.coins - sp.price, pets: [...(player.pets ?? []), pet] } };
}

/** Futter & Tierarzt aller Tiere pro Stunde. */
export function petUpkeepPerHour(player: Player): number {
  return (player.pets ?? []).reduce((sum, pet) => sum + (species(pet.speciesId)?.upkeepPerHour ?? 0), 0);
}

/** Ein Ausflug: Tier oder Auto geht in eine Nachbarstraße – dort wird er wie ein Streich angewendet. */
export interface Outing {
  targetStreetId: string;
  mischief: Mischief;
}

/**
 * Welche Tiere und Autos seit dem letzten Mal auf Ausflug waren – nach festem Takt, nicht per Zufall:
 * je mehr (und je größere) Tiere und je dreckigere Autos, desto mehr Haufen und Ruß bei den Nachbarn.
 * Das Ziel wird reproduzierbar unter den Nachbarstraßen ausgewählt.
 */
export function dueOutings(player: Player, targets: Street[], now: number): { player: Player; outings: Outing[] } {
  const outings: Outing[] = [];
  const owner = possessive(player.name);

  function schedule<T extends { id: string; nextOutingAt?: number; boughtAt: number }>(thing: T, everyHours: number, make: (at: number) => Omit<Mischief, "id" | "at" | "blocked">): T {
    const every = everyHours * HOUR;
    let next = thing.nextOutingAt ?? thing.boughtAt + every;
    let count = 0;
    while (next <= now && count < PETS.maxCatchUp && targets.length > 0) {
      const id = `${thing.id}-${next}`;
      const target = targets[hashString(id) % targets.length];
      outings.push({ targetStreetId: target.id, mischief: { id, at: next, blocked: false, senderName: player.name, ...make(next) } });
      next += every;
      count++;
    }
    if (next <= now) next = now + every; // lange weg: nicht alles nachholen
    return next === thing.nextOutingAt ? thing : { ...thing, nextOutingAt: next };
  }

  const pets = (player.pets ?? []).map((pet) => {
    const sp = species(pet.speciesId);
    if (!sp) return pet;
    return schedule(pet, sp.outingEveryHours, () => ({ badBoyId: `tier-${sp.id}`, label: `${owner} ${sp.name} ${pet.name}` }));
  });
  const cars = (player.cars ?? []).map((car) => {
    const model = carModel(car.modelId);
    // Elektroautos machen keinen Dreck – die fahren einfach nur.
    if (!model || model.soot === 0) return car;
    return schedule(car, CAR_OUTINGS.everyHours, () => ({ badBoyId: `auto-${model.id}`, label: car.name }));
  });

  const changed = pets.some((p, i) => p !== player.pets![i]) || cars.some((c, i) => c !== player.cars![i]);
  return { player: changed ? { ...player, ...(player.pets && { pets }), ...(player.cars && { cars }) } : player, outings };
}

