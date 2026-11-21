import type { Controls } from './bike';

type Action = 'pedal' | 'brake' | 'back' | 'forward';

const KEYMAP: Record<string, Action> = {
  KeyW: 'pedal',
  ArrowUp: 'pedal',
  ArrowRight: 'forward',
  KeyS: 'brake',
  ArrowDown: 'brake',
  Space: 'brake',
  KeyA: 'back',
  ArrowLeft: 'back',
  KeyD: 'forward',
};

export class Input {
  private held = new Set<Action>();
  private touch = new Map<number, Action>();
  cruise = false;
  onToggle: ((what: 'cruise' | 'radio' | 'next' | 'hud' | 'pause' | 'bell') => void) | null = null;
  onFirstGesture: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.gesture();
      const a = KEYMAP[e.code];
      if (a) {
        this.held.add(a);
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyC': this.cruise = !this.cruise; this.onToggle?.('cruise'); break;
        case 'KeyR': this.onToggle?.('radio'); break;
        case 'KeyN': this.onToggle?.('next'); break;
        case 'KeyH': this.onToggle?.('hud'); break;
        case 'KeyB': this.onToggle?.('bell'); break;
        case 'KeyP':
        case 'Escape': this.onToggle?.('pause'); break;
      }
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.touch.clear();
    });
  }

  private gesture() {
    if (this.onFirstGesture) {
      const cb = this.onFirstGesture;
      this.onFirstGesture = null;
      cb();
    }
  }

  /** Wire a DOM button to an action (pointer events, multi-touch safe). */
  bindButton(el: HTMLElement, action: Action) {
    const down = (e: PointerEvent) => {
      e.preventDefault();
      this.gesture();
      el.setPointerCapture?.(e.pointerId);
      this.touch.set(e.pointerId, action);
      el.classList.add('active');
    };
    const up = (e: PointerEvent) => {
      this.touch.delete(e.pointerId);
      if (![...this.touch.values()].includes(action)) el.classList.remove('active');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private has(a: Action) {
    if (this.held.has(a)) return true;
    for (const v of this.touch.values()) if (v === a) return true;
    return false;
  }

  read(): Controls {
    const brake = this.has('brake');
    if (brake && this.cruise) {
      this.cruise = false;
      this.onToggle?.('cruise');
    }
    return {
      pedal: this.has('pedal'),
      brake,
      lean: (this.has('forward') ? 1 : 0) - (this.has('back') ? 1 : 0),
      cruise: this.cruise,
    };
  }
}
