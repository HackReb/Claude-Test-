import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { formatCoins } from "../format";
import { formatPlace } from "../geo/streetSearch";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

const TICK_MS = 1000;

export function AppLayout() {
  const player = useGameStore((s) => s.player)!;
  const street = useGameStore((s) => s.street)!;
  const tick = useGameStore((s) => s.tick);

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

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-street">
          <span className="topbar-street-name">{street.name}</span>
          <span className="topbar-city">{formatPlace(street)}</span>
        </div>
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
        </NavLink>
        <NavLink to={routes.share}>
          <span aria-hidden>📸</span>Teilen
        </NavLink>
      </nav>
    </div>
  );
}
