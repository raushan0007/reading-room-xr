import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildStudies, PRESETS } from './phantoms.js';
import { Button, TextCard } from './ui.js';
import { Viewport } from './viewport.js';
import { InputManager } from './input.js';

// ------------------------------------------------------------------ setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local'); // origin = seated head position: fast cold start, no room setup
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking'] }));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b10);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
camera.position.set(0, 0, 0);
camera.rotation.set(-0.22, 0, 0, 'YXZ'); // desktop: look slightly down so the toolbar is visible
scene.add(camera);

// soft reading-room environment: dim dome + floor ring
{
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(12, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x0b1118, side: THREE.BackSide })
  );
  scene.add(dome);
  const floor = new THREE.Mesh(new THREE.RingGeometry(0.6, 3.2, 64), new THREE.MeshBasicMaterial({ color: 0x0f1822 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.15;
  scene.add(floor);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.03, 0.5), new THREE.MeshBasicMaterial({ color: 0x18222e }));
  desk.position.set(0, -0.48, -0.55);
  scene.add(desk);
}

const input = new InputManager(renderer, camera, scene);
const studies = buildStudies();

// ------------------------------------------------------------------ app state
const app = {
  camera,
  tool: 'scroll',
  sync: true,
  focused: null,
  viewports: [],
  focus(vp) {
    if (this.focused === vp) return;
    this.focused && this.focused.setFocused(false);
    this.focused = vp; vp.setFocused(true);
  },
  onSliceChanged(vp) {
    if (!this.sync || this._syncing) return;
    this._syncing = true;
    for (const o of this.viewports) {
      if (o !== vp && o.study && vp.study && o.study.group === vp.study.group) o.setSlice(vp.slice);
    }
    this._syncing = false;
  },
  onWLChanged() {},
  onMeasure(vp, m) {
    report.push(`• ${vp.study.label} (${vp.study.date}) · Im ${m.slice + 1}: ${m.mm.toFixed(1)} mm`);
    updateReport();
  },
};

// ------------------------------------------------------------------ layout helpers
function placeOnArc(obj, angleDeg, radius, y) {
  const a = THREE.MathUtils.degToRad(angleDeg);
  obj.position.set(Math.sin(a) * radius, y, -Math.cos(a) * radius);
  obj.lookAt(0, y, 0);
}

// three viewports in an arc
const vpNames = ['VIEWPORT 1', 'VIEWPORT 2', 'VIEWPORT 3'];
[-34, 0, 34].forEach((ang, i) => {
  const vp = new Viewport(app, vpNames[i]);
  placeOnArc(vp.group, ang, 1.05, 0.02);
  scene.add(vp.group);
  input.add(vp.imageMesh); input.add(vp.header);
  app.viewports.push(vp);
});
app.viewports[0].setStudy(studies[1]); // prior
app.viewports[1].setStudy(studies[0]); // current
app.viewports[2].setStudy(studies[2]); // head
app.focus(app.viewports[1]);

// ------------------------------------------------------------------ toolbar (within arm's reach, tilted up)
const toolbar = new THREE.Group();
toolbar.position.set(0, -0.36, -0.5);
toolbar.rotation.x = -0.75;
scene.add(toolbar);

const toolDefs = [
  ['scroll', 'Scroll', 'slices'],
  ['wl', 'W / L', 'contrast'],
  ['zoom', 'Zoom', 'drag up/down'],
  ['pan', 'Pan', 'move image'],
  ['measure', 'Measure', 'ruler mm'],
  ['probe', 'HU', 'density'],
];
const toolButtons = {};
toolDefs.forEach(([id, label, sub], i) => {
  const b = new Button({ w: 0.085, h: 0.05, label, sub, onClick: () => setTool(id) });
  b.mesh.position.set(-0.225 + i * 0.09, 0.03, 0);
  toolbar.add(b.mesh); input.add(b.mesh);
  toolButtons[id] = b;
});
function setTool(id) {
  app.tool = id;
  for (const [k, b] of Object.entries(toolButtons)) b.setActive(k === id);
}
setTool('scroll');

Object.keys(PRESETS).forEach((name, i) => {
  const b = new Button({
    w: 0.085, h: 0.04, label: name,
    onClick: () => {
      const vp = app.focused; if (!vp || !vp.study) return;
      vp.ww = PRESETS[name].ww; vp.wl = PRESETS[name].wl; vp.render();
    },
  });
  b.mesh.position.set(-0.225 + i * 0.09, -0.02, 0);
  toolbar.add(b.mesh); input.add(b.mesh);
});
const syncBtn = new Button({
  w: 0.085, h: 0.04, label: 'Sync ON',
  onClick: () => { app.sync = !app.sync; syncBtn.setLabel(app.sync ? 'Sync ON' : 'Sync OFF'); syncBtn.setActive(app.sync); },
});
syncBtn.setActive(true);
syncBtn.mesh.position.set(-0.225 + 5 * 0.09, -0.02, 0);
toolbar.add(syncBtn.mesh); input.add(syncBtn.mesh);

