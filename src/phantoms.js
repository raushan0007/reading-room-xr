// Procedurally generated CT "phantoms" (synthetic volumes in Hounsfield units).
// No patient data is used anywhere in this project.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const inEll = (x, y, cx, cy, a, b) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1;

// ---------------------------------------------------------------- Chest CT
export function makeChest({ noduleRadius = 6.5, seed = 7, label, date, id }) {
  const nx = 160, ny = 160, nz = 64;
  const ps = 2.0; // mm per pixel (320 mm FOV)
  const st = 4.0; // slice spacing mm
  const data = new Int16Array(nx * ny * nz);
  const r = rng(seed);
  const vr = rng(1234); // vessel layout is identical between prior and current

  // Pre-generate lung vessels (shared anatomy)
  const vessels = [];
  for (let k = 0; k < 420; k++) {
    vessels.push({
      side: vr() < 0.5 ? -1 : 1,
      x: (vr() - 0.5) * 70,
      y: (vr() - 0.5) * 120,
      z: 6 + vr() * (nz - 12),
      rad: 1.2 + vr() * 2.6 * (vr() < 0.15 ? 1.8 : 1),
    });
  }

  const nodule = { x: -62, y: -18, z: 26, rad: noduleRadius };

  for (let z = 0; z < nz; z++) {
    const t = z / (nz - 1); // 0 = apex, 1 = base
    const lungScale = Math.pow(Math.sin(Math.PI * (0.08 + t * 0.85)), 0.6);
    const heartOn = t > 0.42 && t < 0.97;
    const heartScale = heartOn ? Math.sin(Math.PI * ((t - 0.42) / 0.55)) : 0;
    const ribPhase = Math.floor(z / 3) % 2;
    for (let j = 0; j < ny; j++) {
      const y = (j - ny / 2) * ps; // + = posterior
      for (let i = 0; i < nx; i++) {
        const x = (i - nx / 2) * ps; // image left = patient right
        let hu = -1000;
        const bodyA = 150 - 18 * (1 - lungScale), bodyB = 108;
        // CT table
        if (y > 122 && y < 128 && Math.abs(x) < 150) hu = 150;
        if (inEll(x, y, 0, 0, bodyA, bodyB)) {
          hu = inEll(x, y, 0, 0, bodyA - 11, bodyB - 11) ? 45 : -95; // muscle / fat rim
          // lungs
          const la = 48 * lungScale, lb = 74 * lungScale;
          const inR = la > 2 && inEll(x, y, -58, -2, la, lb);
          let inL = la > 2 && inEll(x, y, 58, -2, la * 0.95, lb);
          const inHeart = heartOn && inEll(x, y, 22, -28, 58 * heartScale + 1, 46 * heartScale + 1);
          if (inHeart) inL = false;
          if (inR || inL) hu = -860;
          if (inHeart) hu = 42;
          // aorta (contrast)
          if (t > 0.12 && inEll(x, y, 18, 32, 13, 13)) hu = 190;
          if (t > 0.12 && t < 0.3 && inEll(x, y, 5, -10, 14, 14)) hu = 190; // ascending
          // spine
          if (inEll(x, y, 0, 72, 19, 17)) hu = inEll(x, y, 0, 72, 15, 13) ? 320 : 850;
          if (inEll(x, y, 0, 96, 8, 7)) hu = 25;
          if (inEll(x, y, 0, 108, 22, 6) && !inEll(x, y, 0, 96, 9, 8)) hu = 600;
          // sternum
          if (t > 0.18 && t < 0.85 && inEll(x, y, 0, -96, 14, 6)) hu = 520;
        }
        data[(z * ny + j) * nx + i] = hu;
      }
    }
    // ribs: small bony ellipses along the chest wall
    for (let k = 0; k < 9; k++) {
      const ang = Math.PI * (0.05 + (k + ribPhase * 0.5) / 9) ; // posterior-lateral arc
      for (const side of [-1, 1]) {
        const cxr = side * (150 - 18 * (1 - lungScale) - 16) * Math.sin(ang);
        const cyr = -(108 - 16) * Math.cos(ang);
        stamp(data, nx, ny, z, ps, cxr, cyr, 5, 4, (old) => (old > -500 ? 700 : old));
      }
    }
  }

  // vessels (only inside lung)
  for (const v of vessels) {
    const cx = v.side * 58 + v.x * 0.9;
    rasterSphere(data, nx, ny, nz, ps, st, cx, v.y * 0.85, v.z, v.rad, (old) => (old < -600 ? 35 : old));
  }
  // nodule (slightly lobulated)
  const nr = rng(99);
  rasterSphere(data, nx, ny, nz, ps, st, nodule.x, nodule.y, nodule.z, nodule.rad, (old) => (old < -400 ? 30 : old));
  for (let k = 0; k < 6; k++) {
    const a = nr() * Math.PI * 2;
    rasterSphere(data, nx, ny, nz, ps, st,
      nodule.x + Math.cos(a) * nodule.rad * 0.7, nodule.y + Math.sin(a) * nodule.rad * 0.7,
      nodule.z + (nr() - 0.5), nodule.rad * 0.45, (old) => (old < -400 ? 30 : old));
  }

  addNoise(data, r, 14);
  return {
    id, label, date, modality: 'CT', body: 'CHEST', group: 'chest',
    nx, ny, nz, ps, st, data,
    wl: { ww: 1500, wl: -600 },
    keySlice: nodule.z,
  };
}

