// Static HTML overlay. The engine fills #instruction, #controls, #status etc. directly,
// so these elements are rendered once and never re-rendered by React.
export function Brand() {
  return (
    <header id="brand">
      <h1><img src="/logo.png" alt="Putar Lagi" width="800" height="400" /></h1>
    </header>
  );
}

export function Status() {
  return (
    <div id="status" hidden role="status">
      <span className="dot"></span><span id="stLabel">REC</span><span id="stTime">00:00</span>
      <span id="stExtra"></span><div id="meter" aria-hidden="true"></div>
    </div>
  );
}

export function BottomBar() {
  return (
    <div id="bottom">
      <p id="instruction" aria-live="polite"></p>
      <div id="controls"></div>
    </div>
  );
}

export function Feedback() {
  return (
    <>
      <div id="toast" aria-live="assertive"></div>
      <div id="hint" aria-live="polite"></div>
      <div id="hotspot" className="hotspot" hidden></div>
      <div id="tip" hidden></div>
    </>
  );
}

export function Modal() {
  return (
    <div id="modal" className="overlay" hidden>
      <div className="card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <h2 id="modalTitle"></h2><p id="modalText"></p><div className="row" id="modalBtns"></div>
      </div>
    </div>
  );
}

export function ShareBox() {
  return (
    <div id="shareBox" className="overlay" hidden>
      <div className="card" role="dialog" aria-modal="true" aria-labelledby="shareTtl">
        <h2 id="shareTtl">Kirim ke teman</h2>
        <form id="shareForm">
          <label htmlFor="shareTo">Untuk</label>
          <input id="shareTo" maxLength={24} autoComplete="off" placeholder="nama temanmu" />
          <label htmlFor="shareFrom">Dari</label>
          <input id="shareFrom" maxLength={24} autoComplete="off" placeholder="namamu" />
          <label htmlFor="shareTitle">Tulisan di label kaset</label>
          <input id="shareTitle" maxLength={24} autoComplete="off" placeholder="mis. Lagu buat kamu" />
          <label htmlFor="shareMsg">Pesan singkat (maks. 140 huruf)</label>
          <textarea id="shareMsg" maxLength={140} rows={2} placeholder="mis. Dengarkan pelan-pelan ya"></textarea>
          <div className="row">
            <button type="button" className="btn" id="shareCancel">Batal</button>
            <button className="btn primary">Bungkus kaset</button>
          </div>
        </form>
        <div id="shareDone" hidden>
          <p id="shareSize"></p>
          <input id="shareLink" className="link" readOnly aria-label="Tautan kaset" />
          <div className="row">
            <button type="button" className="btn" id="shareClose">Tutup</button>
            <button type="button" className="btn" id="shareNative" hidden>Bagikan…</button>
            <button type="button" className="btn primary" id="shareCopy">Salin tautan</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GiftBox() {
  return (
    <div id="gift" hidden>
      <div className="card gift" role="dialog" aria-labelledby="giftTitle">
        <h2 id="giftTitle">Ada kaset untukmu</h2>
        <p id="giftFrom" className="from"></p>
        <p id="giftMsg" className="msg"></p>
        <p id="giftHow" className="how" hidden>🤏🤏 Jepit kedua sisi tutup kotak, lalu angkat</p>
        <div className="row"><button type="button" className="btn primary" id="giftOpen">Buka kotak</button></div>
      </div>
    </div>
  );
}

export function HandControl() {
  return (
    <>
      <div id="handBox" hidden><video id="handCam" playsInline muted></video></div>
    </>
  );
}
