import { useEffect, useMemo, useRef, useState } from "react";
import { sound } from "../../audio/sound";
import { StreetLife, type LifeAnchors } from "../../components/street/StreetLife";
import { blocksRoad, DUEL, duelClashes, planShow, StreetShow, type ActiveShow } from "../../components/street/StreetShows";
import { Traffic } from "../../components/street/Traffic";
import { SHOWS, type ShowKind } from "../../config/streetLife";
import { loadShowMemory, nextShowKind, saveShowMemory, secondsUntilNextShow, showPlayed } from "../../game/showPicker";
import { lotsOf, residentsOf } from "../game/street";
import type { MemberSummary, Shop, StreetV2 } from "../model/types";
import { HouseLot } from "./HouseLot";
import { layoutStage, mallSlot, STAGE } from "./layout";
import { MallBuilding } from "./MallBuilding";
import { MemberWalkers } from "./MemberWalkers";

interface Props {
  street: StreetV2;
  memberId: string | null;
  canOpenShop: boolean;
  onShop?: (shop: Shop) => void;
  onOpenShop?: () => void;
  onMember?: (member: MemberSummary) => void;
  onShow?: (show: ActiveShow | null) => void;
  /** Himmel oben drüber (Hintergrund der Bühne). */
  sky?: boolean;
}