// ---------------------------------------------------------------- Head CT
export function makeHead({ seed = 3, id, label, date }) {
  const nx = 160, ny = 160, nz = 36;
  const ps = 1.3, st = 4.5;
  const data = new Int16Array(nx * ny * nz);
  const r = rng(seed);
  for (let z = 0; z < nz; z++) {
    const t = z / (nz - 1); // 0 = skull base, 1 = vertex
    const s = Math.sqrt(Math.max(0.05, 1 - ((t - 0.35) / 0.78) ** 2));
    const A = 70 * s, B = 88 * s;
    for (let j = 0; j < ny; j++) {
      const y = (j - ny / 2) * ps; // + = posterior
      for (let i = 0; i < nx; i++) {
        const x = (i - nx / 2) * ps;
        let hu = -1000;
        if (inEll(x, y, 0, 0, A + 5, B + 5)) {
          hu = 40; // scalp
          if (inEll(x, y, 0, 0, A, B)) hu = 1300; // skull
          const iA = A - 7, iB = B - 7;
          if (iA > 3 && inEll(x, y, 0, 0, iA, iB)) {
            hu = inEll(x, y, 0, 0, iA - 7, iB - 7) ? 29 : 39; // white / grey matter
            // falx
            if (Math.abs(x) < 1.0 && y < iB - 10 && t > 0.3) hu = 60;
            // lateral ventricles
            if (t > 0.42 && t < 0.72) {
              const vs = Math.sin(Math.PI * (t - 0.42) / 0.3);
              if (inEll(x, y, -9, -4, 5 * vs + 1, 24 * vs + 2) || inEll(x, y, 9, -4, 5 * vs + 1, 24 * vs + 2)) hu = 6;
            }
            if (t > 0.34 && t < 0.44 && Math.abs(x) < 2 && Math.abs(y) < 12) hu = 6; // third ventricle
            // subdural hematoma: crescent along patient-right convexity (image left)
            if (t > 0.38 && t < 0.84 && x < -18 && Math.abs(y) < 62 && !inEll(x, y, 10, 0, iA - 3, iB - 2)) {
              const fade = Math.sin(Math.PI * (t - 0.38) / 0.46);
              if (fade > 0.25) hu = 72;
            }
          }
          // skull base: orbits and sinuses
          if (t < 0.3) {
            if (inEll(x, y, -26, -62, 13, 11) || inEll(x, y, 26, -62, 13, 11)) hu = t < 0.18 ? 30 : hu;
            if (inEll(x, y, 0, -70, 10, 9) && t < 0.2) hu = -900;
            if ((inEll(x, y, -32, 18, 16, 6) || inEll(x, y, 32, 18, 16, 6)) && t < 0.22) hu = 1100;
          }
        }
        data[(z * ny + j) * nx + i] = hu;
      }
    }
  }
  addNoise(data, r, 4);
  return {
    id, label, date, modality: 'CT', body: 'HEAD', group: 'head',
    nx, ny, nz, ps, st, data,
    wl: { ww: 80, wl: 40 },
    keySlice: 22,
  };
}

function stamp(data, nx, ny, z, ps, cx, cy, a, b, fn) {
  const i0 = Math.max(0, Math.floor((cx - a) / ps + nx / 2)), i1 = Math.min(nx - 1, Math.ceil((cx + a) / ps + nx / 2));
  const j0 = Math.max(0, Math.floor((cy - b) / ps + ny / 2)), j1 = Math.min(ny - 1, Math.ceil((cy + b) / ps + ny / 2));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = (i - nx / 2) * ps, y = (j - ny / 2) * ps;
    if (inEll(x, y, cx, cy, a, b)) { const k = (z * ny + j) * nx + i; data[k] = fn(data[k]); }
  }
}

function rasterSphere(data, nx, ny, nz, ps, st, cx, cy, cz, rad, fn) {
  const rz = rad / st;
  const z0 = Math.max(0, Math.floor(cz - rz)), z1 = Math.min(nz - 1, Math.ceil(cz + rz));
  for (let z = z0; z <= z1; z++) {
    const dz = (z - cz) * st;
    const rr = rad * rad - dz * dz;
    if (rr <= 0) continue;
    const rs = Math.sqrt(rr);
    stamp(data, nx, ny, z, ps, cx, cy, rs, rs, fn);
  }
}

function addNoise(data, r, sigma) {
  for (let k = 0; k < data.length; k++) {
    data[k] = Math.max(-1024, Math.min(3000, data[k] + Math.round(gauss(r) * sigma)));
  }
}

export function buildStudies() {
  return [
    makeChest({ id: 'chest-cur', label: 'CHEST CT  CURRENT', date: '2026-11-01', noduleRadius: 6.6, seed: 11 }),
    makeChest({ id: 'chest-pri', label: 'CHEST CT  PRIOR', date: '2026-05-04', noduleRadius: 4.0, seed: 5 }),
    makeHead({ id: 'head', label: 'HEAD CT  NON-CONTRAST', date: '2026-11-06' }),
  ];
}

export const PRESETS = {
  Lung: { ww: 1500, wl: -600 },
  Soft: { ww: 400, wl: 40 },
  Bone: { ww: 1800, wl: 400 },
  Brain: { ww: 80, wl: 40 },
  Subdural: { ww: 200, wl: 75 },
};
