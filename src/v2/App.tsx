import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ChooseStreetScreen } from "./screens/ChooseStreetScreen";
import { FigureSheet } from "./screens/FigureSheet";
import { PlayerSheet } from "./screens/PlayerSheet";
import { MallSheet } from "./screens/MallSheet";
import { ShopSheet } from "./screens/ShopSheet";
import { StageScreen } from "./screens/StageScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { useV2 } from "./store";

/** Babo v2: Anmelden → Straße wählen → die Straße als Bühne, alles Weitere als Blätter darüber. */
export function App() {
  const status = useV2((s) => s.status);
  const init = useV2((s) => s.init);
  const notice = useV2((s) => s.notice);

  useEffect(() => {
    void init();
  }, [init]);

  if (status === "loading") return <div className="splash">Lade deine Straße …</div>;
  if (status === "offline") return <div className="splash">Babo 2 braucht den Server – bitte VITE_API_URL setzen.</div>;
  if (status === "error")
    return (
      <div className="splash">
        <p>{notice ?? "Der Server ist gerade nicht erreichbar."}</p>
        <button type="button" className="btn btn-primary" onClick={() => void init()}>
          Nochmal versuchen
        </button>
      </div>
    );
  if (status === "logged-out") return <WelcomeScreen />;
  if (status === "no-street") return <ChooseStreetScreen />;

  return (
    <HashRouter>
      <StageScreen />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/mall" element={<MallSheet />} />
        <Route path="/laden/neu" element={<ShopSheet mode="new" />} />
        <Route path="/laden/:shopId" element={<ShopSheet mode="edit" />} />
        <Route path="/figur" element={<FigureSheet />} />
        <Route path="/spieler/:memberId" element={<PlayerSheet />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
