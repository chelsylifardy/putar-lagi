// Camera hand control: the index fingertip moves a cursor, a thumb–index pinch acts as a press.
// Pinches are turned into pointer events, so the 3D scene and the HTML buttons need no special code.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POINTER_ID = 77;
const PINCH_ON = 0.32, PINCH_OFF = 0.45; // thumb–index gap relative to palm size, with hysteresis

let landmarker, stream, raf = 0, running = false;
let pos = null, pinching = false, target = null, lostFrames = 0;

const $ = s => document.querySelector(s);

function fire(el, type, x, y) {
  el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: POINTER_ID, pointerType: 'mouse',
    isPrimary: true, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
}

function press(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return;
  target = el.closest('button,input,textarea,canvas') || el;
  fire(target, 'pointerdown', x, y);
  if (target.matches('input,textarea')) target.focus();
}
function release(x, y) {
  if (!target) return;
  const t = target; target = null;
  fire(t, 'pointerup', x, y);
  if (t.tagName === 'BUTTON' && document.elementFromPoint(x, y)?.closest('button') === t) t.click();
}

function track() {
  if (!running) return;
  raf = requestAnimationFrame(track);
  const video = $('#handCam');
  if (video.readyState < 2) return;
  const res = landmarker.detectForVideo(video, performance.now());
  const cursor = $('#handCursor');
  const lm = res.landmarks?.[0];
  if (!lm) {
    // briefly losing the hand mid-pinch should not drop what it holds
    if (++lostFrames > 8) { if (pinching && pos) release(pos.x, pos.y); pinching = false; cursor.hidden = true; }
    return;
  }
  lostFrames = 0;
  const [wrist, thumb, index, mid] = [lm[0], lm[4], lm[8], lm[9]];
  const palm = Math.hypot(mid.x - wrist.x, mid.y - wrist.y) || 1e-3;
  const gap = Math.hypot(thumb.x - index.x, thumb.y - index.y) / palm;
  // mirror x so moving right moves right; a margin lets the cursor reach the screen edges
  const mx = 1 - (thumb.x + index.x) / 2, my = (thumb.y + index.y) / 2;
  const nx = Math.min(1, Math.max(0, (mx - .15) / .7)), ny = Math.min(1, Math.max(0, (my - .12) / .66));
  const tx = nx * innerWidth, ty = ny * innerHeight;
  pos = pos ? { x: pos.x + (tx - pos.x) * .45, y: pos.y + (ty - pos.y) * .45 } : { x: tx, y: ty };
  cursor.hidden = false;
  cursor.style.transform = `translate(${pos.x}px,${pos.y}px)`;
  const scene = $('#scene');
  if (!pinching && gap < PINCH_ON) { pinching = true; press(pos.x, pos.y); }
  else if (pinching && gap > PINCH_OFF) { pinching = false; release(pos.x, pos.y); }
  cursor.classList.toggle('pinch', pinching);
  fire(target === scene || !target ? scene : target, 'pointermove', pos.x, pos.y);
}

export async function startHands() {
  if (running) return;
  stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
  const video = $('#handCam');
  video.srcObject = stream; await video.play();
  if (!landmarker) {
    const files = await FilesetResolver.forVisionTasks(WASM);
    const opts = { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 };
    try { landmarker = await HandLandmarker.createFromOptions(files, opts); }
    catch { landmarker = await HandLandmarker.createFromOptions(files, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } }); }
  }
  running = true; $('#handBox').hidden = false; track();
}

export function stopHands() {
  running = false; cancelAnimationFrame(raf);
  if (pinching && pos) release(pos.x, pos.y);
  pinching = false; pos = null;
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  $('#handBox').hidden = true; $('#handCursor').hidden = true;
}

export const handsOn = () => running;
