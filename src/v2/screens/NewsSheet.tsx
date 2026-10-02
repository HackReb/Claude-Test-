import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sound } from "../../audio/sound";
import { formatCoins } from "../../format";
import { ItemPreview } from "../components/ItemSvg";
import { Sheet } from "../components/Sheet";
import { SHOP_GROUPS } from "../config/shops";
import { agoText, bestsellers, headline } from "../game/news";
import { attractionOf, groupsOf, lotsOf, residentsOf } from "../game/street";
import type { NewsEvent } from "../model/types";
import { currentStreetOf, useV2 } from "../store";

/** Die Zeitung: was in der Straße gerade los ist – Neuigkeiten, Bestseller und die Straße in Zahlen. */
export function NewsSheet() {
  const navigate = useNavigate();
  const street = useV2(currentStreetOf)!;
  const member = useV2((s) => s.member)!;
  const loadNews = useV2((s) => s.loadNews);
  const [news, setNews] = useState<NewsEvent[] | null>(null);
  const now = Date.now();

  useEffect(() => {
    let alive = true;
    void loadNews().then((list) => alive && setNews(list));
    return () => {
      alive = false;
    };
  }, [loadNews, street.id]);

  const facts = useMemo(() => {
    const lots = lotsOf(street, now);
    return {
      residents: residentsOf(lots),
      houses: lots.filter((l) => l.stage >= 2).length,
      sites: lots.filter((l) => l.stage === 1).length,
      groups: groupsOf(street.shops).size,
      attraction: attractionOf(street),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street]);
  const top = useMemo(() => bestsellers(street, facts.residents, now), [street, facts.residents, now]);
  const shopExists = (id?: string) => !!id && street.shops.some((s) => s.id === id);
  const go = (to: string) => {
    sound.tap();
    navigate(to);
  };
  const date = new Date(now).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Sheet title="📰 Zeitung" onClose={() => navigate("/")}>
      <header className="paper-head">
        <b>{street.name}-Bote</b>
        <small>
          {street.city} · {date}
        </small>
      </header>

      <h3 className="sub-head">Bestseller</h3>
      {top.length === 0 ? (
        <p className="subtle">Noch nichts verkauft. Wer legt die erste Ware ins Schaufenster?</p>
      ) : (
        <ol className="best-list">
          {top.map((b, i) => (
            <li key={b.item.id}>
              <button type="button" className="best-row" onClick={() => go(`/laden/${b.shop.id}`)}>
                <span className="best-rank">{i + 1}</span>
                <ItemPreview design={b.item.design} id={`b-${b.item.id}`} size={44} />
                <span className="shop-text">
                  <b>{b.item.name}</b>
                  <small>
                    {b.shop.name} · 🪙 {formatCoins(b.item.price)} · ≈{Math.round(b.sales)}× verkauft
                    {b.shop.memberId === member.id ? " · dein Laden" : ""}
                  </small>
                </span>
                <span className="chev">›</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <h3 className="sub-head">Neuigkeiten</h3>
      {news === null ? (
        <p className="subtle">Lade …</p>
      ) : news.length === 0 ? (
        <p className="subtle">Noch nichts passiert – die Straße ist ganz neu.</p>
      ) : (
        <ul className="news-list">
          {news.map((event) => {
            const h = headline(event);
            const target = event.kind === "join" && event.memberId ? `/spieler/${event.memberId}` : shopExists(event.data.shopId) ? `/laden/${event.data.shopId}` : null;
            const design = event.data.item?.design;
            const body = (
              <>
                <span className="news-icon" aria-hidden>
                  {design ? <ItemPreview design={design} id={`n-${event.id}`} size={36} /> : h.icon}
                </span>
                <span className="shop-text">
                  <b>{h.text}</b>
                  <small>{agoText(event.at, now)}</small>
                </span>
              </>
            );
            return (
              <li key={event.id}>
                {target && (event.kind !== "join" || event.memberId !== member.id) ? (
                  <button type="button" className="news-row" onClick={() => go(target)}>
                    {body}
                    <span className="chev">›</span>
                  </button>
                ) : (
                  <div className="news-row">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="sub-head">Die Straße in Zahlen</h3>
      <dl className="facts">
        <div>
          <dt>👥 Bewohner</dt>
          <dd>{Math.round(facts.residents)}</dd>
        </div>
        <div>
          <dt>🏠 Häuser</dt>
          <dd>
            {facts.houses}
            {facts.sites > 0 ? ` (+${facts.sites} im Bau)` : ""}
          </dd>
        </div>
        <div>
          <dt>🧑‍🤝‍🧑 Spieler</dt>
          <dd>
            {street.members.length}/{street.maxMembers}
          </dd>
        </div>
        <div>
          <dt>🏬 Läden</dt>
          <dd>
            {street.shops.length} in {facts.groups}/{Object.keys(SHOP_GROUPS).length} Branchen
          </dd>
        </div>
        <div>
          <dt>⭐ Anziehung</dt>
          <dd>{Math.round(facts.attraction * 100)} %</dd>
        </div>
      </dl>
    </Sheet>
  );
}
