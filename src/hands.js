// Camera hand control for up to two hands.
// Each hand has a cursor and a gesture: 'open', 'pinch' (thumb + index) or 'fist'.
// Pinch and fist are sent as pointer events (with `event.hand` attached), so the scene and the
// HTML buttons work as with a mouse; the engine reads getHands() for two-hand interactions.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const PINCH_ON = 0.32, PINCH_OFF = 0.45; // thumb–index gap relative to palm size, with hysteresis
const LOST_FRAMES = 8;                   // a hand may vanish briefly without dropping what it holds

let landmarker, stream, raf = 0, running = false;
const hands = {}; // keyed by 'L' / 'R'

const $ = s => document.querySelector(s);

function fire(el, type, h) {
  const ev = new PointerEvent(type, { clientX: h.x, clientY: h.y, pointerId: h.pid, pointerType: 'mouse',
    isPrimary: h.id === 'R', bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
  ev.hand = { id: h.id, gesture: h.gesture };
  el.dispatchEvent(ev);
}

function press(h) {
  const el = document.elementFromPoint(h.x, h.y); if (!el) return;
  const t = el.closest('button,input,textarea,canvas') || el;
  // a fist only grabs things in the scene; buttons need a pinch
  if (h.gesture === 'fist' && t.tagName !== 'CANVAS') return;
  h.target = t;
  fire(t, 'pointerdown', h);
  if (t.matches('input,textarea')) t.focus();
}
function release(h) {
  const t = h.target; if (!t) return;
  h.target = null;
  fire(t, 'pointerup', h);
  if (t.tagName === 'BUTTON' && document.elementFromPoint(h.x, h.y)?.closest('button') === t) t.click();
}

function gestureOf(lm, prev) {
  const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  const palm = d(0, 9) || 1e-3;
  // fist: at least three fingertips curled closer to the wrist than their knuckles
  let curled = 0;
  for (const [tip, knuckle] of [[8, 5], [12, 9], [16, 13], [20, 17]]) if (d(tip, 0) < d(knuckle, 0) * 1.05) curled++;
  if (curled >= 3) return 'fist';
  const gap = d(4, 8) / palm;
  if (prev === 'pinch') return gap > PINCH_OFF ? 'open' : 'pinch';
  return gap < PINCH_ON ? 'pinch' : 'open';
}

function cursorEl(id) {
  let el = document.getElementById('handCursor' + id);
  if (!el) { el = document.createElement('div'); el.id = 'handCursor' + id; el.className = 'handCursor ' + id; el.hidden = true; document.body.append(el); }
  return el;
}

let lastCount = 0;
function track() {
  if (!running) return;
  raf = requestAnimationFrame(track);
  const video = $('#handCam');
  if (video.readyState < 2) return;
  const res = landmarker.detectForVideo(video, performance.now());
  const seen = new Set();
  (res.landmarks || []).forEach((lm, i) => {
    // the preview is mirrored, so MediaPipe's "Left" is the user's right hand
    const id = res.handednesses?.[i]?.[0]?.categoryName === 'Left' ? 'R' : 'L';
    if (seen.has(id)) return; seen.add(id);
    const h = hands[id] ||= { id, pid: id === 'R' ? 77 : 78, x: 0, y: 0, gesture: 'open', target: null, lost: 0, fresh: true };
    h.lost = 0;
    const thumb = lm[4], index = lm[8];
    // mirror x; a margin lets the cursor reach the screen edges
    const mx = 1 - (thumb.x + index.x) / 2, my = (thumb.y + index.y) / 2;
    const tx = Math.min(1, Math.max(0, (mx - .15) / .7)) * innerWidth, ty = Math.min(1, Math.max(0, (my - .12) / .66)) * innerHeight;
    if (h.fresh) { h.x = tx; h.y = ty; h.fresh = false; } else { h.x += (tx - h.x) * .45; h.y += (ty - h.y) * .45; }
    const was = h.gesture, g = gestureOf(lm, was);
    h.gesture = g;
    if (was === 'open' && g !== 'open') press(h);
    else if (was !== 'open' && g === 'open') release(h);
    const c = cursorEl(id); c.hidden = false; c.dataset.g = g;
    c.style.transform = `translate(${h.x}px,${h.y}px)`;
    fire(h.target || $('#scene'), 'pointermove', h);
  });
  for (const id of Object.keys(hands)) {
    if (seen.has(id)) continue;
    const h = hands[id];
    if (++h.lost > LOST_FRAMES) { if (h.target) release(h); cursorEl(id).hidden = true; delete hands[id]; }
  }
  const count = Object.keys(hands).length;
  if (count !== lastCount) { lastCount = count; dispatchEvent(new CustomEvent('handschange', { detail: count })); }
}

export async function startHands() {
  if (running) return;
  stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
  const video = $('#handCam');
  video.srcObject = stream; await video.play();
  if (!landmarker) {
    const files = await FilesetResolver.forVisionTasks(WASM);
    const opts = { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2 };
    try { landmarker = await HandLandmarker.createFromOptions(files, opts); }
    catch { landmarker = await HandLandmarker.createFromOptions(files, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } }); }
  }
  running = true; $('#handBox').hidden = false; track();
}

export function stopHands() {
  running = false; cancelAnimationFrame(raf);
  for (const id of Object.keys(hands)) { if (hands[id].target) release(hands[id]); cursorEl(id).hidden = true; delete hands[id]; }
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  $('#handBox').hidden = true;
  dispatchEvent(new CustomEvent('handschange', { detail: 0 }));
}

/** Hands currently in view: [{ id:'L'|'R', x, y, gesture }] in screen pixels. */
export const getHands = () => Object.values(hands).filter(h => h.lost === 0 || h.target).map(({ id, x, y, gesture }) => ({ id, x, y, gesture }));
export const handsOn = () => running;
