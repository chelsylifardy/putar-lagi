import { useEffect } from 'react';
import { startEngine } from './engine.jsx';
import { startHands, stopHands } from './hands.js';
import { Brand, Status, BottomBar, Feedback, Modal, ShareBox, GiftBox, HandControl } from './components/Overlay.jsx';

export default function App() {
  useEffect(() => {
    startEngine();
    // hand control starts on its own; without a camera (or permission) the mouse/touch still works
    // hand control is for desktops with a webcam; on phones touch is the natural input and
    // running the camera model next to the 3D scene makes them stutter
    const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
    if (!touch) startHands().catch(err => { console.warn('hand control off:', err); stopHands(); });
  }, []);
  return (
    <>
      <canvas id="scene" aria-label="Meja belajar 3D dengan kaset, tape recorder, dan pensil"></canvas>
      <div className="vignette"></div>
      <div className="grain"></div>
      <Brand />
      <Status />
      <BottomBar />
      <Feedback />
      <Modal />
      <ShareBox />
      <GiftBox />
      <HandControl />
      <div id="loading">Menyiapkan meja…</div>
    </>
  );
}
