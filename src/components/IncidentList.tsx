import { formatAgo } from "../format";
import { actorOf } from "../game/mischief";
import type { Street } from "../model/types";

/** Was Bad Boys, Tiere und Autos der Nachbarn zuletzt in der Straße angestellt haben. */
export function IncidentList({ street }: { street: Street }) {
  const incidents = street.incidents ?? [];
  const now = Date.now();
  return (
    <section className="card incidents" aria-label="Vorfälle">
      <h2>Was zuletzt los war</h2>
      {incidents.length === 0 ? (
        <p className="subtle">Alles ruhig. Noch hat niemand Ärger gemacht.</p>
      ) : (
        <ul className="news">
          {incidents.slice(0, 6).map((incident) => (
            <li key={incident.id}>
              <span className="news-avatar" aria-hidden>
                {incident.blocked ? "🛡️" : actorOf({ badBoyId: incident.badBoyId }).emoji}
              </span>
              <div>
                <span>{incident.text}</span>
                <small>{formatAgo(incident.at, now)}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
