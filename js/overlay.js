/* =========================================================
   OBS / browser overlay renderer
   Camera access is opt-in only.
   ========================================================= */
(function () {
  "use strict";

  const State = window.CrossFitState;
  const Timer = window.CrossFitTimer;
  const byId=(id)=>document.getElementById(id);
  const canvas=byId("broadcastCanvas");
  const cameraVideo=byId("cameraVideo");
  const previewMode=new URLSearchParams(location.search).has("preview");
  if (previewMode) document.body.classList.add("preview-mode");

  let cameraStream=null;
  let cameraStarting=false;
  let lastCameraKey="";
  let lastSoundKey="";

  const fonts = {
    system:'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    arial:'Arial, sans-serif',
    helvetica:'Helvetica, Arial, sans-serif',
    georgia:'Georgia, serif',
    impact:'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'
  };

  function setText(id,value) { const el=byId(id); if (el) el.textContent=value ?? ""; }

  async function startCamera(layout) {
    const key=`${layout.cameraDeviceId}|${layout.cameraPlacement}|${layout.cameraFit}|${layout.cameraMirror}`;
    if (cameraStream && key===lastCameraKey) return;
    if (cameraStarting || !navigator.mediaDevices?.getUserMedia) return;

    stopCamera();
    cameraStarting=true;
    window.dispatchEvent(new CustomEvent("camera-status",{detail:{status:"loading"}}));

    try {
      const video=layout.cameraDeviceId ? {deviceId:{exact:layout.cameraDeviceId}} : {facingMode:"user"};
      cameraStream=await navigator.mediaDevices.getUserMedia({video,audio:false});
      cameraVideo.srcObject=cameraStream;
      await cameraVideo.play().catch(()=>{});
      lastCameraKey=key;
      window.dispatchEvent(new CustomEvent("camera-status",{detail:{status:"ready",message:"Video stream connected."}}));
    } catch (error) {
      window.dispatchEvent(new CustomEvent("camera-status",{detail:{status:"error",message:error?.message || "Permission denied or camera unavailable."}}));
    } finally { cameraStarting=false; }
  }

  function stopCamera() {
    if (cameraStream) cameraStream.getTracks().forEach((t)=>t.stop());
    cameraStream=null;
    cameraVideo.srcObject=null;
    lastCameraKey="";
  }

  function applyCamera(layout) {
    canvas.classList.remove("camera-background","camera-left","camera-right","camera-mirror");
    cameraVideo.style.objectFit=layout.cameraFit || "cover";
    if (layout.cameraMirror) canvas.classList.add("camera-mirror");

    if (!layout.cameraEnabled) {
      stopCamera();
      window.dispatchEvent(new CustomEvent("camera-status",{detail:{status:"disabled"}}));
      return;
    }

    canvas.classList.add(`camera-${layout.cameraPlacement || "background"}`);
    startCamera(layout);
  }

  function playTone(frequency, duration, volume, type = "sine") {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(.001, .18 * volume), ctx.currentTime + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + .03);
    } catch {}
  }

  function soundCue(state, model) {
    if (!state.timer.sound || previewMode || !state.timer.running) return;

    const volume = Math.max(0, Math.min(1, state.timer.soundVolume / 100));
    let cue = "";
    let action = null;

    if (model.phase === "GET READY" && state.timer.soundCountdown) {
      const remaining = Math.max(0, state.timer.leadIn * 1000 - Timer.elapsedMs(state.timer));
      const second = Math.ceil(remaining / 1000);
      if (second > 0 && second <= 3) {
        cue = `countdown-${second}`;
        action = () => playTone(880 + ((3 - second) * 70), .09, volume);
      }
    } else if (model.phase === "WORK" && state.timer.soundWork) {
      cue = `work-${model.segmentIndex}`;
      action = () => playTone(1120, .16, volume, "square");
    } else if (model.phase === "REST" && state.timer.soundRest) {
      cue = `rest-${model.segmentIndex}`;
      action = () => playTone(620, .16, volume, "triangle");
    } else if (model.phase === "FINISHED" && state.timer.soundFinish) {
      cue = "finished";
      action = () => playTone(1320, .42, volume, "square");
    } else if ((model.phase === "COUNTDOWN" || model.phase === "STOPWATCH") && model.overallElapsedMs < 250 && state.timer.soundWork) {
      cue = `start-${state.timer.startedAt}`;
      action = () => playTone(1120, .18, volume, "square");
    }

    if (!cue || cue === lastSoundKey || !action) return;
    lastSoundKey = cue;
    action();
  }

  function applyState() {
    const state=State.getState();
    const model=Timer.displayModel(state);

    canvas.style.setProperty("--overlay-accent",state.branding.accentColor);
    canvas.style.setProperty("--overlay-text",state.branding.textColor);
    canvas.style.setProperty("--left-zone",`${state.layout.leftWidth}%`);
    canvas.style.setProperty("--right-zone",`${state.layout.rightWidth}%`);
    canvas.style.setProperty("--surface-opacity",String(state.layout.panelOpacity/100));
    canvas.style.setProperty("--surface-radius",`${state.layout.cornerRadius}px`);
    canvas.style.setProperty("--timer-size",`${state.timer.size}px`);
    canvas.style.setProperty("--brand-size",`${state.branding.fontSize}px`);
    canvas.style.setProperty("--workout-title-size",`${state.workout.titleSize}px`);
    canvas.style.setProperty("--workout-body-size",`${state.workout.bodySize}px`);
    canvas.style.setProperty("--workout-line-height",String(state.workout.lineHeight/100));
    canvas.style.setProperty("--brand-font",fonts[state.branding.fontFamily] || fonts.system);
    canvas.style.setProperty("--workout-font",fonts[state.workout.fontFamily] || fonts.system);

    byId("zoneLeft").classList.toggle("hidden-zone",!state.branding.visible);
    const logo=byId("overlayLogo");
    const hasLogo = Boolean(state.branding.logoDataUrl && state.branding.showLogo);
    if (hasLogo) {
      logo.src=state.branding.logoDataUrl; logo.style.display="block";
    } else { logo.removeAttribute("src"); logo.style.display="none"; }
    byId("zoneLeft").classList.toggle("has-logo", hasLogo);

    setText("overlayBrandTitle",state.branding.showTitle ? state.branding.title : "");
    setText("overlaySubtitle",state.branding.showSubtitle ? state.branding.subtitle : "");
    setText("overlayBrandText",state.branding.showText ? state.branding.freeText : "");
    document.querySelector(".brand-copy").style.textAlign=state.branding.align;

    byId("zoneCenter").classList.toggle("hidden-zone",!state.timer.visible);
    setText("overlayTimer",model.text);
    setText("overlayTimerState",state.timer.showState ? model.phase : "");
    setText("overlayRound",state.timer.showRound ? model.roundText : "");
    setText("overlayTimeCap",state.timer.showTimeCap ? model.timeCapText : "");
    byId("overlayTimer").style.color=Timer.trafficColor(state,model);

    canvas.dataset.timerState = (model.phase || "ready").toLowerCase().replace(/\s+/g, "-");
    const shell = document.querySelector(".timer-shell");
    shell.classList.toggle("timer-live", state.timer.running);
    shell.classList.toggle("timer-paused", state.timer.paused);
    shell.classList.toggle("timer-finished", model.finished);

    byId("timerProgressRing").parentElement.style.background =
      `conic-gradient(${state.branding.accentColor} ${Math.max(0,Math.min(1,model.progress))*360}deg, rgba(255,255,255,.07) 0deg)`;

    byId("zoneRight").classList.toggle("hidden-zone",!state.workout.visible);
    setText("overlayWorkoutTitle",state.workout.showTitle ? state.workout.title : "");
    setText("overlayWorkoutBody",state.workout.showBody ? state.workout.body : "");
    setText("overlayCoach",state.workout.showCoach ? state.workout.coach : "");
    setText("overlayNotice",state.workout.showNotice ? state.workout.notice : "");
    byId("workoutKicker").style.display=state.workout.showTitle ? "" : "none";
    byId("overlayClock").style.display=state.workout.showClock ? "" : "none";
    byId("overlayWorkoutBody").style.textAlign=state.workout.align;
    byId("overlayWorkoutTitle").style.textAlign=state.workout.align;

    byId("safeGuides").classList.toggle("visible",Boolean(previewMode && state.layout.showSafeGuides));

    const cameraLayout = { ...state.layout };
    if ((state.layout.cameraWorkflow || "obs") !== "browser") {
      cameraLayout.cameraEnabled = false;
    }
    applyCamera(cameraLayout);
    soundCue(state,model);
  }

  function updateClock() {
    if (!State.getState().workout.showClock) return;
    setText("overlayClock",new Date().toLocaleTimeString([],{
      hour:"2-digit",minute:"2-digit",second:"2-digit"
    }));
  }

  window.addEventListener("overlay-state-changed",applyState);
  window.addEventListener("overlay-state-received",applyState);

  applyState();
  updateClock();
  setInterval(()=>{ applyState(); updateClock(); },100);
})();
