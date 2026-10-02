import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sound } from "../../audio/sound";
import { formatCoins } from "../../format";
import { SHOWS } from "../../config/streetLife";
import { StreetStage } from "../components/StreetStage";
import { MAX_SHOPS_PER_MEMBER } from "../config/shops";
import { attractionOf, lotsOf, residentsOf, shopIncomePerHour } from "../game/street";
import { useV2 } from "../store";

const REFRESH_MS = 60_000;

/** Die Straße füllt den Bildschirm; darüber schweben Name, Münzen und Kennzahlen, unten die Leiste. */
export function StageScreen() {
  const street = useV2((s) => s.street)!;
  const member = useV2((s) => s.member)!;
  const refresh = useV2((s) => s.refresh);
  const collect = useV2((s) => s.collect);
  const coins = useV2((s) => s.coins());
  const navigate = useNavigate();
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(() => useV2.getState().pending());

  // Regelmäßig nachsehen, was die anderen gemacht haben – und die Kassen ticken lassen.
  useEffect(() => {
    const tick = () => setPending(useV2.getState().pending());
    const timer = setInterval(tick, 1000);
    const sync = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      clearInterval(sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const stats = useMemo(() => {
    const lots = lotsOf(street, Date.now());
    const residents = residentsOf(lots);
    const own = street.shops.filter((s) => s.memberId === member.id);
    const income = own.reduce((sum, s) => sum + shopIncomePerHour(s, street, residents), 0);
    return { residents, income, own: own.length, attraction: attractionOf(street) };
  }, [street, member.id]);

  const say = (text: string) => {
    setNote(text);
    setTimeout(() => setNote((n) => (n === text ? null : n)), 2600);
  };

  async function onCollect() {
    const amount = await collect();
    if (amount > 0) {
      sound.coins(amount);
      say(`🪙 ${formatCoins(amount)} aus deinen Ladenkassen eingesammelt!`);
    } else sound.deny();
    setPending(useV2.getState().pending());
  }

  const soon = (what: string) => {
    sound.tap();
    say(`${what} kommt in der nächsten Etappe.`);
  };

  return (
    <div className="stage">
      <StreetStage
        street={street}
        memberId={member.id}
        canOpenShop={stats.own < MAX_SHOPS_PER_MEMBER}
        onShop={(shop) => {
          sound.tap();
          navigate(`/laden/${shop.id}`);
        }}
        onOpenShop={() => {
          sound.tap();
          navigate("/laden/neu");
        }}
        onMember={(m) => {
          sound.tap();
          navigate(m.id === member.id ? "/figur" : `/spieler/${m.id}`);
        }}
        onShow={(show) => setNote(show ? SHOWS.names[show.kind] : null)}
      />

      <div className="hud">
        <div className="chip chip-title">
          <b>{street.name}</b>
          <small>
            {street.city} · {street.members.length}/{street.maxMembers} Spieler
          </small>
        </div>
        <div className="chip chip-coins">🪙 {formatCoins(coins)}</div>
      </div>
      <div className="hud-stats">
        <span className="chip">👥 {Math.round(stats.residents)}</span>
        <span className="chip">
          📈 <b className="up">+{formatCoins(Math.round(stats.income))}/h</b>
        </span>
        <span className="chip">
          🏬 {stats.own}/{MAX_SHOPS_PER_MEMBER}
        </span>
        <span className="chip" title="Anziehungskraft der Straße">
          ⭐ {Math.round(stats.attraction * 100)} %
        </span>
      </div>

      {note && (
        <p className="stage-note" role="status">
          {note}
        </p>
      )}

      <button type="button" className="bag" onClick={() => void onCollect()} aria-label="Ladenkassen einsammeln">
        💰<small>{stats.own === 0 ? "kein Laden" : `+${formatCoins(Math.floor(pending))}`}</small>
      </button>

      <nav className="dock" aria-label="Hauptmenü">
        <button type="button" onClick={() => navigate("/figur")}>
          <span className="ico">🧍</span>Figur
        </button>
        <button type="button" onClick={() => soon("Bummeln in anderen Straßen")}>
          <span className="ico">🗺️</span>Bummeln
        </button>
        <button type="button" className="main" onClick={() => navigate("/mall")}>
          <span className="ico">🏬</span>Mall
        </button>
        <button type="button" onClick={() => soon("Das Live-Tagebuch")}>
          <span className="ico">📰</span>Zeitung
        </button>
        <button type="button" onClick={() => navigate("/mall#konto")}>
          <span className="ico">⚙️</span>Mehr
        </button>
      </nav>
    </div>
  );
}
