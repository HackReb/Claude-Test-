/**
 * Soundeffekte und Straßengeräusche – komplett im Browser synthetisiert (Web Audio), keine Dateien.
 * Klingt bewusst comichaft; echte Aufnahmen können später einzelne Methoden ersetzen.
 *
 * Browser erlauben Ton erst nach einer Berührung/Taste → `unlock()` beim ersten Tippen aufrufen.
 */

export interface AmbienceLevels {
  traffic: number;
  kids: number;
  bustle: number;
  birds: number;
  dog: number;
  flies: number;
}

const SILENCE: AmbienceLevels = { traffic: 0, kids: 0, bustle: 0, birds: 0, dog: 0, flies: 0 };
const MUTE_KEY = "babo:sound";

const rand = (min: number, max: number) => min + Math.random() * (max - min);

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private muted = readMuted();
  private listeners = new Set<(muted: boolean) => void>();

  private levels: AmbienceLevels = { ...SILENCE };
  private beds: Partial<Record<"traffic" | "bustle" | "flies", GainNode>> = {};
  private nextEvent: Record<string, number> = {};
  private timer: ReturnType<typeof setInterval> | null = null;

  get isMuted() {
    return this.muted;
  }

  onMuteChange(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "off" : "on");
    } catch {
      // Speicher gesperrt – Einstellung gilt dann nur bis zum Neuladen.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    this.listeners.forEach((l) => l(muted));
    if (!muted) this.unlock();
  }

  /** Erzeugt/weckt den Audio-Kontext – nur innerhalb einer Nutzer-Geste wirksam. */
  unlock() {
    if (typeof window === "undefined" || this.muted) return;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        this.noise = this.makeNoise(false);
        this.brown = this.makeNoise(true);
        document.addEventListener("visibilitychange", () => {
          if (document.hidden) void this.ctx?.suspend();
          else if (!this.muted) void this.ctx?.resume();
        });
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.applyAmbience();
    } catch {
      // Kein Web Audio – das Spiel läuft stumm weiter.
    }
  }

  // ---------- Soundeffekte ----------

  /** Münzen einsammeln – mehr Münzen, mehr Klimpern. */
  coins(amount = 1) {
    const count = Math.min(6, 1 + Math.floor(Math.log10(Math.max(1, amount)) * 2));
    for (let i = 0; i < count; i++) this.coin(i * 0.07);
  }

  coin(delay = 0) {
    this.play((t) => {
      this.tone(988, t + delay, 0.07, "square", 0.09);
      this.tone(1319, t + delay + 0.07, 0.22, "square", 0.09);
    });
  }

  /** Kasse: Grundstück kaufen, Baustein freischalten. */
  cash() {
    this.play((t) => {
      this.noiseBurst(t, 0.12, "bandpass", 2500, 1.5, 0.25);
      this.tone(1568, t + 0.1, 0.5, "sine", 0.18);
      this.tone(2093, t + 0.1, 0.7, "sine", 0.14);
      this.tone(2637, t + 0.16, 0.5, "sine", 0.08);
    });
  }

  /** Hämmern und Fertig-Klang. */
  build() {
    this.play((t) => {
      for (let i = 0; i < 3; i++) {
        this.noiseBurst(t + i * 0.18, 0.05, "bandpass", 1800, 2, 0.35);
        this.tone(170, t + i * 0.18, 0.06, "triangle", 0.3);
      }
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + 0.62 + i * 0.08, 0.35, "triangle", 0.12));
    });
  }

  upgrade() {
    this.play((t) => [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.07, 0.3, "square", 0.07)));
  }

  /** Müll aufheben. */
  pickup() {
    this.play((t) => {
      this.tone(420, t, 0.12, "sine", 0.2, 950);
      this.noiseBurst(t, 0.06, "highpass", 3000, 0.7, 0.08);
    });
  }

  /** Schrubben (Hundehaufen braucht mehrere Tipper). */
  scrub() {
    this.play((t) => this.noiseBurst(t, 0.09, "bandpass", 3200, 1.2, 0.22, 1800));
  }

  /** Sauber! */
  sparkle() {
    this.play((t) => [1760, 2349, 2637, 3136].forEach((f, i) => this.tone(f, t + i * 0.05, 0.25, "sine", 0.08)));
  }

  deny() {
    this.play((t) => this.tone(180, t, 0.25, "square", 0.08, 110));
  }

  /** Sprechblase / Wunsch der Bewohner. */
  bubble() {
    this.play((t) => {
      this.tone(660, t, 0.12, "sine", 0.12);
      this.tone(880, t + 0.12, 0.2, "sine", 0.12);
    });
  }

  tap() {
    this.play((t) => this.tone(1200, t, 0.03, "square", 0.04));
  }

  // ---------- Straßengeräusche ----------

  /** Lautstärke der Geräusch-Ebenen (0–1), abhängig davon, was gerade zu sehen ist. */
  setAmbience(levels: Partial<AmbienceLevels>) {
    this.levels = { ...SILENCE, ...levels };
    this.applyAmbience();
  }

  stopAmbience() {
    this.setAmbience(SILENCE);
  }

  private applyAmbience() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const bedLevels = { traffic: this.levels.traffic * 0.05, bustle: this.levels.bustle * 0.035, flies: this.levels.flies * 0.02 };
    for (const [name, gain] of Object.entries(bedLevels) as [keyof typeof bedLevels, number][]) {
      if (gain > 0 && !this.beds[name]) this.beds[name] = this.startBed(name);
      this.beds[name]?.gain.setTargetAtTime(gain, now, 0.6);
    }
    const anyEvents = this.levels.traffic + this.levels.kids + this.levels.bustle + this.levels.birds + this.levels.dog > 0;
    if (anyEvents && !this.timer) this.timer = setInterval(() => this.scheduleEvents(), 250);
    if (!anyEvents && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Dauer-Geräusche: Verkehrsrauschen, Stimmengemurmel, Fliegensummen. */
  private startBed(name: "traffic" | "bustle" | "flies"): GainNode {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master!);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.connect(lfoGain);

    if (name === "flies") {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 215;
      lfo.frequency.value = 7;
      lfoGain.gain.value = 18;
      lfoGain.connect(osc.frequency);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1400;
      osc.connect(filter).connect(out);
      osc.start();
    } else {
      const src = ctx.createBufferSource();
      src.buffer = name === "traffic" ? this.brown : this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = name === "traffic" ? "lowpass" : "bandpass";
      filter.frequency.value = name === "traffic" ? 420 : 520;
      filter.Q.value = name === "traffic" ? 0.7 : 0.8;
      // langsames Schwanken, damit es lebendig klingt
      lfo.frequency.value = name === "traffic" ? 0.07 : 0.3;
      lfoGain.gain.value = name === "traffic" ? 120 : 160;
      lfoGain.connect(filter.frequency);
      src.connect(filter).connect(out);
      src.start();
    }
    lfo.start();
    return out;
  }

  /** Einzelne Geräusche in zufälligen Abständen: Autos, Kinder, Ladenglocke, Vögel, Hund. */
  private scheduleEvents() {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== "running") return;
    const now = performance.now() / 1000;
    const due = (name: string, level: number, minGap: number, maxGap: number, fire: () => void) => {
      if (level <= 0) return;
      const next = this.nextEvent[name] ?? now + rand(0.5, maxGap / 2);
      if (now >= next) {
        fire();
        // Mehr Geschehen im Bild → häufiger
        this.nextEvent[name] = now + rand(minGap, maxGap) / Math.max(0.35, level);
      } else {
        this.nextEvent[name] = next;
      }
    };
    const l = this.levels;
    due("car", l.traffic, 4, 11, () => this.carPass(l.traffic));
    due("kids", l.kids, 2.5, 7, () => this.kidsLaugh(l.kids));
    due("bell", l.bustle, 9, 20, () => this.shopBell(l.bustle));
    due("birds", l.birds, 1.8, 5, () => this.birdChirp(l.birds));
    due("dog", l.dog, 7, 16, () => this.dogBark(l.dog));
  }

  private carPass(level: number) {
    this.play((t) => {
      const ctx = this.ctx!;
      const src = ctx.createBufferSource();
      src.buffer = this.brown;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 0.9;
      filter.frequency.setValueAtTime(260, t);
      filter.frequency.linearRampToValueAtTime(760, t + 1.1);
      filter.frequency.linearRampToValueAtTime(240, t + 2.4);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35 * level + 0.05, t + 1.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      const pan = ctx.createStereoPanner();
      const dir = Math.random() < 0.5 ? -1 : 1;
      pan.pan.setValueAtTime(-dir, t);
      pan.pan.linearRampToValueAtTime(dir, t + 2.4);
      src.connect(filter).connect(gain).connect(pan).connect(this.master!);
      src.start(t);
      src.stop(t + 2.5);
    });
  }

  private kidsLaugh(level: number) {
    this.play((t) => {
      const base = rand(620, 900);
      const blips = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < blips; i++) this.tone(base * (1 - i * 0.04), t + i * 0.11, 0.08, "triangle", 0.05 * level + 0.01, base * 0.8);
      if (Math.random() < 0.4) this.tone(base * 0.9, t + blips * 0.11 + 0.1, 0.25, "triangle", 0.04 * level, base * 1.4); // „juchuu“
    });
  }

  private shopBell(level: number) {
    this.play((t) => {
      this.tone(1319, t, 0.6, "sine", 0.06 * level + 0.01);
      this.tone(1047, t + 0.28, 0.8, "sine", 0.06 * level + 0.01);
    });
  }

  private birdChirp(level: number) {
    this.play((t) => {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tone(rand(2800, 3600), t + i * 0.09, 0.06, "sine", 0.03 * level + 0.005, rand(3800, 4800));
    });
  }

  private dogBark(level: number) {
    this.play((t) => {
      const barks = Math.random() < 0.6 ? 2 : 1;
      for (let i = 0; i < barks; i++) {
        const s = t + i * 0.26;
        this.tone(330, s, 0.13, "sawtooth", 0.07 * level + 0.01, 170, 900);
        this.noiseBurst(s, 0.08, "bandpass", 700, 1.5, 0.08 * level);
      }
    });
  }

  // ---------- Bausteine ----------

  private play(schedule: (time: number) => void) {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    try {
      schedule(ctx.currentTime + 0.01);
    } catch {
      // einzelne Effekte dürfen nie das Spiel stören
    }
  }

  private tone(
    freq: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFreq?: number,
    lowpass?: number,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    let node: AudioNode = osc;
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = lowpass;
      node = osc.connect(filter);
    }
    node.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noiseBurst(
    start: number,
    duration: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    volume: number,
    endFreq?: number,
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, start);
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0002, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(start);
    src.stop(start + duration + 0.02);
  }

  /** 2 s Rauschen: weiß (hell) oder „braun“ (dumpf, wie Verkehr). */
  private makeNoise(brown: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "off";
  } catch {
    return false;
  }
}

export const sound = new SoundEngine();
