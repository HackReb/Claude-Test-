import { describe, expect, it } from "vitest";
import { CAR_COLORS, CAR_MODELS, CARS } from "../config/cars";
import { buyCar, cleanPlate, defaultCarName, defaultPlate, updateCar } from "./cars";
import { claimStreet } from "./claimStreet";

const player = () => ({ ...claimStreet({ playerName: "Kalle", street: { name: "Weg", city: "Ulm" } }, 0).player, coins: 20_000 });
const borsche = { modelId: "borsche-911ish", color: CAR_COLORS[0], name: "Kalles Borsche", plate: "TUT-KA 911" };

describe("Autohaus", () => {
  it("hat mehrere Fantasie-Marken mit eigenem Preis", () => {
    expect(new Set(CAR_MODELS.map((m) => m.brand)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(CAR_MODELS.map((m) => m.id)).size).toBe(CAR_MODELS.length);
  });

  it("Kauf kostet Münzen und stellt das Auto in die Garage", () => {
    const result = buyCar(player(), borsche, 5);
    if (!result.ok) throw new Error(result.reason);
    expect(result.player.coins).toBe(20_000 - 6000);
    expect(result.player.cars).toHaveLength(1);
    expect(result.car).toMatchObject({ modelId: "borsche-911ish", name: "Kalles Borsche", plate: "TUT-KA 911", boughtAt: 5 });
  });

  it("verweigert zu teure Autos, falsche Farben, leere Namen und eine volle Garage", () => {
    expect(buyCar({ ...player(), coins: 100 }, borsche, 0)).toEqual({ ok: false, reason: "too-expensive" });
    expect(buyCar(player(), { ...borsche, color: "#123456" }, 0)).toEqual({ ok: false, reason: "bad-color" });
    expect(buyCar(player(), { ...borsche, name: "  " }, 0)).toEqual({ ok: false, reason: "no-name" });
    expect(buyCar(player(), { ...borsche, modelId: "gibts-nicht" }, 0)).toEqual({ ok: false, reason: "unknown-model" });
    let p = { ...player(), coins: 1_000_000 };
    for (let i = 0; i < CARS.maxCars; i++) {
      const r = buyCar(p, { ...borsche, modelId: "fiasko-500" }, i);
      if (!r.ok) throw new Error(r.reason);
      p = r.player;
    }
    expect(buyCar(p, borsche, 9)).toEqual({ ok: false, reason: "garage-full" });
  });

  it("Nummernschilder: aus Ort + Name, nur erlaubte Zeichen", () => {
    expect(defaultPlate("Tuttlingen", "Kalle", 911)).toBe("TUT-KA 911");
    expect(defaultPlate("Überlingen", "Özil", 7)).toBe("UBE-OZ 7");
    expect(cleanPlate("  tut-ka 911!!💥 ")).toBe("TUT-KA 911");
    expect(cleanPlate("SEHR-LANGES SCHILD")).toHaveLength(CARS.plateMaxLength);
    expect(defaultCarName("Hans", "volksflitzer-bulli")).toBe("Hans’ Volksflitzer");
  });

  it("Name, Schild und Farbe lassen sich ändern", () => {
    const bought = buyCar(player(), borsche, 0);
    if (!bought.ok) throw new Error();
    const changed = updateCar(bought.player, bought.car.id, { name: "Blitzi", plate: "ulm-b 1", color: CAR_COLORS[2] })!;
    expect(changed.cars![0]).toMatchObject({ name: "Blitzi", plate: "ULM-B 1", color: CAR_COLORS[2] });
    // Leere Eingaben behalten den alten Wert
    expect(updateCar(changed, bought.car.id, { name: " ", plate: "" })!.cars![0]).toMatchObject({ name: "Blitzi", plate: "ULM-B 1" });
    expect(updateCar(changed, "weg", { name: "x" })).toBeNull();
  });
});
