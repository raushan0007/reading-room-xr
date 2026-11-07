import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

// Unified pointer input: mouse (desktop / emulator), XR hand pinch-rays, and finger poke.
// Targets are objects with any of: onHover(bool), onDown(hit, p), onDrag(hit, p), onUp(p), onWheel(dy, hit).
// A target with freeDrag=true gets onDrag(null, p) and reads the pointer ray itself.

const tmpM = new THREE.Matrix4();

class Pointer {
  constructor(name) {
    this.name = name;
    this.origin = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, -1);
    this.valid = false;
    this.pressed = false;
    this.hover = null; this.hoverHit = null;
    this.drag = null; this.dragMesh = null;
    this.plane = new THREE.Plane();
  }
}

export class InputManager {
  constructor(renderer, camera, scene) {
    this.renderer = renderer; this.camera = camera; this.scene = scene;
    this.meshes = [];
    this.raycaster = new THREE.Raycaster();
    this.pointers = [];
    this.lookYaw = 0; this.lookPitch = -0.22;
    this._setupMouse();
    this._setupXR();
  }

  add(mesh) { this.meshes.push(mesh); }

  _setupMouse() {
    const p = new Pointer('mouse');
    this.mouse = p;
    this.pointers.push(p);
    const ndc = new THREE.Vector2();
    let looking = false, lx = 0, ly = 0;
    const el = this.renderer.domElement;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      p.ndc = ndc; p.valid = true;
      if (looking) {
        this.lookYaw -= (e.clientX - lx) * 0.004; this.lookPitch -= (e.clientY - ly) * 0.004;
        this.lookPitch = Math.max(-1.2, Math.min(1.2, this.lookPitch));
        lx = e.clientX; ly = e.clientY;
        this.camera.rotation.set(this.lookPitch, this.lookYaw, 0, 'YXZ');
      }
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 2) { looking = true; lx = e.clientX; ly = e.clientY; return; }
      if (e.button === 0) { this._computeMouseRay(); this._down(p); el.setPointerCapture(e.pointerId); }
    });
    el.addEventListener('pointerup', (e) => {
      if (e.button === 2) { looking = false; return; }
      if (e.button === 0) this._up(p);
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._computeMouseRay();
      const hit = this._raycast(p);
      if (hit && hit.target.onWheel) hit.target.onWheel(Math.sign(e.deltaY), hit);
    }, { passive: false });
  }

  _computeMouseRay() {
    const p = this.mouse;
    if (!p.ndc || this.renderer.xr.isPresenting) { p.valid = false; return; }
    this.raycaster.setFromCamera(p.ndc, this.camera);
    p.origin.copy(this.raycaster.ray.origin);
    p.dir.copy(this.raycaster.ray.direction);
    p.valid = true;
  }

  _setupXR() {
    const xr = this.renderer.xr;
    const handFactory = new XRHandModelFactory();
    this.hands = [];
    for (let i = 0; i < 2; i++) {
      const ctrl = xr.getController(i);
      this.scene.add(ctrl);
      const p = new Pointer('xr' + i);
      p.ctrl = ctrl;
      // ray visual
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7fb6ff, transparent: true, opacity: 0.55 }));
      line.scale.z = 2;
      ctrl.add(line);
      p.line = line;
      const cursor = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      cursor.visible = false;
      this.scene.add(cursor);
      p.cursor = cursor;
      ctrl.addEventListener('connected', (e) => { p.source = e.data; });
      ctrl.addEventListener('disconnected', () => { p.source = null; p.valid = false; if (p.pressed) this._up(p); });
      ctrl.addEventListener('selectstart', () => this._down(p));
      ctrl.addEventListener('selectend', () => this._up(p));
      this.pointers.push(p);

      const hand = xr.getHand(i);
      hand.add(handFactory.createHandModel(hand, 'mesh'));
      this.scene.add(hand);
      this.hands.push({ hand, prevZ: new Map(), cooldown: 0 });

      // controller grip is optional; controllers still work via the same ray
    }
  }

  _raycast(p) {
    this.raycaster.ray.origin.copy(p.origin);
    this.raycaster.ray.direction.copy(p.dir);
    const vis = this.meshes.filter((m) => isVisible(m));
    const hits = this.raycaster.intersectObjects(vis, false);
    for (const h of hits) {
      const target = h.object.userData.target;
      if (target) return { target, mesh: h.object, point: h.point, uv: h.uv ? h.uv.clone() : null, distance: h.distance };
    }
    return null;
  }

  _down(p) {
    p.pressed = true;
    const hit = p.hover ? p.hoverHit : this._raycast(p);
    if (!hit) return;
    p.drag = hit.target; p.dragMesh = hit.mesh;
    const n = new THREE.Vector3(0, 0, 1).transformDirection(hit.mesh.matrixWorld);
    p.plane.setFromNormalAndCoplanarPoint(n, hit.point);
    hit.target.onDown && hit.target.onDown(hit, p);
  }

  _up(p) {
    p.pressed = false;
    if (p.drag && p.drag.onUp) p.drag.onUp(p);
    p.drag = null; p.dragMesh = null;
  }

  update() {
    const presenting = this.renderer.xr.isPresenting;
    if (!presenting) this._computeMouseRay(); else this.mouse.valid = false;

    for (const p of this.pointers) {
      if (p.ctrl) {
        // XR pointer: valid if controller/hand ray is tracked
        p.valid = presenting && p.ctrl.visible && !!p.source;
        if (p.valid) {
          p.ctrl.updateMatrixWorld();
          p.origin.setFromMatrixPosition(p.ctrl.matrixWorld);
          tmpM.extractRotation(p.ctrl.matrixWorld);
          p.dir.set(0, 0, -1).applyMatrix4(tmpM).normalize();
        }
        p.line.visible = p.valid;
        p.cursor.visible = false;
      }
      if (!p.valid) { this._setHover(p, null); continue; }

      if (p.drag) {
        if (p.drag.freeDrag) { p.drag.onDrag && p.drag.onDrag(null, p); continue; }
        const ray = new THREE.Ray(p.origin, p.dir);
        const pt = new THREE.Vector3();
        if (ray.intersectPlane(p.plane, pt)) {
          const local = p.dragMesh.worldToLocal(pt.clone());
          const [w, h] = p.dragMesh.userData.size || [1, 1];
          const uv = new THREE.Vector2(local.x / w + 0.5, local.y / h + 0.5);
          p.drag.onDrag && p.drag.onDrag({ point: pt, uv, mesh: p.dragMesh, target: p.drag }, p);
          if (p.cursor) { p.cursor.position.copy(pt); p.cursor.visible = true; p.line.scale.z = pt.distanceTo(p.origin); }
        }
        continue;
      }
      const hit = this._raycast(p);
      this._setHover(p, hit);
      if (p.cursor) {
        if (hit) { p.cursor.position.copy(hit.point); p.cursor.visible = true; p.line.scale.z = hit.distance; }
        else p.line.scale.z = 2;
      }
    }
    if (presenting) this._updatePoke();
  }

  _setHover(p, hit) {
    const t = hit ? hit.target : null;
    if (p.hover !== t) {
      if (p.hover && p.hover.onHover && !this.pointers.some((q) => q !== p && q.hover === p.hover)) p.hover.onHover(false);
      if (t && t.onHover) t.onHover(true);
      p.hover = t;
    }
    p.hoverHit = hit;
  }

  // Index-fingertip poke for buttons (direct touch).
  _updatePoke() {
    const now = performance.now();
    const v = new THREE.Vector3();
    for (const h of this.hands) {
      const tip = h.hand.joints && h.hand.joints['index-finger-tip'];
      if (!tip || !tip.visible) continue;
      tip.getWorldPosition(v);
      for (const m of this.meshes) {
        const t = m.userData.target;
        if (!t || !t.pokeable || !isVisible(m)) continue;
        const local = m.worldToLocal(v.clone());
        const [w, hh] = m.userData.size;
        const inside = Math.abs(local.x) < w / 2 && Math.abs(local.y) < hh / 2;
        const prev = h.prevZ.get(m);
        h.prevZ.set(m, local.z);
        if (inside && prev !== undefined && prev > 0.004 && local.z <= 0.004 && local.z > -0.04 && now > h.cooldown) {
          h.cooldown = now + 450;
          t.onDown && t.onDown({ target: t, mesh: m, point: v.clone() }, null);
        }
      }
    }
  }
}

function isVisible(o) {
  while (o) { if (!o.visible) return false; o = o.parent; }
  return true;
}
