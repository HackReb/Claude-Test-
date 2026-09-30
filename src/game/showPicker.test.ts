import { describe, expect, it } from "vitest";
import { SHOWS } from "../config/streetLife";
import { nextShowKind, type ShowMemory } from "./showPicker";

describe("Welche Show kommt", () => {
  it("Zirkus nur beim allerersten Mal, danach jede Show einmal, nie zweimal hintereinander", () => {
    let memory: ShowMemory = { circusSeen: false, bag: [], last: null };
    const kinds: string[] = [];
    for (let i = 0; i < 1 + SHOWS.order.length * 5; i++) {
      const picked = nextShowKind(memory);
      kinds.push(picked.kind);
      memory = picked.memory;
    }
    expect(kinds[0]).toBe("circus");
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    // Jede Runde (nach dem Eröffnungs-Zirkus) enthält jede Show genau einmal.
    const round = kinds.slice(1, 1 + SHOWS.order.length);
    expect(new Set(round).size).toBe(SHOWS.order.length);
    // Kein Zirkus-Dauerlauf: in 40 Shows höchstens so oft wie jede andere auch.
    expect(kinds.filter((k) => k === "circus").length).toBeLessThanOrEqual(6);
  });

  it("wer die Straße neu öffnet, bekommt nicht wieder den Zirkus", () => {
    const seen: ShowMemory = { circusSeen: true, bag: [], last: "circus" };
    for (let i = 0; i < 50; i++) expect(nextShowKind(seen).kind).not.toBe("circus");
  });
});
