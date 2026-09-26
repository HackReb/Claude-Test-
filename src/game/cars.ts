import { CAR_COLORS, CARS, carModel } from "../config/cars";
import type { Car, Player } from "../model/types";
import { createId } from "./ids";
import { possessive } from "./names";

/** Nummernschild aus Ort und Name, z. B. Tuttlingen + Kalle → „TUT-KA 123“. */
export function defaultPlate(city: string, playerName: string, number: number): string {
  const letters = (text: string, n: number) =>
    text
      .normalize("NFD")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, n);
  const town = letters(city, 3) || "BAB";
  const initials = letters(playerName, 2) || "XY";
  return cleanPlate(`${town}-${initials} ${Math.max(1, Math.min(9999, Math.round(number)))}`);
}

/** Erlaubt nur Zeichen, die auf ein Schild passen; Großbuchstaben, gekürzt. */
export function cleanPlate(plate: string): string {
  return plate
    .toUpperCase()
    .replace(/[^A-Z0-9ÄÖÜ -]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CARS.plateMaxLength);
}

export function cleanCarName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, CARS.carNameMaxLength);
}

export const defaultCarName = (playerName: string, modelId: string) =>
  `${possessive(playerName)} ${carModel(modelId)?.brand.split(" ").pop() ?? "Auto"}`.slice(0, CARS.carNameMaxLength);

export type BuyCarResult =
  | { ok: true; player: Player; car: Car }
  | { ok: false; reason: "unknown-model" | "bad-color" | "garage-full" | "too-expensive" | "no-name" };

export function buyCar(
  player: Player,
  input: { modelId: string; color: string; name: string; plate: string },
  now: number,
): BuyCarResult {
  const model = carModel(input.modelId);
  if (!model) return { ok: false, reason: "unknown-model" };
  if (!(CAR_COLORS as readonly string[]).includes(input.color)) return { ok: false, reason: "bad-color" };
  const cars = player.cars ?? [];
  if (cars.length >= CARS.maxCars) return { ok: false, reason: "garage-full" };
  if (player.coins < model.price) return { ok: false, reason: "too-expensive" };
  const name = cleanCarName(input.name);
  const plate = cleanPlate(input.plate);
  if (!name || !plate) return { ok: false, reason: "no-name" };

  const car: Car = { id: createId(), modelId: model.id, color: input.color, name, plate, boughtAt: now };
  return { ok: true, car, player: { ...player, coins: player.coins - model.price, cars: [...cars, car] } };
}

/** Name, Nummernschild oder Farbe eines eigenen Autos ändern (Umlackieren ist gratis). */
export function updateCar(player: Player, carId: string, changes: Partial<Pick<Car, "name" | "plate" | "color">>): Player | null {
  const cars = player.cars ?? [];
  const car = cars.find((c) => c.id === carId);
  if (!car) return null;
  const next: Car = { ...car };
  if (changes.name !== undefined) next.name = cleanCarName(changes.name) || car.name;
  if (changes.plate !== undefined) next.plate = cleanPlate(changes.plate) || car.plate;
  if (changes.color !== undefined && (CAR_COLORS as readonly string[]).includes(changes.color)) next.color = changes.color;
  return { ...player, cars: cars.map((c) => (c.id === carId ? next : c)) };
}