const resetBtn = new Button({ w: 0.085, h: 0.035, label: 'Reset view', onClick: () => app.focused && app.focused.reset() });
resetBtn.mesh.position.set(-0.18, -0.064, 0);
const helpBtn = new Button({ w: 0.085, h: 0.035, label: 'Help', onClick: () => { help.mesh.visible = !help.mesh.visible; } });
helpBtn.mesh.position.set(0.18, -0.064, 0);
const layoutBtn = new Button({ w: 0.17, h: 0.035, label: 'Bring panels back', onClick: () => resetLayout() });
layoutBtn.mesh.position.set(0, -0.064, 0);
for (const b of [resetBtn, helpBtn, layoutBtn]) { toolbar.add(b.mesh); input.add(b.mesh); }

function resetLayout() {
  [-34, 0, 34].forEach((ang, i) => placeOnArc(app.viewports[i].group, ang, 1.05, 0.02));
}

// ------------------------------------------------------------------ worklist (left)
const worklist = new THREE.Group();
placeOnArc(worklist, -66, 0.95, -0.02);
scene.add(worklist);
const wlCard = new TextCard({ w: 0.32, h: 0.42, title: 'Worklist', lines: ['Pinch a study to load it into the focused (blue) viewport.'] });
worklist.add(wlCard.mesh);
studies.forEach((s, i) => {
  const b = new Button({
    w: 0.28, h: 0.07, label: s.label, sub: `${s.date} · ${s.nz} images`,
    onClick: () => { if (app.focused) { app.focused.setStudy(s); } },
  });
  b.mesh.position.set(0, 0.06 - i * 0.085, 0.003);
  worklist.add(b.mesh); input.add(b.mesh);
});

// ------------------------------------------------------------------ report (right)
const reportGroup = new THREE.Group();
placeOnArc(reportGroup, 66, 0.95, -0.02);
scene.add(reportGroup);
const report = [];
const reportCard = new TextCard({ w: 0.32, h: 0.42, title: 'Measurements', lines: [] });
reportGroup.add(reportCard.mesh);
const clearBtn = new Button({
  w: 0.12, h: 0.04, label: 'Clear',
  onClick: () => { report.length = 0; app.viewports.forEach((v) => { v.measures = []; v.render(); }); updateReport(); },
});
clearBtn.mesh.position.set(0, -0.17, 0.003);
reportGroup.add(clearBtn.mesh); input.add(clearBtn.mesh);
function updateReport() {
  const lines = report.length ? report.slice(-9) : ['Use the Measure tool: pinch and drag across a finding.', 'Tip: compare the nodule on PRIOR vs CURRENT.'];
  reportCard.setLines(lines);
}
updateReport();

// ------------------------------------------------------------------ help card (front, dismissable)
const help = new TextCard({
  w: 0.5, h: 0.42, title: 'Reading Room XR · hands only',
  lines: [
    '• Point and PINCH (thumb + index) to press buttons, or just tap them with your finger.',
    '• Pinch on an image and drag to use the selected tool.',
    '• Pinch with BOTH hands on an image and spread to zoom.',
    '• Pinch a panel title bar to move the panel.',
    'Try: find the right-lung nodule, Measure it on CURRENT and PRIOR (Sync keeps them on the same slice).',
  ],
});
help.mesh.position.set(0, 0.03, -0.75);
scene.add(help.mesh);
const helpClose = new Button({ w: 0.12, h: 0.04, label: 'Got it', onClick: () => { help.mesh.visible = false; } });
helpClose.mesh.position.set(0, -0.175, 0.004);
help.mesh.add(helpClose.mesh); input.add(helpClose.mesh);

// ------------------------------------------------------------------ keyboard (desktop testing)
window.addEventListener('keydown', (e) => {
  const vp = app.focused;
  if (!vp) return;
  if (e.key === 'ArrowUp') vp.setSlice(vp.slice - 1);
  if (e.key === 'ArrowDown') vp.setSlice(vp.slice + 1);
  const map = { 1: 'scroll', 2: 'wl', 3: 'zoom', 4: 'pan', 5: 'measure', 6: 'probe' };
  if (map[e.key]) setTool(map[e.key]);
});

// ------------------------------------------------------------------ loop
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  input.update();
  renderer.render(scene, camera);
});

window.__app = app; // for automated smoke tests
