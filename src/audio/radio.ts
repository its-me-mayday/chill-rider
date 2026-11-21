import * as Tone from 'tone';

/**
 * Generative lo-fi radio. Every "track" is a random key, tempo and chord
 * progression played by a dusty electric piano, round bass, boom-bap drums,
 * an occasional bell melody and a vinyl bed. Nothing is sampled.
 */

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const QUALITY: Record<string, number[]> = {
  maj9: [4, 7, 11, 14],
  maj7: [4, 7, 11, 16],
  m9: [3, 7, 10, 14],
  m7: [3, 7, 10, 15],
  dom9: [4, 10, 14, 19],
  m11: [3, 10, 14, 17],
  sus: [5, 7, 10, 14],
};

type Chord = [degree: number, quality: keyof typeof QUALITY];

const PROGRESSIONS: Chord[][] = [
  [[2, 'm9'], [5, 'dom9'], [1, 'maj9'], [6, 'm9']],
  [[1, 'maj7'], [3, 'm7'], [6, 'm9'], [4, 'maj9']],
  [[4, 'maj9'], [3, 'm7'], [2, 'm11'], [1, 'maj9']],
  [[6, 'm9'], [4, 'maj7'], [1, 'maj9'], [5, 'sus']],
  [[1, 'maj9'], [4, 'maj9'], [2, 'm9'], [5, 'dom9']],
  [[2, 'm11'], [3, 'm7'], [4, 'maj9'], [5, 'sus']],
];

const KEYS = ['C', 'D', 'Eb', 'E', 'F', 'G', 'Ab', 'A', 'Bb'];
const KEY_MIDI: Record<string, number> = { C: 48, D: 50, Eb: 51, E: 52, F: 53, G: 55, Ab: 56, A: 57, Bb: 58 };

const WORDS_A = ['peach', 'slow', 'golden', 'pastel', 'sleepy', 'warm', 'dusty', 'soft', 'late', 'quiet', 'velvet', 'hazy'];
const WORDS_B = ['wheels', 'horizon', 'boulevard', 'afternoon', 'breeze', 'pedals', 'sunset', 'postcard', 'fields', 'cassette', 'drive', 'clouds'];

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
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function makeTrack(prev?: Track): Track {
  let key = pick(KEYS);
  if (prev && key === prev.key) key = pick(KEYS);
  const base = KEY_MIDI[key];
  const prog = pick(PROGRESSIONS);
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
    const shift = Math.round((centre - avg) / 12) * 12;
    notes = notes.map((n) => n + shift);
    while (Math.min(...notes) < 52) notes = notes.map((n) => n + 12);
    while (Math.max(...notes) > 79) notes = notes.map((n) => n - 12);
    chords.push(notes);
    last = notes;
  }
  return {
    title: `${pick(WORDS_A)} ${pick(WORDS_B)}`,
    key,
    bpm: 68 + Math.floor(Math.random() * 16),
    progression: chords,
    roots,
    kick: pick(KICKS),
  };
}

const midi = (n: number) => Tone.Frequency(n, 'midi').toFrequency();

export class Radio {
  playing = false;
  track: Track = makeTrack();
  onTrack: ((t: Track) => void) | null = null;

  private ready = false;
  private master!: Tone.Volume;
  private keysGain!: Tone.Gain;
  private keys!: Tone.PolySynth;
  private bass!: Tone.MonoSynth;
  private bell!: Tone.PolySynth;
  private kick!: Tone.MembraneSynth;
  private snare!: Tone.NoiseSynth;
  private hat!: Tone.NoiseSynth;
  private crackle!: Tone.NoiseSynth;
  private vinyl!: Tone.Noise;
  private step = 0;
  private bar = 0;
  private pendingTrack: Track | null = null;
  private loopId: number | null = null;

  constructor(private output: Tone.InputNode) {}

