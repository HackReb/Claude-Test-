import { Link, useParams } from "react-router-dom";
import { Placeholder } from "../components/Placeholder";
import { routes } from "../routes";

export function BuilderScreen() {
  const { plotId = "" } = useParams();
  return (
    <Placeholder title="Baukasten" milestone="M4: Fassaden-Editor">
      <p>Vorschau oben, Kategorien-Leiste unten (Grundkörper · Dach · Türen · Fenster · Deko), Live-Mietanzeige.</p>
      <Link className="btn btn-link" to={routes.plot(plotId)}>← Zurück zum Grundstück</Link>
    </Placeholder>
  );
}
