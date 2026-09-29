import { useState } from "react";
import { formatRate } from "../format";
import { randomBuilding } from "../game/randomBuilding";
import { buildingIncomePerHour } from "../game/rent";
import { BuildingEconomy } from "./BuildingEconomy";
import { cleanBuildingName, personalName } from "../game/names";
import { buildingFromTemplate, templatesFor, type Template } from "../game/templates";
import type { Building, BuildingUse, Plot } from "../model/types";
import { isUnlocked } from "../parts/catalog";
import { useGameStore } from "../store/gameStore";
import { BuildingNameField } from "./BuildingNameField";
import { FacadePreview } from "./FacadePreview";
import { UsePicker, useLabel } from "./UsePicker";
import { sound } from "../audio/sound";

export type BuildMode = "template" | "random";

/** Auswahl eines neuen Gebäudes: Vorlagen-Liste oder Würfeln. */
export function BuildPicker({ plot, mode, streetId, onDone }: { plot: Plot; mode: BuildMode; streetId?: string; onDone: () => void }) {
  return mode === "template" ? (
    <TemplateList plot={plot} streetId={streetId} onDone={onDone} />
  ) : (
    <Dice plot={plot} streetId={streetId} onDone={onDone} />
  );
}

/** Baut das Gebäude mit dem gewählten Namen; ohne gültigen Namen passiert nichts. */
function useBuild(plot: Plot, streetId: string | undefined, onDone: () => void) {
  const build = useGameStore((s) => s.build);
  return async (building: Building, name: string, use: BuildingUse) => {
    const clean = cleanBuildingName(name);
    if (clean && (await build(plot.id, { ...building, name: clean, use }, streetId))) {
      sound.build();
      onDone();
    } else {
      sound.deny();
    }
  };
}

const usePlayerName = () => useGameStore((s) => s.player!.name);

function TemplateList({ plot, streetId, onDone }: { plot: Plot; streetId?: string; onDone: () => void }) {
  const place = useBuild(plot, streetId, onDone);
  const playerName = usePlayerName();
  const [use, setUse] = useState<BuildingUse>("residential");
  const templates = templatesFor(plot.size, use);
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
          <FacadePreview facade={chosen.facade} size={plot.size} label={chosen.name} maxHeight={200} building={{ ...building, name }} />
        </div>
        <BuildingNameField value={name} onChange={setName} use={chosen.use} />
        <p className="subtle">{useLabel(chosen.use)}</p>
        <BuildingEconomy size={plot.size} building={building} />
        <button type="button" className="btn btn-primary btn-wide" disabled={!name.trim()} onClick={() => void place(building, name, chosen.use)}>
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
      <UsePicker value={use} onChange={setUse} />
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
              <FacadePreview facade={template.facade} size={plot.size} label={template.name} maxHeight={120} building={building} />
              <strong>{template.name}</strong>
              <span className="subtle">
                bis 🪙 {formatRate(buildingIncomePerHour(plot.size, building))}/Std.
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Dice({ plot, streetId, onDone }: { plot: Plot; streetId?: string; onDone: () => void }) {
  const place = useBuild(plot, streetId, onDone);
  const unlockedParts = useGameStore((s) => s.player!.unlockedParts);
  // Würfeln nutzt nur freigeschaltete Bausteine (Vorlagen dagegen sind fertige Gebäude).
  const roll = (use: BuildingUse) => randomBuilding(plot.size, Math.random, { use, isAvailable: (part) => isUnlocked(part, unlockedParts) });
  const playerName = usePlayerName();
  const [use, setUse] = useState<BuildingUse>("residential");
  const [building, setBuilding] = useState(() => roll(use));
  const [rolls, setRolls] = useState(1);
  const [name, setName] = useState(() => personalName(playerName, building.name));
  // Einen selbst getippten Namen nicht beim nächsten Wurf überschreiben.
  const [nameTouched, setNameTouched] = useState(false);

  function reroll(nextUse = use) {
    const next = roll(nextUse);
    sound.tap();
    setBuilding(next);
    setRolls((n) => n + 1);
    if (!nameTouched) setName(personalName(playerName, next.name));
  }

  return (
    <section className="picker" aria-label="Würfeln">
      <div className="picker-head">
        <h2>🎲 Gewürfelt</h2>
        <button type="button" className="btn btn-link" onClick={onDone}>
          Abbrechen
        </button>
      </div>
      <UsePicker
        value={use}
        onChange={(next) => {
          setUse(next);
          reroll(next);
        }}
      />
      <div className="card dice-preview" key={rolls}>
        <FacadePreview facade={building.facade} size={plot.size} label={building.name} maxHeight={220} building={{ ...building, name }} />
      </div>
      <BuildingNameField
        use={use}
        value={name}
        onChange={(value) => {
          setName(value);
          setNameTouched(true);
        }}
      />
      <BuildingEconomy size={plot.size} building={building} />
      <div className="actions">
        <button type="button" className="btn" onClick={() => reroll()}>
          Nochmal 🎲
        </button>
        <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={() => void place(building, name, building.use ?? use)}>
          Bauen
        </button>
      </div>
    </section>
  );
}
