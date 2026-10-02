import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sound } from "../../audio/sound";
import { FigurePreview } from "../components/FigureSvg";
import { ItemPreview } from "../components/ItemSvg";
import { Sheet } from "../components/Sheet";
import { HAIR_COLORS, HAIR_STYLES, SKINS, SLOT_ORDER, SLOTS, type Slot } from "../config/items";
import { figureOf, wardrobe, wear, wornDesigns } from "../game/figure";
import type { Figure } from "../model/types";
import { useV2 } from "../store";

/** Die eigene Figur: Haut, Haare und je Platz ein Stück aus dem Schrank – Grund-Teile oder gekaufte Waren. */
export function FigureSheet() {
  const navigate = useNavigate();
  const member = useV2((s) => s.member)!;
  const saveFigure = useV2((s) => s.saveFigure);
  const figure = useMemo(() => figureOf({ id: member.id, figure: member.data.figure }), [member.id, member.data.figure]);
  const inventory = member.data.inventory ?? [];
  const closet = useMemo(() => wardrobe(inventory), [inventory]);
  const [slot, setSlot] = useState<Slot>("top");
  const [tab, setTab] = useState<"kleidung" | "aussehen">("kleidung");

  const update = (next: Figure) => {
    sound.tap();
    void saveFigure(next);
  };
  const setBase = (patch: Partial<Figure["base"]>) => update({ ...figure, base: { ...figure.base, ...patch } });
  const bought = inventory.length;

  return (
    <Sheet title="Deine Figur" onClose={() => navigate("/")}>
      <div className="figure-top">
        <div className="figure-preview">
          <FigurePreview figure={figure} worn={wornDesigns(figure)} id="me" size={150} />
        </div>
        <div className="figure-info">
          <b>{member.name}</b>
          <small>
            {bought === 0 ? "Noch nichts gekauft." : `${bought} Sache${bought === 1 ? "" : "n"} im Schrank.`} Neue Sachen findest du in den Schaufenstern der Mall.
          </small>
          <button type="button" className="btn btn-link" onClick={() => navigate("/mall")}>
            Zur Mall
          </button>
        </div>
      </div>

      <div className="group-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "kleidung"} className={tab === "kleidung" ? "on" : ""} onClick={() => setTab("kleidung")}>
          👕 Anziehen
        </button>
        <button type="button" role="tab" aria-selected={tab === "aussehen"} className={tab === "aussehen" ? "on" : ""} onClick={() => setTab("aussehen")}>
          🧑 Aussehen
        </button>
      </div>

      {tab === "kleidung" ? (
        <>
          <div className="slot-chips" role="tablist" aria-label="Platz">
            {SLOT_ORDER.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={slot === s} className={`slot-chip${slot === s ? " on" : ""}${figure.worn[s] ? " worn" : ""}`} onClick={() => setSlot(s)}>
                {SLOTS[s].emoji} {SLOTS[s].name}
                {closet[s].length > 0 && <small>{closet[s].length}</small>}
              </button>
            ))}
          </div>
          <div className="item-grid">
            <button type="button" className={`item-card${!figure.worn[slot] ? " on" : ""}`} aria-pressed={!figure.worn[slot]} onClick={() => update(wear(figure, slot, null))}>
              <span className="item-none">∅</span>
              <b>Nichts</b>
            </button>
            {closet[slot].map((item) => {
              const on = figure.worn[slot]?.id === item.id;
              return (
                <button key={item.id} type="button" className={`item-card${on ? " on" : ""}`} aria-pressed={on} onClick={() => update(wear(figure, slot, item))}>
                  <ItemPreview design={item.design} id={`c-${item.id}`} size={56} />
                  <b>{item.name}</b>
                  {item.shopName && <small>aus {item.shopName}</small>}
                </button>
              );
            })}
          </div>
          {closet[slot].length === 0 && (
            <p className="subtle">
              Für „{SLOTS[slot].name}“ hast du noch nichts. Vielleicht erfindet jemand in der Mall etwas – oder du selbst in deinem Laden.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="field">
            <span>Haut</span>
            <div className="swatches">
              {SKINS.map((c) => (
                <button key={c} type="button" className={`swatch${figure.base.skin === c ? " on" : ""}`} style={{ background: c }} aria-label={`Hautfarbe ${c}`} aria-pressed={figure.base.skin === c} onClick={() => setBase({ skin: c })} />
              ))}
            </div>
          </div>
          <div className="field">
            <span>Haarfarbe</span>
            <div className="swatches">
              {HAIR_COLORS.map((c) => (
                <button key={c} type="button" className={`swatch${figure.base.hair === c ? " on" : ""}`} style={{ background: c }} aria-label={`Haarfarbe ${c}`} aria-pressed={figure.base.hair === c} onClick={() => setBase({ hair: c })} />
              ))}
            </div>
          </div>
          <div className="field">
            <span>Frisur</span>
            <div className="slot-chips">
              {HAIR_STYLES.map((h) => (
                <button key={h.id} type="button" className={`slot-chip${figure.base.hairStyle === h.id ? " on" : ""}`} aria-pressed={figure.base.hairStyle === h.id} onClick={() => setBase({ hairStyle: h.id })}>
                  {h.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
