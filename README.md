# Reading Room XR

A hands-first radiology reading room for Meta Quest, built with WebXR and three.js. Review CT studies on large floating monitors, compare a prior and a current scan side by side, adjust window/level, zoom, and measure findings, all with your bare hands. No controllers needed.

> All images are synthetic CT phantoms generated in code. No patient data is used. Not for diagnosis.

## Features

- **Three-monitor layout** in a seated arc, plus a worklist (left) and a measurements panel (right).
- **Hands only:** point and pinch to press, or tap buttons with your fingertip. Pinch and drag on an image to use a tool.
- **Tools:** Scroll slices, Window/Level, Zoom, Pan, Measure (mm), HU probe.
- **Two-hand pinch zoom** on any image.
- **Presets:** Lung, Soft tissue, Bone, Brain, Subdural.
- **Synced comparison:** scrolling the CURRENT chest CT moves the PRIOR to the same slice, so growth of the right-lung nodule is easy to see and measure.
- **Movable panels:** pinch a panel's title bar to move it. "Bring panels back" restores the layout.
- **Seated, fast start:** uses the `local` reference space, so it opens in front of you with no room setup.
- **Desktop mode** for quick testing: left-click = pinch, right-drag = look around, wheel = scroll, keys 1 to 6 = tools.

## Demo studies (synthetic)

| Study | What to look for |
|---|---|
| CHEST CT PRIOR (2026-05-04) | Small right-lung nodule, about 9–10 mm |
| CHEST CT CURRENT (2026-11-01) | Same nodule, larger, about 13–14 mm |
| HEAD CT NON-CONTRAST (2026-11-06) | Crescent-shaped bright collection along the right convexity (subdural pattern); use the Subdural preset |

## Try it

**Live:** https://raushan0007.github.io/reading-room-xr/

On Meta Quest: open the link in the Meta Quest Browser, press **ENTER VR**, put the controllers down, and use your hands.

## Run locally

No build step is needed: the page loads three.js from a CDN through an import map, so any static server works.

```text
npx serve .        # or: python -m http.server
```

WebXR needs HTTPS on the headset, which GitHub Pages provides.

## Test without a headset

Install the **Immersive Web Emulator** extension for Chrome (by Meta), open the site, and switch the emulated device to hand input.

## Tech

- three.js (MIT licence) for rendering, WebXR hand input, and hand models.
- No build step: ES modules plus an import map (three.js 0.187.0 from jsDelivr).
- All UI is drawn on canvas textures; CT volumes are generated procedurally in `src/phantoms.js`.

## Project structure

```
src/main.js       scene, layout, toolbar, worklist, report
src/viewport.js   image viewport: window/level, zoom, pan, measure, scroll
src/input.js      unified input: pinch-ray, fingertip poke, mouse
src/phantoms.js   synthetic CT volumes (chest prior/current, head)
src/ui.js         canvas-based buttons and text cards
```

## Author

Raushan Kumar Gupta · built for the Meta VR Start Developer Competition 2026 (Productivity track, New Experience division).

## Licence

MIT
