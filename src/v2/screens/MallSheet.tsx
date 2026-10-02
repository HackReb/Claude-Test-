import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCoins } from "../../format";
import { Sheet } from "../components/Sheet";
import { MAX_SHOPS_PER_MEMBER, shopType, FALLBACK_SHOP, SHOP_GROUPS } from "../config/shops";
import { groupsOf, lotsOf, mallFloors, openCostFor, residentsOf, shopIncomePerHour } from "../game/street";
import { useV2 } from "../store";

/** Die Mall im Überblick: Stockwerke, Läden mit Besitzern, freie Plätze – und unten das Konto. */
export function MallSheet() {
  const street = useV2((s) => s.street)!;
  const member = useV2((s) => s.member)!;
  const account = useV2((s) => s.account)!;
  const logout = useV2((s) => s.logout);
  const leave = useV2((s) => s.leave);
  const navigate = useNavigate();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const residents = residentsOf(lotsOf(street, Date.now()));
  const own = street.shops.filter((s) => s.memberId === member.id);
  const nameOf = (memberId: string) => street.members.find((m) => m.id === memberId)?.name ?? "?";
  const floors = mallFloors(street.shops);
  const groups = groupsOf(street.shops);
  const cost = openCostFor(own.length);
  const canOpen = own.length < MAX_SHOPS_PER_MEMBER;

  return (
    <Sheet title={`🏬 Mall ${street.name}`} onClose={() => navigate("/")}>
      <p className="subtle">
        {street.shops.length} {street.shops.length === 1 ? "Laden" : "Läden"} auf {floors} {floors === 1 ? "Stockwerk" : "Stockwerken"} · {groups.size} von{" "}
        {Object.keys(SHOP_GROUPS).length} Branchen · {street.members.length} Spieler
      </p>
      {groups.size < 3 && (
        <p className="notice">
          Tipp: Je mehr verschiedene Branchen die Mall hat, desto mehr Leute ziehen in die Straße – und desto mehr Kundschaft haben alle Läden.
        </p>
      )}

      <button type="button" className="btn btn-primary btn-wide" disabled={!canOpen} onClick={() => navigate("/laden/neu")}>
        {canOpen ? `Laden eröffnen${cost > 0 ? ` für 🪙 ${formatCoins(cost)}` : " – der erste ist gratis"}` : `Du hast schon ${MAX_SHOPS_PER_MEMBER} Läden`}
      </button>

      <ul className="shop-list">
        {street.shops.map((shop) => {
          const def = shopType(shop.type) ?? FALLBACK_SHOP;
          const mine = shop.memberId === member.id;
          return (
            <li key={shop.id}>
              <button type="button" className={`shop-row${mine ? " mine" : ""}`} onClick={() => navigate(`/laden/${shop.id}`)}>
                <span className="shop-emoji">{def.emoji}</span>
                <span className="shop-text">
                  <b>{shop.name}</b>
                  <small>
                    {def.name} · {mine ? "dein Laden" : nameOf(shop.memberId)} · 📈 +{formatCoins(Math.round(shopIncomePerHour(shop, street, residents)))}/h
                  </small>
                </span>
                <span className="chev">›</span>
              </button>
            </li>
          );
        })}
        {street.shops.length === 0 && <li className="subtle">Noch kein Laden – eröffne den ersten!</li>}
      </ul>

      <section className="account-box" id="konto">
        <h3>Konto</h3>
        <p className="subtle">
          Angemeldet als <b>{account.name}</b> · in der {street.name}, {street.city}
        </p>
        <div className="row-buttons">
          <button type="button" className="btn" onClick={() => void logout()}>
            Abmelden
          </button>
          {!confirmLeave ? (
            <button type="button" className="btn btn-link" onClick={() => setConfirmLeave(true)}>
              Straße verlassen
            </button>
          ) : (
            <div className="confirm">
              <p>Wirklich? Deine Läden sind dann weg.</p>
              <button type="button" className="btn btn-danger" onClick={() => void leave()}>
                Ja, Straße verlassen
              </button>
              <button type="button" className="btn btn-link" onClick={() => setConfirmLeave(false)}>
                Abbrechen
              </button>
            </div>
          )}
        </div>
      </section>
    </Sheet>
  );
}
