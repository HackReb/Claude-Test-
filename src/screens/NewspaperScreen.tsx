import { useEffect } from "react";
import { Link } from "react-router-dom";
import { routes } from "../routes";
import { useGameStore } from "../store/gameStore";

const dateFormat = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Titelseite des Babo-Anzeigers: jeden Tag neu, mit dem Besten und Schlimmsten aus der Nachbarschaft. */
export function NewspaperScreen() {
  const paper = useGameStore((s) => s.neighborhood?.paper);
  const ownId = useGameStore((s) => s.street!.id);
  const publish = useGameStore((s) => s.publishPaper);
  const markRead = useGameStore((s) => s.markPaperRead);

  useEffect(() => {
    if (!paper) void publish();
  }, [paper, publish]);
  useEffect(() => {
    if (paper && !paper.read) void markRead();
  }, [paper, markRead]);

  if (!paper) {
    return (
      <section className="placeholder">
        <h1>📰 Babo-Anzeiger</h1>
        <p>Die Druckerpresse läuft warm …</p>
      </section>
    );
  }

  const [lead, ...rest] = paper.issue.stories;
  const linkTo = (streetId: string) => (streetId === ownId ? routes.street : routes.neighborStreet(streetId));
  return (
    <article className="newspaper">
      <header className="paper-masthead">
        <h1>Babo-Anzeiger</h1>
        <p>
          <span>{dateFormat.format(new Date(paper.issue.at))}</span>
          <span>Ausgabe für deine Nachbarschaft · 🪙 1</span>
        </p>
      </header>

      {lead && (
        <Link className={`paper-lead ${lead.tone}`} to={linkTo(lead.streetId)}>
          <h2>{lead.headline}</h2>
          <p>{lead.text}</p>
        </Link>
      )}

      <div className="paper-columns">
        {rest.map((story) => (
          <Link key={story.id} className={`paper-story ${story.tone}`} to={linkTo(story.streetId)}>
            <h3>{story.headline}</h3>
            <p>{story.text}</p>
          </Link>
        ))}
      </div>
      <p className="paper-footer">Morgen früh gibt es die nächste Ausgabe.</p>
    </article>
  );
}
