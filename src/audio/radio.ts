import * as Tone from 'tone';

/**
 * Generative radio with several stations. Each station has its own tempo,
 * chords, instruments and groove; every "track" is a fresh random key, tempo
 * and progression in that style. Nothing is sampled.
 */

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const QUALITY: Record<string, number[]> = {
  maj9: [4, 7, 11, 14],
  maj7: [4, 7, 11, 16],
  m9: [3, 7, 10, 14],
  m7: [3, 7, 10, 15],
  dom9: [4, 10, 14, 19],
  dom13: [4, 10, 14, 21],
  m11: [3, 10, 14, 17],
  sus: [5, 7, 10, 14],
  add9: [4, 7, 14, 16],
  maj: [4, 7, 12, 16],
  min: [3, 7, 12, 15],
};

type Chord = [degree: number, quality: keyof typeof QUALITY];

type Keys = 'epiano' | 'jazz' | 'nylon' | 'pad';
type Bass = 'lofi' | 'walk' | 'bossa' | 'pulse' | 'drone';
type Drums = 'boombap' | 'jazz' | 'bossa' | 'synth' | 'none';
type Melody = 'bell' | 'arp' | 'sparse';

export interface Station {
  id: string;
  name: string;
  freq: string;
  tagline: string;
  icon: string;
  color: [string, string];
  bpm: [number, number];
  swing: number;
  keys: Keys;
  bass: Bass;
  drums: Drums;
  melody: Melody;
  vinyl: number; // dB
  cutoff: number;
  progressions: Chord[][];
  words: [string[], string[]];
}

