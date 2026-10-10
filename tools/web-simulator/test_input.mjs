import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonInput } from './web/input.mjs';
function fixture() {
  let clock = 0, nextId = 0;
  const timers = new Map(), events = [];
  const input = new ButtonInput((key, event) => events.push([key, event]), {
    setTimer(fn, ms) { const id = ++nextId; timers.set(id, { at: clock + ms, fn }); return id; },
    clearTimer(id) { timers.delete(id); }
  });
  return { input, events, advance(ms) {
    const end = clock + ms;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      clock = due[1].at; timers.delete(due[0]); due[1].fn();
    }
    clock = end;
  } };
}
test('short press emits immediate PRESS and one delayed CLICK', () => {
  const { input, events, advance } = fixture();
  input.down('OK'); input.up('OK'); advance(249);
  assert.deepEqual(events, [['OK', 'PRESS']]); advance(1);
  assert.deepEqual(events, [['OK', 'PRESS'], ['OK', 'CLICK']]);
});
test('double press suppresses both CLICK events', () => {
  const { input, events, advance } = fixture();
  input.down('UP'); input.up('UP'); advance(100); input.down('UP'); input.up('UP'); advance(1000);
  assert.deepEqual(events, [['UP', 'PRESS'], ['UP', 'PRESS'], ['UP', 'DOUBLE']]);
});
test('long hold fires once and never clicks on release or keyboard repeat', () => {
  const { input, events, advance } = fixture();
  input.down('DOWN'); input.down('DOWN'); advance(599); assert.equal(events.length, 1);
  advance(1001); input.up('DOWN'); advance(1000);
  assert.deepEqual(events, [['DOWN', 'PRESS'], ['DOWN', 'LONG']]);
});
test('focus loss/cancellation clears long and pending click timers', () => {
  const { input, events, advance } = fixture();
  input.down('OK'); input.up('OK'); input.down('UP'); input.cancel(); advance(1000);
  input.up('UP'); assert.deepEqual(events, [['OK', 'PRESS'], ['UP', 'PRESS']]);
});
test('releases beyond double interval are independent clicks', () => {
  const { input, events, advance } = fixture();
  input.down('OK'); input.up('OK'); advance(251); input.down('OK'); input.up('OK'); advance(251);
  assert.deepEqual(events, [['OK', 'PRESS'], ['OK', 'CLICK'], ['OK', 'PRESS'], ['OK', 'CLICK']]);
});
test('changing the held key cancels the old long action', () => {
  const { input, events, advance } = fixture();
  input.down('UP'); advance(200); input.down('DOWN'); input.up('UP'); input.up('DOWN'); advance(1000);
  assert.deepEqual(events, [['UP', 'PRESS'], ['DOWN', 'PRESS'], ['DOWN', 'CLICK']]);
});
test('default timers retain the browser global receiver', () => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const callbacks = [], events = [];
  globalThis.setTimeout = function(fn) {
    assert.equal(this, globalThis, 'browser timers require a Window/global receiver');
    callbacks.push(fn); return callbacks.length;
  };
  globalThis.clearTimeout = function() { assert.equal(this, globalThis); };
  try {
    const input = new ButtonInput((key, event) => events.push([key, event]));
    input.down('OK'); input.up('OK'); callbacks[1]();
    assert.deepEqual(events, [['OK', 'PRESS'], ['OK', 'CLICK']]);
    input.down('UP'); input.cancel();
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
});
