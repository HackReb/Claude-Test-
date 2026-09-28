import { describe, expect, it } from "vitest";
import type { Facade } from "../model/types";
import { gagsOf } from "./gags";
import { TEMPLATES } from "./templates";

const facade = (parts: Facade["parts"]): Facade => ({ base: { partId: "base-brick" }, roof: { partId: "roof-flat" }, floors: 1, parts });
const kinds = (f: Facade) => gagsOf(f).map((g) => g.kind);

describe("Gags an Läden", () => {
  it("Spezial-Fenster und Schilder bestimmen die Szene – mit Platz", () => {
    expect(gagsOf(facade([{ partId: "window-doner", x: 1, y: 0 }]))).toEqual([{ kind: "doner", x: 1, y: 0 }]);
    expect(kinds(facade([{ partId: "deco-sign", x: 0, y: 0, text: "OPTIK" }]))).toEqual(["optician"]);
    expect(kinds(facade([{ partId: "deco-sign", x: 0, y: 0, text: "EIS" }]))).toEqual(["icecream"]);
    expect(kinds(facade([{ partId: "deco-sign", x: 0, y: 0, text: "WEISS" }]))).toEqual([]);
    expect(kinds(facade([{ partId: "deco-sign", x: 0, y: 0, text: "BAD" }]))).toEqual(["pool"]);
    // Doppelt zählt nicht: Dönergrill + Döner-Schild = ein Döner-Gag
    expect(kinds(facade([{ partId: "window-doner", x: 0, y: 0 }, { partId: "deco-neon", x: 0, y: 0, text: "DÖNER" }]))).toEqual(["doner"]);
  });

  it("jede Laden-Vorlage mit Schild hat was zu zeigen, Wohnhäuser nicht", () => {
    const withGag = (id: string) => kinds(TEMPLATES.find((t) => t.id === id)!.facade);
    expect(withGag("doenerbude")).toContain("doner");
    expect(withGag("optiker")).toEqual(["optician"]);
    expect(withGag("eisdiele")).toEqual(["icecream"]);
    expect(withGag("waschsalon")).toEqual(["laundry"]);
    expect(withGag("baeckerei")).toEqual(["bakery"]);
    expect(withGag("wohnhaus")).toEqual([]);
  });
});