export const STATIONS: Station[] = [
  {
    id: 'chill', name: 'Chill FM', freq: '88.1', tagline: 'lo-fi beats to deliver to', icon: '🎧', color: ['#ff9a8b', '#c9a3ff'],
    bpm: [68, 84], swing: 0.22, keys: 'epiano', bass: 'lofi', drums: 'boombap', melody: 'bell', vinyl: -40, cutoff: 2600,
    progressions: [
      [[2, 'm9'], [5, 'dom9'], [1, 'maj9'], [6, 'm9']],
      [[1, 'maj7'], [3, 'm7'], [6, 'm9'], [4, 'maj9']],
      [[4, 'maj9'], [3, 'm7'], [2, 'm11'], [1, 'maj9']],
      [[6, 'm9'], [4, 'maj7'], [1, 'maj9'], [5, 'sus']],
      [[2, 'm11'], [3, 'm7'], [4, 'maj9'], [5, 'sus']],
    ],
    words: [['peach', 'slow', 'golden', 'pastel', 'sleepy', 'warm', 'dusty', 'soft', 'hazy'], ['wheels', 'horizon', 'afternoon', 'pedals', 'postcard', 'cassette', 'clouds']],
  },
  {
    id: 'jazz', name: 'Jazz Café', freq: '91.4', tagline: 'brushes, walking bass, espresso', icon: '🎷', color: ['#9b6b4f', '#f4c063'],
    bpm: [96, 118], swing: 0.55, keys: 'jazz', bass: 'walk', drums: 'jazz', melody: 'bell', vinyl: -44, cutoff: 3800,
    progressions: [
      [[2, 'm9'], [5, 'dom13'], [1, 'maj9'], [1, 'maj9']],
      [[1, 'maj7'], [6, 'm9'], [2, 'm11'], [5, 'dom13']],
      [[3, 'm7'], [6, 'dom9'], [2, 'm9'], [5, 'dom13']],
      [[4, 'maj9'], [4, 'm9'], [3, 'm7'], [6, 'dom9']],
    ],
    words: [['blue', 'midnight', 'smoky', 'velvet', 'late', 'little', 'round'], ['espresso', 'corner', 'saxophone', 'avenue', 'lamplight', 'waltz', 'café']],
  },
  {
    id: 'bossa', name: 'Bossa Breeze', freq: '94.7', tagline: 'nylon strings & sea air', icon: '🌴', color: ['#4fb3a6', '#ffd27a'],
    bpm: [116, 132], swing: 0, keys: 'nylon', bass: 'bossa', drums: 'bossa', melody: 'sparse', vinyl: -46, cutoff: 4200,
    progressions: [
      [[1, 'maj7'], [1, 'maj7'], [2, 'm7'], [5, 'dom9']],
      [[2, 'm9'], [5, 'dom9'], [3, 'm7'], [6, 'dom9']],
      [[1, 'maj9'], [4, 'maj7'], [3, 'm7'], [6, 'm9']],
    ],
    words: [['salty', 'lazy', 'sunny', 'little', 'sandy', 'summer'], ['breeze', 'harbour', 'lemonade', 'hammock', 'seashell', 'promenade']],
  },
  {
    id: 'synth', name: 'Synth Sunset', freq: '99.9', tagline: 'neon pads for night rides', icon: '🌆', color: ['#ff5fa2', '#5f7fff'],
    bpm: [84, 98], swing: 0, keys: 'pad', bass: 'pulse', drums: 'synth', melody: 'arp', vinyl: -60, cutoff: 5200,
    progressions: [
      [[6, 'min'], [4, 'maj'], [1, 'maj'], [5, 'maj']],
      [[1, 'add9'], [5, 'maj'], [6, 'min'], [4, 'maj']],
      [[6, 'm7'], [5, 'add9'], [4, 'maj7'], [5, 'sus']],
    ],
    words: [['neon', 'chrome', 'electric', 'night', 'pink', 'retro'], ['highway', 'skyline', 'arcade', 'boulevard', 'tapes', 'drive']],
  },
  {
    id: 'rain', name: 'Rain Room', freq: '102.3', tagline: 'ambient drift, no drums', icon: '🌧', color: ['#6a7fb0', '#c9d6ff'],
    bpm: [60, 66], swing: 0, keys: 'pad', bass: 'drone', drums: 'none', melody: 'sparse', vinyl: -34, cutoff: 1800,
    progressions: [
      [[1, 'maj9'], [4, 'maj9']],
      [[6, 'm9'], [4, 'maj7'], [1, 'add9'], [5, 'sus']],
      [[2, 'm11'], [1, 'maj9']],
    ],
    words: [['quiet', 'grey', 'soft', 'distant', 'paper', 'still'], ['window', 'puddles', 'blanket', 'drizzle', 'umbrella', 'tea']],
  },
];

const KEYS = ['C', 'D', 'Eb', 'E', 'F', 'G', 'Ab', 'A', 'Bb'];
const KEY_MIDI: Record<string, number> = { C: 48, D: 50, Eb: 51, E: 52, F: 53, G: 55, Ab: 56, A: 57, Bb: 58 };

const KICKS = [
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
];

export interface Track {
  title: string;
  key: string;
  bpm: number;
  progression: number[][]; // midi chords (no root)
  roots: number[];
  kick: number[];
  station: Station;
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

function makeTrack(st: Station, prev?: Track): Track {
  let key = pick(KEYS);
  if (prev && key === prev.key) key = pick(KEYS);
  const base = KEY_MIDI[key];
  const prog = pick(st.progressions);
  let last: number[] | null = null;
  const chords: number[][] = [];
  const roots: number[] = [];
  for (const [deg, q] of prog) {
    const root = base + MAJOR[deg - 1];
    roots.push(root - 12);
    let notes = QUALITY[q].map((i) => root + i);
    // simple voice leading: keep the voicing centred around the previous one
    const centre = last ? last.reduce((a, b) => a + b, 0) / last.length : 64;
    const avg = notes.reduce((a, b) => a + b, 0) / notes.length;
    notes = notes.map((n) => n + Math.round((centre - avg) / 12) * 12);
    while (Math.min(...notes) < 52) notes = notes.map((n) => n + 12);
    while (Math.max(...notes) > 79) notes = notes.map((n) => n - 12);
    chords.push(notes);
    last = notes;
  }
  return {
    title: `${pick(st.words[0])} ${pick(st.words[1])}`,
    key,
    bpm: st.bpm[0] + Math.floor(Math.random() * (st.bpm[1] - st.bpm[0] + 1)),
    progression: chords,
    roots,
    kick: pick(KICKS),
    station: st,
  };
}

const midi = (n: number) => Tone.Frequency(n, 'midi').toFrequency();

export class Radio {
  playing = false;
  stationIndex = 0;
  track: Track = makeTrack(STATIONS[0]);
  onTrack: ((t: Track) => void) | null = null;
  /** position inside the current 8-bar phrase, 0..1 (for the iPod progress bar) */
  progress = 0;

