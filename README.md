# CrossFit Broadcast Studio — Final

Premium, responsive HTML5/CSS/JavaScript streaming overlay system for CrossFit workouts.

## What changed in V4

- Further premium visual refinement plus a live camera test panel, CrossFit timer presets and richer streaming-status UI.
- The supplied “THE ONLINE BOX” logo is used only in the control/remote header as demo/product branding.
- Broadcast logo remains user-uploadable, replaceable and removable.
- Transparent OBS output is visually obvious in preview mode.
- Timestamp-based timer prevents double-speed or conflicting timers when Control + OBS + Remote are open simultaneously.
- Real local-network synchronization is included with a **zero-dependency Node.js server**.
- Dedicated `remote.html` for smartphone/tablet control.
- More granular show/hide options.
- Font-family controls.
- Workout title/body sizing, line spacing and alignment controls.
- Camera mirror, device selection and status UI.
- Timer expression validation.
- Scene presets no longer save running timer state.
- Scene duplicate/rename/delete controls.
- Logo file type/size validation.
- Fade transitions and timer progress ring.

## Files

- `index.html` — premium operator dashboard
- `overlay.html` — clean OBS/browser broadcast output
- `remote.html` — phone/tablet timer remote
- `server.js` — zero-dependency local HTTP + SSE synchronization server
- `css/styles.css`
- `js/state.js`
- `js/timer.js`
- `js/control.js`
- `js/overlay.js`
- `js/remote.js`
- `assets/the-online-box-logo.png`

## Recommended start

Install Node.js if it is not already installed.

From this folder:

```bash
node server.js
```

Open:

- Control: `http://localhost:8080/`
- Overlay: `http://localhost:8080/overlay.html`
- Remote: `http://localhost:8080/remote.html`

The terminal also prints your LAN remote URL, for example:

```text
http://192.168.1.20:8080/remote.html
```

Open that address on a phone/tablet connected to the same Wi‑Fi/LAN.

## OBS

1. Run `node server.js`.
2. Add a new **Browser Source**.
3. URL: `http://localhost:8080/overlay.html`
4. Width: `1920`
5. Height: `1080`
6. Keep the browser source above your native OBS camera/video source.
7. The normal overlay page has a transparent background.

### Recommended camera workflow

For production:
- Use **OBS Video Capture Device** for the webcam/camera.
- Use this HTML overlay above it.

The built-in browser camera is also available, but native OBS capture is usually more reliable.

## Zoom

1. Compose the camera + overlay scene in OBS.
2. Start **OBS Virtual Camera**.
3. Select **OBS Virtual Camera** in Zoom.

## Custom timer syntax

Supported examples:

```text
30
2m
1:30
2m + 30 + 1:00
4*1m
4*(1m+30)
```

The control panel shows whether the expression is valid and its total duration.

## Keyboard shortcuts

- Space — Start / Pause / Resume
- R — Reset timer
- N — Next interval
- F — Fullscreen preview

## Privacy

Browser camera access is opt-in. The application does not request camera permission until **Enable browser camera layer** is switched on.

## Dependencies / recurring cost

Core runtime:
- HTML5
- CSS
- plain JavaScript
- Node.js built-in modules only

No npm package, paid license or mandatory cloud service is required.

## Developer handover

The source is intentionally:
- readable
- unminified
- commented
- split into logical modules

Another developer can change the design, timer parser, state transport or add a cloud backend later without depending on the original developer.


## V3 CrossFit timer presets

The control panel now includes quick presets:

- **FOR TIME** — countdown against a time cap
- **AMRAP** — count-up/stopwatch until the cap
- **EMOM** — repeating one-minute rounds
- **TABATA** — 20s work / 10s rest × 8
- **INTERVAL** — configurable work/rest rounds
- **CUSTOM** — sequence-expression workflow

All presets remain editable after selection.

## V3 camera workflow

The Layout tab includes a **Camera Preview** area and **Test Camera** button.

This is useful for:
- checking browser permission
- confirming the selected device
- verifying mirror behavior before broadcast

For production streaming, native OBS Video Capture Device is still recommended.

## V3 sound cues

Separate controls are available for:
- 3–2–1 countdown
- work/start cue
- rest cue
- finish cue
- volume

Use **Test Sound** in the Timer tab to verify local browser audio.

## Final demo checklist

For client screenshots/video, run:

```bash
node server.js
```

Then make sure:

- header shows **Server synced**
- mobile remote shows **Synced**
- phone Start/Pause/Next/Reset updates desktop/OBS
- camera test shows **Camera ready**
- OBS Browser Source updates live
- Zoom receives OBS Virtual Camera


## V4 refinements

V4 focuses on production usability and premium UX without adding employee monitoring features.

### Correct CrossFit preset behavior

- **FOR TIME** → count-up/stopwatch against a cap
- **AMRAP** → countdown from the selected time cap
- **EMOM** → repeated one-minute rounds
- **TABATA** → 20 seconds work / 10 seconds rest × 8
- **INTERVAL** → configurable work/rest rounds
- **CUSTOM** → custom sequence expressions

### Camera workflow

The Layout tab now makes the production choice explicit:

- **OBS native camera — recommended**
- **Browser camera**

The browser camera still includes device selection, mirror, placement and a local camera test preview.

### Remote wake lock

`remote.html` can request a Screen Wake Lock so a phone/tablet does not sleep during a live workout. Browser support and permission rules still apply.

### Portable configuration

The Streaming tab can export/import a JSON configuration containing branding, timer, workout and layout settings.

Runtime timer state and active browser-camera state are deliberately not exported.

### Focus Mode

Focus Mode hides the configuration panel and makes the broadcast preview the primary full-screen work surface.

### Operational status

The dashboard now shows a compact summary for:

- session state
- timer mode
- camera workflow
- remote/server sync

### Production reminder

For real LAN phone/OBS synchronization, start:

```bash
node server.js
```

Opening the HTML files directly will intentionally show **Local mode** because there is no shared server connection in that case.


## GitHub Pages demo

For contest/client presentation, the project can be deployed directly to GitHub Pages.

See:

```text
GITHUB_PAGES.md
```

On GitHub Pages the interface shows **GitHub demo** rather than a misleading connection warning.

The demo logo is preloaded in the broadcast branding area and can still be changed or removed from the Branding controls.

For real cross-device phone/tablet synchronization, use the included zero-dependency local server:

```bash
node server.js
```
