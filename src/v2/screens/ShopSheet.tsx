import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sound } from "../../audio/sound";
import { formatCoins } from "../../format";
import { Sheet } from "../components/Sheet";
import { ItemPreview } from "../components/ItemSvg";
import { ShopFront } from "../components/ShopFront";
import { INVENT, SLOTS, slotsForType, type Slot } from "../config/items";
import { FALLBACK_SHOP, LOOKS, MAX_SHOPS_PER_MEMBER, SHOP_GROUPS, SHOP_NAME_MAX, SHOP_TYPES, shopType, type ShopGroup } from "../config/shops";
import { describeDesign, designFromText } from "../game/designer";
import { inventionsLeft, residentSalesPerHour } from "../game/figure";
import { lotsOf, openCostFor, residentsOf, shopIncomePerHour } from "../game/street";
import type { Shop, ShopItem } from "../model/types";
import { useV2 } from "../store";

const GROUP_ORDER = Object.keys(SHOP_GROUPS) as ShopGroup[];

/** Laden eröffnen (Typ, Name, Fassade) oder einen bestehenden ansehen und – wenn er mir gehört – ändern. */
export function ShopSheet({ mode }: { mode: "new" | "edit" }) {
  const navigate = useNavigate();
  const { shopId } = useParams();
  const street = useV2((s) => s.street)!;
  const member = useV2((s) => s.member)!;
  const shop = mode === "edit" ? street.shops.find((s) => s.id === shopId) : undefined;

  if (mode === "edit" && !shop) {
    return (
      <Sheet title="Laden" onClose={() => navigate("/")}>
        <p>Diesen Laden gibt es nicht mehr.</p>
      </Sheet>
    );
  }
  if (mode === "edit" && shop) return <ShopDetails shopId={shop.id} mine={shop.memberId === member.id} />;
  return <NewShop />;
}