  private build() {
    if (this.ready) return;
    this.ready = true;
    const tape = new Tone.Vibrato({ frequency: 0.6, depth: 0.08 });
    const lofi = new Tone.Filter({ frequency: 2600, type: 'lowpass', rolloff: -24 });
    const crush = new Tone.BitCrusher(10);
    crush.wet.value = 0.18;
    this.master = new Tone.Volume(-8);
    tape.chain(lofi, crush, this.master);
    this.master.connect(this.output);

    const reverb = new Tone.Reverb({ decay: 3.8, wet: 0.32 });
    const chorus = new Tone.Chorus({ frequency: 0.8, delayTime: 3.5, depth: 0.45, wet: 0.4 }).start();
    this.keysGain = new Tone.Gain(1);
    this.keys = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 1.6, sustain: 0.35, release: 2.2 },
      modulationEnvelope: { attack: 0.01, decay: 0.6, sustain: 0.1, release: 1 },
      volume: -15,
    });
    this.keys.chain(chorus, reverb, this.keysGain, tape);

    this.bell = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 4,
      envelope: { attack: 0.005, decay: 1.4, sustain: 0, release: 1.4 },
      modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 },
      volume: -24,
    });
    const echo = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.35, wet: 0.3 });
    this.bell.chain(echo, reverb);

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
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0 },
      volume: -6,
    }).connect(drumBus);
    const snareFilter = new Tone.Filter({ frequency: 1800, type: 'bandpass', Q: 0.8 }).connect(drumBus);
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      volume: -12,
    }).connect(snareFilter);
    const hatFilter = new Tone.Filter({ frequency: 7000, type: 'highpass' }).connect(drumBus);
    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -22,
    }).connect(hatFilter);

    // vinyl bed + crackles
    const vinylFilter = new Tone.Filter({ frequency: 5000, type: 'lowpass' });
    const vinylHp = new Tone.Filter({ frequency: 500, type: 'highpass' });
    this.vinyl = new Tone.Noise({ type: 'pink', volume: -40 });
    this.vinyl.chain(vinylHp, vinylFilter, this.master);
    this.crackle = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.0005, decay: 0.008, sustain: 0 },
      volume: -26,
    }).connect(vinylHp);
  }

  private schedule() {
    const transport = Tone.getTransport();
    transport.swing = 0.22;
    transport.swingSubdivision = '16n';
    transport.bpm.value = this.track.bpm;
    this.step = 0;
    this.bar = 0;
    if (this.loopId !== null) transport.clear(this.loopId);
    this.loopId = transport.scheduleRepeat((time) => this.tick(time), '16n');
  }

  private tick(time: number) {
    const s = this.step % 16;
    if (s === 0) {
      if (this.pendingTrack && this.bar % 4 === 0) {
        this.track = this.pendingTrack;
        this.pendingTrack = null;
        Tone.getTransport().bpm.rampTo(this.track.bpm, 1, time);
        const t = this.track;
        Tone.getDraw().schedule(() => this.onTrack?.(t), time);
      }
      const idx = this.bar % this.track.progression.length;
      const chord = this.track.progression[idx];
      const barDur = Tone.Time('1m').toSeconds();
      chord.forEach((n, i) => {
        this.keys.triggerAttackRelease(midi(n), barDur * 0.92, time + i * 0.025 + Math.random() * 0.01, 0.55 + Math.random() * 0.2);
      });
      this.bass.triggerAttackRelease(midi(this.track.roots[idx]), '4n.', time, 0.9);
    }
    if (s === 10 && Math.random() < 0.6) {
      const idx = this.bar % this.track.progression.length;
      this.bass.triggerAttackRelease(midi(this.track.roots[idx] + (Math.random() < 0.5 ? 12 : 7)), '8n', time, 0.6);
    }

    // drums
    const kick = this.track.kick;
    if (kick[s]) {
      this.kick.triggerAttackRelease('C1', '8n', time, s === 0 ? 1 : 0.8);
      // gentle sidechain pump on the keys
      this.keysGain.gain.cancelScheduledValues(time);
      this.keysGain.gain.setValueAtTime(0.62, time);
      this.keysGain.gain.linearRampToValueAtTime(1, time + 0.32);
    }
    if (s === 4 || s === 12) this.snare.triggerAttackRelease('16n', time, 0.85);
    else if ((s === 15 || s === 7) && Math.random() < 0.18) this.snare.triggerAttackRelease('32n', time, 0.25);
    if (s % 2 === 0) this.hat.triggerAttackRelease('32n', time, s % 4 === 0 ? 0.7 : 0.4 + Math.random() * 0.2);
    else if (Math.random() < 0.15) this.hat.triggerAttackRelease('32n', time, 0.2);

    // sparse bell melody, mostly in the second half of each 8-bar phrase
    const phrase = this.bar % 8;
    if (phrase >= 4 && s % 2 === 0 && Math.random() < 0.22) {
      const chord = this.track.progression[this.bar % this.track.progression.length];
      const n = pick(chord) + 12;
      this.bell.triggerAttackRelease(midi(n), '8n', time, 0.4 + Math.random() * 0.3);
    }

    if (Math.random() < 0.35) this.crackle.triggerAttackRelease('64n', time + Math.random() * 0.05, Math.random());

    this.step++;
    if (this.step % 16 === 0) this.bar++;
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
    this.bell.releaseAll();
    this.vinyl.stop();
  }

  toggle() {
    if (this.playing) this.stop();
    else void this.play();
  }

  next() {
    const t = makeTrack(this.track);
    if (!this.playing) {
      this.track = t;
      this.onTrack?.(t);
      return;
    }
    this.pendingTrack = t;
    // jump to the next 4-bar boundary quickly
    this.bar = Math.ceil(this.bar / 4) * 4;
  }
}
