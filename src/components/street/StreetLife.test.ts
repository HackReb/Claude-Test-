import { describe, expect, it } from "vitest";
import { planShow, showFocus, showState } from "./StreetShows";
import { allocateWalkers } from "./StreetLife";

describe("Straßenleben", () => {
  it("so viele Leute auf der Straße, wie dort wohnen", () => {
    expect(allocateWalkers([{ id: "a", residents: 3 }, { id: "b", residents: 0 }, { id: "c", residents: 5 }], 24)).toEqual({ a: 3, b: 0, c: 5 });
  });

  it("halbe Bewohner (beim Einziehen): zusammen so viele wie die Anzeige", () => {
    const counts = allocateWalkers([{ id: "a", residents: 2.4 }, { id: "b", residents: 2.4 }, { id: "c", residents: 2.6 }], 24);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(Math.round(7.4));
  });

  it("bei sehr vielen Bewohnern anteilig – der Rest ist gerade zuhause", () => {
    const counts = allocateWalkers([{ id: "a", residents: 40 }, { id: "b", residents: 10 }, { id: "c", residents: 30 }], 24);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(24);
    expect(counts).toEqual({ a: 12, b: 3, c: 9 });
  });

  it("Eiswagen fährt rein, hält in der Mitte des sichtbaren Ausschnitts und fährt wieder raus", () => {
    const show = planShow(1, "icecream", 200, 600, 0);
    expect(show.spot).toBe(400);
    expect(showState(show, 0).x).toBeLessThan(200);
    expect(showState(show, 8000)).toMatchObject({ x: 400, standing: true });
    expect(showState(show, show.duration * 1000).x).toBeGreaterThan(600);
    expect(showFocus(show, 8000).gather).toBe(400);
  });

  it("Zirkusparade zieht einmal ganz durch; die Leute bleiben stehen und schauen", () => {
    const show = planShow(1, "circus", 0, 500, 0);
    expect(showState(show, 0).x).toBeLessThan(0);
    expect(showState(show, show.duration * 1000).x).toBeGreaterThan(500 + 300);
    expect(showFocus(show, 1000).gather).toBeNull();
  });
});
