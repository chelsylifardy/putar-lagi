// Putar Lagi — Three.js scene, tape simulation, audio and interaction state.
// Imperative engine mounted once by <App/>; it drives the DOM rendered in App.jsx by id.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let started = false;

export async function startEngine() {
  if (started) return;
  started = true;

  const $ = s => document.querySelector(s);
  const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
  const UP = V(0,1,0);
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const easeIO = t => t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  const easeOut = t => 1 - Math.pow(1-t,3);
  const easeIn = t => t*t*t;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowPower = coarse || Math.min(innerWidth, innerHeight) < 600;
  const M = reduceMotion ? 0.45 : 1;   // object animation time scale

  await Promise.race([
    Promise.all(['700 40px Caveat','800 40px Inter','600 40px Inter','italic 600 40px Fraunces','500 20px "IBM Plex Mono"'].map(f=>document.fonts.load(f))),
    new Promise(r=>setTimeout(r,3500))
  ]);

  /* ───────────────────────── renderer / scene ───────────────────────── */
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
  let pixelRatio = Math.min(devicePixelRatio, lowPower ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b1f16');
  scene.fog = new THREE.Fog('#2b1f16', 90, 190);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(34, innerWidth/innerHeight, 0.5, 400);

  const hemi = new THREE.HemisphereLight('#ffe6c2', '#3a2515', 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc98c', 3.1);
  const SUN_TARGET = V(0,0,2);
  sun.position.set(-52, 40, -24).add(SUN_TARGET);
  sun.target.position.copy(SUN_TARGET);
  sun.castShadow = true;
  const shadowSize = lowPower ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left:-36, right:36, top:32, bottom:-32, near:20, far:150 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#aebfdc', 0.4);
  fill.position.set(30, 25, 40);
  scene.add(fill);

  /* ───────────────────────── canvas texture helpers ───────────────────────── */
  function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return [c, c.getContext('2d')]; }
  function toTex(c, repeat){ const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=maxAniso; if(repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; } return t; }
  function rng(seed){ return () => (seed = (seed*16807) % 2147483647, (seed-1)/2147483646); }
  function rrect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
  function speckle(g,w,h,n,rgb,a,seed=3){ const r=rng(seed); for(let i=0;i<n;i++){ g.fillStyle=`rgba(${rgb},${a*r()})`; g.fillRect(r()*w, r()*h, 1+r()*2, 1+r()*2); } }
  function hand(g, text, x, y, size, color, rot=0, weight=700){
    g.save(); g.translate(x,y); g.rotate(rot); g.fillStyle=color; g.font=`${weight} ${size}px Caveat, cursive`; g.fillText(text,0,0); g.restore();
  }

  /* desk */
  function woodCanvas(){
    const [c,g] = makeCanvas(2048,1024); const r = rng(11);
    const planks = 5, ph = 1024/planks;
    const bases = ['124,80,47','114,72,41','131,86,52','119,76,44','126,82,49'];
    for(let p=0;p<planks;p++){
      g.fillStyle=`rgb(${bases[p]})`; g.fillRect(0,p*ph,2048,ph);
      for(let i=0;i<170;i++){
        const y0=p*ph+r()*ph, amp=1.5+r()*5, fr=0.0015+r()*0.004, ph0=r()*6;
        g.strokeStyle = r()<.55 ? `rgba(62,34,17,${0.05+r()*0.13})` : `rgba(170,118,74,${0.04+r()*0.1})`;
        g.lineWidth = 0.6+r()*2.4; g.beginPath();
        for(let x=0;x<=2048;x+=16){ const y=y0+Math.sin(x*fr+ph0)*amp+Math.sin(x*fr*3.3+ph0)*amp*.35; x?g.lineTo(x,y):g.moveTo(x,y); }
        g.stroke();
      }
      for(let k=0;k<2;k++){ const kx=r()*2048, ky=p*ph+ph*(.25+r()*.5); const kg=g.createRadialGradient(kx,ky,1,kx,ky,22+r()*16);
        kg.addColorStop(0,'rgba(55,28,12,.55)'); kg.addColorStop(1,'rgba(55,28,12,0)'); g.fillStyle=kg; g.beginPath(); g.ellipse(kx,ky,50,14,0,0,7); g.fill(); }
      g.fillStyle='rgba(28,14,6,.6)'; g.fillRect(0,p*ph,2048,2.5);
      const sx=r()*2048; g.fillRect(sx,p*ph,2,ph);
    }
    for(let i=0;i<340;i++){ const x=r()*2048,y=r()*1024,a=(r()-.5)*.6,l=6+r()*60;
      g.strokeStyle=`rgba(236,204,160,${0.04+r()*0.13})`; g.lineWidth=.5+r()*.9; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); g.stroke(); }
    for(let i=0;i<6;i++){ const x=r()*2048,y=r()*1024; g.strokeStyle='rgba(40,20,10,.12)'; g.lineWidth=2; g.beginPath(); g.arc(x,y,28+r()*10,0,7); g.stroke(); }
    const rad=g.createRadialGradient(1024,560,60,1024,560,900); rad.addColorStop(0,'rgba(255,225,180,.07)'); rad.addColorStop(1,'rgba(0,0,0,.14)');
    g.fillStyle=rad; g.fillRect(0,0,2048,1024);
    return c;
  }
  const woodTex = toTex(woodCanvas());
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(260,200),
    new THREE.MeshStandardMaterial({ map:woodTex, roughness:.62, metalness:0, bumpMap:woodTex, bumpScale:.4 }));
  desk.rotation.x = -Math.PI/2; desk.receiveShadow = true; scene.add(desk);

  function blobTexture(){ const [c,g]=makeCanvas(128,128); const gr=g.createRadialGradient(64,64,4,64,64,64);
    gr.addColorStop(0,'rgba(0,0,0,.55)'); gr.addColorStop(.55,'rgba(0,0,0,.25)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c); return t; }
  const blobTex = blobTexture();
  function blob(w,d,op=.5){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshBasicMaterial({map:blobTex,transparent:true,opacity:op,depthWrite:false}));
    m.rotation.x=-Math.PI/2; m.position.y=.012; m.renderOrder=1; return m; }

  /* window mullion shadows — invisible caster between the sun and the desk */
  {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ colorWrite:false, depthWrite:false });
    const bar = (w,h,x,y)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat); m.position.set(x,y,0); m.castShadow=true; grp.add(m); };
    bar(1.3,70,-4,0); bar(90,1.1,0,-2); bar(3,70,-30,0); bar(90,3,0,-26);
    for(let i=0;i<5;i++) bar(90,.35,0,10+i*3.2); // hint of a half-drawn blind
    const dir = sun.position.clone().sub(SUN_TARGET).normalize();
    grp.position.copy(SUN_TARGET).addScaledVector(dir, 26).add(V(-6,0,-4));
    grp.lookAt(sun.position.clone().add(V(-6,0,-4)));
    scene.add(grp);
  }

  /* ───────────────────────── cassette ───────────────────────── */
  const HUB_A = V(2.1,.6,-.35), HUB_B = V(-2.1,.6,-.35);
  const A_L = V(.8,.6,2.98), B_L = V(-.8,.6,2.98);
  const HUB_R = 1.1, R_PACK0 = 2.0, R_B = 1.55;
  const TS = .4, TN0 = 5, TMAX = lowPower ? 120 : 150;
  const MAXOUT = (TMAX-TN0)*TS + .6*TS;
  const PACK_K = (R_PACK0*R_PACK0 - 1.3*1.3) / MAXOUT, PACK_L0 = (R_PACK0*R_PACK0 - HUB_R*HUB_R)/PACK_K;

  const labelCanvas = makeCanvas(1024,610);
  const labelTex = toTex(labelCanvas[0]);
  const S = { state:'boot', busy:false, inRecorder:false, rec:null, title:'', hasPlayed:false, sfx:true, fx:true, tangled:false, paused:false };

  function drawLabel(){
    const [c,g] = labelCanvas, W=c.width, H=c.height;
    g.clearRect(0,0,W,H);
    g.fillStyle='#eee1c1'; rrect(g,0,0,W,H,16); g.fill();
    const age=g.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.62); age.addColorStop(0,'rgba(255,250,235,0)'); age.addColorStop(1,'rgba(170,125,60,.2)');
    g.fillStyle=age; g.fillRect(0,0,W,H);
    speckle(g,W,H,2400,'110,80,40',.09,5);
    // header
    g.fillStyle='#34466b'; rrect(g,34,24,150,56,8); g.fill();
    g.fillStyle='#efe3c4'; g.font='800 34px Inter, sans-serif'; g.fillText('SIDE A',47,64);
    g.fillStyle='#a8483e'; g.font='italic 600 44px Fraunces, serif'; g.textAlign='right'; g.fillText('C-60',W-38,66); g.textAlign='left';
    g.fillStyle='rgba(52,70,107,.75)'; g.font='600 15px Inter, sans-serif'; g.fillText('NORMAL POSITION  ·  TYPE I', 210, 60);
    g.strokeStyle='rgba(52,70,107,.45)'; g.lineWidth=2; g.beginPath(); g.moveTo(40,150); g.lineTo(W-40,150); g.stroke();
    if(S.title) hand(g, S.title, 58, 140, 62, '#22336e', -0.012);
    // window
    const wx0=(-3.35+4.2)/8.4*W, wx1=(3.35+4.2)/8.4*W, wy0=(-1.6+3)/5*H, wy1=(.9+3)/5*H;
    g.strokeStyle='rgba(43,35,32,.55)'; g.lineWidth=5; rrect(g,wx0-3,wy0-3,wx1-wx0+6,wy1-wy0+6,70); g.stroke();
    g.save(); g.globalCompositeOperation='destination-out'; g.fillStyle='#000'; rrect(g,wx0,wy0,wx1-wx0,wy1-wy0,66); g.fill(); g.restore();
    g.fillStyle='rgba(52,70,107,.8)'; g.font='800 38px Inter'; g.fillText('A',30,(wy0+wy1)/2+14);
    g.fillStyle='#a8483e'; g.beginPath(); g.moveTo(W-58,(wy0+wy1)/2-14); g.lineTo(W-32,(wy0+wy1)/2); g.lineTo(W-58,(wy0+wy1)/2+14); g.fill();
    // stripes + print
    g.fillStyle='#34466b'; g.fillRect(0,wy1+18,W,26);
    g.fillStyle='#a8483e'; g.fillRect(0,wy1+52,W,11);
    g.fillStyle='#34466b'; g.font='800 30px Inter'; g.letterSpacing='6px'; g.fillText('SUARA YANG DISIMPAN',40,H-24); g.letterSpacing='0px';
    g.fillStyle='rgba(52,70,107,.7)'; g.font='600 15px Inter'; g.textAlign='right'; g.fillText('60 MIN  ·  30 / SIDE',W-40,H-28); g.textAlign='left';
    if(S.rec && S.rec.demo){
      g.save(); g.translate(W-300,122); g.rotate(-.09); g.strokeStyle='rgba(168,72,62,.85)'; g.lineWidth=4; g.strokeRect(0,-38,250,50);
      g.fillStyle='rgba(168,72,62,.9)'; g.font='800 24px Inter'; g.fillText('CONTOH · DEMO',16,-4); g.restore();
    }
    labelTex.needsUpdate = true;
  }

  function ringTexture(){
    const [c,g]=makeCanvas(512,512); g.fillStyle='#3b2618'; g.fillRect(0,0,512,512); const r=rng(9);
    for(let rr=40; rr<256; rr+=1.2){ g.strokeStyle=`rgba(${r()<.5?'95,62,38':'28,17,10'},${.25+r()*.35})`; g.lineWidth=1; g.beginPath(); g.arc(256,256,rr,0,7); g.stroke(); }
    g.strokeStyle='rgba(150,110,70,.35)'; g.lineWidth=3; g.beginPath(); g.arc(256,256,238,0,7); g.stroke();
    const sh=g.createLinearGradient(0,0,512,512); sh.addColorStop(.35,'rgba(255,220,180,0)'); sh.addColorStop(.5,'rgba(255,220,180,.12)'); sh.addColorStop(.65,'rgba(255,220,180,0)');
    g.fillStyle=sh; g.fillRect(0,0,512,512);
    g.strokeStyle='rgba(20,12,6,.55)'; g.lineWidth=2; g.beginPath(); g.moveTo(256,256); g.lineTo(256,20); g.stroke();
    return toTex(c);
  }

  function hubGeometry(){
    const s=new THREE.Shape(); s.absarc(0,0,HUB_R-.02,0,Math.PI*2,false);
    const h=new THREE.Path(); const N=120;
    for(let i=0;i<=N;i++){ const a=i/N*Math.PI*2; const k=(a/(Math.PI*2)*6)%1; const r=(k>.43&&k<.57)?.31:.44;
      const x=Math.cos(a)*r, y=Math.sin(a)*r; i?h.lineTo(x,y):h.moveTo(x,y); }
    s.holes.push(h);
    const geo=new THREE.ExtrudeGeometry(s,{depth:.88,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:2,curveSegments:56});
    geo.rotateX(-Math.PI/2); geo.translate(0,-.44,0); geo.computeVertexNormals(); return geo;
  }

  const tapeMat = new THREE.MeshPhysicalMaterial({ color:'#3d2618', roughness:.3, metalness:.35, sheen:.6, sheenColor:new THREE.Color('#8a5a36'), sheenRoughness:.4, side:THREE.DoubleSide });
  const ribbonMat = tapeMat.clone(); ribbonMat.emissive = new THREE.Color('#d58a3a'); ribbonMat.emissiveIntensity = 0;

  function buildCassette(){
    const g=new THREE.Group();
    const shellMat=new THREE.MeshPhysicalMaterial({ color:'#e6b770', transparent:true, opacity:.3, roughness:.24, metalness:0, clearcoat:.5, clearcoatRoughness:.35, depthWrite:false });
    const shell=new THREE.Mesh(new RoundedBoxGeometry(10.04,1.2,6.38,4,.16), shellMat);
    shell.position.y=.6; shell.renderOrder=3; shell.castShadow=true; g.add(shell);
    // inner edge wall (slightly denser plastic rim)
    const rimMat=new THREE.MeshStandardMaterial({ color:'#b8894a', transparent:true, opacity:.35, roughness:.4, depthWrite:false });
    const tr=new THREE.Shape(); tr.moveTo(-3.55,2.15); tr.lineTo(3.55,2.15); tr.lineTo(4.1,3.19); tr.lineTo(-4.1,3.19); tr.closePath();
    const trGeo=new THREE.ExtrudeGeometry(tr,{depth:.07,bevelEnabled:false}); trGeo.rotateX(Math.PI/2);
    const bump=new THREE.Mesh(trGeo, shellMat); bump.position.y=1.27; bump.renderOrder=3; g.add(bump);
    const darkMat=new THREE.MeshStandardMaterial({ color:'#1d140d', roughness:.8 });
    for(const x of [-1.75,1.75]){ const d=new THREE.Mesh(new THREE.CircleGeometry(.24,24),darkMat); d.rotation.x=-Math.PI/2; d.position.set(x,1.275,2.72); g.add(d); }
    const hw=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.42),darkMat); hw.rotation.x=-Math.PI/2; hw.position.set(0,1.275,2.86); g.add(hw);
    for(const x of [-3.9,3.9]){ const w=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.05),rimMat); w.position.set(x,.6,3.15); g.add(w); }
    // label
    const label=new THREE.Mesh(new THREE.PlaneGeometry(8.4,5.0), new THREE.MeshStandardMaterial({ map:labelTex, roughness:.85, alphaTest:.5 }));
    label.rotation.x=-Math.PI/2; label.position.set(0,1.207,-.5); label.receiveShadow=true; label.castShadow=true; g.add(label);
    // screws
    const screwMat=new THREE.MeshStandardMaterial({ color:'#b9b3a6', metalness:.9, roughness:.35 });
    const slotMat=new THREE.MeshStandardMaterial({ color:'#3b3630', metalness:.6, roughness:.5 });
    for(const [x,z] of [[-4.6,-2.82],[4.6,-2.82],[-4.6,2.82],[4.6,2.82],[0,2.3]]){
      const s=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.05,20),screwMat); s.position.set(x,1.225,z); g.add(s);
      const s1=new THREE.Mesh(new THREE.BoxGeometry(.26,.02,.04),slotMat); s1.position.set(x,1.25,z); s1.rotation.y=.4; g.add(s1);
      const s2=s1.clone(); s2.rotation.y=.4+Math.PI/2; g.add(s2);
      const post=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,1.1,16), rimMat); post.position.set(x,.6,z); g.add(post);
    }
    // reels
    const hubGeo=hubGeometry(), hubMat=new THREE.MeshStandardMaterial({ color:'#ede6d5', roughness:.5 });
    const packMats=[ new THREE.MeshPhysicalMaterial({ color:'#3a2517', roughness:.38, metalness:.3, sheen:.5, sheenColor:new THREE.Color('#7a5030') }),
                     new THREE.MeshStandardMaterial({ map:ringTexture(), roughness:.32, metalness:.3 }), null ];
    packMats[2]=packMats[1];
    const mkReel=(pos,r)=>{
      const reel=new THREE.Group(); reel.position.copy(pos);
      const hub=new THREE.Mesh(hubGeo,hubMat); hub.castShadow=true; reel.add(hub);
      const clampPiece=new THREE.Mesh(new THREE.BoxGeometry(.16,.86,.42), new THREE.MeshStandardMaterial({ color:'#c9bfa9', roughness:.6 }));
      clampPiece.position.set(.96,0,0); reel.add(clampPiece);
      const pack=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.381,80,1,false), packMats);
      pack.scale.set(r,1,r); pack.castShadow=true; reel.add(pack);
      g.add(reel); return { reel, pack };
    };
    const A=mkReel(HUB_A,R_PACK0), B=mkReel(HUB_B,R_B);
    // rollers, pins, pressure pad
    const white=new THREE.MeshStandardMaterial({ color:'#f1ece0', roughness:.4 });
    const metal=new THREE.MeshStandardMaterial({ color:'#c8c2b6', metalness:.95, roughness:.25 });
    for(const x of [-3.35,3.35]){ const r=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.62,20),white); r.position.set(x,.6,2.72); g.add(r);
      const pin=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.15,8),metal); pin.position.set(x,.6,2.72); g.add(pin);
      const gp=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,1.1,12),metal); gp.position.set(x*.62,.6,2.98); g.add(gp); }
    const spring=new THREE.Mesh(new THREE.BoxGeometry(2.1,.36,.03),metal); spring.position.set(0,.6,2.7); g.add(spring);
    const felt=new THREE.Mesh(new THREE.BoxGeometry(.7,.36,.2), new THREE.MeshStandardMaterial({ color:'#d9c9a3', roughness:1 })); felt.position.set(0,.6,2.83); g.add(felt);
    const shield=new THREE.Mesh(new THREE.BoxGeometry(1.1,.9,.04),metal); shield.position.set(0,.6,2.6); g.add(shield);
    // internal tape runs
    const segGeo=new THREE.BoxGeometry(1,.381,.014);
    const segs=[0,1,2,3].map(()=>{ const m=new THREE.Mesh(segGeo,tapeMat); g.add(m); return m; });
    const bl=blob(13,9.5,.55); g.add(bl);
    g.traverse(o=>{ if(o.isMesh && o!==bl && o.castShadow===false && o.material!==shellMat) o.castShadow=false; });
    return { group:g, reelA:A.reel, packA:A.pack, reelB:B.reel, packB:B.pack, segs, label, shell };
  }
  const cas = buildCassette();
  const cassette = cas.group; scene.add(cassette);

  function setSeg(m, x1,z1, x2,z2){ const dx=x2-x1, dz=z2-z1; const L=Math.hypot(dx,dz); m.position.set((x1+x2)/2,.6,(z1+z2)/2); m.rotation.set(0,-Math.atan2(dz,dx),0); m.scale.x=Math.max(L,.001); }
  function tangentPt(cx,cz,r,px,pz,pickSide){ const dx=px-cx, dz=pz-cz, d=Math.hypot(dx,dz); const a=Math.atan2(dz,dx), b=Math.acos(clamp(r/d,-1,1));
    const t1=[cx+Math.cos(a+b)*r, cz+Math.sin(a+b)*r], t2=[cx+Math.cos(a-b)*r, cz+Math.sin(a-b)*r]; return pickSide(t1,t2); }
  function updateInternalTape(rA){
    const tA=tangentPt(HUB_A.x,HUB_A.z,rA,3.55,2.72,(a,b)=>a[0]>b[0]?a:b);
    setSeg(cas.segs[0], tA[0],tA[1], 3.55,2.72);
    setSeg(cas.segs[1], 3.35,2.93, A_L.x,A_L.z);
    const tB=tangentPt(HUB_B.x,HUB_B.z,R_B,-3.55,2.72,(a,b)=>a[0]<b[0]?a:b);
    setSeg(cas.segs[2], tB[0],tB[1], -3.55,2.72);
    setSeg(cas.segs[3], -3.35,2.93, B_L.x,B_L.z);
  }

  /* ───────────────────────── recorder ───────────────────────── */
  function speakerCanvas(){
    const [c,g]=makeCanvas(1024,954); g.fillStyle='#34312d'; g.fillRect(0,0,1024,954); speckle(g,1024,954,3000,'255,255,255',.05,4);
    const cx=520, cy=430, R=330; g.fillStyle='#1c1a18';
    for(let y=-R;y<=R;y+=22) for(let x=-R;x<=R;x+=22){ const ox=((y/22)&1)?11:0; if(Math.hypot(x+ox,y)<R){ g.beginPath(); g.arc(cx+x+ox,cy+y,6.5,0,7); g.fill(); } }
    g.strokeStyle='rgba(200,195,185,.4)'; g.lineWidth=4; g.beginPath(); g.arc(cx,cy,R+18,0,7); g.stroke();
    g.fillStyle='#d9d3c7'; g.font='italic 600 64px Fraunces, serif'; g.fillText('Sandiwara',60,880);
    g.font='600 22px Inter'; g.fillStyle='rgba(217,211,199,.8)'; g.fillText('RC-603  STEREO CASSETTE-CORDER',62,920);
    g.textAlign='right'; g.fillText('AUTO STOP · CONDENSER MIC',990,64); g.textAlign='left';
    return toTex(c);
  }
  function keyCanvas(action){
    const [c,g]=makeCanvas(128,160); const rec=action==='rec';
    g.fillStyle=rec?'#a73b31':'#d2cdc3'; g.fillRect(0,0,128,160);
    for(let y=8;y<156;y+=7){ g.fillStyle='rgba(0,0,0,.05)'; g.fillRect(6,y,116,2); }
    const ink=rec?'#f6ead3':'#2d2b28'; g.fillStyle=ink; const cx=64, cy=70;
    const tri=(x,y,s,dir)=>{ g.beginPath(); g.moveTo(x-s*dir,y-s); g.lineTo(x+s*dir,y); g.lineTo(x-s*dir,y+s); g.closePath(); g.fill(); };
    if(action==='rec'){ g.beginPath(); g.arc(cx,cy,18,0,7); g.fill(); }
    if(action==='play') tri(cx,cy,18,1);
    if(action==='rew'){ tri(cx-9,cy,14,-1); tri(cx+11,cy,14,-1); }
    if(action==='ff'){ tri(cx-11,cy,14,1); tri(cx+9,cy,14,1); }
    if(action==='stop'){ g.fillRect(cx-14,cy-20,28,22); g.beginPath(); g.moveTo(cx-14,cy+16); g.lineTo(cx,cy+6); g.lineTo(cx+14,cy+16); g.fill(); g.fillRect(cx-14,cy+19,28,5); }
    if(action==='pause'){ g.fillRect(cx-14,cy-18,10,36); g.fillRect(cx+4,cy-18,10,36); }
    g.font='700 17px Inter'; g.textAlign='center'; g.fillText({rec:'REC',play:'PLAY',rew:'REW',ff:'F.FWD',stop:'STOP/EJ',pause:'PAUSE'}[action],cx,140);
    return toTex(c);
  }
  const counterCanvas = makeCanvas(256,96); const counterTex = toTex(counterCanvas[0]);
  let counterVal=-1;
  function drawCounter(n){
    n=Math.max(0,Math.min(999,Math.floor(n))); if(n===counterVal) return; counterVal=n;
    const [c,g]=counterCanvas; g.fillStyle='#161411'; g.fillRect(0,0,256,96);
    const s=String(n).padStart(3,'0');
    for(let i=0;i<3;i++){ const x=40+i*62; const gr=g.createLinearGradient(0,14,0,82); gr.addColorStop(0,'#8d877c'); gr.addColorStop(.5,'#f2ede2'); gr.addColorStop(1,'#8d877c');
      g.fillStyle=gr; g.fillRect(x,14,52,68); g.fillStyle='#1d1a16'; g.font='600 50px "IBM Plex Mono", monospace'; g.textAlign='center'; g.fillText(s[i],x+26,66); }
    counterTex.needsUpdate=true;
  }
  drawCounter(0);

  const KEY_ACTIONS=['rec','play','rew','ff','stop','pause'];
  const KEY_NAMES={rec:'Rekam',play:'Putar',rew:'Mundur 5 detik',ff:'Maju 5 detik',stop:'Stop / keluarkan kaset',pause:'Jeda'};
  function buildRecorder(){
    const g=new THREE.Group();
    const body=new THREE.MeshStandardMaterial({ color:'#8e897f', roughness:.48, metalness:.3 });
    const dark=new THREE.MeshStandardMaterial({ color:'#2c2a27', roughness:.75, metalness:.1 });
    const base=new THREE.Mesh(new RoundedBoxGeometry(20,2.8,12,4,.45), body); base.position.y=1.4; base.castShadow=base.receiveShadow=true; g.add(base);
    const rimH=1.3, rimY=2.8+rimH/2-.05;
    const rb=(w,d,x,z,mat=body)=>{ const m=new THREE.Mesh(new RoundedBoxGeometry(w,rimH,d,3,.25),mat); m.position.set(x,rimY,z); m.castShadow=m.receiveShadow=true; g.add(m); return m; };
    rb(8.8,8.2,-5.6,-1.9); rb(11.2,.7,4.4,-5.65); rb(.8,7.5,9.6,-1.55); rb(10.4,.6,4,1.9);
    const spk=new THREE.Mesh(new THREE.PlaneGeometry(8.3,7.7), new THREE.MeshStandardMaterial({ map:speakerCanvas(), roughness:.7 }));
    spk.rotation.x=-Math.PI/2; spk.position.set(-5.6,4.052,-1.9); spk.receiveShadow=true; g.add(spk);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(10.4,6.9), dark); floor.rotation.x=-Math.PI/2; floor.position.set(4,2.805,-1.85); floor.receiveShadow=true; g.add(floor);
    const white=new THREE.MeshStandardMaterial({ color:'#e9e3d4', roughness:.5 });
    const metal=new THREE.MeshStandardMaterial({ color:'#cfc9bd', metalness:.95, roughness:.22 });
    for(const x of [1.9,6.1]){ const sp=new THREE.Mesh(new THREE.CylinderGeometry(.36,.4,1,6),white); sp.position.set(x,3.3,-2.3); g.add(sp); }
    const head=new THREE.Mesh(new RoundedBoxGeometry(1,.8,.3,2,.08),metal); head.position.set(4,3.25,1.43); g.add(head);
    const pinch=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.7,16),new THREE.MeshStandardMaterial({ color:'#161412', roughness:.9 })); pinch.position.set(5.75,3.25,1.42); g.add(pinch);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.9,8),metal); cap.position.set(2.25,3.25,1.42); g.add(cap);
    // key well
    const well=new THREE.Mesh(new THREE.PlaneGeometry(13.2,3.2), dark); well.rotation.x=-Math.PI/2; well.position.set(3.25,2.806,4); g.add(well);
    const keys={};
    KEY_ACTIONS.forEach((a,i)=>{
      const k=new THREE.Group(); const x=-2.85+.95+i*2.12;
      const keyMat=a==='rec'?new THREE.MeshStandardMaterial({ color:'#a33a30', roughness:.4 }):new THREE.MeshStandardMaterial({ color:'#cdc8be', roughness:.35, metalness:.2 });
      const kb=new THREE.Mesh(new RoundedBoxGeometry(1.9,1.2,2.4,2,.16),keyMat); kb.castShadow=true; k.add(kb);
      const top=new THREE.Mesh(new THREE.PlaneGeometry(1.6,2.0), new THREE.MeshStandardMaterial({ map:keyCanvas(a), roughness:.45 }));
      top.rotation.x=-Math.PI/2; top.position.y=.602; k.add(top);
      k.position.set(x,2.95,4); k.userData={ action:a, baseY:2.95, pressed:false, tap:0 };
      kb.userData.key=k; top.userData.key=k;
      g.add(k); keys[a]=k;
    });
    // counter, LED, mic
    const cnt=new THREE.Mesh(new RoundedBoxGeometry(3.4,.5,1.5,2,.1),dark); cnt.position.set(-6.4,2.95,3.9); g.add(cnt);
    const disp=new THREE.Mesh(new THREE.PlaneGeometry(3,1.12),new THREE.MeshBasicMaterial({ map:counterTex, toneMapped:false })); disp.rotation.x=-Math.PI/2; disp.position.set(-6.4,3.205,3.9); g.add(disp);
    const ledMat=new THREE.MeshStandardMaterial({ color:'#5a1a14', emissive:'#ff3a22', emissiveIntensity:0, roughness:.3 });
    const led=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),ledMat); led.position.set(-8.9,2.85,3.2); g.add(led);
    const mic=new THREE.Mesh(new THREE.CircleGeometry(.55,24),dark); mic.rotation.x=-Math.PI/2; mic.position.set(-8.9,2.81,4.8); g.add(mic);
    // lid
    const lid=new THREE.Group(); lid.position.set(4,4.1,-5.3);
    const lidMat=new THREE.MeshPhysicalMaterial({ color:'#6b5a48', transparent:true, opacity:.34, roughness:.12, clearcoat:1, depthWrite:false });
    const plate=new THREE.Mesh(new RoundedBoxGeometry(10.9,.2,7.3,2,.08),lidMat); plate.position.set(0,.1,3.65); plate.renderOrder=4; lid.add(plate);
    const tab=new THREE.Mesh(new RoundedBoxGeometry(2.4,.28,.5,2,.1),body); tab.position.set(0,.12,7.25); lid.add(tab);
    const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,10.6,12),body); hinge.rotation.z=Math.PI/2; lid.add(hinge);
    g.add(lid);
    // handle folded behind
    const handle=new THREE.Mesh(new THREE.TorusGeometry(7.2,.32,12,48,Math.PI),body); handle.rotation.x=-Math.PI/2; handle.position.set(0,.32,-6.1); handle.castShadow=true; g.add(handle);
    const bl=blob(26,17,.55); g.add(bl);
    return { group:g, keys, lid, ledMat };
  }
  const rec3d = buildRecorder();
  const recorder = rec3d.group; recorder.position.set(-9,0,-2); scene.add(recorder);
  const LID_OPEN = -1.12;
  rec3d.lid.rotation.x = LID_OPEN;
  const SLOT = V(-9+4, 2.82, -2-1.95);
  const CAS_REST = { pos:V(7.8,0,.8), rot:-.2 };
  const DESK_POS = V(6,0,2.2);

  /* ───────────────────────── pencil ───────────────────────── */
  function pencilCanvas(){
    const [c,g]=makeCanvas(384,2048); g.fillStyle='#2f5b45'; g.fillRect(0,0,384,2048);
    for(let i=0;i<6;i++){ g.fillStyle=i%2?'rgba(255,255,255,.035)':'rgba(0,0,0,.05)'; g.fillRect(i*64,0,64,2048); }
    g.save(); g.translate(40,1760); g.rotate(-Math.PI/2); g.fillStyle='#d8b560'; g.font='700 30px Inter';
    g.fillText('2B   PENSIL SEKOLAH   ·   KAYU PINUS   ·   INDONESIA',0,0); g.restore();
    g.fillStyle='#d8b560'; g.fillRect(0,1880,384,6);
    const r=rng(21); for(let i=0;i<40;i++){ g.fillStyle=`rgba(${r()<.5?'225,190,140':'20,40,30'},${.25+r()*.4})`; const y=r()<.6?r()*140:1900+r()*140; g.fillRect(r()*384,y,2+r()*9,2+r()*6); }
    for(let i=0;i<5;i++){ g.fillStyle='rgba(20,36,28,.5)'; g.fillRect(r()*384, 40+r()*80, 12+r()*14, 3); }
    return toTex(c);
  }
  function buildPencil(){
    const g=new THREE.Group();
    const lead=new THREE.Mesh(new THREE.ConeGeometry(.085,.4,18), new THREE.MeshStandardMaterial({ color:'#3a3a3c', metalness:.55, roughness:.35 }));
    lead.rotation.x=Math.PI; lead.position.y=.2; g.add(lead);
    const wood=new THREE.Mesh(new THREE.CylinderGeometry(.33,.085,1.9,24,1,true), new THREE.MeshStandardMaterial({ color:'#d8b48a', roughness:.8 }));
    wood.position.y=.4+.95; g.add(wood);
    const bodyGeo=new THREE.CylinderGeometry(.36,.36,14.5,6,1); const body=new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ map:pencilCanvas(), roughness:.42, flatShading:true }));
    body.position.y=2.3+7.25; g.add(body);
    const endMat=new THREE.MeshStandardMaterial({ color:'#d8b48a', roughness:.8 });
    const ring=new THREE.Mesh(new THREE.CircleGeometry(.36,6),endMat); ring.rotation.x=Math.PI/2; ring.position.y=2.3; g.add(ring);
    const fer=new THREE.Mesh(new THREE.CylinderGeometry(.385,.385,.95,28), new THREE.MeshStandardMaterial({ color:'#c9b27a', metalness:.9, roughness:.3 }));
    fer.position.y=16.8+.475; g.add(fer);
    for(const y of [16.98,17.55]){ const t=new THREE.Mesh(new THREE.TorusGeometry(.39,.035,8,28), fer.material); t.rotation.x=Math.PI/2; t.position.y=y; g.add(t); }
    const er=new THREE.Mesh(new THREE.CylinderGeometry(.33,.35,.62,28), new THREE.MeshStandardMaterial({ color:'#d6948a', roughness:.95 }));
    er.position.y=17.75+.31; er.rotation.z=.04; g.add(er);
    const hit=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,18.4,8), new THREE.MeshBasicMaterial({ visible:false })); hit.position.y=9.2; hit.userData.pencilHit=true; g.add(hit);
    g.traverse(o=>{ if(o.isMesh && o!==hit){ o.castShadow=true; } });
    return { group:g, hit };
  }
  const pen = buildPencil(); const pencil = pen.group; scene.add(pencil);
  const PENCIL_REST = { tip:V(13.6,.32,8.2), axis:V(.36,0,-.93).normalize(), spin:Math.PI/6 };
  const pencilPose = { tip:PENCIL_REST.tip.clone(), axis:PENCIL_REST.axis.clone(), spin:PENCIL_REST.spin };
  const _q1=new THREE.Quaternion(), _q2=new THREE.Quaternion();
  function applyPencil(){ _q1.setFromUnitVectors(UP,pencilPose.axis); _q2.setFromAxisAngle(UP,pencilPose.spin); pencil.quaternion.copy(_q1).multiply(_q2); pencil.position.copy(pencilPose.tip); }
  applyPencil();

  /* ───────────────────────── case, notebook, tracklist ───────────────────────── */
  function buildCase(){
    const g=new THREE.Group(); const m=new THREE.MeshPhysicalMaterial({ color:'#f7f3ea', transparent:true, opacity:.2, roughness:.06, clearcoat:1, depthWrite:false });
    const W=11,D=7,H=1.5,t=.1; const box=(w,h,d,x,y,z,p=g)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); b.position.set(x,y,z); b.renderOrder=2; p.add(b); return b; };
    box(W,t,D,0,t/2,0); box(W,H*.55,t,0,H*.27,D/2); box(W,H,t,0,H/2,-D/2); box(t,H,D,-W/2,H/2,0); box(t,H,D,W/2,H/2,0);
    for(const x of [-2.1,2.1]){ const p=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.9,16),m); p.position.set(x,.45,-.4); g.add(p); }
    const lid=new THREE.Group(); lid.position.set(0,H,-D/2); lid.rotation.x=2.93; g.add(lid);
    box(W,t,D,0,0,D/2,lid); box(t,.6,D,-W/2,-.3,D/2,lid); box(t,.6,D,W/2,-.3,D/2,lid);
    const [c,gg]=makeCanvas(640,420); gg.fillStyle='#ece0c2'; gg.fillRect(0,0,640,420); speckle(gg,640,420,1500,'100,70,40',.08,8);
    gg.fillStyle='#34466b'; gg.fillRect(0,40,640,30); gg.fillStyle='#a8483e'; gg.fillRect(0,78,640,12);
    gg.fillStyle='#34466b'; gg.font='800 30px Inter'; gg.fillText('C-60',30,150);
    hand(gg,'Side A — suara yang disimpan',40,230,48,'#22336e',-.02); hand(gg,'Side B — (kosong)',40,300,44,'#22336e',-.01);
    hand(gg,'jangan ditimpa ya!',300,380,40,'#a8483e',-.05);
    const card=new THREE.Mesh(new THREE.PlaneGeometry(W-.4,D-.4), new THREE.MeshStandardMaterial({ map:toTex(c), roughness:.9 }));
    card.rotation.x=Math.PI/2; card.position.set(0,-t/2-.02,D/2); lid.add(card);
    g.add(blob(16,15,.35));
    return g;
  }
  const casebox = buildCase(); casebox.position.set(22,0,-9); casebox.rotation.y=-.42; scene.add(casebox);

  function notebookCanvas(){
    const [c,g]=makeCanvas(1024,1448); g.fillStyle='#f1eadb'; g.fillRect(0,0,1024,1448); speckle(g,1024,1448,4000,'120,100,70',.06,2);
    g.strokeStyle='rgba(80,110,170,.45)'; g.lineWidth=2; for(let y=150;y<1448;y+=46){ g.beginPath(); g.moveTo(0,y); g.lineTo(1024,y); g.stroke(); }
    g.strokeStyle='rgba(190,70,70,.55)'; g.beginPath(); g.moveTo(118,0); g.lineTo(118,1448); g.moveTo(124,0); g.lineTo(124,1448); g.stroke();
    const ink='#2c3f7a'; const L=[['Kamis, 17 Juli 1997',60,-.01],['PR Bhs. Indonesia — karangan',0,0],['   "Liburan di Rumah Nenek" (2 hal.)',0,0],['',0,0],
      ['- beli kaset kosong C-60 (2 biji)',0,-.01],['- balikin kaset punya Dewi!!',0,.01],['- rekam acara radio Minggu malam',0,0],['',0,0],
      ['kalau pitanya kusut → pakai pensil',0,-.015],['   pelan-pelan, jangan sampai putus',0,0]];
    L.forEach(([t,dx,r],i)=>{ if(t) hand(g,t,150+dx,140+46*i-8,44,ink,r); });
    g.strokeStyle=ink; g.lineWidth=3; g.beginPath(); for(let a=0;a<18;a+=.2){ const rr=a*2.2; g.lineTo(850+Math.cos(a)*rr,1080+Math.sin(a)*rr); } g.stroke();
    return toTex(c);
  }
  {
    const nb=new THREE.Group();
    const pages=new THREE.Mesh(new THREE.BoxGeometry(21,.7,29.7), new THREE.MeshStandardMaterial({ color:'#eee6d4', roughness:.9 })); pages.position.y=.4; pages.castShadow=pages.receiveShadow=true; nb.add(pages);
    const cover=new THREE.Mesh(new THREE.BoxGeometry(21.4,.12,30), new THREE.MeshStandardMaterial({ color:'#3b4f78', roughness:.8 })); cover.position.y=.06; nb.add(cover);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(21,29.7), new THREE.MeshStandardMaterial({ map:notebookCanvas(), roughness:.92 })); top.rotation.x=-Math.PI/2; top.position.y=.752; top.receiveShadow=true; nb.add(top);
    nb.position.set(-31,0,-14); nb.rotation.y=.32; scene.add(nb);
  }
  function tracklistCanvas(){
    const [c,g]=makeCanvas(600,860); g.clearRect(0,0,600,860);
    g.fillStyle='#f5edda'; g.beginPath(); g.moveTo(0,20); for(let x=0;x<=600;x+=20) g.lineTo(x,10+Math.sin(x*.7)*6+(x%40?4:0)); g.lineTo(600,860); g.lineTo(0,860); g.closePath(); g.fill();
    speckle(g,600,860,1500,'120,90,50',.07,6);
    g.strokeStyle='rgba(80,110,170,.35)'; g.lineWidth=2; for(let y=150;y<860;y+=58){ g.beginPath(); g.moveTo(0,y); g.lineTo(600,y); g.stroke(); }
    hand(g,'Kaset campur — Side A',34,110,56,'#a8483e',-.02);
    ['1. Pagi yang biru','2. Surat dari jauh','3. Sepeda sore','4. Malam minggu (radio)','5. Pesan buat nanti','','Side B: belum diisi'].forEach((t,i)=>{ if(t) hand(g,t,40,196+58*i,46,'#2c3f7a',(i%2?.01:-.01)); });
    return toTex(c);
  }
  {
    const tl=new THREE.Mesh(new THREE.PlaneGeometry(7.4,10.6), new THREE.MeshStandardMaterial({ map:tracklistCanvas(), roughness:.95, alphaTest:.5 }));
    tl.rotation.set(-Math.PI/2,0,.28); tl.position.set(-19,.03,11.5); tl.receiveShadow=true; scene.add(tl);
  }

  /* dust motes */
  const dust = (()=>{ if(reduceMotion) return null; const N=lowPower?60:140, pos=new Float32Array(N*3), r=rng(4);
    for(let i=0;i<N;i++){ pos[i*3]=-26+r()*40; pos[i*3+1]=2+r()*26; pos[i*3+2]=-20+r()*30; }
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const p=new THREE.Points(geo,new THREE.PointsMaterial({ color:'#ffe2b8', size:.14, transparent:true, opacity:.4, depthWrite:false, blending:THREE.AdditiveBlending }));
    scene.add(p); return p; })();

  /* onboarding arc */
  const arc = new THREE.Group();
  { const m=new THREE.MeshBasicMaterial({ color:'#fff0d6', transparent:true, opacity:.55, depthTest:false });
    const t=new THREE.Mesh(new THREE.TorusGeometry(3.1,.055,8,80,Math.PI*1.45),m); t.rotation.x=-Math.PI/2; t.renderOrder=9; arc.add(t);
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.22,.55,16),m); cone.rotation.x=Math.PI/2; cone.position.set(3.1,0,.2); cone.renderOrder=9; arc.add(cone);
    arc.visible=false; scene.add(arc); }

  /* ───────────────────────── tape simulation ───────────────────────── */
  const tape = { p:[], q:[], tw:[], restA:TS, grab:-1, target:V(), raw:V(), active:false, acc:0, iter:lowPower?10:14, mess:.3, lastOut:0, spin:0, lastFeed:0 };
  function tapeReset(){
    tape.p=[]; tape.q=[]; tape.tw=[];
    for(let i=0;i<TN0;i++){ const v=A_L.clone().lerp(B_L,i/(TN0-1)); tape.p.push(v); tape.q.push(v.clone()); tape.tw.push(0); }
    tape.restA=TS; tape.grab=-1; tape.active=false; tape.acc=0; tape.lastOut=0; tape.spin=0;
  }
  tapeReset();
  const outLen = () => (tape.p.length-TN0)*TS + (tape.restA-TS);
  const packR = () => Math.sqrt(HUB_R*HUB_R + Math.max(0,PACK_L0-outLen())*PACK_K);
  function tapeInsert(){
    const P=tape.p, a=P[0], b=P[1]; const f=clamp((tape.restA-TS)/tape.restA,.05,.95);
    const np=a.clone().lerp(b,f);
    const kick=.03+tape.mess*.07; P.splice(1,0,np); tape.q.splice(1,0,np.clone().add(V((Math.random()-.5)*kick*2,-.01,-kick)));
    const prev=tape.tw[1]||0; tape.tw.splice(1,0,clamp(prev*.86+(Math.random()-.5)*(0.5+tape.mess*1.4),-1.4,1.4));
    tape.restA-=TS; if(tape.grab>=1) tape.grab++;
  }
  function tapeRemove(){
    if(tape.p.length<=TN0) return false;
    if(tape.grab===1) tape.grab=-1; else if(tape.grab>1) tape.grab--;
    tape.p.splice(1,1); tape.q.splice(1,1); tape.tw.splice(1,1); tape.restA+=TS; return true;
  }
  // colliders in cassette-local space (cassette sits on desk at DESK_POS with no rotation while tape is out)
  const recBox = { x0:-19.2-DESK_POS.x, x1:1.2-DESK_POS.x, z0:-8.2-DESK_POS.z, z1:4.2-DESK_POS.z, y1:4.2 };
  function collide(p){
    if(p.y<.03) p.y=.03;
    if(p.x>-5.08&&p.x<5.08&&p.z>-3.25&&p.z<3.25&&p.y<1.3){
      const dF=3.25-p.z, dB=p.z+3.25, dT=1.3-p.y, dL=p.x+5.08, dR=5.08-p.x, m=Math.min(dF,dB,dT,dL,dR);
      if(m===dF)p.z=3.25; else if(m===dT)p.y=1.3; else if(m===dB)p.z=-3.25; else if(m===dL)p.x=-5.08; else p.x=5.08;
    }
    const r=recBox; if(p.x>r.x0&&p.x<r.x1&&p.z>r.z0&&p.z<r.z1&&p.y<r.y1){
      const m=Math.min(r.x1-p.x,p.x-r.x0,r.z1-p.z,p.z-r.z0,r.y1-p.y);
      if(m===r.x1-p.x)p.x=r.x1; else if(m===r.z1-p.z)p.z=r.z1; else if(m===r.y1-p.y)p.y=r.y1; else if(m===p.x-r.x0)p.x=r.x0; else p.z=r.z0;
    }
  }
  const GRAV=520;
  function tapeStep(h){
    const P=tape.p, Q=tape.q, n=P.length, gy=-GRAV*h*h, G=tape.grab;
    for(let i=1;i<n-1;i++){ if(i===G) continue; const p=P[i], q=Q[i];
      const vx=p.x-q.x, vy=p.y-q.y, vz=p.z-q.z, fr=p.y<.07?.58:.985;
      q.copy(p); p.x+=vx*fr; p.y+=vy*.985+gy; p.z+=vz*fr; }
    // curl memory: tape that sat wound on a reel wants to coil a little when slack
    for(let i=2;i<n-2;i++){ if(i===G) continue; const a=P[i-1], b=P[i+1], p=P[i]; if(p.y>1.2) continue;
      const tx=b.x-a.x, tz=b.z-a.z, l=Math.hypot(tx,tz); if(l<.05||l>TS*1.95) continue;
      const sgn=tape.tw[i]>=0?1:-1, f=.0035*(1+tape.mess); p.x+=-tz/l*f*sgn; p.z+=tx/l*f*sgn; }
    P[0].copy(A_L); P[n-1].copy(B_L);
    if(G>0){ Q[G].copy(P[G]); P[G].copy(tape.target); }
    const inv=i=>(i===0||i===n-1||i===G)?0:1;
    for(let it=0;it<tape.iter;it++){
      for(let i=0;i<n-1;i++){ const a=P[i], b=P[i+1], rest=i===0?tape.restA:TS;
        const dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z, len=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6, wa=inv(i), wb=inv(i+1), w=wa+wb; if(!w) continue;
        const k=(len-rest)/len/w; a.x+=dx*k*wa; a.y+=dy*k*wa; a.z+=dz*k*wa; b.x-=dx*k*wb; b.y-=dy*k*wb; b.z-=dz*k*wb; }
      if(!(it&1)) for(let i=0;i<n-2;i++){ const a=P[i], b=P[i+2]; const dx=b.x-a.x, dy=b.y-a.y, dz=b.z-a.z, len=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6, min=TS*1.5;
        if(len<min){ const wa=inv(i), wb=inv(i+2), w=wa+wb; if(!w) continue; const k=(len-min)/len/w*.3; a.x+=dx*k*wa; a.y+=dy*k*wa; a.z+=dz*k*wa; b.x-=dx*k*wb; b.y-=dy*k*wb; b.z-=dz*k*wb; } }
      for(let i=1;i<n-1;i++){ if(i===G) continue; const p=P[i]; if(i>2&&i<n-3) collide(p); else if(p.y<.03) p.y=.03; }
      if(it>=tape.iter-2){ // stack overlapping strands instead of letting them interpenetrate
        for(let i=1;i<n-1;i++){ const a=P[i]; if(a.y>.3) continue;
          for(let j=i+4;j<n-1;j++){ const b=P[j]; if(j===G) continue; if(Math.abs(a.x-b.x)<.24&&Math.abs(a.z-b.z)<.24&&Math.abs(a.y-b.y)<.045){ b.y=a.y+.045; Q[j].y=b.y; } } }
      }
    }
  }
  function tapeGrabUpdate(dt){
    if(tape.grab<0) return;
    const t=tape.raw.clone(), P=tape.p;
    for(let k=0;k<4;k++){ const lb=(P.length-1-tape.grab)*TS; if(t.distanceTo(B_L)>lb*.97 && tape.grab>1) tape.grab--; else break; }
    const lb=(P.length-1-tape.grab)*TS; let d=t.distanceTo(B_L); if(d>lb) t.sub(B_L).multiplyScalar(lb/d).add(B_L);
    tape.lastFeed=0;
    let la=tape.restA+(tape.grab-1)*TS; d=t.distanceTo(A_L);
    if(d>la*.97){
      const feed=Math.min(d-la*.97, MAXOUT-outLen(), 80*dt);
      tape.lastFeed=Math.max(0,feed);
      if(feed>0){ tape.restA+=feed; while(tape.restA>TS*1.6 && P.length<TMAX) tapeInsert(); }
      la=tape.restA+(tape.grab-1)*TS; if(d>la) t.sub(A_L).multiplyScalar(la/d).add(A_L);
    }
    tape.spin=Math.max(tape.spin, Math.min(60, (tape.lastFeed||0)/Math.max(dt,1e-3)));
    if(tape.mess>.35){ for(let o=-4;o<=4;o++){ const i=tape.grab+o; if(i>1&&i<P.length-2&&o){ const q=tape.q[i], s=tape.mess*.06; q.x+=(Math.random()-.5)*s; q.z+=(Math.random()-.5)*s; } } }
    tape.target.copy(t);
  }

  /* ribbon mesh */
  const SUB=3, RMAX=((TMAX-1)*SUB+1);
  const rPos=new Float32Array(RMAX*2*3), rNor=new Float32Array(RMAX*2*3), rUv=new Float32Array(RMAX*2*2);
  const rIdx=[]; for(let i=0;i<RMAX-1;i++){ const a=i*2; rIdx.push(a,a+2,a+1, a+1,a+2,a+3); }
  const ribbonGeo=new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position',new THREE.BufferAttribute(rPos,3).setUsage(THREE.DynamicDrawUsage));
  ribbonGeo.setAttribute('normal',new THREE.BufferAttribute(rNor,3).setUsage(THREE.DynamicDrawUsage));
  ribbonGeo.setAttribute('uv',new THREE.BufferAttribute(rUv,2));
  ribbonGeo.setIndex(rIdx);
  const ribbon=new THREE.Mesh(ribbonGeo,ribbonMat); ribbon.frustumCulled=false; ribbon.castShadow=true; ribbon.receiveShadow=true; cassette.add(ribbon);
  const Wp=Array.from({length:TMAX},()=>V()), thA=new Float32Array(TMAX), thB=new Float32Array(TMAX);
  const sP=Array.from({length:RMAX},()=>V()), sW=Array.from({length:RMAX},()=>V());
  const _T=V(), _Wf=V(), _N=V(), _prev=V(), _tmp=V();
  const HALFW=.1905;
  function catm(o,p0,p1,p2,p3,t){ const t2=t*t,t3=t2*t;
    for(const c of ['x','y','z']) o[c]=.5*((2*p1[c])+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t2+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t3); }
  function buildRibbon(){
    const P=tape.p, n=P.length; let hasPrev=false;
    for(let i=0;i<n;i++){ const y=P[i].y, e=Math.min(i,n-1-i);
      let th = y<.09 ? tape.tw[i]*.1 : tape.tw[i]*clamp((y-.05)/.8,.25,1);
      thA[i]=lerp(Math.PI/2, th, clamp((e-1)/3,0,1)); }
    for(let i=0;i<n;i++) thB[i]=(thA[Math.max(0,i-1)]+2*thA[i]+thA[Math.min(n-1,i+1)])/4;
    for(let i=0;i<n;i++){
      _T.subVectors(P[Math.min(n-1,i+1)],P[Math.max(0,i-1)]).normalize();
      _Wf.crossVectors(_T,UP);
      if(_Wf.lengthSq()<.02){ if(hasPrev){ _Wf.copy(_prev).addScaledVector(_T,-_prev.dot(_T)); } else _Wf.set(1,0,0); }
      _Wf.normalize(); _N.crossVectors(_Wf,_T).normalize();
      const W=Wp[i]; W.copy(_Wf).multiplyScalar(Math.cos(thB[i])).addScaledVector(_N,Math.sin(thB[i])).normalize();
      if(hasPrev && W.dot(_prev)<0) W.negate(); _prev.copy(W); hasPrev=true;
    }
    let m=0;
    for(let i=0;i<n-1;i++) for(let k=0;k<SUB;k++){ const t=k/SUB;
      catm(sP[m],P[Math.max(0,i-1)],P[i],P[i+1],P[Math.min(n-1,i+2)],t); if(sP[m].y<.022) sP[m].y=.022;
      sW[m].copy(Wp[i]).lerp(Wp[i+1],t).normalize(); m++; }
    sP[m].copy(P[n-1]); sW[m].copy(Wp[n-1]); m++;
    for(let j=0;j<m;j++){ const p=sP[j], w=sW[j];
      _T.subVectors(sP[Math.min(m-1,j+1)],sP[Math.max(0,j-1)]).normalize(); _N.crossVectors(_T,w).normalize();
      const o=j*6; rPos[o]=p.x-w.x*HALFW; rPos[o+1]=p.y-w.y*HALFW; rPos[o+2]=p.z-w.z*HALFW; rPos[o+3]=p.x+w.x*HALFW; rPos[o+4]=p.y+w.y*HALFW; rPos[o+5]=p.z+w.z*HALFW;
      rNor[o]=rNor[o+3]=_N.x; rNor[o+1]=rNor[o+4]=_N.y; rNor[o+2]=rNor[o+5]=_N.z; }
    ribbonGeo.setDrawRange(0,(m-1)*6);
    ribbonGeo.attributes.position.needsUpdate=true; ribbonGeo.attributes.normal.needsUpdate=true;
  }

  /* ───────────────────────── camera ───────────────────────── */
  const VIEWS = {
    intro:   { pos:[-1,40,45],  look:[-1,0,0],   k:.8 },
    recorder:{ pos:[-5,27,27],  look:[-4,2,-.5], k:.75 },
    closeup: { pos:[7.5,27,27], look:[7.2,0,7.5], k:.6 },
    rewind:  { pos:[7.5,26,17], look:[7.2,0,4.6], k:.5 },
    finished:{ pos:[1,35,38],   look:[1,0,2],    k:.75 },
  };
  const cam = { pos:V(), look:V(), view:'intro', moving:false };
  const fovFor = () => { const a=innerWidth/innerHeight; return a<.8 ? 52 : a<1.2 ? 42 : 34; };
  function applyFov(){ camera.fov=fovFor(); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); }
  function viewFor(name){
    const v=VIEWS[name], look=V(...v.look), pos=V(...v.pos), aspect=innerWidth/innerHeight;
    const fovK=Math.tan(THREE.MathUtils.degToRad(17))/Math.tan(THREE.MathUtils.degToRad(fovFor()/2));
    let k=aspect<1.45 ? clamp(Math.pow(1.45/aspect, v.k)*fovK,.9,2.6) : 1;
    pos.sub(look); if(aspect<.8){ pos.y*=1.3; pos.z*=.72; } pos.multiplyScalar(k).add(look);
    if(aspect<.8 && name==='intro'){ look.x+=1; pos.x+=1; }
    return { pos, look };
  }
  async function goView(name, dur=1.5){
    cam.view=name; const to=viewFor(name), fp=cam.pos.clone(), fl=cam.look.clone();
    if(reduceMotion) dur=0;
    cam.moving=true; await tween(dur,k=>{ cam.pos.lerpVectors(fp,to.pos,k); cam.look.lerpVectors(fl,to.look,k); }); cam.moving=false;
  }
  { const v=viewFor('intro'); cam.pos.copy(v.pos).add(V(0,6,8)); cam.look.copy(v.look); }

  /* ───────────────────────── tweens ───────────────────────── */
  const tweens=[];
  function tween(dur,fn,ease=easeIO){ return new Promise(res=>{ if(dur<=0){ fn(1); res(); return; } tweens.push({t:0,dur,fn,ease,res}); }); }
  function updateTweens(dt){ for(let i=tweens.length-1;i>=0;i--){ const w=tweens[i]; w.t+=dt; const k=Math.min(1,w.t/w.dur); w.fn(w.ease(k)); if(k>=1){ tweens.splice(i,1); w.res(); } } }
  const wait = ms => new Promise(r=>setTimeout(r,ms));

  /* ───────────────────────── audio ───────────────────────── */
  let actx=null, noiseBuf=null, mediaSrc=null, dryGain, wetGain, hissGain, playAnalyser, micAnalyser=null, micSrc=null;
  const audioEl=new Audio(); audioEl.preload='auto'; audioEl.setAttribute('playsinline','');
  function ensureCtx(){
    if(!actx){ const C=window.AudioContext||window.webkitAudioContext; if(!C) return null; actx=new C();
      noiseBuf=actx.createBuffer(1,actx.sampleRate,actx.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    if(actx.state==='suspended') actx.resume();
    return actx;
  }
  function ensureGraph(){
    if(mediaSrc || !ensureCtx()) return;
    try{
      mediaSrc=actx.createMediaElementSource(audioEl);
      playAnalyser=actx.createAnalyser(); playAnalyser.fftSize=512;
      dryGain=actx.createGain(); wetGain=actx.createGain();
      const lp=actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7200; lp.Q.value=.5;
      const hp=actx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=85;
      const warm=actx.createBiquadFilter(); warm.type='peaking'; warm.frequency.value=260; warm.gain.value=1.8; warm.Q.value=.8;
      const dl=actx.createDelay(.05); dl.delayTime.value=.006;
      const lfo=actx.createOscillator(); lfo.frequency.value=.55; const lfoG=actx.createGain(); lfoG.gain.value=.00045; lfo.connect(lfoG).connect(dl.delayTime); lfo.start();
      mediaSrc.connect(playAnalyser);
      playAnalyser.connect(dryGain).connect(actx.destination);
      playAnalyser.connect(hp); hp.connect(warm).connect(lp).connect(dl).connect(wetGain).connect(actx.destination);
      const hiss=actx.createBufferSource(); hiss.buffer=noiseBuf; hiss.loop=true; const hb=actx.createBiquadFilter(); hb.type='bandpass'; hb.frequency.value=5200; hb.Q.value=.6;
      hissGain=actx.createGain(); hissGain.gain.value=0; hiss.connect(hb).connect(hissGain).connect(actx.destination); hiss.start();
      applyFx();
    }catch(err){ console.warn('audio graph',err); mediaSrc=null; }
  }
  function applyFx(){ if(!dryGain) return; const t=actx.currentTime; dryGain.gain.setTargetAtTime(S.fx?0:1,t,.03); wetGain.gain.setTargetAtTime(S.fx?1:0,t,.03);
    hissGain.gain.setTargetAtTime(S.fx && S.state==='playing' && !audioEl.paused ? .0032 : 0, t, .05); }
  function sfx(type='click'){
    if(!S.sfx || !ensureCtx()) return; const t=actx.currentTime;
    const src=actx.createBufferSource(); src.buffer=noiseBuf; const bp=actx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=type==='clunk'?900:2600; bp.Q.value=1.4;
    const g=actx.createGain(); const vol=type==='clunk'?.1:.055; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+(type==='clunk'?.09:.045));
    src.connect(bp).connect(g).connect(actx.destination); src.start(t,Math.random()*.5); src.stop(t+.12);
    if(type==='clunk'){ const o=actx.createOscillator(); o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(70,t+.08); const og=actx.createGain(); og.gain.setValueAtTime(.08,t); og.gain.exponentialRampToValueAtTime(.0001,t+.1); o.connect(og).connect(actx.destination); o.start(t); o.stop(t+.12); }
  }
  function pickMime(){ if(!window.MediaRecorder) return ''; for(const m of ['audio/webm;codecs=opus','audio/webm','audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/aac','audio/ogg;codecs=opus']) if(MediaRecorder.isTypeSupported?.(m)) return m; return ''; }
  function extFor(m){ if(/webm/.test(m)) return 'webm'; if(/mp4|aac|m4a/.test(m)) return 'm4a'; if(/ogg/.test(m)) return 'ogg'; if(/wav/.test(m)) return 'wav'; return 'webm'; }

  const recState = { mr:null, stream:null, chunks:[], start:0, elapsed:0, mime:'' };
  const MAXREC=60;

  /* ───────────────────────── UI ───────────────────────── */
  const ui = { instr:$('#instruction'), controls:$('#controls'), status:$('#status'), stLabel:$('#stLabel'), stTime:$('#stTime'), stExtra:$('#stExtra'),
    meter:$('#meter'), toast:$('#toast'), hint:$('#hint'), hot:$('#hotspot'), tip:$('#tip') };
  const bars=[]; for(let i=0;i<14;i++){ const b=document.createElement('i'); ui.meter.append(b); bars.push(b); }
  let instrTimer; function setInstr(t){ if(ui.instr.dataset.t===t) return; ui.instr.dataset.t=t; ui.instr.classList.add('fade'); clearTimeout(instrTimer); instrTimer=setTimeout(()=>{ ui.instr.textContent=t; ui.instr.classList.remove('fade'); },reduceMotion?0:180); }
  let toastTimer; function toast(t,ms=2400){ ui.toast.textContent=t; ui.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),ms); }
  let hintTimer; function hint(t,ms=1500){ ui.hint.textContent=t; ui.hint.classList.add('show'); clearTimeout(hintTimer); hintTimer=setTimeout(()=>ui.hint.classList.remove('show'),ms); }
  const fmt = s => { s=Math.max(0,Math.floor(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
  const wind = { pending:0, holding:false, total:0, lastA:0, vel:0, wob:0, wobV:0 };

  function setControls(list){
    ui.controls.replaceChildren(...list.map(b=>{
      const el=document.createElement('button'); el.type='button'; el.className='btn'+(b.primary?' primary':''); el.textContent=b.label;
      if(b.hold){
        const on=e=>{ e.preventDefault(); if(S.busy) return; wind.holding=true; el.classList.add('holding'); };
        const off=()=>{ wind.holding=false; el.classList.remove('holding'); };
        el.addEventListener('pointerdown',on); el.addEventListener('pointerup',off); el.addEventListener('pointerleave',off); el.addEventListener('pointercancel',off);
        el.addEventListener('keydown',e=>{ if((e.key===' '||e.key==='Enter')&&!e.repeat) on(e); }); el.addEventListener('keyup',e=>{ if(e.key===' '||e.key==='Enter') off(); });
        el.addEventListener('blur',off); el.setAttribute('aria-label','Tahan untuk menggulung pita');
      } else el.addEventListener('click',()=>{ if(!S.busy) b.onClick(); });
      return el; }));
  }
  const keyWorld = a => rec3d.keys[a].localToWorld(V(0,.7,0));
  const hubWorld = () => cassette.localToWorld(HUB_A.clone());
  const tapeMidWorld = () => cassette.localToWorld(tape.p[Math.floor(tape.p.length/2)].clone());
  const pencilMid = () => pencilPose.tip.clone().addScaledVector(pencilPose.axis,7);

  function setState(st){ S.state=st; renderUI(); }
  function renderUI(){
    let hs=null; const st=S.state;
    if(st==='idle'){ setInstr('Rekam sesuatu yang ingin kamu simpan.'); setControls([{label:'● Rekam',primary:true,onClick:()=>pressAction('rec')}]); hs=()=>keyWorld('rec'); }
    else if(st==='recording'){ setInstr('Sedang merekam… bicaralah pelan-pelan.'); setControls([{label:'■ Berhenti merekam',primary:true,onClick:()=>pressAction('stop')}]); hs=()=>keyWorld('stop'); }
    else if(st==='recorded'){
      const demo=S.rec?.demo;
      if(S.hasPlayed){ setInstr('Mau iseng sedikit? Keluarkan kasetnya.'); hs=()=>keyWorld('stop'); }
      else { setInstr(demo?'Ini rekaman contoh (demo), bukan suaramu. Tekan ▶ untuk mendengarkan.':'Tekan ▶ untuk mendengarkan suaramu.'); hs=()=>keyWorld('play'); }
      setControls([{label:'▶ Putar',primary:!S.hasPlayed,onClick:()=>pressAction('play')},{label:'⏏ Keluarkan kaset',primary:S.hasPlayed,onClick:()=>eject()},{label:'● Rekam ulang',onClick:()=>pressAction('rec')}]);
    }
    else if(st==='playing'){
      setInstr(S.paused?'Dijeda.':(S.rec?.demo?'Memutar rekaman contoh (demo)…':'Mendengarkan…'));
      setControls([{label:S.paused?'▶ Lanjut':'❚❚ Jeda',primary:true,onClick:()=>pressAction(S.paused?'play':'pause')},{label:'■ Stop',onClick:()=>pressAction('stop')},{label:'⏏ Keluarkan',onClick:()=>eject()}]);
    }
    else if(st==='ejected' || st==='pulling'){ setInstr('Tarik pitanya. Pelan-pelan.'); setControls(st==='ejected'?[{label:'Kembalikan ke recorder',onClick:()=>replay(false)}]:[]); if(st==='ejected') hs=tapeMidWorld; }
    else if(st==='tangled'){ setInstr('Masukkan pensil ke lubang kaset.'); setControls([{label:'✎ Pasang pensil',primary:true,onClick:()=>insertPencil()}]); hs=pencilMid; }
    else if(st==='rewinding'){ setInstr('Putar pensilnya. Gulung kembali.'); setControls([{label:'Tahan untuk menggulung',hold:true}]); }
    else if(st==='restored'){ setInstr('Sudah rapi. Putar lagi?'); setControls([{label:'▶ Dengarkan lagi',primary:true,onClick:()=>replay(true)},{label:'⤓ Simpan rekaman',onClick:download},{label:'● Rekam ulang',onClick:()=>pressAction('rec')}]); }
    else setControls([]);
    S.hot=hs; ui.hot.hidden=!hs;
  }

  /* modal */
  function dialog(title,text,buttons){
    return new Promise(res=>{ const m=$('#modal'); $('#modalTitle').textContent=title; $('#modalText').textContent=text;
      const row=$('#modalBtns'); row.replaceChildren(...buttons.map(b=>{ const el=document.createElement('button'); el.type='button'; el.className='btn'+(b.primary?' primary':''); el.textContent=b.label;
        el.onclick=()=>{ m.hidden=true; res(b.value); }; return el; }));
      m.hidden=false; row.lastElementChild?.focus();
      m.onkeydown=e=>{ if(e.key==='Escape'){ m.hidden=true; res(null); } };
    });
  }

  /* title editor */
  const titleBox=$('#titleBox'), titleInput=$('#titleInput');
  function openTitle(){ titleInput.value=S.title; titleBox.hidden=false; setTimeout(()=>titleInput.focus(),30); }
  $('#btnTitle').onclick=openTitle;
  $('#titleCancel').onclick=()=>{ titleBox.hidden=true; };
  titleBox.addEventListener('keydown',e=>{ if(e.key==='Escape') titleBox.hidden=true; });
  $('#titleForm').onsubmit=e=>{ e.preventDefault(); S.title=titleInput.value.trim().slice(0,24); drawLabel(); titleBox.hidden=true; if(S.title) toast('Tertulis di label.',1500); };
  const bSfx=$('#btnSfx'), bFx=$('#btnFx');
  bSfx.onclick=()=>{ S.sfx=!S.sfx; bSfx.setAttribute('aria-pressed',S.sfx); bSfx.textContent='Bunyi tombol: '+(S.sfx?'nyala':'mati'); };
  bFx.onclick=()=>{ S.fx=!S.fx; bFx.setAttribute('aria-pressed',S.fx); bFx.textContent='Efek kaset: '+(S.fx?'nyala':'mati'); applyFx(); };

  /* ───────────────────────── mechanics ───────────────────────── */
  function setKey(a,down){ rec3d.keys[a].userData.pressed=down; }
  function tapKey(a){ const k=rec3d.keys[a]; k.userData.tap=.18; sfx('click'); }
  function releaseAll(){ KEY_ACTIONS.forEach(a=>setKey(a,false)); }

  async function moveLid(open){ const from=rec3d.lid.rotation.x, to=open?LID_OPEN:0; if(Math.abs(from-to)<.01) return;
    await tween(.5*M,k=>rec3d.lid.rotation.x=lerp(from,to,k)); if(!open) sfx('clunk'); }

  async function insertCassette(){
    if(S.inRecorder) return;
    const view=goView('recorder',1.3);
    await moveLid(true);
    const from=cassette.position.clone(), r0=cassette.rotation.y, above=SLOT.clone().add(V(0,3.4,3));
    await tween(1.0*M,k=>{ cassette.position.lerpVectors(from,above,k); cassette.position.y=lerp(from.y,above.y,k)+Math.sin(k*Math.PI)*1.5; cassette.rotation.y=lerp(r0,0,k); cassette.rotation.x=Math.sin(k*Math.PI)*-.12; });
    await tween(.45*M,k=>cassette.position.lerpVectors(above,SLOT,k),easeOut);
    sfx('click'); S.inRecorder=true;
    await moveLid(false); await view;
  }

  async function pressAction(a){
    if(S.busy) return;
    ensureCtx();
    const st=S.state;
    if(['ejecting','ejected','pulling','tangled','rewinding','settling'].includes(st)){ tapKey(a); if(st!=='ejecting') hint('Rapikan dulu pitanya.'); return; }
    if(a==='rec'){
      if(st==='recording') return;
      if(S.rec){
        const v=await dialog('Rekam ulang?','Rekaman yang sekarang akan diganti dan tidak bisa dikembalikan. Simpan dulu kalau masih ingin disimpan.',
          [{label:'Batal',value:null},{label:'Simpan dulu',value:'save'},{label:'Ganti rekaman',value:'yes',primary:true}]);
        if(v==='save'){ download(); return; }
        if(v!=='yes') return;
      }
      if(st==='playing') stopPlayback(true);
      startRecording(); return;
    }
    if(a==='stop'){
      if(st==='recording'){ stopRecording(); return; }
      if(st==='playing'){ tapKey('stop'); stopPlayback(); return; }
      if(S.inRecorder && S.rec && (st==='recorded')){ eject(); return; }
      tapKey('stop'); return;
    }
    if(a==='play'){
      if(st==='playing' && S.paused){ setKey('pause',false); audioEl.play().catch(()=>{}); return; }
      if(st==='recorded' && S.inRecorder){ play(); return; }
      tapKey('play'); if(!S.inRecorder && S.rec) hint('Kasetnya belum di dalam recorder.'); return;
    }
    if(a==='pause'){ if(st==='playing'){ if(S.paused){ setKey('pause',false); audioEl.play().catch(()=>{}); } else { setKey('pause',true); sfx('click'); audioEl.pause(); } } else tapKey('pause'); return; }
    if(a==='rew'||a==='ff'){ tapKey(a); if(st==='playing'){ try{ const d=S.rec.duration||audioEl.duration||0; audioEl.currentTime=clamp(audioEl.currentTime+(a==='ff'?5:-5),0,Math.max(0,(isFinite(audioEl.duration)?audioEl.duration:d)-.05)); }catch{} } }
  }

  async function startRecording(){
    if(!window.isSecureContext){ micError('insecure'); return; }
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){ micError('unsupported'); return; }
    S.busy=true; setInstr('Meminta izin mikrofon…');
    let stream;
    try{ stream=await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } }); }
    catch(err){ S.busy=false; micError(err && err.name); return; }
    try{
      if(!S.inRecorder){ await insertCassette(); } else { await goView('recorder',1.1); if(rec3d.lid.rotation.x<-.05) await moveLid(false); }
      // reset tape visuals to a fresh cassette side
      tapeReset();
      const mime=pickMime(); const mr=new MediaRecorder(stream, mime?{ mimeType:mime }:undefined);
      recState.mr=mr; recState.stream=stream; recState.chunks=[]; recState.mime=mr.mimeType||mime||'audio/webm';
      mr.ondataavailable=e=>{ if(e.data && e.data.size) recState.chunks.push(e.data); };
      mr.onstop=finishRecording;
      mr.onerror=()=>{ toast('Perekaman terhenti karena galat.'); };
      if(ensureCtx()){ micSrc=actx.createMediaStreamSource(stream); micAnalyser=actx.createAnalyser(); micAnalyser.fftSize=512; micSrc.connect(micAnalyser); }
      setKey('rec',true); setKey('play',true); sfx('clunk');
      mr.start(250); recState.start=performance.now(); recState.elapsed=0;
      S.hasPlayed=false; S.state='recording'; renderUI();
    }catch(err){
      console.error(err); stream.getTracks().forEach(t=>t.stop()); releaseAll();
      micError('unsupported');
    }finally{ S.busy=false; }
  }
  function stopRecording(){
    const mr=recState.mr; if(!mr || mr.state==='inactive') return;
    recState.elapsed=(performance.now()-recState.start)/1000;
    S.busy=true; mr.stop();
  }
  function finishRecording(){
    const { stream, chunks, mime } = recState;
    stream?.getTracks().forEach(t=>t.stop());
    try{ micSrc?.disconnect(); }catch{} micSrc=null; micAnalyser=null; recState.mr=null; recState.stream=null;
    releaseAll(); sfx('clunk');
    const blob=new Blob(chunks,{ type:mime });
    S.busy=false;
    if(!blob.size){ S.state=S.rec?'recorded':'idle'; renderUI(); toast('Tidak ada suara yang terekam. Coba lagi.'); return; }
    if(S.rec) URL.revokeObjectURL(S.rec.url);
    S.rec={ blob, url:URL.createObjectURL(blob), mime, ext:extFor(mime), duration:Math.min(MAXREC,recState.elapsed), demo:false };
    audioEl.src=S.rec.url; audioEl.load();
    drawLabel();
    S.state='recorded'; renderUI(); toast('Suaramu sudah tersimpan.',2800);
  }
  async function micError(kind){
    const msg = kind==='NotAllowedError'||kind==='SecurityError' ? 'Akses mikrofon ditolak. Izinkan mikrofon untuk halaman ini di pengaturan browser, lalu coba lagi.'
      : kind==='NotFoundError'||kind==='OverconstrainedError' ? 'Mikrofon tidak ditemukan. Sambungkan mikrofon, lalu coba lagi.'
      : kind==='NotReadableError' ? 'Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.'
      : kind==='insecure' ? 'Perekaman hanya bisa dilakukan lewat koneksi aman (https atau localhost).'
      : kind==='unsupported' ? 'Browser ini belum bisa merekam suara.' : 'Mikrofon belum bisa dipakai.';
    renderUI();
    const v=await dialog('Mikrofon tidak tersedia', msg+' Kamu juga bisa mencoba alurnya dengan rekaman contoh (demo musik, bukan suaramu).',
      [{label:'Tutup',value:null},{label:'Pakai rekaman contoh',value:'demo'},{label:'Coba lagi',value:'retry',primary:true}]);
    if(v==='retry') startRecording(); else if(v==='demo') useSample();
  }
  async function useSample(){
    S.busy=true;
    try{
      const blob=await makeDemo();
      if(S.rec) URL.revokeObjectURL(S.rec.url);
      S.rec={ blob, url:URL.createObjectURL(blob), mime:'audio/wav', ext:'wav', duration:6.5, demo:true };
      audioEl.src=S.rec.url; audioEl.load(); drawLabel();
      if(!S.inRecorder) await insertCassette();
      tapeReset(); S.hasPlayed=false; S.state='recorded'; renderUI(); toast('Rekaman contoh (demo) dimuat.',2400);
    }catch(e){ console.error(e); toast('Rekaman contoh gagal dibuat.'); }
    S.busy=false;
  }
  async function makeDemo(){
    const sr=44100, dur=6.5; const oc=new OfflineAudioContext(1,Math.ceil(sr*dur),sr);
    const notes=[[0,523.25],[.42,659.25],[.84,783.99],[1.26,659.25],[1.68,587.33],[2.1,698.46],[2.52,880],[2.94,698.46],[3.36,659.25],[3.78,783.99],[4.2,1046.5],[4.8,783.99],[5.2,523.25]];
    for(const [t,f] of notes){ for(const [mul,vol] of [[1,.22],[2,.05]]){ const o=oc.createOscillator(); o.type='triangle'; o.frequency.value=f*mul; const g=oc.createGain();
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.012); g.gain.exponentialRampToValueAtTime(.0008,t+1.25); o.connect(g).connect(oc.destination); o.start(t); o.stop(t+1.3); } }
    const buf=await oc.startRendering(); const ch=buf.getChannelData(0), n=ch.length; const ab=new ArrayBuffer(44+n*2), v=new DataView(ab);
    const ws=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
    ws(0,'RIFF'); v.setUint32(4,36+n*2,true); ws(8,'WAVE'); ws(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); ws(36,'data'); v.setUint32(40,n*2,true);
    for(let i=0;i<n;i++) v.setInt16(44+i*2,clamp(ch[i],-1,1)*32767,true);
    return new Blob([ab],{ type:'audio/wav' });
  }

  function play(){
    if(!S.rec || !S.inRecorder) return;
    ensureGraph();
    if(audioEl.src!==S.rec.url){ audioEl.src=S.rec.url; }
    if(audioEl.ended || S.forceRestart){ try{ audioEl.currentTime=0; }catch{} S.forceRestart=false; }
    setKey('play',true); sfx('clunk');
    audioEl.play().catch(err=>{ console.warn(err); setKey('play',false); toast('Rekaman belum bisa diputar di browser ini.'); });
  }
  function stopPlayback(silent){ audioEl.pause(); try{ audioEl.currentTime=0; }catch{} releaseAll(); if(!silent){ S.hasPlayed=true; S.state='recorded'; S.paused=false; renderUI(); } }
  audioEl.addEventListener('play',()=>{ S.paused=false; if(S.state!=='playing'){ S.state='playing'; } setKey('play',true); setKey('pause',false); renderUI(); applyFx(); });
  audioEl.addEventListener('pause',()=>{ applyFx(); if(S.state!=='playing' || audioEl.ended) return; if(audioEl.currentTime===0){ return; } S.paused=true; renderUI(); });
  audioEl.addEventListener('ended',()=>{ releaseAll(); sfx('clunk'); S.hasPlayed=true; S.paused=false; S.forceRestart=true; if(S.state==='playing'){ S.state='recorded'; renderUI(); } applyFx(); });
  audioEl.addEventListener('error',()=>{ if(S.rec && S.state==='playing'){ releaseAll(); S.state='recorded'; renderUI(); toast('Format rekaman tidak didukung untuk diputar di sini.'); } });

  async function eject(){
    if(S.busy || !S.inRecorder || S.state==='recording' || !S.rec) return;
    S.busy=true; audioEl.pause(); S.forceRestart=true; releaseAll(); tapKey('stop'); S.state='ejecting'; renderUI();
    await moveLid(true);
    const from=cassette.position.clone(), up=from.clone().add(V(0,3.4,2.5));
    await tween(.5*M,k=>cassette.position.lerpVectors(from,up,k),easeOut);
    await tween(1.0*M,k=>{ cassette.position.lerpVectors(up,DESK_POS,k); cassette.position.y=lerp(up.y,0,k)+Math.sin(k*Math.PI)*1.2; cassette.rotation.x=Math.sin(k*Math.PI)*.08; });
    cassette.position.copy(DESK_POS); cassette.rotation.set(0,0,0); sfx('click');
    S.inRecorder=false; tapeReset(); S.tangled=false;
    await goView('closeup',1.4);
    S.busy=false; setState('ejected');
  }
  async function replay(autoplay){
    if(S.busy) return; S.busy=true;
    if(!S.inRecorder){ tapeReset(); await insertCassette(); }
    S.busy=false; S.state='recorded'; renderUI();
    if(autoplay){ S.forceRestart=true; play(); }
  }
  function download(){
    const r=S.rec; if(!r) return;
    const base=(S.title||'putar-lagi').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'putar-lagi';
    const a=document.createElement('a'); a.href=r.url; a.download=`${base}${r.demo?'-demo':''}.${r.ext}`; document.body.append(a); a.click(); a.remove();
    toast('Rekaman disimpan.',1600);
  }

  async function insertPencil(){
    if(S.busy || S.state!=='tangled') return;
    S.busy=true; drag=null; tape.grab=-1; ui.tip.hidden=true;
    const hub=hubWorld(), t0=pencilPose.tip.clone(), a0=pencilPose.axis.clone(), above=hub.clone().add(V(0,2.8,0));
    await tween(.75*M,k=>{ pencilPose.tip.lerpVectors(t0,above,k); pencilPose.tip.y+=Math.sin(k*Math.PI)*3; pencilPose.axis.copy(a0).lerp(UP,k).normalize(); applyPencil(); });
    pencilPose.axis.copy(UP);
    const inHub=hub.clone(); inHub.y=.3;
    await tween(.35*M,k=>{ pencilPose.tip.lerpVectors(above,inHub,k); applyPencil(); },easeIn);
    sfx('click'); S.spinOffset=pencilPose.spin-angA;
    wind.pending=0; wind.total=0; arc.visible=true; arc.position.copy(hub).setY(1.45);
    S.state='rewinding'; renderUI();
    await goView('rewind',1.2);
    S.busy=false;
  }
  async function finishRewind(){
    S.busy=true; S.state='settling'; renderUI(); wind.pending=0; wind.holding=false; arc.visible=false; tape.grab=-1;
    const from=tape.p.map(v=>v.clone()); tape.active=false;
    const target=from.map((_,i)=>A_L.clone().lerp(B_L,i/(from.length-1)));
    await tween(.45*M,k=>tape.p.forEach((v,i)=>v.lerpVectors(from[i],target[i],k)),easeOut);
    tapeReset(); sfx('click');
    const t0=pencilPose.tip.clone(), up=t0.clone().add(V(0,3.2,0));
    await tween(.4*M,k=>{ pencilPose.tip.lerpVectors(t0,up,k); applyPencil(); },easeOut);
    const s0=pencilPose.spin;
    await tween(.85*M,k=>{ pencilPose.tip.lerpVectors(up,PENCIL_REST.tip,k); pencilPose.tip.y+=Math.sin(k*Math.PI)*2.2; pencilPose.axis.copy(UP).lerp(PENCIL_REST.axis,k).normalize(); pencilPose.spin=lerp(s0,PENCIL_REST.spin+Math.round((s0-PENCIL_REST.spin)/(Math.PI/3))*(Math.PI/3),k); applyPencil(); });
    sfx('click');
    toast('Sudah rapi.',1800);
    await goView('finished',1.4);
    S.busy=false; setState('restored');
  }

  /* ───────────────────────── pointer input ───────────────────────── */
  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
  let drag=null;
  function setRay(e){ const r=canvas.getBoundingClientRect(); ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera); }
  function planeHit(y){ const out=V(); return ray.ray.intersectPlane(new THREE.Plane(UP.clone(),-y),out) ? out : null; }
  function toScreen(v){ const p=v.clone().project(camera); return { x:(p.x+1)/2*innerWidth, y:(1-p.y)/2*innerHeight, ok:p.z<1 }; }
  const keyMeshes=[]; Object.values(rec3d.keys).forEach(k=>k.children.forEach(c=>keyMeshes.push(c)));
  function hitKey(){ const h=ray.intersectObjects(keyMeshes,false)[0]; return h ? h.object.userData.key.userData.action : null; }
  function hitPencil(){ return ray.intersectObject(pen.hit,false).length>0; }
  function hitLabel(){ return ray.intersectObject(cas.label,false).length>0; }
  function pickTape(e){
    const P=tape.p; let best=-1, bd=e.pointerType==='touch'?60:40;
    for(let i=1;i<P.length-1;i++){ const s=toScreen(cassette.localToWorld(P[i].clone())); const d=Math.hypot(s.x-e.clientX,s.y-e.clientY); if(d<bd){ bd=d; best=i; } }
    return best;
  }
  function tapeTargetFromRay(){
    const w=planeHit(1.6); if(!w) return null; const l=cassette.worldToLocal(w);
    l.x=clamp(l.x,-40,40); l.z=clamp(l.z,-30,34); return l;
  }
  const pv={ x:0, y:0, t:0, vx:0, vy:0 };
  function capture(id){ try{ canvas.setPointerCapture(id); }catch{} }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(drag || S.busy || !$('#modal').hidden) return;
    ensureCtx(); setRay(e); const st=S.state;
    if(st==='tangled' && hitPencil()){
      drag={ type:'pencil', id:e.pointerId }; capture(e.pointerId); canvas.style.cursor='grabbing'; ui.hot.hidden=true; sfx('click'); return;
    }
    if(st==='ejected'||st==='pulling'||st==='tangled'){
      const gi=pickTape(e);
      if(gi>0){ drag={ type:'tape', id:e.pointerId }; capture(e.pointerId); canvas.style.cursor='grabbing';
        const t=tapeTargetFromRay(); tape.raw.copy(t||tape.p[gi]); tape.grab=gi; tape.target.copy(tape.p[gi]); tape.active=true;
        Object.assign(pv,{ x:e.clientX, y:e.clientY, t:performance.now(), vx:0, vy:0 }); tape.mess=.3;
        if(st==='ejected') setState('pulling'); return; }
    }
    if(st==='rewinding'){
      const c=toScreen(hubWorld()); drag={ type:'wind', id:e.pointerId, cx:c.x, cy:c.y, lastA:Math.atan2(e.clientY-c.y,e.clientX-c.x), lastT:performance.now() };
      capture(e.pointerId); return;
    }
    const k=hitKey(); if(k){ pressAction(k); return; }
    if(hitLabel() && ['idle','recorded','restored','ejected'].includes(st)) openTitle();
  });
  canvas.addEventListener('pointermove',e=>{
    if(drag && e.pointerId!==drag.id) return;
    setRay(e);
    if(!drag){ hover(e); return; }
    if(drag.type==='tape'){
      const t=tapeTargetFromRay(); if(t) tape.raw.copy(t);
      const now=performance.now(), dt=Math.max(1,now-pv.t), vx=(e.clientX-pv.x)/dt, vy=(e.clientY-pv.y)/dt;
      const sp=Math.hypot(vx,vy), sp0=Math.hypot(pv.vx,pv.vy);
      if(sp>.05 && sp0>.05){ const cos=(vx*pv.vx+vy*pv.vy)/(sp*sp0); const turn=Math.acos(clamp(cos,-1,1)); tape.mess=lerp(tape.mess,clamp(turn*sp*.9,0,1),.25); }
      else tape.mess=lerp(tape.mess,.25,.05);
      Object.assign(pv,{ x:e.clientX, y:e.clientY, t:now, vx, vy });
    } else if(drag.type==='pencil'){
      const w=planeHit(1.0); if(!w) return;
      w.x=clamp(w.x,-20,34); w.z=clamp(w.z,-20,26);
      pencilPose.tip.copy(w); applyPencil();
      const hub=hubWorld(); if(Math.hypot(w.x-hub.x,w.z-hub.z)<1.9){ const id=drag.id; drag=null; try{ canvas.releasePointerCapture(id); }catch{} canvas.style.cursor=''; insertPencil(); }
    } else if(drag.type==='wind'){
      const dx=e.clientX-drag.cx, dy=e.clientY-drag.cy; const a=Math.atan2(dy,dx);
      let d=a-drag.lastA; if(d>Math.PI) d-=Math.PI*2; if(d<-Math.PI) d+=Math.PI*2; drag.lastA=a;
      if(Math.hypot(dx,dy)<12) return;
      const now=performance.now(), dt=Math.max(1,now-drag.lastT)/1000; drag.lastT=now;
      if(d>0){ wind.pending=Math.min(wind.pending+d,5); wind.vel=lerp(wind.vel,d/dt,.3); }
      else if(d<-.015){ wind.wobV+=d*2.2; wind.vel=0; if(!ui.hint.classList.contains('show')) hint('↻ Putar searah jarum jam untuk menggulung'); }
    }
  });
  function endDrag(e){
    if(!drag || (e && e.pointerId!==drag.id)) return;
    const d=drag; drag=null; canvas.style.cursor='';
    try{ canvas.releasePointerCapture(d.id); }catch{}
    if(d.type==='tape'){ tape.grab=-1; if(S.state==='pulling' && outLen()<.3 && !S.tangled) { /* barely pulled */ } }
    if(d.type==='pencil' && S.state==='tangled'){ S.busy=true; const t0=pencilPose.tip.clone();
      tween(.5*M,k=>{ pencilPose.tip.lerpVectors(t0,PENCIL_REST.tip,k); pencilPose.tip.y+=Math.sin(k*Math.PI)*.8; applyPencil(); }).then(()=>{ S.busy=false; renderUI(); }); }
    if(d.type==='wind'){ wind.pending=Math.min(5,wind.pending+clamp(wind.vel,0,12)*.06); wind.vel=0; }
  }
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',e=>{ if(drag && drag.id===e.pointerId) endDrag(e); });
  function hover(e){
    if(e.pointerType!=='mouse' || S.busy){ ui.tip.hidden=true; canvas.style.cursor=''; return; }
    let label=null, cur='';
    const st=S.state;
    if(st==='rewinding'){ label='Putar melingkar searah jarum jam'; cur='grab'; }
    else if(st==='tangled' && hitPencil()){ label='Seret pensil ke lubang kaset'; cur='grab'; }
    else if((st==='ejected'||st==='pulling'||st==='tangled') && pickTape(e)>0){ label='Tarik pita'; cur='grab'; }
    else { const k=hitKey(); if(k){ label=KEY_NAMES[k]; cur='pointer'; } else if(hitLabel() && ['idle','recorded','restored','ejected'].includes(st)){ label='Tulis judul di label'; cur='text'; } }
    canvas.style.cursor=cur;
    if(label){ ui.tip.textContent=label; ui.tip.hidden=false; ui.tip.style.transform=`translate(${e.clientX+14}px,${e.clientY+14}px)`; } else ui.tip.hidden=true;
  }

  /* ───────────────────────── frame loop ───────────────────────── */
  let angA=0, angB=0, last=performance.now(), fpsAcc=0, fpsN=0, degraded=lowPower, meterLvl=0;
  const H_STEP=1/60;
  function frame(now){
    const dt=Math.min(.05,(now-last)/1000); last=now;
    updateTweens(dt);

    // camera
    let sway=V();
    if(!reduceMotion && !drag && (cam.view==='intro'||cam.view==='finished')){ const t=now/1000; sway.set(Math.sin(t*.21)*.5,Math.sin(t*.17)*.3,0); }
    camera.position.copy(cam.pos).add(sway); camera.lookAt(cam.look);
    { const d=cam.pos.distanceTo(cam.look); scene.fog.near=d+35; scene.fog.far=d+140; }

    // recording timer
    if(S.state==='recording'){
      const el=(performance.now()-recState.start)/1000; recState.elapsed=el;
      if(el>=MAXREC){ stopRecording(); toast('Batas 60 detik tercapai.',1800); }
    }

    // reels during transport
    const transporting = S.state==='recording' || (S.state==='playing' && !audioEl.paused);
    if(transporting){ const v=4.76*dt; angA-=v/packR(); angB-=v/R_B; }

    // tape
    if(tape.active){
      tapeGrabUpdate(dt);
      if(tape.spin>.5 && S.state!=='rewinding'){ const extra=Math.min(tape.spin*dt*(.22+tape.mess*.35), MAXOUT-outLen()); if(extra>0){ tape.restA+=extra; while(tape.restA>TS*1.6 && tape.p.length<TMAX) tapeInsert(); } }
      tape.spin*=Math.exp(-dt*(tape.grab>0?4:6));
      tape.acc+=dt; let steps=0; while(tape.acc>=H_STEP && steps<3){ tapeStep(H_STEP); tape.acc-=H_STEP; steps++; } if(steps===3) tape.acc=0;
      if(S.state==='pulling' && !S.tangled && outLen()>20){ S.tangled=true; toast('Yah… kusut.',1700); setTimeout(()=>{ if(S.state==='pulling'){ toast('Untung ada pensil.',2200); setState('tangled'); } },1750); }
    }
    // winding
    if(S.state==='rewinding' && !S.busy){
      if(wind.holding) wind.pending=Math.min(5,wind.pending+6.5*dt);
      if(wind.pending>1e-5){
        const step=Math.min(wind.pending*(1-Math.exp(-dt*8)), 14*dt, wind.pending);
        wind.pending-=step; wind.total+=step;
        tape.restA-=step*packR();
        while(tape.restA<.06 && tape.p.length>TN0) tapeRemove();
        if(tape.p.length<=TN0 && tape.restA<=TS){ tape.restA=TS; finishRewind(); }
      }
      if(arc.visible){ arc.rotation.y-=dt*(reduceMotion?0:.9); if(wind.total>Math.PI*2) arc.visible=false; }
    }
    const o=outLen(); angA+=(o-tape.lastOut)/packR(); tape.lastOut=o;
    wind.wobV+=(-wind.wob*90-wind.wobV*11)*dt; wind.wob+=wind.wobV*dt;
    cas.reelA.rotation.y=angA+wind.wob; cas.reelB.rotation.y=angB;
    const rA=packR(); cas.packA.scale.set(rA,1,rA); updateInternalTape(rA);
    if(S.state==='rewinding'){ pencilPose.spin=angA+wind.wob+S.spinOffset; applyPencil(); }
    buildRibbon();
    ribbonMat.emissiveIntensity = S.state==='ejected' ? (reduceMotion?.25:.18+.18*Math.sin(now/260)) : 0;

    // keys
    for(const a of KEY_ACTIONS){ const k=rec3d.keys[a], u=k.userData; if(u.tap>0) u.tap-=dt; const target=u.baseY-((u.pressed||u.tap>0)?.38:0); k.position.y=lerp(k.position.y,target,1-Math.exp(-dt*28)); }
    rec3d.ledMat.emissiveIntensity = S.state==='recording' ? 2.2+Math.sin(now/180)*.4 : (S.state==='playing'&&!audioEl.paused?.5:0);

    // status + meter
    const showStatus = S.state==='recording' || S.state==='playing';
    ui.status.hidden=!showStatus;
    if(showStatus){
      let an=null;
      if(S.state==='recording'){ ui.status.className='rec'; ui.stLabel.textContent='REC'; ui.stTime.textContent=fmt(recState.elapsed); ui.stExtra.textContent='· sisa '+Math.max(0,Math.ceil(MAXREC-recState.elapsed))+' dtk'; an=micAnalyser; drawCounter(recState.elapsed); }
      else { ui.status.className=S.paused?'pause':'play'; ui.stLabel.textContent=S.paused?'JEDA':'PLAY'; ui.stTime.textContent=fmt(audioEl.currentTime);
        ui.stExtra.innerHTML='/ '+fmt(S.rec?.duration||0)+(S.rec?.demo?' <span class="demo">DEMO</span>':''); an=playAnalyser; drawCounter(audioEl.currentTime); }
      let lvl=0; if(an){ const buf=frame.buf||(frame.buf=new Float32Array(512)); an.getFloatTimeDomainData(buf); let s=0; for(let i=0;i<buf.length;i++) s+=buf[i]*buf[i]; lvl=Math.sqrt(s/buf.length); }
      meterLvl=Math.max(lvl*5.5,meterLvl*.86); const on=Math.round(clamp(meterLvl,0,1)*bars.length);
      bars.forEach((b,i)=>{ b.className=i<on?(i>=bars.length-3?'hot':'on'):''; });
    }

    // hotspot
    if(S.hot && !S.busy && !drag){ const s=toScreen(S.hot()); ui.hot.hidden=!s.ok; ui.hot.style.transform=`translate(${s.x}px,${s.y}px)`; } else ui.hot.hidden=true;
    ui.controls.classList.toggle('busy',S.busy);

    if(dust){ const a=dust.geometry.attributes.position; for(let i=0;i<a.count;i++){ let y=a.getY(i)+dt*.12; if(y>28) y=2; a.setY(i,y); a.setX(i,a.getX(i)+Math.sin(now/3000+i)*dt*.05); } a.needsUpdate=true; }

    renderer.render(scene,camera);

    // adaptive quality
    if(!degraded && now>3000){ fpsAcc+=dt; fpsN++; if(fpsN>=120){ if(fpsAcc/fpsN>1/42){ degraded=true; pixelRatio=Math.min(pixelRatio,1.25); renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth,innerHeight,false);
        sun.shadow.mapSize.set(1024,1024); sun.shadow.map?.dispose(); sun.shadow.map=null; tape.iter=9; } fpsAcc=0; fpsN=0; } }
    requestAnimationFrame(frame);
  }

  addEventListener('resize',()=>{ applyFov(); renderer.setSize(innerWidth,innerHeight,false);
    if(!cam.moving){ const v=viewFor(cam.view); cam.pos.copy(v.pos); cam.look.copy(v.look); } });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden && drag){ endDrag(); } });

  /* ───────────────────────── start ───────────────────────── */
  drawLabel();
  cassette.position.copy(CAS_REST.pos); cassette.rotation.y=CAS_REST.rot;
  applyFov();
  requestAnimationFrame(frame);
  $('#loading').classList.add('gone'); setTimeout(()=>$('#loading').remove(),700);
  S.state='idle'; renderUI();
  goView('intro',2.2);
}
