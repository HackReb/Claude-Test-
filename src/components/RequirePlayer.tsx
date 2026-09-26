import { Navigate, Outlet } from "react-router-dom";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

/** Alle Spiel-Screens brauchen einen Spieler mit Straße – sonst geht's zum Claimen. */
export function RequirePlayer() {
  const hasPlayer = useGameStore((s) => s.player !== null && s.street !== null);
  return hasPlayer ? <Outlet /> : <Navigate to={routes.start} replace />;
}
