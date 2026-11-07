import * as THREE from 'three';
import { canvasPlane, COLORS } from './ui.js';

const S = 512; // image canvas resolution
const IMG = 0.5; // image size in metres

export class Viewport {
  constructor(app, name) {
    this.app = app; this.name = name;
    this.group = new THREE.Group();
    this.study = null;
    this.measures = []; // {slice, a:{x,y}, b:{x,y}, mm}
    this.live = null;
    this.active = new Map(); // pointer -> start state (for two-hand zoom)

    // frame
    this.frameMat = new THREE.MeshBasicMaterial({ color: 0x1a2533 });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(IMG + 0.03, IMG + 0.1), this.frameMat);
    frame.position.set(0, 0.025, -0.002);
    this.group.add(frame);

    // image
    const img = canvasPlane(IMG, IMG, S / IMG);
    img.canvas.width = S; img.canvas.height = S;
    img.tex.colorSpace = THREE.SRGBColorSpace;
    Object.assign(this, { canvas: img.canvas, ctx: img.ctx, tex: img.tex, imageMesh: img.mesh });
    this.imageMesh.userData.target = this.imageTarget();
    this.group.add(this.imageMesh);

    // header (drag handle)
    const hd = canvasPlane(IMG + 0.03, 0.05, 1400);
    Object.assign(this, { hdCanvas: hd.canvas, hdCtx: hd.ctx, hdTex: hd.tex, header: hd.mesh });
    this.header.position.set(0, IMG / 2 + 0.035, 0);
    this.header.userData.target = this.headerTarget();
    this.group.add(this.header);

    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.drawHeader();
  }

  setStudy(study) {
    this.study = study;
    this.off.width = study.nx; this.off.height = study.ny;
    this.imgData = this.offCtx.createImageData(study.nx, study.ny);
    this.slice = Math.min(study.nz - 1, study.keySlice ?? Math.floor(study.nz / 2));
    this.ww = study.wl.ww; this.wl = study.wl.wl;
    this.zoom = 1; this.panX = 0; this.panY = 0;
    this.measures = []; this.live = null;
    this.drawHeader();
    this.render(true);
  }

  reset() { if (this.study) { const m = this.measures; this.setStudy(this.study); this.measures = m; this.render(true); } }

  setSlice(s) {
    if (!this.study) return;
    const ns = Math.max(0, Math.min(this.study.nz - 1, Math.round(s)));
    if (ns !== this.slice) { this.slice = ns; this.render(true); this.app.onSliceChanged(this); }
  }

  setFocused(f) { this.frameMat.color.set(f ? 0x1f7ae0 : 0x1a2533); this.focused = f; this.drawHeader(); }

  drawHeader() {
    const c = this.hdCanvas, ctx = this.hdCtx;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = this.focused ? '#1f4f8a' : '#1a2533';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 ${Math.round(c.height * 0.42)}px sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(`${this.name}${this.study ? '  ·  ' + this.study.label : ''}`, c.height * 0.4, c.height / 2);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.dim;
    ctx.font = `${Math.round(c.height * 0.3)}px sans-serif`;
    ctx.fillText('pinch bar to move', c.width - c.height * 0.4, c.height / 2);
    this.hdTex.needsUpdate = true;
  }

  // canvas pixel -> image pixel
  uvToImage(uv) {
    const st = this.study;
    const scale = (S / st.nx) * this.zoom;
    const cx = st.nx / 2 + this.panX, cy = st.ny / 2 + this.panY;
    const px = uv.x * S, py = (1 - uv.y) * S;
    return { x: (px - S / 2) / scale + cx, y: (py - S / 2) / scale + cy };
  }
  imageToCanvas(p) {
    const st = this.study;
    const scale = (S / st.nx) * this.zoom;
    const cx = st.nx / 2 + this.panX, cy = st.ny / 2 + this.panY;
    return { x: (p.x - cx) * scale + S / 2, y: (p.y - cy) * scale + S / 2 };
  }
  huAt(p) {
    const st = this.study;
    const i = Math.floor(p.x), j = Math.floor(p.y);
    if (i < 0 || j < 0 || i >= st.nx || j >= st.ny) return null;
    return st.data[(this.slice * st.ny + j) * st.nx + i];
  }

  render(sliceChanged = false) {
    const st = this.study, ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    if (!st) {
      ctx.fillStyle = COLORS.dim; ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Empty viewport', S / 2, S / 2 - 14);
      ctx.fillText('Pick a study from the worklist', S / 2, S / 2 + 22);
      this.tex.needsUpdate = true; return;
    }
    // window/level -> grey
    const n = st.nx * st.ny, off = this.slice * n, d = this.imgData.data;
    const lo = this.wl - this.ww / 2, k = 255 / Math.max(1, this.ww);
    for (let i = 0; i < n; i++) {
      let g = (st.data[off + i] - lo) * k;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      const q = i * 4; d[q] = d[q + 1] = d[q + 2] = g; d[q + 3] = 255;
    }
    this.offCtx.putImageData(this.imgData, 0, 0);
    const scale = (S / st.nx) * this.zoom;
    const cx = st.nx / 2 + this.panX, cy = st.ny / 2 + this.panY;
    ctx.imageSmoothingEnabled = true;
    ctx.setTransform(scale, 0, 0, scale, S / 2 - cx * scale, S / 2 - cy * scale);
    ctx.drawImage(this.off, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // measurements
    const list = this.measures.filter((m) => m.slice === this.slice);
    if (this.live) list.push(this.live);
    for (const m of list) {
      const a = this.imageToCanvas(m.a), b = this.imageToCanvas(m.b);
      ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.font = '600 24px sans-serif'; ctx.fillStyle = COLORS.accent; ctx.textAlign = 'left';
      ctx.fillText(`${m.mm.toFixed(1)} mm`, Math.max(a.x, b.x) + 10, (a.y + b.y) / 2);
    }

    // overlays
    ctx.font = '19px monospace'; ctx.fillStyle = '#d8e4f0'; ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`${st.modality} ${st.body}`, 10, 8);
    ctx.fillText(st.date, 10, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`Im ${this.slice + 1}/${st.nz}`, S - 10, 8);
    ctx.fillText(`Z ${(this.slice * st.st).toFixed(0)} mm`, S - 10, 30);
    ctx.textBaseline = 'bottom';
    ctx.fillText(`x${this.zoom.toFixed(2)}`, S - 10, S - 8);
    ctx.textAlign = 'left';
    ctx.fillText(`W ${Math.round(this.ww)}  L ${Math.round(this.wl)}`, 10, S - 8);
    if (this.probe) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillText(`HU ${this.probe}`, 10, S - 30);
    }
    ctx.fillStyle = '#9fb2c8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 20px sans-serif';
    ctx.fillText('R', 14, S / 2); ctx.fillText('L', S - 14, S / 2);
    ctx.fillText('A', S / 2, 14);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#ff8a7a';
    ctx.fillText('SYNTHETIC PHANTOM · NOT PATIENT DATA', S / 2, S - 14);
    // slice scrollbar
    const sh = (S - 80) / st.nz;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(S - 6, 40, 4, S - 80);
    ctx.fillStyle = '#7fb6ff'; ctx.fillRect(S - 7, 40 + this.slice * sh, 6, Math.max(4, sh));
    this.tex.needsUpdate = true;
  }

  // ------------------------------------------------------------ targets
  imageTarget() {
    const vp = this;
    return {
      onHover() {},
      onWheel(dy) { vp.app.focus(vp); vp.setSlice(vp.slice + dy); },
      onDown(hit, p) {
        vp.app.focus(vp);
        if (!vp.study) return;
        const uv = hit.uv || new THREE.Vector2(0.5, 0.5);
        vp.active.set(p, { uv: uv.clone(), slice: vp.slice, ww: vp.ww, wl: vp.wl, zoom: vp.zoom, panX: vp.panX, panY: vp.panY });
        if (vp.active.size === 2) {
          const [a, b] = [...vp.active.values()];
          vp.pinch = { d0: Math.max(0.02, a.uv.distanceTo(b.uv)), zoom0: vp.zoom };
          vp.live = null;
          return;
        }
        const tool = vp.app.tool;
        if (tool === 'measure') {
          const pt = vp.uvToImage(uv);
          vp.live = { slice: vp.slice, a: pt, b: { ...pt }, mm: 0 };
          vp.render();
        } else if (tool === 'probe') {
          vp.probe = vp.huAt(vp.uvToImage(uv)); vp.render();
        }
      },
      onDrag(hit, p) {
        const s = vp.active.get(p);
        if (!s || !vp.study) return;
        s.cur = hit.uv.clone();
        if (vp.active.size === 2 && vp.pinch) {
          const [a, b] = [...vp.active.values()];
          const d = (a.cur || a.uv).distanceTo(b.cur || b.uv);
          vp.zoom = Math.max(0.5, Math.min(8, vp.pinch.zoom0 * d / vp.pinch.d0));
          vp.render(); return;
        }
        const du = hit.uv.x - s.uv.x, dv = hit.uv.y - s.uv.y;
        const st = vp.study;
        switch (vp.app.tool) {
          case 'scroll': vp.setSlice(s.slice - dv * st.nz * 1.4); break;
          case 'wl':
            vp.ww = Math.max(2, s.ww * Math.exp(du * 2.5));
            vp.wl = s.wl + dv * s.ww * 1.2;
            vp.render(); vp.app.onWLChanged(vp); break;
          case 'zoom': vp.zoom = Math.max(0.5, Math.min(8, s.zoom * Math.exp(dv * 2.5))); vp.render(); break;
          case 'pan':
            vp.panX = s.panX - du * st.nx / vp.zoom; vp.panY = s.panY + dv * st.ny / vp.zoom; vp.render(); break;
          case 'measure': {
            const b = vp.uvToImage(hit.uv);
            vp.live.b = b;
            vp.live.mm = Math.hypot(b.x - vp.live.a.x, b.y - vp.live.a.y) * st.ps;
            vp.render(); break;
          }
          case 'probe': vp.probe = vp.huAt(vp.uvToImage(hit.uv)); vp.render(); break;
        }
      },
      onUp(p) {
        vp.active.delete(p);
        if (vp.active.size < 2) vp.pinch = null;
        if (vp.live) {
          if (vp.live.mm > 1.5) { vp.measures.push(vp.live); vp.app.onMeasure(vp, vp.live); }
          vp.live = null; vp.render();
        }
      },
    };
  }

  headerTarget() {
    const vp = this;
    const t = {
      freeDrag: true,
      onHover() {},
      onDown(hit, p) {
        vp.app.focus(vp);
        if (!p) return;
        t.dist = hit.point.distanceTo(p.origin);
        t.offset = vp.group.position.clone().sub(hit.point);
      },
      onDrag(_h, p) {
        const target = p.origin.clone().add(p.dir.clone().multiplyScalar(t.dist)).add(t.offset);
        vp.group.position.lerp(target, 0.6);
        const cam = new THREE.Vector3();
        vp.app.camera.getWorldPosition(cam);
        cam.y = vp.group.position.y;
        vp.group.lookAt(cam);
      },
    };
    return t;
  }
}
