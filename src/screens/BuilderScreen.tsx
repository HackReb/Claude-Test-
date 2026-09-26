import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { sound } from "../audio/sound";
import { EditorCanvas } from "../components/builder/EditorCanvas";
import { UsePicker } from "../components/UsePicker";
import { useOf } from "../game/life";
import { PartThumb } from "../components/builder/PartThumb";
import { ECONOMY } from "../config/economy";
import { formatCoins, formatRate } from "../format";
import { createId } from "../game/ids";
import { BUILDING_NAME_MAX_LENGTH, cleanBuildingName, personalName } from "../game/names";
import { belongsTo } from "../game/plots";
import { buildingRentPerMinute } from "../game/rent";
import type { Building, BuildingUse, Facade, Part, PartCategory, Plot } from "../model/types";
import { getPart, isUnlocked, partsOf } from "../parts/catalog";
import { partAt, placePart, removeAt, setFloors, setText, starterFacade, TEXT_MAX_LENGTH } from "../parts/editor";
import { FACADE_RULES, validateFacade } from "../parts/rules";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";
import { useStreetContext, type StreetContext } from "../store/useStreetContext";

type Tab = PartCategory | "erase";

const TABS: { id: Tab; label: string }[] = [
  { id: "base", label: "Wand" },
  { id: "roof", label: "Dach" },
  { id: "door", label: "Türen" },
  { id: "window", label: "Fenster" },
  { id: "deco", label: "Deko" },
  { id: "erase", label: "Weg" },
];


export function BuilderScreen() {
  const { plotId, streetId } = useParams();
  const ctx = useStreetContext(streetId);
  const playerId = useGameStore((s) => s.player!.id);
  const plot = ctx?.street.plots.find((p) => p.id === plotId);
  // Bauen nur auf eigenen Grundstücken – auch in Nachbarstraßen.
  if (!ctx || !plot || !belongsTo(ctx.street, plot, playerId)) {
    return <Navigate to={ctx && plot ? ctx.plotRoute(plot.id) : (ctx?.backRoute ?? routes.street)} replace />;
  }
  return <Builder plot={plot} ctx={ctx} />;
}

