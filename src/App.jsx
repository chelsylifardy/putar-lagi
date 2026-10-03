import { useEffect } from 'react';
import { startEngine } from './engine.jsx';
import { Brand, Tools, Status, BottomBar, Feedback, Modal, TitleEditor, ShareBox, GiftBox } from './components/Overlay.jsx';

export default function App() {
  useEffect(() => { startEngine(); }, []);
  return (
    <>
      <canvas id="scene" aria-label="Meja belajar 3D dengan kaset, tape recorder, dan pensil"></canvas>
      <div className="vignette"></div>
      <div className="grain"></div>
      <Brand />
      <Tools />
      <Status />
      <BottomBar />
      <Feedback />
      <Modal />
      <TitleEditor />
      <ShareBox />
      <GiftBox />
      <div id="loading">Menyiapkan meja…</div>
    </>
  );
}
