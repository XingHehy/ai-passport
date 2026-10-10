import { ButtonInput } from './input.mjs';
const $ = (id) => document.getElementById(id);
const canvas = $('passport-display');
const ctx = canvas.getContext('2d', { alpha: false });
const rawFrame = new Uint8ClampedArray(240 * 320 * 4);
const image = ctx.createImageData(240, 320);
for (let i = 3; i < rawFrame.length; i += 4) rawFrame[i] = 255;
let runtime, ready = false, powered = true, brightness = 100, dirty = true, paused = false;
let frames = 0, totalFrames = 0, lastStats = performance.now(), buildIdentity;
let feedbackTimer;
const keys = { UP: 0, DOWN: 1, OK: 2 };
const events = { PRESS: 0, CLICK: 1, DOUBLE: 2, LONG: 3 };
const startTime = performance.now();

function log(key, event) {
  const list = $('event-log');
  list.querySelector('.log-empty')?.remove();
  const row = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = ((performance.now() - startTime) / 1000).toFixed(2) + 's';
  const entry = document.createElement('span');
  entry.textContent = key + ' / ';
  const detail = document.createElement('em');
  detail.textContent = event;
  entry.append(detail); row.append(time, entry); list.prepend(row);
  while (list.children.length > 100) list.lastElementChild.remove();
}
function status(message, state = 'ready') {
  $('runtime-status').textContent = message;
  $('status-dot').className = 'status-dot ' + state;
}
function feedback(message) {
  clearTimeout(feedbackTimer);
  $('screenshot-feedback').textContent = message;
  $('screenshot-feedback').hidden = false;
  feedbackTimer = setTimeout(() => { $('screenshot-feedback').hidden = true; }, 3500);
}
function draw() {
  const scale = powered ? brightness / 100 : 0;
  for (let i = 0; i < rawFrame.length; i += 4) {
    image.data[i] = Math.round(rawFrame[i] * scale);
    image.data[i + 1] = Math.round(rawFrame[i + 1] * scale);
    image.data[i + 2] = Math.round(rawFrame[i + 2] * scale);
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  dirty = false; frames++; totalFrames++;
}
globalThis.passportBridge = {
  flush(heap, ptr, x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++, ptr += 2) {
        const pixel = heap[ptr] | (heap[ptr + 1] << 8);
        const target = (y * 240 + x) * 4;
        rawFrame[target] = Math.round(((pixel >> 11) & 31) * 255 / 31);
        rawFrame[target + 1] = Math.round(((pixel >> 5) & 63) * 255 / 63);
        rawFrame[target + 2] = Math.round((pixel & 31) * 255 / 31);
      }
    }
    dirty = true;
  },
  backlight(value) { brightness = value; dirty = true; }
};
function emit(key, event) {
  if (!ready) return;
  log(key, event);
  if (key === 'POWER') {
    if (event === 'CLICK') {
      input.cancel(); clearPressed();
      powered = !powered;
      runtime._sim_power(Number(powered));
      dirty = true;
      status(powered ? '运行中' : '模拟电源已关闭');
    }
  } else if (powered) runtime._sim_key(keys[key], events[event]);
}
const input = new ButtonInput(emit);
function clearPressed() { document.querySelectorAll('[data-key]').forEach(el => el.classList.remove('is-pressed')); }
function cancelInput() { input.cancel(); clearPressed(); }
function down(key) {
  if (!ready || (!powered && key !== 'POWER')) return;
  clearPressed();
  document.querySelectorAll(`[data-key="${key}"]`).forEach(el => el.classList.add('is-pressed'));
  input.down(key);
}
function up(key) {
  document.querySelectorAll(`[data-key="${key}"]`).forEach(el => el.classList.remove('is-pressed'));
  input.up(key);
}
for (const el of document.querySelectorAll('[data-key]')) {
  el.disabled = true;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); el.focus({ preventScroll: true });
    el.setPointerCapture(e.pointerId); down(el.dataset.key);
  });
  el.addEventListener('pointerup', e => { e.preventDefault(); up(el.dataset.key); });
  el.addEventListener('pointercancel', cancelInput);
  el.addEventListener('lostpointercapture', () => {
    if (input.pressed.has(el.dataset.key)) cancelInput();
  });
  // Support assistive-technology clicks without duplicating pointer events.
  el.addEventListener('click', e => {
    if (e.detail === 0) { down(el.dataset.key); up(el.dataset.key); }
  });
}
const keyboard = { ArrowUp: 'UP', ArrowDown: 'DOWN', Enter: 'OK', p: 'POWER', P: 'POWER' };
function editing(target) { return target instanceof Element && (target.closest('input,select,textarea,[contenteditable="true"]')); }
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { cancelInput(); if ($('simulator-stage').classList.contains('is-fullscreen')) toggleFullscreen(); return; }
  const key = keyboard[e.key];
  if (!key || editing(e.target)) return;
  // Native button Enter/Space remains accessible without global key duplication.
  if (e.target instanceof Element && e.target.closest('button') && e.key === 'Enter') return;
  e.preventDefault(); if (!e.repeat) down(key);
});
window.addEventListener('keyup', e => {
  const key = keyboard[e.key];
  if (!key) return;
  if (input.pressed.has(key)) { e.preventDefault(); up(key); }
});
window.addEventListener('blur', cancelInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelInput(); });
$('page-select').addEventListener('change', () => {
  cancelInput(); runtime._sim_page(Number($('page-select').value));
  $('page-help').textContent = $('page-select').value === '0' ? 'OK 切换颜色；UP / DOWN 调整背光。' : '屏幕显示 PRESS / CLICK / DOUBLE / LONG 事件。';
  dirty = true; log('PAGE', $('page-select').value === '0' ? 'DISPLAY' : 'BUTTON');
});
$('reset').addEventListener('click', () => {
  cancelInput(); powered = true; runtime._sim_reset(); dirty = true; status('运行中'); log('SYSTEM', 'RESET');
});
function setADC() {
  const enabled = $('adc-enabled').checked;
  $('adc-input').disabled = !enabled;
  const value = enabled ? Number($('adc-input').value) : -1;
  $('adc-output').textContent = enabled ? `${value} mV` : '不可用';
  runtime._sim_adc(value);
}
$('adc-enabled').addEventListener('change', setADC);
$('adc-input').addEventListener('input', setADC);
$('clear-log').addEventListener('click', () => {
  $('event-log').replaceChildren();
  const empty = document.createElement('li'); empty.className = 'log-empty'; empty.textContent = '按下任意按键开始调试'; $('event-log').append(empty);
});
for (const [id, screenOnly] of [['shell-view', false], ['screen-view', true]]) {
  $(id).addEventListener('click', () => {
    $('simulator-stage').classList.toggle('screen-only', screenOnly);
    $('shell-view').setAttribute('aria-pressed', String(!screenOnly)); $('screen-view').setAttribute('aria-pressed', String(screenOnly));
  });
}
function fullscreenState() {
  const on = Boolean(document.fullscreenElement || $('simulator-stage').classList.contains('is-fullscreen'));
  $('fullscreen-toggle').setAttribute('aria-pressed', String(on));
  $('fullscreen-toggle').setAttribute('aria-label', on ? '退出全屏' : '全屏显示模拟器');
  $('fullscreen-toggle').title = on ? '退出全屏' : '全屏预览';
}
async function toggleFullscreen() {
  const stage = $('simulator-stage');
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (stage.classList.contains('is-fullscreen')) stage.classList.remove('is-fullscreen');
    else if (stage.requestFullscreen) await stage.requestFullscreen();
    else stage.classList.add('is-fullscreen');
  } catch { stage.classList.toggle('is-fullscreen'); }
  fullscreenState();
}
$('fullscreen-toggle').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', fullscreenState);
function screenshotBlob() {
  if (dirty) draw();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法生成截图')), 'image/png'));
}
function download(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `passport-${$('page-select').value === '0' ? 'display' : 'buttons'}-${Date.now()}.png`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('screenshot-copy').addEventListener('click', async () => {
  const button = $('screenshot-copy'); button.disabled = true; button.setAttribute('aria-busy', 'true');
  try {
    // Start clipboard write in the user gesture; the PNG promise resolves later.
    const png = screenshotBlob();
    if (navigator.clipboard?.write && globalThis.ClipboardItem) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); feedback('已复制 240 × 320 屏幕截图'); }
      catch { download(await png); feedback('剪贴板未获授权，已下载 PNG'); }
    } else { download(await png); feedback('此浏览器不支持图片复制，已下载 PNG'); }
  } catch (error) { feedback(error.message); }
  finally { button.disabled = false; button.setAttribute('aria-busy', 'false'); }
});
$('screenshot-download').addEventListener('click', async () => {
  try { download(await screenshotBlob()); feedback('已下载 240 × 320 屏幕截图'); }
  catch (error) { feedback(error.message); }
});
function animate(now) {
  if (ready && !paused && !document.hidden) {
    runtime._sim_step(); if (dirty) draw();
  }
  if (now - lastStats > 1000) {
    $('frame-stats').textContent = powered ? `${Math.round(frames * 1000 / (now - lastStats))} redraw/s · ${brightness}% light` : 'POWER OFF';
    frames = 0; lastStats = now;
  }
  requestAnimationFrame(animate);
}
async function loadWasm() {
  const response = await fetch('runtime.wasm');
  if (!response.ok) throw new Error('WebAssembly 文件不可用，请先运行构建');
  const size = Number(response.headers.get('Content-Length'));
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const chunks = []; let loaded = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    chunks.push(value); loaded += value.length;
    if (size > 0) { $('loading-progress').value = loaded / size * 100; $('loading-detail').textContent = `载入 ${Math.round(loaded / size * 100)}%`; }
  }
  const bytes = new Uint8Array(loaded); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