function Builder({ plot, ctx }: { plot: Plot; ctx: StreetContext }) {
  const player = useGameStore((s) => s.player)!;
  const build = useGameStore((s) => s.build);
  const unlock = useGameStore((s) => s.unlockPart);
  const navigate = useNavigate();

  const [name, setName] = useState(plot.building?.name ?? personalName(player.name, "Haus"));
  const [facade, setFacade] = useState<Facade>(() => structuredClone(plot.building?.facade ?? starterFacade()));
  const [tab, setTab] = useState<Tab>("door");
  const [toolId, setToolId] = useState<string | null>(null);
  const [active, setActive] = useState<{ x: number; y: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [offer, setOffer] = useState<Part | null>(null);
  const [use, setUse] = useState<BuildingUse>(plot.building ? useOf(plot.building) : "residential");

  const tool = toolId ? (getPart(toolId) ?? null) : null;
  const errors = validateFacade(facade, plot.size);
  const cleanName = cleanBuildingName(name);
  const draft: Building = { id: createId(), name: cleanName ?? "", level: 1, createdBy: "player", use, facade };
  const rent = buildingRentPerMinute(plot.size, draft);
  const count = (category: PartCategory) => facade.parts.filter((p) => getPart(p.partId)?.category === category).length;
  const activePart = active ? partAt(facade, active.x, active.y) : undefined;
  const editingText = activePart && getPart(activePart.partId)?.textFill ? activePart : undefined;
  const maxFloors = ECONOMY.plotSizes[plot.size].maxFloors;

  function onCell(x: number, y: number) {
    setMessage(null);
    if (tab === "erase") {
      sound.pickup();
      setFacade(removeAt(facade, x, y));
      setActive(null);
      return;
    }
    const existing = partAt(facade, x, y);
    // Gleiches Teil nochmal antippen = auswählen (z. B. um den Schild-Text zu ändern), nicht ersetzen.
    if (!tool || existing?.partId === tool.id) {
      setActive(existing ? { x, y } : null);
      if (!tool && !existing) setMessage("Wähl unten ein Teil aus und tipp dann auf die Fassade.");
      return;
    }
    const result = placePart(facade, plot.size, tool.id, x, y);
    if (result.ok) {
      setFacade(result.facade);
      setActive({ x, y });
      sound.tap();
    } else {
      setMessage(result.reason);
      sound.deny();
    }
  }

  function onPalette(part: Part) {
    setMessage(null);
    if (!isUnlocked(part, player.unlockedParts)) {
      setOffer(part);
      return;
    }
    select(part);
  }

  function select(part: Part) {
    setOffer(null);
    if (part.category === "base") setFacade({ ...facade, base: { partId: part.id } });
    else if (part.category === "roof") setFacade({ ...facade, roof: { partId: part.id } });
    else setToolId(toolId === part.id ? null : part.id);
  }

  async function onUnlock(part: Part) {
    const result = await unlock(part.id);
    if (result.ok) sound.cash();
    // Direkt auswählen – `player` in diesem Render ist noch der Stand vor dem Freischalten.
    if (result.ok) select(part);
  }

  async function onBuild() {
    if (errors.length || !cleanName) return;
    if (await build(plot.id, draft, ctx.streetId)) {
      sound.build();
      navigate(ctx.plotRoute(plot.id));
    }
  }

  const selectTab = (next: Tab) => {
    setTab(next);
    setOffer(null);
    setMessage(null);
    if (next === "erase") setToolId(null);
    else if (tool && tool.category !== next) setToolId(null);
  };

  return (
    <div className="builder">
      <div className="builder-head">
        <Link className="btn btn-link back" to={ctx.plotRoute(plot.id)}>
          ← Abbrechen
        </Link>
        <label className="field builder-name">
          <span className="sr-only">Name des Gebäudes</span>
          <input
            value={name}
            maxLength={BUILDING_NAME_MAX_LENGTH}
            placeholder="Name am Haus"
            aria-invalid={!cleanName}
            onChange={(e) => setName(e.target.value)}
            aria-label="Name des Gebäudes"
          />
        </label>
      </div>

      <div className="card builder-stage">
        <EditorCanvas facade={facade} size={plot.size} tool={tool} erasing={tab === "erase"} active={active} onCell={onCell} />
      </div>

      <div className="builder-stats">
        <strong className="builder-rent">🪙 {formatRate(rent)}/min</strong>
        <span className="subtle">
          Türen {count("door")} · Fenster {count("window")}/{FACADE_RULES.maxWindows} · Deko {count("deco")}/{FACADE_RULES.maxDeco}
        </span>
        {maxFloors > 1 && (
          <div className="stepper" role="group" aria-label="Stockwerke">
            <button type="button" className="btn" disabled={facade.floors <= 1} onClick={() => setFacade(setFloors(facade, plot.size, facade.floors - 1))} aria-label="Ein Stockwerk weniger">
              −
            </button>
            <span>
              {facade.floors} Stockwerk{facade.floors > 1 ? "e" : ""}
            </span>
            <button type="button" className="btn" disabled={facade.floors >= maxFloors} onClick={() => setFacade(setFloors(facade, plot.size, facade.floors + 1))} aria-label="Ein Stockwerk mehr">
              +
            </button>
          </div>
        )}
      </div>

      <UsePicker value={use} onChange={setUse} />

      {editingText && (
        <label className="field">
          <span>Text auf dem {getPart(editingText.partId)?.name}</span>
          <input
            value={editingText.text ?? ""}
            maxLength={TEXT_MAX_LENGTH}
            autoCapitalize="characters"
            onChange={(e) => setFacade(setText(facade, editingText.x, editingText.y, e.target.value))}
          />
        </label>
      )}

      {message && <p className="error" role="status">{message}</p>}

      <div className="palette">
        <div className="palette-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "selected" : ""} onClick={() => selectTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "erase" ? (
          <p className="hint left palette-hint">Tipp auf ein Teil der Fassade, um es zu entfernen.</p>
        ) : (
          <>
            <div className="palette-parts">
              {partsOf(tab).map((part) => {
                const unlocked = isUnlocked(part, player.unlockedParts);
                const selected =
                  part.id === toolId || part.id === facade.base.partId || part.id === facade.roof.partId;
                return (
                  <button
                    key={part.id}
                    type="button"
                    className={`palette-part${selected ? " selected" : ""}${unlocked ? "" : " locked"}`}
                    aria-pressed={selected}
                    onClick={() => onPalette(part)}
                  >
                    <PartThumb part={part} />
                    <span>{part.name}</span>
                    {!unlocked && <small>🔒 {formatCoins(part.price)}</small>}
                  </button>
                );
              })}
            </div>
            {tab !== "base" && tab !== "roof" && !offer && (
              <p className="hint left palette-hint">
                {tool ? `${tool.name} ausgewählt – tipp auf ein hervorgehobenes Feld.` : "Teil auswählen, dann auf die Fassade tippen."}
              </p>
            )}
          </>
        )}

        {offer && (
          <div className="unlock-offer">
            <p>
              <strong>{offer.name}</strong> freischalten für <strong>🪙 {formatCoins(offer.price)}</strong>?
              {player.coins < offer.price && <> Dir fehlen noch 🪙 {formatCoins(offer.price - player.coins)}.</>}
            </p>
            <div className="actions">
              <button type="button" className="btn btn-primary" disabled={player.coins < offer.price} onClick={() => void onUnlock(offer)}>
                Freischalten
              </button>
              <button type="button" className="btn btn-link" onClick={() => setOffer(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {(errors.length > 0 || !cleanName) && (
        <ul className="builder-errors">
          {!cleanName && <li>Gib deinem Haus oben einen Namen.</li>}
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-primary btn-wide" disabled={errors.length > 0 || !cleanName} onClick={() => void onBuild()}>
        {plot.building ? `${draft.name || "Haus"} bauen (ersetzt ${plot.building.name})` : `${draft.name || "Haus"} bauen`}
      </button>
    </div>
  );
}
