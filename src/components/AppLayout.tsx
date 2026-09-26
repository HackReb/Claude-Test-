import { NavLink, Outlet } from "react-router-dom";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

const formatCoins = new Intl.NumberFormat("de-DE");

export function AppLayout() {
  const player = useGameStore((s) => s.player)!;
  const street = useGameStore((s) => s.street)!;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-street">
          <span className="topbar-street-name">{street.name}</span>
          <span className="topbar-city">{street.city}</span>
        </div>
        <div className="coins" aria-label={`${player.coins} Münzen`}>
          <span aria-hidden>🪙</span> {formatCoins.format(player.coins)}
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
