import * as Tone from 'tone';
import { Radio } from './radio';

/** Owns the audio graph: the radio plus world sounds (wind, freewheel, bell). */
export class AudioEngine {
  radio: Radio;
  private master: Tone.Volume;
  private started = false;
  private ready = false;
  private wind!: Tone.Noise;
  private windFilter!: Tone.Filter;
  private windGain!: Tone.Gain;
  private tick!: Tone.NoiseSynth;
  private thump!: Tone.MembraneSynth;
  private chime!: Tone.PolySynth;
  private tickAcc = 0;
  private rain!: Tone.Noise;
  private rainGain!: Tone.Gain;
  private wantRain = false;

  constructor() {
    this.master = new Tone.Volume(0).toDestination();
    this.radio = new Radio(this.master);
  }

  /** Must be called from a user gesture. */
  async start() {
    if (this.started) return;
    this.started = true;
    await Tone.start();
    this.build();
    this.ready = true;
  }

  private build() {
    const rainFilter = new Tone.Filter({ frequency: 2400, type: 'lowpass' });
    this.rainGain = new Tone.Gain(0);
    this.rain = new Tone.Noise({ type: 'pink', volume: -14 });
    this.rain.chain(rainFilter, this.rainGain, this.master);
    this.rain.start();
    this.setRain(this.wantRain);
    this.windFilter = new Tone.Filter({ frequency: 400, type: 'bandpass', Q: 0.6 });
    this.windGain = new Tone.Gain(0);
    this.wind = new Tone.Noise({ type: 'pink', volume: -6 });
    this.wind.chain(this.windFilter, this.windGain, this.master);
    this.wind.start();

    const tickHp = new Tone.Filter({ frequency: 3500, type: 'highpass' }).connect(this.master);
    this.tick = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.0005, decay: 0.012, sustain: 0 },
      volume: -34,
    }).connect(tickHp);
    this.thump = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
      volume: -14,
    }).connect(this.master);
    const rev = new Tone.Reverb({ decay: 2, wet: 0.3 }).connect(this.master);
    this.chime = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 5.1,
      modulationIndex: 6,
      envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 1 },
      modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
      volume: -16,
    }).connect(rev);
  }

  get isStarted() {
    return this.ready;
  }

  setVolume(v: number) {
    this.master.volume.rampTo(v <= 0.001 ? -Infinity : Tone.gainToDb(v * v), 0.1);
  }

  /** Called every frame with the bike state. */
  update(dt: number, speed: number, airborne: boolean, pedalling: boolean) {
    if (!this.ready) return;
    const s = Math.min(1, speed / 16);
    const target = 0.02 + s * s * 0.35 + (airborne ? 0.1 : 0);
    this.windGain.gain.rampTo(target, 0.15);
    this.windFilter.frequency.rampTo(280 + s * 900 + (airborne ? 300 : 0), 0.2);

    // freewheel hub clicks when coasting
    if (!pedalling && !airborne && speed > 1.2) {
      this.tickAcc += dt * speed * 2.4;
      if (this.tickAcc > 1) {
        this.tickAcc %= 1;
        this.tick.triggerAttackRelease('64n', Tone.now(), 0.5 + Math.random() * 0.3);
      }
    } else {
      this.tickAcc = 0;
    }
  }

  land(power: number) {
    if (!this.ready) return;
    this.thump.triggerAttackRelease('A1', '16n', Tone.now(), Math.min(1, 0.3 + power * 0.25));
  }

  bell() {
    if (!this.ready) return;
    const now = Tone.now();
    this.chime.triggerAttackRelease(['E6', 'B6'], '8n', now, 0.6);
    this.chime.triggerAttackRelease(['E6', 'B6'], '8n', now + 0.16, 0.5);
  }

  setRain(on: boolean) {
    this.wantRain = on;
    if (!this.ready && !this.rainGain) return;
    this.rainGain?.gain.rampTo(on ? 0.5 : 0, 2);
  }

  private hornSynth: Tone.Synth | null = null;

  /** a little two-tone car horn, quieter when far away */
  horn(dist: number) {
    if (!this.ready) return;
    if (!this.hornSynth) this.hornSynth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.08 }, volume: -22 }).connect(this.master);
    const now = Tone.now();
    const v = Math.max(0.15, 1 - dist / 25);
    this.hornSynth.triggerAttackRelease('A4', 0.12, now, v);
    this.hornSynth.triggerAttackRelease('F4', 0.18, now + 0.16, v);
  }

  /** another rider's bell, a little further away */
  otherBell() {
    if (!this.ready) return;
    const now = Tone.now();
    this.chime.triggerAttackRelease(['D6', 'A6'], '16n', now, 0.25);
    this.chime.triggerAttackRelease(['D6', 'A6'], '16n', now + 0.14, 0.2);
  }

  /** click-wheel tick */
  private clicker?: Tone.MembraneSynth;
  wheelClick() {
    if (!this.ready) return;
    if (!this.clicker) this.clicker = new Tone.MembraneSynth({ pitchDecay: 0.002, octaves: 1, envelope: { attack: 0.0005, decay: 0.012, sustain: 0 }, volume: -20 }).connect(this.master);
    try {
      this.clicker.triggerAttackRelease('A6', '64n', Tone.now() + 0.001, 0.6);
    } catch {
      /* clicks faster than the synth can retrigger */
    }
  }

  /** wrench ratchet, a whoosh and a little brass fanfare for a bike upgrade */
  private brass?: Tone.PolySynth;
  private ratchet?: Tone.NoiseSynth;
  private whoosh?: { noise: Tone.Noise; filter: Tone.Filter; gain: Tone.Gain };
  private boom?: Tone.MembraneSynth;
  upgradeJingle(tier = 1) {
    if (!this.ready) return;
    if (!this.brass) {
      const lp = new Tone.Filter({ frequency: 2600, type: 'lowpass' }).connect(this.master);
      const verb = new Tone.Reverb({ decay: 2.4, wet: 0.25 }).connect(lp);
      this.brass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 18 } as Tone.OmniOscillatorOptions,
        envelope: { attack: 0.02, decay: 0.25, sustain: 0.55, release: 0.6 },
        volume: -19,
      }).connect(verb);
      const hp = new Tone.Filter({ frequency: 1800, type: 'highpass' }).connect(this.master);
      this.ratchet = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.025, sustain: 0 }, volume: -16 }).connect(hp);
      const wf = new Tone.Filter({ frequency: 300, type: 'bandpass', Q: 1.2 });
      const wg = new Tone.Gain(0);
      const wn = new Tone.Noise({ type: 'pink', volume: -6 });
      wn.chain(wf, wg, this.master);
      wn.start();
      this.whoosh = { noise: wn, filter: wf, gain: wg };
      this.boom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 4, envelope: { attack: 0.001, decay: 0.5, sustain: 0 }, volume: -10 }).connect(this.master);
    }
    this.radio.duck(3.4);
    const now = Tone.now() + 0.05;
    // the wrench: click-click-click
    for (let k = 0; k < 7; k++) this.ratchet!.triggerAttackRelease('64n', now + k * 0.075 + (k % 2) * 0.01, 0.6 + (k % 3) * 0.15);
    // whoosh up
    const w = this.whoosh!;
    w.filter.frequency.cancelScheduledValues(now);
    w.filter.frequency.setValueAtTime(300, now + 0.6);
    w.filter.frequency.exponentialRampToValueAtTime(7000, now + 1.0);
    w.gain.gain.cancelScheduledValues(now);
    w.gain.gain.setValueAtTime(0, now + 0.6);
    w.gain.gain.linearRampToValueAtTime(0.5, now + 0.9);
    w.gain.gain.linearRampToValueAtTime(0, now + 1.1);
    // fanfare: higher tiers sound brighter
    const root = 60 + Math.min(4, tier) * 2;
    const f = (n: number) => Tone.Frequency(n, 'midi').toFrequency();
    const t0 = now + 1.05;
    this.boom!.triggerAttackRelease('C2', '8n', t0, 0.9);
    [0, 4, 7].forEach((iv, i) => this.brass!.triggerAttackRelease(f(root + iv), '16n', t0 + i * 0.11, 0.7));
    this.brass!.triggerAttackRelease([f(root), f(root + 4), f(root + 7), f(root + 12)], 1.3, t0 + 0.36, 0.85);
    this.brass!.triggerAttackRelease(f(root - 12), 1.3, t0 + 0.36, 0.6);
    [12, 16, 19, 24, 28].forEach((iv, i) => this.chime.triggerAttackRelease(f(root + 12 + iv), '16n', t0 + 0.4 + i * 0.07, 0.35));
    this.boom!.triggerAttackRelease('G1', '8n', t0 + 0.36, 0.6);
  }

  /** soft "pop" when a parcel changes hands */
  pop() {
    if (!this.ready) return;
    this.chime.triggerAttackRelease('G5', '32n', Tone.now(), 0.35);
  }

  /** little fanfare: level up, town complete */
  fanfare() {
    if (!this.ready) return;
    const now = Tone.now();
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => this.chime.triggerAttackRelease(n, '8n', now + i * 0.09, 0.45));
  }

  /** postcard found */
  collect() {
    if (!this.ready) return;
    const now = Tone.now();
    ['A5', 'E6', 'A6'].forEach((n, i) => this.chime.triggerAttackRelease(n, '16n', now + i * 0.06, 0.4));
  }

  sparkle() {
    if (!this.ready) return;
    const now = Tone.now();
    ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => this.chime.triggerAttackRelease(n, '16n', now + i * 0.07, 0.35));
  }
}
