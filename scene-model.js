import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';

/* =================================================================
   Container-viewer op basis van het geëxporteerde SketchUp-model
   (Collada: model.dae — op scene-niveau in meters, Y-up).
   - centreert op de grond (x/z gecentreerd, vloer op y=0)
   - verbergt de reefer-machinekant (cool_engine) en zet daar
     onze back-unit (uit tekening 00095800-R00) op de kopwand
   - OrbitControls + auto-rotate; reveal-animatie volgt
   ================================================================= */

const MODEL_URL = 'model.dae';

const canvas = document.getElementById('scene3d-canvas');
const track = document.getElementById('scene3d-track');
const labelWrap = document.getElementById('scene3d-labels');
const progressBar = document.querySelector('.scene3d-progress i');
if (canvas) init();

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function matName(o) {
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return (m && m.name) || '';
}

/* ---- back-unit uit tekening 00095800-R00 (mm → m) ----
   Eén witte kopplaat die de hele machineopening vult (PLATE_W × PLATE_H),
   hoofddiepte 450, dieper basisdeel ~816. Rechthoekige openingen op de
   tekening-coördinaten (DW×DH), verticaal verschoven zodat ze op de oude
   bay vallen. Ø530-ventilatorgat in de ONDERKANT (ventilator volgt later). */
