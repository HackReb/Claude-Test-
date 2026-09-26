import { useId } from "react";
import { BUILDING_NAME_MAX_LENGTH } from "../game/names";

/** Eingabe für den Gebäudenamen – der Name steht später auf dem Schild an der Straße. */
export function BuildingNameField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>Name am Haus</span>
      <input
        id={id}
        value={value}
        maxLength={BUILDING_NAME_MAX_LENGTH}
        placeholder="z. B. Kalles Kiosk"
        aria-invalid={!value.trim()}
        onChange={(e) => onChange(e.target.value)}
      />
      {!value.trim() && <small className="error">Gib deinem Haus einen Namen.</small>}
    </label>
  );
}
