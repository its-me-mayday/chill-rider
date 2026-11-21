import type { Controls } from './rider';

type Action = 'pedal' | 'brake' | 'left' | 'right';
export type Toggle = 'radio' | 'next' | 'hud' | 'pause' | 'bell';

const KEYMAP: Record<string, Action> = {
  KeyW: 'pedal',
  ArrowUp: 'pedal',
  KeyS: 'brake',
  ArrowDown: 'brake',
  Space: 'brake',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export interface Joystick {
  active: boolean;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

const JOY_MAX = 60;

export class Input {
  private held = new Set<Action>();
  private buttons = new Map<number, Action>();
  joy: Joystick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
  private joyId: number | null = null;
  onToggle: ((what: Toggle) => void) | null = null;

  constructor(surface: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (a) {
        this.held.add(a);
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      const map: Record<string, Toggle> = { KeyR: 'radio', KeyN: 'next', KeyH: 'hud', KeyP: 'pause', Escape: 'pause', KeyB: 'bell' };
      if (map[e.code]) this.onToggle?.(map[e.code]);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.buttons.clear();
      this.joy.active = false;
      this.joyId = null;
    });

    // floating joystick: touch anywhere on the play surface
    surface.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.joyId !== null) return;
      e.preventDefault();
      this.joyId = e.pointerId;
      surface.setPointerCapture?.(e.pointerId);
      this.joy = { active: true, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    });
    surface.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyId) return;
      let dx = e.clientX - this.joy.ox;
      let dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_MAX * 1.6) {
        // drag the origin along so the stick never feels stuck
        const k = (d - JOY_MAX * 1.6) / d;
        this.joy.ox += dx * k;
        this.joy.oy += dy * k;
        dx = e.clientX - this.joy.ox;
        dy = e.clientY - this.joy.oy;
      }
      this.joy.x = e.clientX;
      this.joy.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.joy.active = false;
    };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
  }

  bindButton(el: HTMLElement, action: Action) {
    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture?.(e.pointerId);
      this.buttons.set(e.pointerId, action);
      el.classList.add('active');
    };
    const up = (e: PointerEvent) => {
      this.buttons.delete(e.pointerId);
      if (![...this.buttons.values()].includes(action)) el.classList.remove('active');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private has(a: Action) {
    if (this.held.has(a)) return true;
    for (const v of this.buttons.values()) if (v === a) return true;
    return false;
  }

  read(): Controls {
    const brake = this.has('brake');
    if (this.joy.active) {
      const dx = this.joy.x - this.joy.ox;
      const dy = this.joy.y - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > 12) {
        return { pedal: Math.min(1, d / JOY_MAX), brake, steer: 0, aim: Math.atan2(dy, dx) };
      }
      return { pedal: 0, brake, steer: 0, aim: null };
    }
    return {
      pedal: this.has('pedal') ? 1 : 0,
      brake,
      steer: (this.has('right') ? 1 : 0) - (this.has('left') ? 1 : 0),
      aim: null,
    };
  }
}