const PLATE_W = 2.10, PLATE_H = 2.63;   // vult de kopopening (één schone plaat)
const DW = 2.0255, DH = 2.2352;         // tekening-kopplaat → referentie voor de openingen
const DEPTH = 0.45, BASE_D = 0.816, BASE_H = 0.24;
function buildBackUnit(bayOffsetY) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f2f3, roughness: 0.62, metalness: 0.08 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e32, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide });
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.5 });

  // vullende witte kopplaat + kastlichaam, dieper basisdeel onderin
  g.add(new THREE.Mesh(new THREE.BoxGeometry(PLATE_W, PLATE_H, DEPTH), white));
  const base = new THREE.Mesh(new THREE.BoxGeometry(PLATE_W * 0.97, BASE_H, BASE_D), white);
  base.position.set(0, -PLATE_H / 2 + BASE_H / 2, DEPTH / 2 - BASE_D / 2);
  g.add(base);

  const fz = DEPTH / 2 + 0.002;
  const px = (xmm) => (xmm - DW * 1000 / 2) / 1000;                 // x vanaf links → lokaal
  const py = (ymm) => bayOffsetY + (DH * 1000 / 2 - ymm) / 1000;    // y vanaf boven → lokaal, op de bay

  // rechthoekige openingen [x_links, y_boven, breedte, hoogte] in mm (uit de tekening)
  const OPEN = [
    [1297, 425, 130, 55], [535, 480, 135, 117], [672, 480, 41, 407], [713, 480, 135, 117],
    [267, 1150, 410, 500], [1128, 1131, 196, 400], [361, 1660, 250, 110], [267, 1905, 400, 85],
  ];
  for (const [x, y, w, h] of OPEN) {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w / 1000, h / 1000), dark);
    o.position.set(px(x + w / 2), py(y + h / 2), fz);
    g.add(o);
  }

  // Ø70 inlaat op het voorvlak (bovenin)
  const inlet = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), dark);
  inlet.position.set(px(1128), py(120), fz); g.add(inlet);

  // Ø530 ventilatorgat in de onderkant + Ø30 wartel (kijken omlaag)
  const fanHole = new THREE.Mesh(new THREE.CircleGeometry(0.265, 48), dark);
  fanHole.rotation.x = -Math.PI / 2; fanHole.position.set(px(900), -PLATE_H / 2 + 0.003, DEPTH / 2 - 0.45); g.add(fanHole);
  const gland = new THREE.Mesh(new THREE.CircleGeometry(0.015, 18), dark);
  gland.rotation.x = -Math.PI / 2; gland.position.set(px(619), -PLATE_H / 2 + 0.003, DEPTH / 2 - 0.62); g.add(gland);

  // boutrand langs de kopplaat
  const boltGeo = new THREE.SphereGeometry(0.012, 8, 8), rim = 0.05, nx = 10, ny = 12;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (i > 0 && i < nx - 1 && j > 0 && j < ny - 1) continue;
    const b = new THREE.Mesh(boltGeo, boltMat);
    b.position.set(-PLATE_W / 2 + rim + i * (PLATE_W - 2 * rim) / (nx - 1), -PLATE_H / 2 + rim + j * (PLATE_H - 2 * rim) / (ny - 1), fz);
    g.add(b);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function init() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
  camera.position.set(12, 8, 14);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false; controls.enablePan = false;
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = Math.PI / 2 - 0.02;
  if (coarse) { controls.enableRotate = false; controls.autoRotate = true; controls.autoRotateSpeed = 0.5; }
  else if (!prefersReduced) { controls.autoRotate = true; controls.autoRotateSpeed = 0.3; }

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f7a, 0.75));
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xfff4e0, 1.1);
  key.position.set(10, 18, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.near = 1; sc.far = 90; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20;
  key.shadow.bias = -0.0004; scene.add(key);
  const fill = new THREE.DirectionalLight(0xe6eef4, 0.6); fill.position.set(-10, 10, -12); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff2df, 0.5); rim.position.set(-6, 6, -14); scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; ground.receiveShadow = true; scene.add(ground);

  function showMsg(text) {
    if (!labelWrap) return;
    let m = labelWrap.querySelector('.glb-msg');
    if (!m) { m = document.createElement('div'); m.className = 'lab glb-msg'; labelWrap.appendChild(m); }
    m.textContent = text; m.style.left = '50%'; m.style.top = '50%'; m.style.opacity = '1';
  }

  let revealTick = null; // wordt gezet zodra het model geladen is
  let camBaseDist = 0, camExplodeAmt = 0; // camera trekt alleen tijdens de explode terug
  const _camOff = new THREE.Vector3();
  const loader = new ColladaLoader();
  showMsg('Model laden…');
  loader.load(
    MODEL_URL,
    (collada) => {
      const model = collada.scene;
      model.updateMatrixWorld(true);

      // materialen: dubbelzijdig (SketchUp-vlakken enkelzijdig)
      const engineMeshes = [];
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m) { m.side = THREE.DoubleSide; if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; } });
        if (matName(o).startsWith('cool_engine')) engineMeshes.push(o);
      });

      // centreren op x/z, vloer op y=0
      let box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.x -= center.x; model.position.z -= center.z;
      scene.add(model);
      model.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(model);
      model.position.y -= box.min.y;
      model.updateMatrixWorld(true);

      // machinekant (cool_engine) bepalen → de nieuwe kast komt hier exact overheen
      const halfLen = size.z / 2;
      const eb = new THREE.Box3();
      let machineSign = -1;
      if (engineMeshes.length) {
        engineMeshes.forEach((m) => eb.expandByObject(m));
        machineSign = eb.getCenter(new THREE.Vector3()).z < 0 ? -1 : 1;
      } else {
        eb.set(new THREE.Vector3(-PLATE_W / 2, 0.12, machineSign * halfLen - DEPTH),
               new THREE.Vector3(PLATE_W / 2, 0.12 + PLATE_H, machineSign * halfLen));
      }
      const eCenter = eb.getCenter(new THREE.Vector3());
      const eSize = eb.getSize(new THREE.Vector3());
      const outerZ = machineSign > 0 ? eb.max.z : eb.min.z;
      console.log('[bay] center', eCenter.x.toFixed(2), eCenter.y.toFixed(2), eCenter.z.toFixed(2),
        '| size', eSize.x.toFixed(2), eSize.y.toFixed(2), eSize.z.toFixed(2),
        '| halfLen', halfLen.toFixed(2), '| outerZ', outerZ.toFixed(2));

      // reefer-machinekant verbergen — de nieuwe kast vervangt deze.
      // Per MESH (niet per node: nodes bevatten ook wanden/dak). Alleen platte
      // panelen/behuizing/roosters op de kop; frame blijft (stijlen, rails, hoekstukken).
      engineMeshes.forEach((m) => { m.visible = false; });
      const _b = new THREE.Box3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();
      model.traverse((o) => {
        if ((!o.isMesh && !o.isLine) || !o.visible) return;                  // ook edge-lines
        _b.setFromObject(o); _b.getCenter(_c); _b.getSize(_s);
        if (_c.z > -5.05) return;                                            // alleen de machinekant
        if (_s.y > 1.8 && _s.x < 0.5) return;                               // alleen smalle hoekstijlen behouden; brede kopwandpanelen weg
        if (Math.max(_s.x, _s.y, _s.z) < 0.22 && matName(o) !== 'detail'
          && Math.abs(_c.x) > 0.9 && (_c.y < 0.35 || _c.y > 2.5)) return;    // alleen échte hoekstukken behouden
        if (_s.x > 1.5 && _s.y < 0.16) return;                              // boven-/onderrail behouden
        o.visible = false;                                                   // rest = oude machine
      });

      // back-unit = één witte plaat die de kopopening vult; midden op de opening,
      // openingen verticaal verschoven zodat ze op de oude bay vallen.
      const OPENING_CY = 1.45;
      const back = buildBackUnit(eCenter.y - OPENING_CY);
      back.position.set(eCenter.x, OPENING_CY, outerZ - machineSign * DEPTH / 2);
      if (machineSign < 0) back.rotation.y = Math.PI;
      scene.add(back);
      back.updateMatrixWorld(true);

      // --- interieur: compostmassa met golvende, ruwe bovenkant (tot tegen de kast) ---
      const compostFar = -machineSign * (halfLen - 0.2);           // bij de deuren
      const compostNear = machineSign * (halfLen - DEPTH - 0.02);  // tot tegen de witte kast
      const compostLen = Math.abs(compostFar - compostNear), cH = 2.3;
      const compostCz = (compostFar + compostNear) / 2;
      const cg = new THREE.BoxGeometry(2.16, cH, compostLen, 22, 1, 130);
      const cp = cg.attributes.position;
      for (let i = 0; i < cp.count; i++) {
        if (cp.getY(i) > cH / 2 - 0.01) { // alleen het bovenvlak vervormen
          const x = cp.getX(i), z = cp.getZ(i);
          const bump = Math.sin(x * 2.3) * 0.05 + Math.sin(z * 0.8 + 1.3) * 0.10
            + Math.sin(z * 3.1 + x) * 0.035 + Math.sin(x * 5.0 + z * 2.0) * 0.02; // alles vloeiend, geen scherpe facetjes
          cp.setY(i, cp.getY(i) - 0.12 + bump); // gemiddeld iets lager + hobbelig
        }
      }
      cg.computeVertexNormals();
      // procedurele compost-textuur (gemêleerd bruin met korrels/strootjes) — textuur zonder scherpe facetjes
      const ctex = (() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#4f3f27'; ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 5000; i++) {
          const x = Math.random() * 256, y = Math.random() * 256, r = Math.random() * 2.4 + 0.4, s = Math.random();
          ctx.fillStyle = s < 0.55 ? `rgba(32,22,11,${0.2 + Math.random() * 0.4})`
            : s < 0.9 ? `rgba(98,76,44,${0.12 + Math.random() * 0.28})`
            : `rgba(126,104,62,${0.1 + Math.random() * 0.16})`;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        const t = new THREE.CanvasTexture(cv);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 14); t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })();
      const compost = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({
        map: ctex, color: 0xffffff, roughness: 1, metalness: 0,
      }));
      compost.position.set(0, 0.16 + cH / 2, compostCz);
      compost.receiveShadow = true;
      scene.add(compost);

      // schone groene onderplaat (vloerrand) — blijft staan en dekt de vloerbalkjes af,
      // zodat bij het opengaan geen 'tandjes'/kier onder de zijwand zichtbaar worden
      const floorSlab = new THREE.Mesh(
        new THREE.BoxGeometry(size.x - 0.04, 0.17, compostLen + 0.1),
        new THREE.MeshStandardMaterial({ color: 0x3f8f34, roughness: 0.4, metalness: 0.12 })
      );
      floorSlab.position.set(0, 0.085, compostCz);
      floorSlab.castShadow = true; floorSlab.receiveShadow = true;
      scene.add(floorSlab);

      // --- container groen kleuren; edge-lines weg (schoner + geen witte lijnen in de compost) ---
      const GREEN = new THREE.Color(0x3f8f34);
      const shellMats = new Set();
      model.traverse((o) => {
        if ((!o.isMesh && !o.isLine) || !o.visible) return;
        if (o.isLine) { o.visible = false; return; } // SketchUp-randlijnen verbergen
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        o.renderOrder = 1; // schil ná de compost renderen → compost altijd zichtbaar
        mats.forEach((mm) => {
          if (!mm) return;
          if (!mm.__done) {
            mm.__done = true;
            const nm = mm.name || '';
            if (nm.startsWith('reefer_base') || nm === 'rubber' || nm.startsWith('std_base')) {
              mm.color && mm.color.copy(GREEN);
              if ('roughness' in mm) { mm.roughness = 0.32; mm.metalness = 0.15; }
              if ('shininess' in mm) { mm.shininess = 70; mm.specular && mm.specular.setHex(0x1c1c1c); }
            }
          }
          mm.transparent = true;
          shellMats.add(mm);
        });
      });

      // --- container opdelen voor de explode (dak/links/rechts/deuren) ---
      const explode = {
        roof:  { g: new THREE.Group(), dir: new THREE.Vector3(0, 1, 0),  mag: 2.0 },
        left:  { g: new THREE.Group(), dir: new THREE.Vector3(-1, 0, 0), mag: 2.2 },
        right: { g: new THREE.Group(), dir: new THREE.Vector3(1, 0, 0),  mag: 2.2 },
        doors: { g: new THREE.Group(), dir: new THREE.Vector3(0, 0, -machineSign), mag: 2.6 },
      };
      Object.values(explode).forEach((e) => scene.add(e.g));
      const toMove = [];
      model.traverse((o) => { if ((o.isMesh || o.isLine) && o.visible) toMove.push(o); });
      const _bb = new THREE.Box3(), _cc = new THREE.Vector3(), _s2 = new THREE.Vector3();
      // Deurkant EERST → alles aan die kant (panelen, sluitstangen, hendels,
      // grijze plaat, hoekstijlen) gaat als één geheel mee; dak/vloer-regels
      // kunnen geen losse deuronderdelen meer wegkapen.
      const doorZ = halfLen - 1.4; // alles voorbij deze z-grens hoort bij de deurkant
      const diag = new URLSearchParams(location.search).has('diag');
      for (const o of toMove) {
        _bb.setFromObject(o); _bb.getCenter(_cc); _bb.getSize(_s2);
        let key = null;
        if (_cc.y < 0.35 && _s2.x > 1.5) key = null;          // brede vloerbalken blijven altijd staan (niet met de deur mee)
        else if (-machineSign * _cc.z > doorZ) key = 'doors'; // hele deurkant als één geheel
        else if (_cc.y > 2.55) key = 'roof';                  // dak + bovenrand
        else if (_cc.y > 2.25 && Math.abs(_cc.x) < 0.85) key = 'roof'; // dwarsbalken/ribben onder het dak
        else if (_cc.y < 0.35) key = null;                    // vloer/onderrand blijft staan
        else if (_cc.x > 0.9) key = 'right';                  // rechterwand
        else if (_cc.x < -0.9) key = 'left';                  // linkerwand
        if (key === 'doors' && -machineSign * _cc.z < halfLen - 0.5 && Math.max(_s2.x, _s2.y, _s2.z) < 0.5) {
          o.visible = false; // twee bovenhoek-blokjes die ~1 m naar binnen staken en bij het openen leken te zweven → weg
          continue;
        }
        if (!key) continue;
        explode[key].g.attach(o);
        // deur gebruikt de gedeelde schil-materialen → vervaagt mét de wanden (zelfde glas-effect);
        // het beslag zit nu correct in de doors-groep en beweegt als één geheel mee.
        // beslag (stangen/hendels/plaat = 'detail') altijd als laatste tekenen → geen flikkerende
        // stangen door transparantie-sortering t.o.v. het deurpaneel.
        if (key === 'doors' && o.isMesh && matName(o) === 'detail') o.renderOrder = 4;
      }
      if (diag) { // outliers: stukken die ver van het zwaartepunt van hun groep liggen = visuele zwevers
        for (const k in explode) {
          const cs = [];
          explode[k].g.traverse((o) => { if (o.isMesh || o.isLine) cs.push(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())); });
          if (!cs.length) continue;
          const cen = new THREE.Vector3(); cs.forEach((c) => cen.add(c)); cen.multiplyScalar(1 / cs.length);
          explode[k].g.traverse((o) => {
            if (!(o.isMesh || o.isLine)) return;
            const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
            const d = c.distanceTo(cen);
            if (d > 2.0) {
              console.log('OUTLIER', k, '"' + matName(o) + '"', o.isLine ? 'L' : 'M', 'c', c.x.toFixed(2), c.y.toFixed(2), c.z.toFixed(2), 's', s.x.toFixed(2), s.y.toFixed(2), s.z.toFixed(2), 'd', d.toFixed(2));
              if (o.isMesh && new URLSearchParams(location.search).has('hl')) o.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            }
          });
        }
      }
      if (new URLSearchParams(location.search).has('groups')) { // debug: kleur elke explode-groep
        const tint = { roof: 0xff3030, left: 0x2f6bff, right: 0xff30e0, doors: 0xffd020 };
        for (const k in explode) explode[k].g.traverse((o) => {
          if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: tint[k] });
        });
      }
      const backBaseZ = back.position.z;

      // --- logo op de zijwanden ---
      new THREE.TextureLoader().load('assets/logo-white.png', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const aspect = (tex.image && tex.image.width / tex.image.height) || 4.18;
        const logoW = 5.4, logoH = logoW / aspect;
        const logoMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        shellMats.add(logoMat); // vervaagt mee tijdens de reveal
        for (const sx of [1, -1]) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(logoW, logoH), logoMat);
          p.position.set(sx * (size.x / 2 + 0.02), 1.5, 1.4);
          p.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
          p.renderOrder = 2;
          (sx > 0 ? explode.right : explode.left).g.add(p); // beweegt mee met de wand
        }
      });

      // --- labels ---
      const labelDefs = [
        { text: 'Compostmassa', pos: new THREE.Vector3(0, 1.6, 1.8) },
        { text: 'Back-unit — ventilator + warmtewisseling', pos: new THREE.Vector3(0, 1.5, machineSign * (halfLen - 0.1)) },
        { text: 'Warme lucht → warm water', pos: new THREE.Vector3(0.6, 2.4, machineSign * (halfLen - 1.8)) },
      ];
      const labels = labelDefs.map((d) => {
        const el = document.createElement('div'); el.className = 'lab'; el.textContent = d.text; el.style.opacity = '0';
        if (labelWrap) labelWrap.appendChild(el);
        return { el, pos: d.pos };
      });

      function setReveal(t) {
        const shellOp = 1 - 0.68 * smoothstep(0.05, 0.85, t); // schil vervaagt maar blijft zichtbaar tijdens explode
        const solid = t < 0.03; // dicht: schil schrijft diepte (echt solide); reveal: niet (compost altijd zichtbaar)
        shellMats.forEach((mm) => { mm.opacity = shellOp; mm.depthWrite = solid; });
        // explode: onderdelen trekken tegelijk met de transparantie uit elkaar
        const eAmt = smoothstep(0.05, 0.9, t);
        camExplodeAmt = eAmt;
        for (const k in explode) explode[k].g.position.copy(explode[k].dir).multiplyScalar(explode[k].mag * eAmt);
        back.position.z = backBaseZ + machineSign * 1.7 * eAmt; // witte kast schuift naar buiten
        if (progressBar) progressBar.style.width = (t * 100).toFixed(0) + '%';
      }
      const _v = new THREE.Vector3();
      function projectLabels(t) {
        const w = canvas.clientWidth, h = canvas.clientHeight, fade = smoothstep(0.2, 0.5, t);
        labels.forEach((L) => {
          _v.copy(L.pos).project(camera);
          if (_v.z > 1) { L.el.style.opacity = '0'; return; }
          L.el.style.left = (_v.x * 0.5 + 0.5) * w + 'px';
          L.el.style.top = (-_v.y * 0.5 + 0.5) * h + 'px';
          L.el.style.opacity = String(fade);
        });
      }
      const revParam = new URLSearchParams(location.search).get('rev');
      const revOverride = revParam !== null ? parseFloat(revParam) : null;
      function scrollProgress() {
        if (revOverride !== null) return revOverride;
        if (!track) return 0;
        const total = track.offsetHeight - window.innerHeight;
        if (total <= 0) return 0;
        return Math.min(1, Math.max(0, -track.getBoundingClientRect().top / total));
      }
      let tCur = 0;
      revealTick = () => {
        const target = scrollProgress();
        tCur = revOverride !== null ? target : tCur + (target - tCur) * 0.12;
        setReveal(tCur); projectLabels(tCur);
      };
      setReveal(0);

      // camera fit op alles
      box = new THREE.Box3().setFromObject(model); box.expandByObject(back);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      controls.target.copy(sphere.center);
      controls.target.y -= sphere.radius * 0.24; // model hoger in beeld → minder lege ruimte boven
      const fov = camera.fov * Math.PI / 180;
      camBaseDist = (sphere.radius / Math.sin(fov / 2)) * 0.9; // strak in rust; trekt terug bij explode
      const dir = new THREE.Vector3(0.95 * machineSign, 0.5, 1.3 * machineSign).normalize();
      camera.position.copy(sphere.center).add(dir.multiplyScalar(camBaseDist));
      const dist = camBaseDist;
      const qs = new URLSearchParams(location.search);
      if (qs.has('norot')) controls.autoRotate = false;
      if (qs.has('face')) { // recht vooraanzicht op de kopwand (debug)
        const fy = OPENING_CY;
        controls.target.set(0, fy, machineSign * halfLen);
        camera.position.set(0.01, fy, machineSign * (halfLen + 4.8));
        controls.autoRotate = false;
      }
      if (qs.has('door')) { // vanaf de deurkant (debug voor compost-zichtbaarheid)
        controls.target.copy(sphere.center);
        camera.position.set(sphere.center.x + 5, sphere.center.y + 3, -machineSign * (halfLen + 7));
        controls.autoRotate = false;
      }
      if (qs.has('top')) { // van bovenaf (debug voor zwevende stukken)
        controls.target.copy(sphere.center);
        camera.position.set(sphere.center.x - 3, sphere.center.y + 13, machineSign * 3);
        controls.autoRotate = false;
      }
      if (qs.has('doorout')) { // van buiten de deurkant, 3/4 (debug voor zwevers bij de deur)
        controls.target.set(0, 1.4, -machineSign * (halfLen + 1.5));
        camera.position.set(6.5, 2.4, -machineSign * (halfLen + 8));
        controls.autoRotate = false;
      }
      if (qs.has('sidebottom')) { // ingezoomd op de onderkant van de zijwand bij de machinekant (debug)
        controls.target.set(-1.1, 0.35, machineSign * 2.2);
        camera.position.set(-5.5, 1.1, machineSign * -0.5);
        controls.autoRotate = false;
      }
      if (qs.has('doorfront')) { // recht van voren op de deurkant (debug)
        controls.target.set(0, sphere.center.y, sphere.center.z);
        camera.position.set(0.01, sphere.center.y, -machineSign * (halfLen + 9));
        controls.autoRotate = false;
      }
      camera.near = Math.max(0.1, dist / 100); camera.far = dist * 12; camera.updateProjectionMatrix();

      window.__model = model; window.__back = back;
      console.log('[model] klaar. size', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2), '| machineSign', machineSign, '| engineMeshes', engineMeshes.length);

      const m = labelWrap && labelWrap.querySelector('.glb-msg'); if (m) m.remove();
    },
    (xhr) => { if (progressBar && xhr.total) progressBar.style.width = ((xhr.loaded / xhr.total) * 100).toFixed(0) + '%'; },
    (err) => { console.error('[model] laden mislukt:', err); showMsg('Model kon niet geladen worden (model.dae).'); }
  );

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
  }
  function animate() {
    resize();
    if (revealTick) revealTick();
    controls.update();
    if (camBaseDist) { // camera terugtrekken naarmate de container explodeert
      _camOff.copy(camera.position).sub(controls.target).setLength(camBaseDist * (1 + 0.62 * camExplodeAmt));
      camera.position.copy(controls.target).add(_camOff);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}
