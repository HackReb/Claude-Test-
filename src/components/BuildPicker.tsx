import { useState } from "react";
import { formatRate } from "../format";
import { randomBuilding } from "../game/randomBuilding";
import { buildingRentPerMinute } from "../game/rent";
import { buildingFromTemplate, templatesFor } from "../game/templates";
import type { Building, Plot } from "../model/types";
import { isUnlocked } from "../parts/catalog";
import { useGameStore } from "../store/gameStore";
import { FacadePreview } from "./FacadePreview";

export type BuildMode = "template" | "random";

/** Auswahl eines neuen Gebäudes: Vorlagen-Liste oder Würfeln. */
export function BuildPicker({ plot, mode, onDone }: { plot: Plot; mode: BuildMode; onDone: () => void }) {
  return mode === "template" ? <TemplateList plot={plot} onDone={onDone} /> : <Dice plot={plot} onDone={onDone} />;
}

function useBuild(plot: Plot, onDone: () => void) {
  const build = useGameStore((s) => s.build);
  return async (building: Building) => {
    if (await build(plot.id, building)) onDone();
  };
}

function TemplateList({ plot, onDone }: { plot: Plot; onDone: () => void }) {
  const place = useBuild(plot, onDone);
  const templates = templatesFor(plot.size);
  return (
    <section className="picker" aria-label="Vorlagen">
      <div className="picker-head">
        <h2>Vorlage wählen</h2>
        <button type="button" className="btn btn-link" onClick={onDone}>
          Abbrechen
        </button>
      </div>
      <div className="template-grid">
        {templates.map((template) => {
          const building = buildingFromTemplate(template);
          return (
            <button key={template.id} type="button" className="template-card" onClick={() => void place(building)}>
              <FacadePreview facade={template.facade} size={plot.size} label={template.name} maxHeight={120} />
              <strong>{template.name}</strong>
              <span className="subtle">🪙 {formatRate(buildingRentPerMinute(plot.size, building))}/min</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Dice({ plot, onDone }: { plot: Plot; onDone: () => void }) {
  const place = useBuild(plot, onDone);
  const unlockedParts = useGameStore((s) => s.player!.unlockedParts);
  // Würfeln nutzt nur freigeschaltete Bausteine (Vorlagen dagegen sind fertige Gebäude).
  const roll = () => randomBuilding(plot.size, Math.random, { isAvailable: (part) => isUnlocked(part, unlockedParts) });
  const [building, setBuilding] = useState(roll);
  const [rolls, setRolls] = useState(1);

  return (
    <section className="picker" aria-label="Würfeln">
      <div className="picker-head">
        <h2>🎲 {building.name}</h2>
        <button type="button" className="btn btn-link" onClick={onDone}>
          Abbrechen
        </button>
      </div>
      <div className="card dice-preview" key={rolls}>
        <FacadePreview facade={building.facade} size={plot.size} label={building.name} maxHeight={220} />
      </div>
      <p className="subtle">
        Bringt 🪙 {formatRate(buildingRentPerMinute(plot.size, building))} pro Minute · {building.facade.floors} Stockwerk
        {building.facade.floors > 1 ? "e" : ""}
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setBuilding(roll());
            setRolls((n) => n + 1);
          }}
        >
          Nochmal 🎲
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void place(building)}>
          Bauen
        </button>
      </div>
    </section>
  );
}
