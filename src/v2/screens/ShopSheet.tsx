import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sound } from "../../audio/sound";
import { formatCoins } from "../../format";
import { Sheet } from "../components/Sheet";
import { ShopFront } from "../components/ShopFront";
import { FALLBACK_SHOP, LOOKS, MAX_SHOPS_PER_MEMBER, SHOP_GROUPS, SHOP_NAME_MAX, SHOP_TYPES, shopType, type ShopGroup } from "../config/shops";
import { lotsOf, openCostFor, residentsOf, shopIncomePerHour } from "../game/street";
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
      <p className="notice">🧪 Hier erfindest du bald eigene Waren für dein Schaufenster: {def.sells}.</p>

      {mine && (
        <>
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
