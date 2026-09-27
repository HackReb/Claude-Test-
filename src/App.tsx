import { useEffect } from "react";
import { HashRouter, MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequirePlayer } from "./components/RequirePlayer";
import { routes } from "./routes";
import { BuilderScreen } from "./screens/BuilderScreen";
import { ClaimScreen } from "./screens/ClaimScreen";
import { NeighborhoodScreen } from "./screens/NeighborhoodScreen";
import { NeighborStreetScreen } from "./screens/NeighborStreetScreen";
import { NewspaperScreen } from "./screens/NewspaperScreen";
import { PlotScreen } from "./screens/PlotScreen";
import { ShareScreen } from "./screens/ShareScreen";
import { GarageScreen } from "./screens/GarageScreen";
import { PetShopScreen } from "./screens/PetShopScreen";
import { StreetScreen } from "./screens/StreetScreen";
import { useGameStore } from "./store/gameStore";

// HashRouter: funktioniert auf jedem statischen Hosting ohne Server-Rewrites.
// Im Artifact-Build läuft die App in einem Frame, der die URL nicht anfassen soll.
const Router = import.meta.env.MODE === "artifact" ? MemoryRouter : HashRouter;

export function App() {
  const status = useGameStore((s) => s.status);
  const hasPlayer = useGameStore((s) => s.player !== null);
  const init = useGameStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (status === "loading") return <div className="splash">Lade deine Straße …</div>;
  if (status === "error") return <div className="splash">Spielstand konnte nicht geladen werden.</div>;

  return (
    <Router>
      <Routes>
        <Route path={routes.start} element={hasPlayer ? <Navigate to={routes.street} replace /> : <ClaimScreen />} />
        <Route element={<RequirePlayer />}>
          <Route element={<AppLayout />}>
            <Route path={routes.street} element={<StreetScreen />} />
            <Route path="/plot/:plotId" element={<PlotScreen />} />
            <Route path="/builder/:plotId" element={<BuilderScreen />} />
            <Route path={routes.neighborhood} element={<NeighborhoodScreen />} />
            <Route path="/neighborhood/:streetId" element={<NeighborStreetScreen />} />
            <Route path="/neighborhood/:streetId/plot/:plotId" element={<PlotScreen />} />
            <Route path="/neighborhood/:streetId/builder/:plotId" element={<BuilderScreen />} />
            <Route path={routes.share} element={<ShareScreen />} />
            <Route path={routes.paper} element={<NewspaperScreen />} />
            <Route path={routes.garage} element={<GarageScreen />} />
            <Route path={routes.pets} element={<PetShopScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={hasPlayer ? routes.street : routes.start} replace />} />
      </Routes>
    </Router>
  );
}