function NewShop() {
  const navigate = useNavigate();
  const street = useV2((s) => s.street)!;
  const member = useV2((s) => s.member)!;
  const coins = useV2((s) => s.coins());
  const openShop = useV2((s) => s.openShop);
  const [group, setGroup] = useState<ShopGroup>("alltag");
  const [typeId, setTypeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [look, setLook] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const own = street.shops.filter((s) => s.memberId === member.id).length;
  const cost = openCostFor(own);
  const type = typeId ? shopType(typeId) : undefined;
  const taken = new Set(street.shops.map((s) => s.type));
  const valid = !!type && name.trim().length >= 2 && own < MAX_SHOPS_PER_MEMBER && coins >= cost;

  async function onOpen() {
    if (!valid || !type || busy) return;
    setBusy(true);
    setError(null);
    const result = await openShop(type.id, name.trim(), look);
    setBusy(false);
    if (!result.ok) {
      sound.deny();
      setError(result.message);
      return;
    }
    sound.cash();
    navigate(`/laden/${result.shop!.id}`, { replace: true });
  }

  return (
    <Sheet title="Laden eröffnen" onClose={() => navigate("/mall")}>
      {own >= MAX_SHOPS_PER_MEMBER ? (
        <p className="notice">Du hast schon {MAX_SHOPS_PER_MEMBER} Läden – mehr gehen nicht.</p>
      ) : (
        <>
          <p className="subtle">
            {cost > 0 ? `Dein ${own + 1}. Laden kostet 🪙 ${formatCoins(cost)}.` : "Dein erster Laden ist gratis."} Läden, die es in der Mall noch nicht gibt,
            bringen mehr Kundschaft für alle.
          </p>
          <div className="group-tabs" role="tablist">
            {GROUP_ORDER.map((g) => (
              <button key={g} type="button" role="tab" aria-selected={group === g} className={group === g ? "on" : ""} onClick={() => setGroup(g)}>
                {SHOP_GROUPS[g].emoji} {SHOP_GROUPS[g].name}
              </button>
            ))}
          </div>
          <div className="type-grid">
            {SHOP_TYPES.filter((t) => t.group === group).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`type-card${typeId === t.id ? " on" : ""}`}
                aria-pressed={typeId === t.id}
                onClick={() => {
                  sound.tap();
                  setTypeId(t.id);
                }}
              >
                <span className="type-emoji">{t.emoji}</span>
                <b>{t.name}</b>
                <small>{t.sells}</small>
                {taken.has(t.id) && <em>schon in der Mall</em>}
              </button>
            ))}
          </div>

          {type && (
            <>
              <label className="field">
                <span>Name deines Ladens</span>
                <input value={name} maxLength={SHOP_NAME_MAX} placeholder={`z. B. ${member.name}s ${type.name}`} onChange={(e) => setName(e.target.value)} />
              </label>
              <div className="field">
                <span>Fassade</span>
                <div className="look-row">
                  {Array.from({ length: LOOKS }, (_, i) => (
                    <button key={i} type="button" className={`look-card${look === i ? " on" : ""}`} aria-pressed={look === i} onClick={() => setLook(i)}>
                      <svg viewBox="0 0 120 68" width={120} height={68} aria-hidden>
                        <ShopFront type={type.id} name={name.trim() || type.name} look={i} width={120} height={68} />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="error">{error}</p>}
              <button type="button" className="btn btn-primary btn-wide" disabled={!valid || busy} onClick={() => void onOpen()}>
                {busy ? "Moment …" : cost > 0 ? `Eröffnen für 🪙 ${formatCoins(cost)}` : "Eröffnen"}
              </button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

function ShopDetails({ shopId, mine }: { shopId: string; mine: boolean }) {
  const navigate = useNavigate();
  const street = useV2((s) => s.street)!;
  const updateShop = useV2((s) => s.updateShop);
  const closeShop = useV2((s) => s.closeShop);
  const shop = street.shops.find((s) => s.id === shopId)!;
  const def = shopType(shop.type) ?? FALLBACK_SHOP;
  const owner = street.members.find((m) => m.id === shop.memberId)?.name ?? "?";
  const residents = residentsOf(lotsOf(street, Date.now()));
  const [name, setName] = useState(shop.name);
  const [look, setLook] = useState(shop.look);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const changed = name.trim() !== shop.name || look !== shop.look;

  async function onSave() {
    if (busy || !changed) return;
    setBusy(true);
    setError(null);
    const result = await updateShop(shop.id, { name: name.trim(), look });
    setBusy(false);
    if (!result.ok) setError(result.message);
    else sound.sparkle();
  }

  return (
    <Sheet title={`${def.emoji} ${shop.name}`} onClose={() => navigate("/mall")}>
      <svg viewBox="0 0 200 110" className="shop-preview" aria-hidden>
        <ShopFront type={shop.type} name={mine ? name.trim() || shop.name : shop.name} look={mine ? look : shop.look} width={200} height={110} />
      </svg>
      <p className="subtle">
        {def.name} · {mine ? "dein Laden" : `gehört ${owner}`} · 📈 +{formatCoins(Math.round(shopIncomePerHour(shop, street, residents)))}/h
      </p>
      <Wares shop={shop} mine={mine} residents={residents} />

      {mine && (
        <>
          <h3 className="sub-head">Laden</h3>
          <label className="field">
            <span>Name</span>
            <input value={name} maxLength={SHOP_NAME_MAX} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span>Fassade</span>
            <div className="look-row">
              {Array.from({ length: LOOKS }, (_, i) => (
                <button key={i} type="button" className={`look-card${look === i ? " on" : ""}`} aria-pressed={look === i} onClick={() => setLook(i)}>
                  <svg viewBox="0 0 120 68" width={120} height={68} aria-hidden>
                    <ShopFront type={shop.type} name={name.trim() || shop.name} look={i} width={120} height={68} />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn btn-primary btn-wide" disabled={!changed || busy || name.trim().length < 2} onClick={() => void onSave()}>
            Speichern
          </button>
          {!confirmClose ? (
            <button type="button" className="btn btn-link" onClick={() => setConfirmClose(true)}>
              Laden schließen
            </button>
          ) : (
            <div className="confirm">
              <p>Den Laden wirklich schließen? Das Geld für die Eröffnung gibt es nicht zurück.</p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  const result = await closeShop(shop.id);
                  if (result.ok) navigate("/mall", { replace: true });
                  else setError(result.message);
                }}
              >
                Ja, schließen
              </button>
              <button type="button" className="btn btn-link" onClick={() => setConfirmClose(false)}>
                Abbrechen
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Das Sortiment: Besucher sehen das Schaufenster und kaufen, der Besitzer erfindet und ordnet. */
function Wares({ shop, mine, residents }: { shop: Shop; mine: boolean; residents: number }) {
  const navigate = useNavigate();
  const member = useV2((s) => s.member)!;
  const coins = useV2((s) => s.coins());
  const buy = useV2((s) => s.buy);
  const updateItems = useV2((s) => s.updateItems);
  const items = shop.data.items ?? [];
  const showcase = items.filter((i) => i.showcase);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const owned = new Set((member.data.inventory ?? []).map((o) => o.itemId));

  async function onBuy(item: ShopItem) {
    if (busy) return;
    setBusy(item.id);
    const result = await buy(shop.id, item.id);
    setBusy(null);
    if (!result.ok) {
      sound.deny();
      setNote({ text: result.message, ok: false });
      return;
    }
    sound.cash();
    setNote({ text: `${item.name} gehört jetzt dir – zieh es gleich an!`, ok: true });
  }

  async function patch(id: string, change: Partial<ShopItem> | null) {
    if (busy) return;
    setBusy(id);
    const next = change ? items.map((i) => (i.id === id ? { ...i, ...change } : i)) : items.filter((i) => i.id !== id);
    const result = await updateItems(shop.id, next);
    setBusy(null);
    if (!result.ok) setNote({ text: result.message, ok: false });
    else sound.tap();
  }

  if (!mine) {
    return (
      <section className="wares">
        <h3 className="sub-head">Schaufenster</h3>
        {showcase.length === 0 ? (
          <p className="subtle">Hier liegt noch nichts im Schaufenster.</p>
        ) : (
          <ul className="ware-list">
            {showcase.map((item) => (
              <li key={item.id} className="ware-row">
                <ItemPreview design={item.design} id={`s-${item.id}`} size={52} />
                <div className="ware-text">
                  <b>{item.name}</b>
                  <small>
                    {SLOTS[item.design.slot].name} · {describeDesign(item.design)}
                    {item.sold > 0 ? ` · ${item.sold}× verkauft` : ""}
                  </small>
                  {item.description && <em>„{item.description}“</em>}
                </div>
                <button type="button" className="btn btn-primary btn-small" disabled={busy !== null || coins < item.price} onClick={() => void onBuy(item)}>
                  {busy === item.id ? "…" : `🪙 ${formatCoins(item.price)}`}
                  {owned.has(item.id) && <small>nochmal</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {note && (
          <p className={note.ok ? "notice" : "error"} role="status">
            {note.text}
            {note.ok && (
              <button type="button" className="btn btn-link" onClick={() => navigate("/figur")}>
                Anziehen
              </button>
            )}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="wares">
      <h3 className="sub-head">
        Dein Sortiment <small>{showcase.length}/{INVENT.showcasePerShop} im Schaufenster</small>
      </h3>
      {items.length === 0 && <p className="subtle">Noch keine Ware. Erfinde unten deine erste – Bewohner und Mitspieler kaufen, was im Schaufenster liegt.</p>}
      <ul className="ware-list">
        {items.map((item) => (
          <li key={item.id} className={`ware-row${item.showcase ? "" : " off"}`}>
            <ItemPreview design={item.design} id={`s-${item.id}`} size={52} />
            <div className="ware-text">
              <b>{item.name}</b>
              <small>
                {SLOTS[item.design.slot].name} · {describeDesign(item.design)} · {item.sold}× an Spieler
                {item.showcase ? ` · ≈${(residentSalesPerHour(item, residents) * 24).toFixed(1)} Bewohner/Tag` : ""}
              </small>
              <label className="price-field">
                🪙
                <input
                  type="number"
                  min={INVENT.priceMin}
                  max={INVENT.priceMax}
                  defaultValue={item.price}
                  aria-label={`Preis für ${item.name}`}
                  onBlur={(e) => {
                    const price = Math.min(INVENT.priceMax, Math.max(INVENT.priceMin, Math.round(Number(e.target.value)) || item.price));
                    e.target.value = String(price);
                    if (price !== item.price) void patch(item.id, { price });
                  }}
                />
              </label>
            </div>
            <div className="ware-actions">
              <button
                type="button"
                className={`btn btn-small${item.showcase ? " btn-primary" : ""}`}
                disabled={busy !== null || (!item.showcase && showcase.length >= INVENT.showcasePerShop)}
                aria-pressed={item.showcase}
                onClick={() => void patch(item.id, { showcase: !item.showcase })}
              >
                {item.showcase ? "im Fenster" : "ins Fenster"}
              </button>
              <button type="button" className="btn btn-link" disabled={busy !== null} aria-label={`${item.name} löschen`} onClick={() => void patch(item.id, null)}>
                löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
      {note && (
        <p className={note.ok ? "notice" : "error"} role="status">
          {note.text}
        </p>
      )}
      <Invent shop={shop} />
    </section>
  );
}

/** Beschreiben, Platz wählen, Preis setzen – und die Vorschau zeigt sofort, was daraus wird. */
function Invent({ shop }: { shop: Shop }) {
  const member = useV2((s) => s.member)!;
  const coins = useV2((s) => s.coins());
  const invent = useV2((s) => s.invent);
  const slots = slotsForType(shop.type);
  const [slot, setSlot] = useState<Slot>(slots[0]);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(INVENT.priceDefault);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (description.trim() ? designFromText(description, slot) : null), [description, slot]);
  const left = inventionsLeft(member, Date.now());
  const items = shop.data.items ?? [];
  const full = items.length >= INVENT.itemsPerShop;
  const label = name.trim() || description.trim().slice(0, 24);
  const valid = !!preview && label.length >= 2 && left > 0 && !full && coins >= INVENT.cost;

  async function onInvent() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const result = await invent(shop.id, { name: label, description, slot, price });
    setBusy(false);
    if (!result.ok) {
      sound.deny();
      setError(result.message);
      return;
    }
    sound.sparkle();
    setDescription("");
    setName("");
  }

  return (
    <div className="invent">
      <h3 className="sub-head">
        Neue Ware erfinden <small>{left > 0 ? `${left}× heute` : "morgen wieder"}</small>
      </h3>
      {full ? (
        <p className="subtle">Dein Laden ist voll ({INVENT.itemsPerShop} Waren). Lösch etwas, um Platz zu machen.</p>
      ) : (
        <>
          <div className="slot-chips" role="tablist" aria-label="Was für eine Ware">
            {slots.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={slot === s} className={`slot-chip${slot === s ? " on" : ""}`} onClick={() => setSlot(s)}>
                {SLOTS[s].emoji} {SLOTS[s].name}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Beschreib sie – Farben, Muster, Form</span>
            <input
              value={description}
              maxLength={INVENT.descriptionMax}
              placeholder={slot === "pet" ? "z. B. grün-blau gepunkteter Dino" : slot === "hand" ? "z. B. braune Peitsche wie bei Indiana Jones" : "z. B. rot gestreift mit gelben Punkten"}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="invent-row">
            <div className="invent-preview" aria-live="polite">
              {preview ? <ItemPreview design={preview} id="invent-preview" size={84} /> : <span className="item-none">?</span>}
              {preview && <small>{describeDesign(preview)}</small>}
            </div>
            <div className="invent-fields">
              <label className="field">
                <span>Name im Schaufenster</span>
                <input value={name} maxLength={24} placeholder={label || "Name"} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span>Preis (🪙 {INVENT.priceMin}–{INVENT.priceMax})</span>
                <input type="number" min={INVENT.priceMin} max={INVENT.priceMax} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </label>
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn btn-primary btn-wide" disabled={!valid || busy} onClick={() => void onInvent()}>
            {busy ? "Moment …" : `Erfinden für 🪙 ${INVENT.cost}`}
          </button>
        </>
      )}
    </div>
  );
}
