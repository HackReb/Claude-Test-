import { describe, expect, it } from "vitest";
import { cleanBuildingName, ownedStreetName, personalName, possessive } from "./names";

describe("Namen", () => {
  it("Genitiv wie im Deutschen", () => {
    expect(possessive("Kalle")).toBe("Kalles");
    expect(possessive("Hans")).toBe("Hans’");
    expect(possessive("Max")).toBe("Max’");
    expect(possessive("Fritz")).toBe("Fritz’");
    expect(possessive("Chris")).toBe("Chris’");
    expect(possessive(" Zoe ")).toBe("Zoes");
  });

  it("persönliche Gebäude- und Straßennamen", () => {
    expect(personalName("Kalle", "Kiosk")).toBe("Kalles Kiosk");
    expect(personalName("Kalle", "Gummibärchenschloss")).toBe("Kalles Gummibärchenschloss");
    expect(personalName("Maximilian-Alexander", "Gummibärchenschloss")).toBe("Gummibärchenschloss");
    expect(ownedStreetName("Kalle", "Bahnhofstraße")).toBe("Kalles Bahnhofstraße");
  });

  it("bereinigt Eingaben", () => {
    expect(cleanBuildingName("  Kalles   Kiosk ")).toBe("Kalles Kiosk");
    expect(cleanBuildingName("   ")).toBeNull();
    expect(cleanBuildingName("x".repeat(50))).toHaveLength(32);
  });
});
