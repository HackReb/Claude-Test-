import { useId } from "react";
import { BUILDING_NAME_MAX_LENGTH } from "../game/names";
import type { BuildingUse } from "../model/types";

/** Eingabe für den Gebäudenamen – er steht am Namensschild in der Straße, bei Läden auch groß auf dem Ladenschild. */
export function BuildingNameField({ value, onChange, use }: { value: string; onChange: (value: string) => void; use?: BuildingUse }) {
  const shop = use === "commercial";
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{shop ? "Name auf dem Ladenschild" : "Name am Haus"}</span>
      <input
        id={id}
        value={value}
        maxLength={BUILDING_NAME_MAX_LENGTH}
        placeholder={shop ? "z. B. Kalles Dönerbude" : "z. B. Kalles Villa"}
        aria-invalid={!value.trim()}
        onChange={(e) => onChange(e.target.value)}
      />
      {!value.trim() && <small className="error">Gib {shop ? "deinem Laden" : "deinem Haus"} einen Namen.</small>}
    </label>
  );
}
