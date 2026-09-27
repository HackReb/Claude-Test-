import { LIFE } from "../config/life";
import type { BuildingUse } from "../model/types";

const OPTIONS: { use: BuildingUse; label: string; hint: string }[] = [
  {
    use: "residential",
    label: "🏠 Wohnen",
    hint: `Bewohner zahlen Miete. Sie ziehen nur ein, wenn es sauber ist, einen Spielplatz und einen Laden gibt – sonst ziehen sie wieder aus.`,
  },
  {
    use: "commercial",
    label: "🏪 Gewerbe",
    hint: `Umsatz durch Kundschaft: Bewohner der Straße kaufen hier ein (ohne Bewohner nur ${Math.round(LIFE.walkInCustomers * 100)} % Laufkundschaft). Kunden werfen Müll weg.`,
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
