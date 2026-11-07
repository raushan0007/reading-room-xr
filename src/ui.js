import * as THREE from 'three';

export const COLORS = {
  panel: '#121a24',
  panelEdge: '#2a3a4f',
  btn: '#1d2a3a',
  btnHover: '#2c4360',
  btnActive: '#1f7ae0',
  text: '#e6eef8',
  dim: '#8aa0b8',
  accent: '#ffd34d',
};

export function canvasPlane(wM, hM, pxPerM = 1000) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(8, Math.round(wM * pxPerM));
  canvas.height = Math.max(8, Math.round(hM * pxPerM));
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), mat);
  mesh.userData.size = [wM, hM];
  return { canvas, ctx, tex, mesh };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A pressable button. Works with pinch-ray, mouse, and finger poke.
export class Button {
  constructor({ w = 0.11, h = 0.05, label = '', onClick = null, sub = '' }) {
    this.w = w; this.h = h; this.label = label; this.sub = sub; this.onClick = onClick;
    Object.assign(this, canvasPlane(w, h, 1400));
    this.mesh.userData.target = this;
    this.pokeable = true;
    this.hover = false; this.active = false; this.flash = 0;
    this.draw();
  }
  draw() {
    const { ctx, canvas: c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    const pad = c.height * 0.06;
    roundRect(ctx, pad, pad, c.width - 2 * pad, c.height - 2 * pad, c.height * 0.22);
    ctx.fillStyle = this.active ? COLORS.btnActive : this.hover || this.flash > 0 ? COLORS.btnHover : COLORS.btn;
    ctx.fill();
    ctx.lineWidth = c.height * 0.05;
    ctx.strokeStyle = this.hover ? '#7fb6ff' : COLORS.panelEdge;
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.sub) {
      ctx.font = `600 ${Math.round(c.height * 0.34)}px sans-serif`;
      ctx.fillText(this.label, c.width / 2, c.height * 0.38);
      ctx.font = `${Math.round(c.height * 0.22)}px sans-serif`;
      ctx.fillStyle = COLORS.dim;
      ctx.fillText(this.sub, c.width / 2, c.height * 0.7);
    } else {
      ctx.font = `600 ${Math.round(c.height * 0.38)}px sans-serif`;
      ctx.fillText(this.label, c.width / 2, c.height / 2 + 1);
    }
    this.tex.needsUpdate = true;
  }
  setLabel(l) { this.label = l; this.draw(); }
  setActive(a) { if (a !== this.active) { this.active = a; this.draw(); } }
  onHover(h) { if (h !== this.hover) { this.hover = h; this.draw(); } }
  onDown() {
    this.flash = 1; this.draw();
    setTimeout(() => { this.flash = 0; this.draw(); }, 150);
    this.onClick && this.onClick(this);
  }
}

// A static text card (titles + lines).
export class TextCard {
  constructor({ w, h, title = '', lines = [], px = 1100 }) {
    this.w = w; this.h = h; this.title = title; this.lines = lines;
    Object.assign(this, canvasPlane(w, h, px));
    this.draw();
  }
  setLines(lines) { this.lines = lines; this.draw(); }
  draw() {
    const { ctx, canvas: c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    roundRect(ctx, 2, 2, c.width - 4, c.height - 4, 18);
    ctx.fillStyle = 'rgba(18,26,36,0.94)';
    ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 3; ctx.stroke();
    const fs = Math.round(c.width * 0.045);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let y = fs * 0.8;
    if (this.title) {
      ctx.font = `700 ${Math.round(fs * 1.15)}px sans-serif`;
      ctx.fillStyle = COLORS.accent;
      ctx.fillText(this.title, fs * 0.8, y);
      y += fs * 1.9;
    }
    ctx.font = `${fs}px sans-serif`;
    for (const line of this.lines) {
      ctx.fillStyle = line.startsWith('•') || line.startsWith('-') ? COLORS.text : COLORS.dim;
      y = wrap(ctx, line, fs * 0.8, y, c.width - fs * 1.6, fs * 1.35);
      if (y > c.height - fs) break;
    }
    this.tex.needsUpdate = true;
  }
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; line = w;
    } else line = test;
  }
  ctx.fillText(line, x, y);
  return y + lh;
}
