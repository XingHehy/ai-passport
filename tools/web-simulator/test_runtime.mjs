// Execute the generated WASM in a VM, without browser or device dependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const output = new URL('../../build/web-simulator/', import.meta.url);
async function fixture() {
  let time = 0, brightness = 100;
  const frame = new Uint16Array(240 * 320);
  const context = vm.createContext({ console, URL, WebAssembly,
    performance: { now: () => time },
    passportBridge: {
      flush(heap, ptr, x1, y1, x2, y2) {
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++, ptr += 2) frame[y * 240 + x] = heap[ptr] | (heap[ptr + 1] << 8);
      },
      backlight(value) { brightness = value; }
    }
  });
  vm.runInContext(await readFile(new URL('runtime.js', output), 'utf8'), context);
  const runtime = await context.createPassportRuntime({ wasmBinary: new Uint8Array(await readFile(new URL('runtime.wasm', output))) });
  const advance = (steps = 10) => { for (let i = 0; i < steps; i++) { time += 20; runtime._sim_step(); } };
  runtime._sim_init(); advance();
  return { runtime, frame, advance, get brightness() { return brightness; } };
}
test('real display handler changes rendered RGB565 pixels and backlight', async () => {
  const f = await fixture();
  const center = 90 * 240 + 35;
  assert.equal(f.frame[center], 0xf800, 'initial swatch is red');
  assert.equal(f.frame[0], 0, 'device rounded-mask corner remains black');
  f.runtime._sim_key(2, 0); f.advance();
  assert.equal(f.frame[center], 0xf800, 'PRESS alone does not cycle the display fixture');
  f.runtime._sim_key(2, 1); f.advance();
  assert.equal(f.frame[center], 0x07e0, 'OK CLICK reaches the original C handler and turns green');
  f.runtime._sim_key(1, 1); f.advance(); assert.equal(f.brightness, 50);
  f.runtime._sim_key(1, 1); f.advance(); assert.equal(f.brightness, 10);
});
test('page teardown, button log events, power cycle and repeated resets remain runnable', async () => {
  const f = await fixture();
  for (let i = 0; i < 12; i++) {
    f.runtime._sim_page(1); f.advance();
    for (let event = 0; event < 4; event++) { f.runtime._sim_key(0, event); f.advance(); }
    f.runtime._sim_adc(1200); f.advance();
    f.runtime._sim_power(0); f.advance();
    f.runtime._sim_key(2, 1); // ignored while off
    f.runtime._sim_page(0); f.runtime._sim_power(1); f.advance();
    f.runtime._sim_reset(); f.advance();
    assert.equal(f.frame[90 * 240 + 35], 0xf800);
  }
});