  private ready = false;
  private master!: Tone.Volume;
  private lofi!: Tone.Filter;
  private reverb!: Tone.Reverb;
  private keysGain!: Tone.Gain;
  private keys!: Tone.PolySynth<Tone.FMSynth>;
  private pad!: Tone.PolySynth;
  private pluck!: Tone.PolySynth;
  private arp!: Tone.Synth;
  private bass!: Tone.MonoSynth;
  private bell!: Tone.PolySynth<Tone.FMSynth>;
  private kick!: Tone.MembraneSynth;
  private snare!: Tone.NoiseSynth;
  private hat!: Tone.NoiseSynth;
  private ride!: Tone.MetalSynth;
  private rim!: Tone.MembraneSynth;
  private crackle!: Tone.NoiseSynth;
  private vinyl!: Tone.Noise;
  private zap!: Tone.NoiseSynth;
  private step = 0;
  private bar = 0;
  private pendingTrack: Track | null = null;
  private loopId: number | null = null;
  private walkPrev = 0;

  constructor(private output: Tone.InputNode) {}

  get station() {
    return STATIONS[this.stationIndex];
  }

  private build() {
    if (this.ready) return;
    this.ready = true;
    const tape = new Tone.Vibrato({ frequency: 0.6, depth: 0.08 });
    this.lofi = new Tone.Filter({ frequency: 2600, type: 'lowpass', rolloff: -24 });
    const crush = new Tone.BitCrusher(10);
    crush.wet.value = 0.15;
    this.master = new Tone.Volume(-8);
    tape.chain(this.lofi, crush, this.master);
    this.master.connect(this.output);

    this.reverb = new Tone.Reverb({ decay: 3.8, wet: 0.32 });
    this.reverb.connect(tape);
    const chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 3.5, depth: 0.45, wet: 0.4 }).start();
    this.keysGain = new Tone.Gain(1);
    chorus.connect(this.reverb);
    this.keysGain.connect(chorus);

