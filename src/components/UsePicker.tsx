import { LIFE } from "../config/life";
import type { BuildingUse } from "../model/types";

const OPTIONS: { use: BuildingUse; label: string; hint: string }[] = [
  {
    use: "residential",
    label: "🏠 Wohnen",
    hint: `Bewohner, Kinder und Hunde. Mögen es sauber und wünschen sich einen Spielplatz (+${Math.round(LIFE.playgroundBonus * 100)} % Miete).`,
  },
  {
    use: "commercial",
    label: "🏪 Gewerbe",
    hint: `Kundschaft bringt Umsatz: +${Math.round(LIFE.customerBonusPerHome * 100)} % Miete je Wohnhaus in der Straße – aber Kunden werfen Müll weg.`,
  },
];

/** Auswahl Wohngebäude oder Gewerbe beim Bauen. */
export function UsePicker({ value, onChange }: { value: BuildingUse; onChange: (use: BuildingUse) => void }) {
  const current = OPTIONS.find((o) => o.use === value)!;
  return (
    <div className="use-picker">
      <div className="segmented" role="radiogroup" aria-label="Nutzung">
        {OPTIONS.map((o) => (
          <button key={o.use} type="button" role="radio" aria-checked={value === o.use} className={value === o.use ? "selected" : ""} onClick={() => onChange(o.use)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="subtle">{current.hint}</p>
    </div>
  );
}

export const useLabel = (use: BuildingUse) => (use === "residential" ? "🏠 Wohnhaus" : "🏪 Gewerbe");
