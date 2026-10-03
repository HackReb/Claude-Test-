import { Navigate, useNavigate, useParams } from "react-router-dom";
import { sound } from "../../audio/sound";
import { FigurePreview } from "../components/FigureSvg";
import { ItemPreview } from "../components/ItemSvg";
import { Sheet } from "../components/Sheet";
import { SLOTS } from "../config/items";
import { FALLBACK_SHOP, shopType } from "../config/shops";
import { figureOf, outfitOf, wornDesigns } from "../game/figure";
import { currentStreetOf, useV2 } from "../store";

/** Die Karte eines Mitspielers: Figur, was er trägt (und woher), seine Läden. */
export function PlayerSheet() {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const street = useV2(currentStreetOf)!;
  const me = useV2((s) => s.member)!;
  const member = street.members.find((m) => m.id === memberId);

  if (!member) {
    return (
      <Sheet title="Spieler" onClose={() => navigate("/")}>
        <p>Dieser Spieler ist nicht mehr in deiner Straße.</p>
      </Sheet>
    );
  }
  if (member.id === me.id) return <Navigate to="/figur" replace />;

  const figure = figureOf(member);
  const outfit = outfitOf(member);
  const shops = street.shops.filter((s) => s.memberId === member.id);
  const since = new Date(member.joinedAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" });
  const go = (to: string) => {
    sound.tap();
    navigate(to);
  };

  return (
    <Sheet title={member.name} onClose={() => navigate("/")}>
      <div className="figure-top">
        <div className="figure-preview">
          <FigurePreview figure={figure} worn={wornDesigns(figure)} id={`p-${member.id}`} size={150} />
        </div>
        <div className="figure-info">
          <b>{member.name}</b>
          <small>Seit {since} in der Straße.</small>
          {shops.length === 0 ? (
            <small>Hat noch keinen Laden.</small>
          ) : (
            <ul className="player-shops">
              {shops.map((s) => (
                <li key={s.id}>
                  <button type="button" className="btn btn-link" onClick={() => go(`/laden/${s.id}`)}>
                    {(shopType(s.type) ?? FALLBACK_SHOP).emoji} {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3 className="sub-head">Trägt gerade</h3>
      {outfit.length === 0 ? (
        <p className="subtle">Nichts Besonderes.</p>
      ) : (
        <ul className="outfit-list">
          {outfit.map((item) => {
            const shop = item.shopId ? street.shops.find((s) => s.id === item.shopId) : undefined;
            return (
              <li key={item.slot} className="outfit-row">
                <ItemPreview design={item.design} id={`o-${member.id}-${item.slot}`} size={44} />
                <div>
                  <b>{item.name}</b>
                  <small>
                    {SLOTS[item.slot].name}
                    {item.shopName ? ` · aus ${item.shopName}` : ""}
                  </small>
                </div>
                {shop && (
                  <button type="button" className="btn btn-small" onClick={() => go(`/laden/${shop.id}`)}>
                    Zum Laden
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