/** Die Straße als Bühne: Mall in der Mitte, Häuser wachsen drumherum, Bewohner und Spieler laufen herum. */
export function StreetStage({ street, memberId, canOpenShop, onShop, onOpenShop, onMember, onShow }: Props) {
  const [now, setNow] = useState(() => Date.now());
  // Häuser wachsen mit der Zeit – jede Minute neu rechnen reicht.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const lots = useMemo(() => lotsOf(street, now), [street, now]);
  const layout = useMemo(() => layoutStage(lots, street.shops), [lots, street.shops]);
  const residents = residentsOf(lots);
  const scroller = useRef<HTMLDivElement>(null);

  // Kran und Co. bewegen sich langsam – ein Tick pro 100 ms genügt.
  const [t, setT] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setT(performance.now() / 1000), 100);
    return () => clearInterval(timer);
  }, []);

  const anchorKey = lots.map((l) => `${l.id}:${l.residents}`).join(",") + "|" + street.shops.map((s) => s.id).join(",");
  const anchors = useMemo<LifeAnchors>(() => {
    const homes = layout.lots
      .filter((b) => b.lot.residents > 0)
      .map((b) => ({ id: b.lot.id, x: b.x + b.width / 2, half: b.width / 2 - 20, side: b.lot.row, residents: b.lot.residents }));
    const shops = street.shops.map((s, i) => {
      const slot = mallSlot(layout.mall, i);
      return { id: s.id, x: slot.x + slot.width / 2, half: 0, side: "top" as const };
    });
    return { homes, shops, playgrounds: [] };
    // anchorKey fasst Häuser und Läden zusammen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey]);

  // Beim ersten Öffnen zur Mall scrollen.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const px = ((layout.mall.x + layout.mall.width / 2) / layout.width) * el.scrollWidth;
    el.scrollLeft = Math.max(0, px - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shows: Zirkus, Eiswagen & Co. – kleine Überraschungen am Rand.
  const [show, setShow] = useState<ActiveShow | null>(null);
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (seconds: number) => (timer = setTimeout(start, seconds * 1000));
    const start = () => {
      const el = scroller.current;
      if (!el || document.visibilityState !== "visible") return schedule(10);
      const svgWidth = el.scrollWidth || 1;
      const viewStart = (el.scrollLeft / svgWidth) * layout.width;
      const viewEnd = ((el.scrollLeft + el.clientWidth) / svgWidth) * layout.width;
      const picked = nextShowKind(loadShowMemory());
      saveShowMemory(picked.memory);
      const next = planShow(Date.now(), picked.kind, viewStart, viewEnd, performance.now());
      const gap = SHOWS.gapSeconds[0] + Math.random() * (SHOWS.gapSeconds[1] - SHOWS.gapSeconds[0]);
      showPlayed(next.duration, gap);
      setShow(next);
      onShowRef.current?.(next);
      playShow(picked.kind, next.duration);
      timer = setTimeout(() => {
        setShow(null);
        onShowRef.current?.(null);
        schedule(gap);
      }, next.duration * 1000);
    };
    schedule(secondsUntilNextShow());
    return () => {
      clearTimeout(timer);
      setShow(null);
    };
  }, [layout.width]);

  const roadMid = (layout.roadTop + layout.roadBottom) / 2;
  const laneY = { top: roadMid - 3, bottom: layout.roadBottom - 3 };
  const label = `${street.name} · 👥 ${Math.round(residents)}`;

  return (
    <div className="stage-scroll" ref={scroller}>
      <svg className="stage-svg" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${street.name}, ${street.city}`}>
        <defs>
          <linearGradient id="v2-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fd3ff" />
            <stop offset="1" stopColor="#d9f0ff" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={layout.width} height={layout.topGround + STAGE.grass} fill="url(#v2-sky)" />
        <rect x={0} y={layout.topGround + STAGE.grass} width={layout.width} height={layout.height - layout.topGround - STAGE.grass} fill="#fff7e8" />
        {[0.08, 0.3, 0.55, 0.8].map((f, i) => (
          <g key={i} transform={`translate(${layout.width * f} ${30 + (i % 2) * 22})`} fill="#fff" opacity={0.9}>
            <ellipse rx={34} ry={12} />
            <ellipse cx={18} cy={-6} rx={22} ry={13} />
            <ellipse cx={-16} cy={-4} rx={18} ry={10} />
          </g>
        ))}
        {/* Gehwege und Fahrbahn */}
        <rect x={0} y={layout.roadTop - STAGE.sidewalk} width={layout.width} height={STAGE.sidewalk} fill="#e3dccf" />
        <rect x={0} y={layout.roadBottom} width={layout.width} height={STAGE.sidewalk} fill="#e3dccf" />
        <rect x={0} y={layout.roadTop} width={layout.width} height={STAGE.road} fill="#4a4a5a" />
        <line x1={0} x2={layout.width} y1={roadMid} y2={roadMid} stroke="#fff" strokeWidth={4} strokeDasharray="40 30" />
        <text x={STAGE.padX + 8} y={roadMid + 7} fontSize={20} fontWeight={900} fill="#fff" opacity={0.9}>
          {label}
        </text>

        {layout.lots.map((box) => (
          <HouseLot key={box.lot.id} box={box} streetId={street.id} t={t} />
        ))}
        <MallBuilding mall={layout.mall} streetName={street.name} shops={street.shops} memberId={memberId} canOpen={canOpenShop} onShop={onShop} onOpen={onOpenShop} />

        <Traffic seed={street.id} width={layout.width} laneY={laneY} cars={[]} trafficCount={2 + Math.min(4, street.shops.length)} paused={!!show && blocksRoad(show.kind)} />
        {show && show.kind !== "balloon" && <StreetShow show={show} roadMid={roadMid} laneBottom={laneY.bottom} walkBottom={layout.walkY.bottom} />}
        <StreetLife seed={street.id} width={layout.width} walkY={layout.walkY} anchors={anchors} show={show} />
        <MemberWalkers members={street.members} width={layout.width} walkY={layout.walkY} meId={memberId} onTap={onMember} />
        {show?.kind === "balloon" && <StreetShow show={show} roadMid={roadMid} laneBottom={laneY.bottom} walkBottom={layout.walkY.bottom} />}
      </svg>
    </div>
  );
}

function playShow(kind: ShowKind, seconds: number) {
  const cheerAt = (at: number) => setTimeout(() => sound.cheer(), at * 1000);
  switch (kind) {
    case "circus":
      sound.circus(seconds);
      return cheerAt(6);
    case "icecream":
      return sound.icecream(seconds);
    case "music":
      sound.busker(seconds);
      return cheerAt(seconds - 6);
    case "balloon":
      return sound.balloon(seconds);
    case "firetruck":
      sound.firetruck(seconds, (seconds - SHOWS.fireStopSeconds) / 2);
      return cheerAt((seconds - SHOWS.fireStopSeconds) / 2 + 5.5);
    case "wedding":
      sound.wedding(seconds);
      return cheerAt(3);
    case "duel":
      sound.duel(DUEL.ignite, DUEL.retract, duelClashes());
      return cheerAt(DUEL.bow + 0.3);
    case "marathon":
      sound.marathon(seconds);
      return cheerAt(2.5);
  }
}
