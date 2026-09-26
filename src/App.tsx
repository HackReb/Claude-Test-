import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequirePlayer } from "./components/RequirePlayer";
import { routes } from "./routes";
import { BuilderScreen } from "./screens/BuilderScreen";
import { ClaimScreen } from "./screens/ClaimScreen";
import { NeighborhoodScreen } from "./screens/NeighborhoodScreen";
import { PlotScreen } from "./screens/PlotScreen";
import { ShareScreen } from "./screens/ShareScreen";
import { StreetScreen } from "./screens/StreetScreen";
import { useGameStore } from "./store/gameStore";

export function App() {
  const status = useGameStore((s) => s.status);
  const hasPlayer = useGameStore((s) => s.player !== null);
  const init = useGameStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (status === "loading") return <div className="splash">Lade deine Straße …</div>;
  if (status === "error") return <div className="splash">Spielstand konnte nicht geladen werden.</div>;

  // HashRouter: funktioniert auf jedem statischen Hosting ohne Server-Rewrites.
  return (
    <HashRouter>
      <Routes>
        <Route path={routes.start} element={hasPlayer ? <Navigate to={routes.street} replace /> : <ClaimScreen />} />
        <Route element={<RequirePlayer />}>
          <Route element={<AppLayout />}>
            <Route path={routes.street} element={<StreetScreen />} />
            <Route path="/plot/:plotId" element={<PlotScreen />} />
            <Route path="/builder/:plotId" element={<BuilderScreen />} />
            <Route path={routes.neighborhood} element={<NeighborhoodScreen />} />
            <Route path={routes.share} element={<ShareScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={hasPlayer ? routes.street : routes.start} replace />} />
      </Routes>
    </HashRouter>
  );
}