    this.keys = new Tone.PolySynth(Tone.FMSynth, { volume: -15 });
    this.keys.connect(this.keysGain);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 24 } as Tone.OmniOscillatorOptions,
      envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 3 },
      volume: -24,
    });
    const padFilter = new Tone.Filter({ frequency: 1800, type: 'lowpass' });
    this.pad.chain(padFilter, this.keysGain);
    this.pluck = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.003, decay: 0.35, sustain: 0.05, release: 0.4 },
      volume: -12,
    });
    this.pluck.connect(this.keysGain);
    this.arp = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.1 }, volume: -26 });
    const echo = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.35, wet: 0.3 });
    echo.connect(this.reverb);
    this.arp.connect(echo);

    this.bell = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 4,
      envelope: { attack: 0.005, decay: 1.4, sustain: 0, release: 1.4 },
      modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 },
      volume: -24,
    });
    this.bell.connect(echo);

    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      filter: { Q: 1, type: 'lowpass', rolloff: -12 },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.6, release: 0.6 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, baseFrequency: 180, octaves: 1.5 },
      volume: -10,
    });
    this.bass.connect(tape);

    const drumBus = new Tone.Filter({ frequency: 3800, type: 'lowpass' });
    drumBus.connect(tape);
    this.kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 5, envelope: { attack: 0.001, decay: 0.35, sustain: 0 }, volume: -6 }).connect(drumBus);
    const snareFilter = new Tone.Filter({ frequency: 1800, type: 'bandpass', Q: 0.8 }).connect(drumBus);
    const snareVerb = new Tone.Gain(0.35).connect(this.reverb);
    snareFilter.connect(snareVerb);
    this.snare = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -12 }).connect(snareFilter);
    const hatFilter = new Tone.Filter({ frequency: 7000, type: 'highpass' }).connect(drumBus);
    this.hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -22 }).connect(hatFilter);
    this.ride = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.9, release: 0.3 }, harmonicity: 5.1, modulationIndex: 16, resonance: 5000, octaves: 1.2, volume: -34 });
    this.ride.frequency.value = 320;
    this.ride.connect(drumBus);
    this.rim = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -16 }).connect(drumBus);

    const vinylFilter = new Tone.Filter({ frequency: 5000, type: 'lowpass' });
    const vinylHp = new Tone.Filter({ frequency: 500, type: 'highpass' });
    this.vinyl = new Tone.Noise({ type: 'pink', volume: -40 });
    this.vinyl.chain(vinylHp, vinylFilter, this.master);
    this.crackle = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.008, sustain: 0 }, volume: -26 }).connect(vinylHp);
    // radio static between stations
    const zapFilter = new Tone.Filter({ frequency: 2200, type: 'bandpass', Q: 0.6 }).connect(this.master);
    this.zap = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.01, decay: 0.35, sustain: 0 }, volume: -18 }).connect(zapFilter);

    this.applyStation();
  }

  /** set instrument voices for the current station */
  private applyStation() {
    if (!this.ready) return;
    const st = this.station;
    this.lofi.frequency.rampTo(st.cutoff, 0.5);
    this.vinyl.volume.rampTo(st.vinyl, 0.5);
    this.reverb.wet.rampTo(st.id === 'rain' ? 0.55 : st.id === 'synth' ? 0.42 : 0.3, 0.5);
    if (st.keys === 'jazz') {
      this.keys.set({
        harmonicity: 3, modulationIndex: 2.4, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.005, decay: 1.1, sustain: 0.2, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.1, release: 0.6 },
      });
    } else {
      this.keys.set({
        harmonicity: 2, modulationIndex: 1.6, oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 1.6, sustain: 0.35, release: 2.2 },
        modulationEnvelope: { attack: 0.01, decay: 0.6, sustain: 0.1, release: 1 },
      });
    }
    this.bass.set({ oscillator: { type: st.bass === 'pulse' ? 'sawtooth' : st.bass === 'walk' ? 'triangle' : 'sine' } });
    this.bass.filterEnvelope.baseFrequency = st.bass === 'pulse' ? 220 : 180;
    const transport = Tone.getTransport();
    transport.swing = st.swing;
    transport.swingSubdivision = st.swing > 0.4 ? '8n' : '16n';
  }

  private schedule() {
    const transport = Tone.getTransport();
    transport.bpm.value = this.track.bpm;
    this.step = 0;
    this.bar = 0;
    if (this.loopId !== null) transport.clear(this.loopId);
    this.loopId = transport.scheduleRepeat((time) => this.tick(time), '16n');
  }

  private pump(time: number) {
    this.keysGain.gain.cancelScheduledValues(time);
    this.keysGain.gain.setValueAtTime(0.62, time);
    this.keysGain.gain.linearRampToValueAtTime(1, time + 0.32);
  }

  private tick(time: number) {
    const s = this.step % 16;
    if (s === 0 && this.pendingTrack && this.bar % 4 === 0) {
      this.track = this.pendingTrack;
      this.pendingTrack = null;
      Tone.getTransport().bpm.rampTo(this.track.bpm, 1, time);
      const t = this.track;
      Tone.getDraw().schedule(() => this.onTrack?.(t), time);
    }
    const tr = this.track;
    const st = tr.station;
    const idx = this.bar % tr.progression.length;
    const chord = tr.progression[idx];
    const root = tr.roots[idx];
    const nextRoot = tr.roots[(idx + 1) % tr.roots.length];
    const barDur = Tone.Time('1m').toSeconds();
    const r = Math.random;

    // ---- harmony
    switch (st.keys) {
      case 'epiano':
        if (s === 0) chord.forEach((n, i) => this.keys.triggerAttackRelease(midi(n), barDur * 0.92, time + i * 0.025 + r() * 0.01, 0.55 + r() * 0.2));
        break;
      case 'jazz': {
        // Charleston-style comping
        const hits: Record<number, number> = { 0: 0.6, 6: 0.45, 10: r() < 0.5 ? 0.4 : 0, 14: r() < 0.3 ? 0.35 : 0 };
        const v = hits[s];
        if (v) chord.forEach((n, i) => this.keys.triggerAttackRelease(midi(n), '8n', time + i * 0.012, v));
        break;
      }
      case 'nylon': {
        // bossa guitar pattern, bass note on the downbeat played by the bass
        if ([0, 3, 6, 10, 12].includes(s)) {
          const v = s === 0 ? 0.6 : 0.45;
          chord.slice(0, 3).forEach((n, i) => this.pluck.triggerAttackRelease(midi(n), '16n', time + i * 0.008, v));
        }
        break;
      }
      case 'pad':
        if (s === 0) chord.forEach((n) => this.pad.triggerAttackRelease(midi(n), barDur * 1.02, time, 0.5));
        break;
    }

    // ---- bass
    switch (st.bass) {
      case 'lofi':
        if (s === 0) this.bass.triggerAttackRelease(midi(root), '4n.', time, 0.9);
        if (s === 10 && r() < 0.6) this.bass.triggerAttackRelease(midi(root + (r() < 0.5 ? 12 : 7)), '8n', time, 0.6);
        break;
      case 'walk':
        if (s % 4 === 0) {
          const beat = s / 4;
          let n: number;
          if (beat === 0) n = root;
          else if (beat === 3) n = nextRoot + (r() < 0.5 ? -1 : 1);
          else n = root + pick([3, 4, 5, 7, 9, 10].filter((x) => x !== this.walkPrev));
          this.walkPrev = n - root;
          this.bass.triggerAttackRelease(midi(n), '4n', time, 0.75);
        }
        break;
      case 'bossa':
        if (s === 0 || s === 8) this.bass.triggerAttackRelease(midi(root), '8n', time, 0.85);
        if (s === 6 || s === 14) this.bass.triggerAttackRelease(midi(root + 7), '8n', time, 0.7);
        break;
      case 'pulse':
        if (s % 2 === 0) this.bass.triggerAttackRelease(midi(root + (s % 4 === 2 ? 12 : 0)), '16n', time, s % 8 === 0 ? 0.9 : 0.6);
        break;
      case 'drone':
        if (s === 0 && this.bar % 2 === 0) this.bass.triggerAttackRelease(midi(root), barDur * 1.9, time, 0.5);
        break;
    }

    // ---- drums
    switch (st.drums) {
      case 'boombap':
        if (tr.kick[s]) {
          this.kick.triggerAttackRelease('C1', '8n', time, s === 0 ? 1 : 0.8);
          this.pump(time);
        }
        if (s === 4 || s === 12) this.snare.triggerAttackRelease('16n', time, 0.85);
        else if ((s === 15 || s === 7) && r() < 0.18) this.snare.triggerAttackRelease('32n', time, 0.25);
        if (s % 2 === 0) this.hat.triggerAttackRelease('32n', time, s % 4 === 0 ? 0.7 : 0.4 + r() * 0.2);
        else if (r() < 0.15) this.hat.triggerAttackRelease('32n', time, 0.2);
        break;
      case 'jazz':
        if ([0, 4, 6, 8, 12, 14].includes(s)) this.ride.triggerAttackRelease('32n', time, s === 6 || s === 14 ? 0.35 : 0.6);
        if (s === 4 || s === 12) {
          this.hat.triggerAttackRelease('32n', time, 0.5);
          this.snare.triggerAttackRelease('32n', time, 0.18);
        }
        if (s === 0 && r() < 0.5) this.kick.triggerAttackRelease('C1', '16n', time, 0.35);
        break;
      case 'bossa':
        if ([0, 3, 6, 10, 12].includes(s)) this.rim.triggerAttackRelease('A4', '32n', time, 0.6);
        if (s === 0 || s === 6 || s === 8 || s === 14) this.kick.triggerAttackRelease('C1', '16n', time, s === 0 || s === 8 ? 0.6 : 0.35);
        this.hat.triggerAttackRelease('32n', time, s % 2 === 0 ? 0.32 : 0.18);
        break;
      case 'synth':
        if (s === 0 || s === 8) {
          this.kick.triggerAttackRelease('C1', '8n', time, 0.9);
          this.pump(time);
        }
        if (s === 4 || s === 12) this.snare.triggerAttackRelease('8n', time, 0.75);
        if (s % 2 === 0) this.hat.triggerAttackRelease('32n', time, 0.35);
        break;
      case 'none':
        break;
    }

    // ---- melody
    const phrase = this.bar % 8;
    if (st.melody === 'bell' && phrase >= 4 && s % 2 === 0 && r() < 0.22) {
      this.bell.triggerAttackRelease(midi(pick(chord) + 12), '8n', time, 0.4 + r() * 0.3);
    } else if (st.melody === 'arp' && phrase >= 2) {
      const order = [0, 1, 2, 3, 2, 1];
      const n = chord[order[this.step % order.length] % chord.length] + 12 + (phrase >= 6 && s >= 8 ? 12 : 0);
      this.arp.triggerAttackRelease(midi(n), '16n', time, 0.6);
    } else if (st.melody === 'sparse' && s % 4 === 0 && r() < 0.12) {
      this.bell.triggerAttackRelease(midi(pick(chord) + 12), '4n', time, 0.3 + r() * 0.2);
    }

    if (r() < (st.id === 'synth' ? 0.05 : 0.35)) this.crackle.triggerAttackRelease('64n', time + r() * 0.05, r());

    this.step++;
    if (this.step % 16 === 0) this.bar++;
    const p = ((this.bar % 8) * 16 + (this.step % 16)) / 128;
    Tone.getDraw().schedule(() => (this.progress = p), time);
  }

  async play() {
    this.build();
    await Tone.start();
    if (this.playing) return;
    this.playing = true;
    this.schedule();
    this.vinyl.start();
    Tone.getTransport().start('+0.05');
    this.onTrack?.(this.track);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    const transport = Tone.getTransport();
    transport.stop();
    if (this.loopId !== null) transport.clear(this.loopId);
    this.loopId = null;
    this.keys.releaseAll();
    this.pad.releaseAll();
    this.bell.releaseAll();
    this.vinyl.stop();
  }

  toggle() {
    if (this.playing) this.stop();
    else void this.play();
  }

  next() {
    const t = makeTrack(this.station, this.track);
    if (!this.playing) {
      this.track = t;
      this.onTrack?.(t);
      return;
    }
    this.pendingTrack = t;
    this.bar = Math.ceil(this.bar / 4) * 4;
  }

  /** Tune to another station: a burst of static and a fresh track in that style. */
  setStation(i: number) {
    const n = STATIONS.length;
    this.stationIndex = ((i % n) + n) % n;
    const t = makeTrack(this.station);
    if (this.ready) {
      this.zap.triggerAttackRelease('8n', Tone.now(), 0.8);
      this.keys.releaseAll();
      this.pad.releaseAll();
      this.applyStation();
    }
    this.track = t;
    this.pendingTrack = null;
    if (this.playing) {
      Tone.getTransport().bpm.rampTo(t.bpm, 0.3);
      this.step = 0;
      this.bar = 0;
    }
    this.onTrack?.(t);
  }
}