async function boot() {
  try {
    const info = await fetch('build-info.json').then(r => { if (!r.ok) throw new Error('缺少构建信息'); return r.json(); });
    buildIdentity = info.id;
    $('build-identity').textContent = `LVGL ${info.lvgl} · ${info.id.slice(0, 8)}`;
    const wasmBinary = await loadWasm();
    $('loading-detail').textContent = '初始化 LVGL';
    runtime = await globalThis.createPassportRuntime({ wasmBinary, print: message => log('C', message), printErr: message => log('ERROR', message), onAbort: message => {
      ready = false; cancelInput(); status('运行时异常', 'error'); $('screen-overlay').hidden = false; $('loading-detail').textContent = String(message);
      document.querySelectorAll('[data-key],#page-select,#reset,#adc-enabled').forEach(el => el.disabled = true);
    } });
    runtime._sim_init(); ready = true; draw();
    $('screen-overlay').hidden = true; status('运行中');
    document.querySelectorAll('[data-key],#page-select,#reset,#adc-enabled,#screenshot-copy,#screenshot-download').forEach(el => el.disabled = false);
    log('SYSTEM', 'READY');
    // Stable automation/debug hooks; these use the same input normalization as the UI.
    globalThis.passportSimulator = {
      get ready() { return ready; }, get frames() { return totalFrames; },
      get powered() { return powered; }, get brightness() { return brightness; },
      down, up, cancel: cancelInput,
      snapshot: () => canvas.toDataURL('image/png'),
      setPaused(value) { paused = Boolean(value); cancelInput(); }
    };
    requestAnimationFrame(animate);
    setInterval(async () => {
      try {
        const res = await fetch('/__simulator/status', { cache: 'no-store' }); if (!res.ok) return;
        const data = await res.json();
        if (data.building) status('源码变更，正在重新构建', '');
        else if (data.error) { status('构建失败：仍显示上次版本', 'error'); feedback('构建失败，请查看启动终端'); }
        else if (data.id && data.id !== buildIdentity) location.reload();
        else status(powered ? '运行中' : '模拟电源已关闭');
      } catch { /* Static serving remains usable without the watch endpoint. */ }
    }, 2000);
  } catch (error) {
    status('加载失败', 'error'); $('loading-progress').hidden = true;
    $('loading-detail').textContent = error.message; console.error(error);
  }
}
boot();
