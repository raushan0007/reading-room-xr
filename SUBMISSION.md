# Devpost Submission Kit: Reading Room XR

Deadline: **18 Nov 2026, 12:00 PM PST = 19 Nov 2026, 1:30 AM IST**
Track: **Productivity** · Division: **New Experience**

---

## Project name
Reading Room XR

## Tagline (short)
A hands-first radiology reading room on Meta Quest: compare scans, window, zoom, and measure with your bare hands.

## Inspiration
I run the PACS and teleradiology infrastructure for a statewide government hospital network in Bihar, India. Radiologists who read remotely often work from a single laptop screen, while a hospital reading room has several large diagnostic monitors. A headset can give anyone that multi-monitor reading room anywhere. Hand tracking makes it practical: radiologists already pinch, drag, and point all day, and they do not want to hold controllers.

## What it does
- Opens a seated reading room with three large monitors, a worklist, and a measurements panel.
- You load studies from the worklist with a pinch, then scroll slices, adjust window/level, zoom, pan, probe Hounsfield units, and measure findings in millimetres.
- PRIOR and CURRENT scans scroll in sync, so you can measure how a lung nodule has grown between visits.
- Two-hand pinch zooms an image; pinching a panel's title bar moves the monitor anywhere around you.
- Every control works with a pinch-ray or by simply tapping it with a fingertip.

## How we built it
- WebXR with three.js, so it runs in the Meta Quest Browser with no install and opens in seconds.
- A unified input layer turns pinch-rays, fingertip pokes, and desktop mouse into the same press/drag events.
- Each viewport renders CT slices on a canvas with a real window/level transform from Hounsfield units, plus zoom, pan, overlays, and measurement lines.
- To avoid any patient-data risk, all CT studies are synthetic phantoms generated in code (a chest CT at two time points with a growing nodule, and a head CT with a subdural pattern).
- Seated-first design: `local` reference space, controls within arm's reach on a tilted desk toolbar.

## Challenges
- Precise image work by hand: mapping small hand movements to window/level and slice scrolling without jitter. Dragging is measured on the image plane, so you can move outside the image while adjusting.
- Making buttons easy to hit both by pinch-ray and by direct touch, without double presses.
- Producing realistic-looking CT data without using any real patient images.

## Accomplishments
- A full read-compare-measure workflow done entirely with hands, in under a minute from launch.
- The PRIOR vs CURRENT comparison: the nodule growth is visible and measurable side by side.

## What we learned
Hands are a natural fit for image review: pinch-and-drag for contrast feels closer to a real workstation mouse than controllers do, and a spatial layout removes the need to tile windows.

## What's next
- Loading real DICOM files (local or from a PACS via DICOMweb) with proper de-identification.
- Voice dictation of findings into a structured report.
- Multi-user review, so a radiologist and a referring doctor can look at the same study together.
- MPR (coronal and sagittal) and 3D volume views.

## Built with
three.js, WebXR, WebXR Hand Input, JavaScript, GitHub Pages

## Links to fill in
- Try it: https://raushan0007.github.io/reading-room-xr/
- Code: https://github.com/raushan0007/reading-room-xr
- Video: YouTube link

---

## Demo video script (about 2 minutes, record on Quest)

Record with the Quest's built-in recorder (Meta button → Camera → Record video). Keep the hands visible in frame.

| Time | Shot | Voice-over |
|---|---|---|
| 0:00–0:10 | Open the URL in Quest Browser, press ENTER VR, controllers on the table | "Radiologists read scans on several big monitors. Reading Room XR puts that room anywhere, controlled only with your hands." |
| 0:10–0:25 | Look around the three monitors, worklist, report panel; tap "Got it" with a fingertip | "Three monitors, a worklist, and a report, all in reach while seated." |
| 0:25–0:45 | Scroll tool: pinch-drag on CURRENT chest CT; PRIOR moves with it (Sync ON) | "Pinch and drag to scroll. The prior scan follows, slice for slice." |
| 0:45–1:05 | Two-hand pinch zoom on the nodule, then W/L drag | "Two hands to zoom in, drag to change contrast." |
| 1:05–1:25 | Measure tool: measure nodule on CURRENT, then on PRIOR; show the measurements panel | "Measure the nodule on both scans: it has grown from about 10 to 14 millimetres." |
| 1:25–1:45 | Load HEAD CT from worklist, Subdural preset, HU probe on the crescent | "Load a head CT, apply the subdural window, probe the density." |
| 1:45–2:00 | Move a panel by its title bar, then "Bring panels back" | "Arrange the room your way. All data here is synthetic. Next: real DICOM and voice reporting." |

---

## Before you submit: checklist

- [ ] Meta Start program membership approved (required to be eligible).
- [ ] Check the Devpost submission form for the required build format. If it needs an APK or a Meta Horizon Store build instead of a web URL, wrap the site as a Quest PWA (Meta's PWA packaging with Bubblewrap) or ask me to set that up.
- [ ] Deployed on GitHub Pages and tested on the Quest with hand tracking on (Settings → Movement tracking → Hand tracking).
- [ ] Video uploaded to YouTube (public or unlisted) and linked.
- [ ] Screenshots: the three-monitor view, the nodule comparison, the head CT.
- [ ] Track = Productivity, Division = New Experience.
