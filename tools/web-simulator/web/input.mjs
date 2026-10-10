// Normalize browser input to the four events in bsp_button.h.
export class ButtonInput {
  constructor(emit, { setTimer = (fn, ms) => globalThis.setTimeout(fn, ms), clearTimer = (id) => globalThis.clearTimeout(id), longMs = 600, doubleMs = 250 } = {}) {
    Object.assign(this, { emit, setTimer, clearTimer, longMs, doubleMs });
    this.pressed = new Map();
    this.pending = new Map();
  }
  down(key) {
    if (this.pressed.has(key)) return;
    // The physical buttons share an ADC ladder: one held key at a time.
    for (const held of this.pressed.keys()) this.cancelKey(held);
    const state = { long: false };
    this.pressed.set(key, state);
    this.emit(key, 'PRESS');
    state.timer = this.setTimer(() => {
      state.long = true;
      this.cancelClick(key);
      this.emit(key, 'LONG');
    }, this.longMs);
  }
  up(key) {
    const state = this.pressed.get(key);
    if (!state) return;
    this.clearTimer(state.timer);
    this.pressed.delete(key);
    if (state.long) return;
    if (this.pending.has(key)) {
      this.cancelClick(key);
      this.emit(key, 'DOUBLE');
    } else {
      this.pending.set(key, this.setTimer(() => {
        this.pending.delete(key);
        this.emit(key, 'CLICK');
      }, this.doubleMs));
    }
  }
  cancelClick(key) {
    if (this.pending.has(key)) this.clearTimer(this.pending.get(key));
    this.pending.delete(key);
  }
  cancelKey(key) {
    const state = this.pressed.get(key);
    if (state) this.clearTimer(state.timer);
    this.pressed.delete(key);
    this.cancelClick(key);
  }
  cancel() {
    for (const key of new Set([...this.pressed.keys(), ...this.pending.keys()])) this.cancelKey(key);
  }
}
