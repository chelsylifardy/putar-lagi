import { useEffect } from 'react';
import { startEngine } from './engine.jsx';
import { startHands, stopHands, handsOn } from './hands.js';
import { Brand, Status, BottomBar, Feedback, Modal, TitleEditor, ShareBox, GiftBox, HandControl } from './components/Overlay.jsx';

export default function App() {
  useEffect(() => {
    startEngine();
    const btn = document.getElementById('btnHands');
    btn.onclick = async () => {
      if (handsOn()) { stopHands(); btn.setAttribute('aria-pressed', 'false'); btn.textContent = '✋ Kontrol tangan'; return; }
      btn.textContent = 'Menyalakan kamera…';
      try { await startHands(); btn.setAttribute('aria-pressed', 'true'); btn.textContent = '✋ Matikan kontrol tangan'; }
      catch (err) { console.warn(err); stopHands(); btn.textContent = '✋ Kamera tidak bisa dipakai'; }
    };
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
      <TitleEditor />
      <ShareBox />
      <GiftBox />
      <HandControl />
      <div id="loading">Menyiapkan meja…</div>
    </>
  );
}
