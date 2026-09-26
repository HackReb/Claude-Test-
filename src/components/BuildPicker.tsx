import { useState } from "react";
import { formatRate } from "../format";
import { randomBuilding } from "../game/randomBuilding";
import { buildingRentPerMinute } from "../game/rent";
import { cleanBuildingName, personalName } from "../game/names";
import { buildingFromTemplate, templatesFor, type Template } from "../game/templates";
import type { Building, Plot } from "../model/types";
import { isUnlocked } from "../parts/catalog";
import { useGameStore } from "../store/gameStore";
import { BuildingNameField } from "./BuildingNameField";
import { FacadePreview } from "./FacadePreview";

export type BuildMode = "template" | "random";

/** Auswahl eines neuen Gebäudes: Vorlagen-Liste oder Würfeln. */
export function BuildPicker({ plot, mode, onDone }: { plot: Plot; mode: BuildMode; onDone: () => void }) {
  return mode === "template" ? <TemplateList plot={plot} onDone={onDone} /> : <Dice plot={plot} onDone={onDone} />;
}

/** Baut das Gebäude mit dem gewählten Namen; ohne gültigen Namen passiert nichts. */
function useBuild(plot: Plot, onDone: () => void) {
  const build = useGameStore((s) => s.build);
  return async (building: Building, name: string) => {
    const clean = cleanBuildingName(name);
    if (clean && (await build(plot.id, { ...building, name: clean }))) onDone();
  };
}

const usePlayerName = () => useGameStore((s) => s.player!.name);

function TemplateList({ plot, onDone }: { plot: Plot; onDone: () => void }) {
  const place = useBuild(plot, onDone);
  const playerName = usePlayerName();
  const templates = templatesFor(plot.size);
  const [chosen, setChosen] = useState<Template | null>(null);
  const [name, setName] = useState("");

  if (chosen) {
    const building = buildingFromTemplate(chosen);
    return (
      <section className="picker" aria-label={chosen.name}>
        <div className="picker-head">
          <h2>{chosen.name}</h2>
          <button type="button" className="btn btn-link" onClick={() => setChosen(null)}>
            ← Andere Vorlage
          </button>
        </div>
        <div className="card dice-preview">
          <FacadePreview facade={chosen.facade} size={plot.size} label={chosen.name} maxHeight={200} />
        </div>
        <BuildingNameField value={name} onChange={setName} />
        <p className="subtle">Bringt 🪙 {formatRate(buildingRentPerMinute(plot.size, building))} pro Minute</p>
        <button type="button" className="btn btn-primary btn-wide" disabled={!name.trim()} onClick={() => void place(building, name)}>
          Bauen
        </button>
      </section>
    );
  }

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
            <button
              key={template.id}
              type="button"
              className="template-card"
              onClick={() => {
                setChosen(template);
                setName(personalName(playerName, template.name));
              }}
            >
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
  const playerName = usePlayerName();
  const [building, setBuilding] = useState(roll);
  const [rolls, setRolls] = useState(1);
  const [name, setName] = useState(() => personalName(playerName, building.name));
  // Einen selbst getippten Namen nicht beim nächsten Wurf überschreiben.
  const [nameTouched, setNameTouched] = useState(false);

  return (
    <section className="picker" aria-label="Würfeln">
      <div className="picker-head">
        <h2>🎲 Gewürfelt</h2>
        <button type="button" className="btn btn-link" onClick={onDone}>
          Abbrechen
        </button>
      </div>
      <div className="card dice-preview" key={rolls}>
        <FacadePreview facade={building.facade} size={plot.size} label={building.name} maxHeight={220} />
      </div>
      <BuildingNameField
        value={name}
        onChange={(value) => {
          setName(value);
          setNameTouched(true);
        }}
      />
      <p className="subtle">
        Bringt 🪙 {formatRate(buildingRentPerMinute(plot.size, building))} pro Minute · {building.facade.floors} Stockwerk
        {building.facade.floors > 1 ? "e" : ""}
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const next = roll();
            setBuilding(next);
            setRolls((n) => n + 1);
            if (!nameTouched) setName(personalName(playerName, next.name));
          }}
        >
          Nochmal 🎲
        </button>
        <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={() => void place(building, name)}>
          Bauen
        </button>
      </div>
    </section>
  );
}
