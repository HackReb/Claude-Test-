import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { formatCoins } from "../format";
import { ownedStreetName } from "../game/names";
import { formatPlace } from "../geo/streetSearch";
import { routes } from "../routes";
import { SoundToggle } from "./SoundToggle";
import { useGameStore } from "../store/gameStore";

const TICK_MS = 1000;
/** Wie oft der Stand der Mitspieler (z. B. Käufe in deiner Straße) geholt wird. */
const REFRESH_MS = 60_000;

export function AppLayout() {
  const player = useGameStore((s) => s.player)!;
  const street = useGameStore((s) => s.street)!;
  const tick = useGameStore((s) => s.tick);
  const refresh = useGameStore((s) => s.refresh);
  const online = useGameStore((s) => s.account?.status === "online");
  const unreadNews = useGameStore(
    (s) => s.neighborhood?.news.filter((n) => n.at > s.neighborhood!.newsSeenAt).length ?? 0,
  );

  // Miete läuft sekündlich hoch; beim Zurückkehren in den Tab sofort nachrechnen.
  useEffect(() => {
    const onTick = () => void tick();
    const timer = setInterval(onTick, TICK_MS);
    document.addEventListener("visibilitychange", onTick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onTick);
    };
  }, [tick]);

  useEffect(() => {
    if (!online) return;
    const onRefresh = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(onRefresh, REFRESH_MS);
    document.addEventListener("visibilitychange", onRefresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [online, refresh]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-street">
          <span className="topbar-street-name">{ownedStreetName(player.name, street.name)}</span>
          <span className="topbar-city">{formatPlace(street)}</span>
        </div>
        <SoundToggle />
        <div className="coins" aria-label={`${player.coins} Münzen`}>
          <span aria-hidden>🪙</span> {formatCoins(player.coins)}
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottomnav">
        <NavLink to={routes.street}>
          <span aria-hidden>🏠</span>Straße
        </NavLink>
        <NavLink to={routes.neighborhood}>
          <span aria-hidden>🗺️</span>Nachbarn
          {unreadNews > 0 && (
            <b className="nav-badge" aria-label={`${unreadNews} Neuigkeiten`}>
              {unreadNews > 9 ? "9+" : unreadNews}
            </b>
          )}
        </NavLink>
        <NavLink to={routes.share}>
          <span aria-hidden>📸</span>Teilen
        </NavLink>
      </nav>
    </div>
  );
}
