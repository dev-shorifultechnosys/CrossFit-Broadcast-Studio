/* =========================================================
   Control dashboard bindings and UX helpers
   ========================================================= */
(function () {
  "use strict";

  const State = window.CrossFitState;
  const Timer = window.CrossFitTimer;
  const byId = (id) => document.getElementById(id);
  const previewFrame = byId("previewFrame");

  const bindings = {
    showBranding:["branding.visible","checked"],
    showLogo:["branding.showLogo","checked"],
    showBrandTitle:["branding.showTitle","checked"],
    showBrandSubtitle:["branding.showSubtitle","checked"],
    showBrandText:["branding.showText","checked"],
    brandTitle:["branding.title","value"],
    brandSubtitle:["branding.subtitle","value"],
    brandFreeText:["branding.freeText","value"],
    brandFontFamily:["branding.fontFamily","value"],
    brandFontSize:["branding.fontSize","number"],
    accentColor:["branding.accentColor","value"],
    textColor:["branding.textColor","value"],
    brandAlign:["branding.align","value"],

    showTimer:["timer.visible","checked"],
    timerMode:["timer.mode","value"],
    leadIn:["timer.leadIn","number"],
    timeCap:["timer.timeCapMinutes","number"],
    rounds:["timer.rounds","number"],
    workSeconds:["timer.workSeconds","number"],
    restSeconds:["timer.restSeconds","number"],
    customSequence:["timer.customSequence","value"],
    timerSize:["timer.size","number"],
    timerColor:["timer.color","value"],
    trafficBasis:["timer.trafficBasis","value"],
    soundVolume:["timer.soundVolume","number"],
    enableTrafficColors:["timer.trafficColors","checked"],
    enableSound:["timer.sound","checked"],
    soundCountdown:["timer.soundCountdown","checked"],
    soundWork:["timer.soundWork","checked"],
    soundRest:["timer.soundRest","checked"],
    soundFinish:["timer.soundFinish","checked"],
    showTimerState:["timer.showState","checked"],
    showRound:["timer.showRound","checked"],
    showTimeCap:["timer.showTimeCap","checked"],

    showWorkout:["workout.visible","checked"],
    showWorkoutTitle:["workout.showTitle","checked"],
    showWorkoutBody:["workout.showBody","checked"],
    workoutTitle:["workout.title","value"],
    workoutBody:["workout.body","value"],
    workoutFontFamily:["workout.fontFamily","value"],
    workoutTitleSize:["workout.titleSize","number"],
    workoutBodySize:["workout.bodySize","number"],
    workoutLineHeight:["workout.lineHeight","number"],
    workoutAlign:["workout.align","value"],
    coachName:["workout.coach","value"],
    noticeText:["workout.notice","value"],
    showCoach:["workout.showCoach","checked"],
    showNotice:["workout.showNotice","checked"],
    showClock:["workout.showClock","checked"],

    leftWidth:["layout.leftWidth","number"],
    rightWidth:["layout.rightWidth","number"],
    panelOpacity:["layout.panelOpacity","number"],
    cornerRadius:["layout.cornerRadius","number"],
    showSafeGuides:["layout.showSafeGuides","checked"],
    cameraWorkflow:["layout.cameraWorkflow","value"],
    cameraEnabled:["layout.cameraEnabled","checked"],
    cameraDevice:["layout.cameraDeviceId","value"],
    cameraPlacement:["layout.cameraPlacement","value"],
    cameraFit:["layout.cameraFit","value"],
    cameraMirror:["layout.cameraMirror","checked"]
  };

  function getPath(object, path) {
    return path.split(".").reduce((value,key)=>value?.[key], object);
  }

  function fillControls() {
    const state = State.getState();
    for (const [id,[path,type]] of Object.entries(bindings)) {
      const el = byId(id);
      if (!el) continue;
      const value = getPath(state,path);
      if (type === "checked") el.checked = Boolean(value);
      else el.value = value ?? "";
    }
    renderAll();
  }

  function bindControls() {
    for (const [id,[path,type]] of Object.entries(bindings)) {
      const el = byId(id);
      if (!el) continue;
      const eventName = el.matches("select,input[type='checkbox']") ? "change" : "input";

      el.addEventListener(eventName, () => {
        let value = type === "checked" ? el.checked : type === "number" ? Number(el.value) : el.value;

        // Timer setup changes always reset runtime position for predictable behavior.
        if (path.startsWith("timer.") && !["timer.size","timer.color","timer.trafficColors","timer.trafficBasis","timer.sound","timer.soundVolume","timer.showState","timer.showRound","timer.showTimeCap","timer.visible"].includes(path)) {
          const timer = { ...State.getState().timer, running:false, paused:false, baseElapsedMs:0, startedAt:null };
          timer[path.split(".")[1]] = value;
          State.updateState("timer", timer);
        } else {
          State.updateState(path, value);
        }

        if (path === "timer.customSequence") renderSequenceStatus();
        renderAll();
      });
    }
  }

  function bindTabs() {
    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b)=>b.classList.remove("active"));
        document.querySelectorAll(".panel-section").forEach((p)=>p.classList.remove("active"));
        button.classList.add("active");
        document.querySelector(`[data-panel="${button.dataset.tab}"]`)?.classList.add("active");
      });
    });
  }

  function renderTimer() {
    const state = State.getState();
    const model = Timer.displayModel(state);
    byId("controlTimerDisplay").textContent = model.text;
    byId("controlTimerMode").textContent = model.phase;
    byId("controlRoundDisplay").textContent = state.timer.showRound ? model.roundText : "";
    byId("startTimerBtn").textContent = state.timer.paused ? "Resume" : state.timer.running ? "Running" : "Start";
  }

  function renderSequenceStatus() {
    const input = byId("customSequence").value;
    const result = Timer.validateSequence(input);
    const el = byId("sequenceStatus");

    if (result.empty) {
      el.textContent = "Use seconds, m, mm:ss, * repetition and parentheses.";
      el.style.color = "";
      return;
    }

    if (!result.valid) {
      el.textContent = `Invalid sequence — ${result.message}`;
      el.style.color = "#ff817a";
      return;
    }

    el.textContent = `Valid sequence — ${result.segments.length} interval(s), ${Timer.formatTime(result.totalSeconds * 1000)} total.`;
    el.style.color = "#65d982";
  }

  let autosaveTimer = null;

  function flashAutosave() {
    const el = byId("autosaveStatus");
    if (!el) return;
    el.textContent = "Saving…";
    el.classList.add("saving");
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      el.textContent = "Autosaved ✓";
      el.classList.remove("saving");
    }, 320);
  }

  function renderSyncStatus(detail) {
    const connected = detail?.connected ?? State.isServerConnected();
    const mode = State.getEnvironmentMode();
    const pill = byId("syncStatus");
    pill.classList.toggle("connected", connected);

    if (connected) {
      byId("syncStatusText").textContent = "Server synced";
    } else if (mode === "github") {
      byId("syncStatusText").textContent = "GitHub demo";
    } else if (mode === "file") {
      byId("syncStatusText").textContent = "File demo";
    } else {
      byId("syncStatusText").textContent = "Local mode";
    }
  }

  function renderAll() {
    renderTimer();
    renderSequenceStatus();
    renderScenes();
    renderPresetButtons();
    renderIntegrationStatus();
    renderOperationalSummary();
  }

  function renderOperationalSummary() {
    const state = State.getState();
    const model = Timer.displayModel(state);

    byId("summarySession").textContent = state.timer.running ? "Live" : state.timer.paused ? "Paused" : model.finished ? "Finished" : "Ready";
    byId("summarySessionDetail").textContent = model.phase;

    byId("summaryMode").textContent = Timer.modeLabel(state.timer);
    byId("summaryModeDetail").textContent = state.timer.mode === "interval"
      ? `${state.timer.rounds} round${state.timer.rounds === 1 ? "" : "s"}`
      : `Cap ${Timer.formatTime(state.timer.timeCapMinutes * 60 * 1000)}`;

    const workflow = state.layout.cameraWorkflow || "obs";
    byId("summaryCamera").textContent = workflow === "obs" ? "OBS" : (state.layout.cameraEnabled ? "Browser On" : "Browser Off");
    byId("summaryCameraDetail").textContent = workflow === "obs"
      ? "Native camera recommended"
      : (state.layout.cameraEnabled ? "Browser camera enabled" : "Browser camera disabled");

    const connected = State.isServerConnected();
    const envMode = State.getEnvironmentMode();
    byId("summaryRemote").textContent = connected ? "Synced" : (envMode === "github" ? "Demo" : "Local");
    byId("summaryRemoteDetail").textContent = connected
      ? "LAN remote available"
      : (envMode === "github" ? "Same-browser demo sync" : "Start server for LAN sync");
  }

  function renderIntegrationStatus() {
    const connected = State.isServerConnected();
    const envMode = State.getEnvironmentMode();
    byId("remoteCardStatus").textContent = connected ? "Synced" : (envMode === "github" ? "Demo" : "Local");
    byId("remoteCardText").textContent = connected
      ? "Phone / tablet live sync ready"
      : (envMode === "github" ? "Static GitHub demo; same-browser sync works" : "Start node server.js for LAN sync");

    const state = State.getState();
    const cameraOn = state.layout.cameraEnabled;
    const workflow = state.layout.cameraWorkflow || "obs";

    byId("cameraCardStatus").textContent = workflow === "obs" ? "OBS" : (cameraOn ? "Enabled" : "Off");
    byId("cameraCardText").textContent = workflow === "obs"
      ? "Native OBS camera recommended"
      : (cameraOn ? "Browser camera layer enabled" : "Browser camera disabled");

    if (byId("healthSyncDot")) {
      byId("healthSyncDot").classList.toggle("ready", connected);
      byId("healthSyncText").textContent = connected
        ? "Server synced"
        : (State.getEnvironmentMode() === "github" ? "GitHub demo" : "Local only");
    }
    if (byId("healthCameraDot")) {
      const cameraReady = workflow === "obs" || cameraOn;
      byId("healthCameraDot").classList.toggle("ready", cameraReady);
      byId("healthCameraText").textContent = workflow === "obs" ? "OBS native" : (cameraOn ? "Browser enabled" : "Off");
    }
  }

  byId("startTimerBtn").addEventListener("click", Timer.startTimer);
  byId("pauseTimerBtn").addEventListener("click", Timer.pauseTimer);
  byId("resetTimerBtn").addEventListener("click", Timer.resetTimer);
  byId("nextIntervalBtn").addEventListener("click", Timer.nextSegment);

  const TIMER_PRESETS = {
    "for-time": {
      preset:"for-time", mode:"stopwatch", leadIn:5, timeCapMinutes:20,
      rounds:1, workSeconds:60, restSeconds:0, customSequence:""
    },
    "amrap": {
      preset:"amrap", mode:"countdown", leadIn:5, timeCapMinutes:20,
      rounds:1, workSeconds:60, restSeconds:0, customSequence:""
    },
    "emom": {
      preset:"emom", mode:"interval", leadIn:5, timeCapMinutes:10,
      rounds:10, workSeconds:60, restSeconds:0, customSequence:""
    },
    "tabata": {
      preset:"tabata", mode:"interval", leadIn:5, timeCapMinutes:4,
      rounds:8, workSeconds:20, restSeconds:10, customSequence:""
    },
    "interval": {
      preset:"interval", mode:"interval", leadIn:5, timeCapMinutes:20,
      rounds:5, workSeconds:60, restSeconds:30, customSequence:""
    },
    "custom": {
      preset:"custom", mode:"interval", leadIn:5, timeCapMinutes:20,
      rounds:1, workSeconds:60, restSeconds:0, customSequence:"4*(1m+30)"
    }
  };

  function renderPresetButtons() {
    const preset = State.getState().timer.preset || "interval";
    document.querySelectorAll("[data-timer-preset]").forEach((button) => {
      button.classList.toggle("active", button.dataset.timerPreset === preset);
    });
  }

  document.querySelectorAll("[data-timer-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = TIMER_PRESETS[button.dataset.timerPreset];
      if (!preset) return;
      const timer = {
        ...State.getState().timer,
        ...preset,
        running:false,
        paused:false,
        baseElapsedMs:0,
        startedAt:null
      };
      State.updateState("timer", timer, { type:"timer-preset", immediate:true });
      fillControls();
      renderPresetButtons();
    });
  });

  byId("logoInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Please use a logo smaller than 2 MB.");
      event.target.value = "";
      return;
    }

    const allowed = ["image/png","image/jpeg","image/webp","image/svg+xml"];
    if (file.type && !allowed.includes(file.type)) {
      alert("Please use PNG, JPG, WebP or SVG.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => State.updateState("branding.logoDataUrl", reader.result);
    reader.readAsDataURL(file);
  });

  byId("removeLogoBtn").addEventListener("click", () => {
    byId("logoInput").value = "";
    State.updateState("branding.logoDataUrl","");
  });

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function renderScenes() {
    const list = byId("sceneList");
    const scenes = State.getScenes();
    list.innerHTML = "";

    if (!scenes.length) {
      list.innerHTML = '<div class="info-card"><p>No saved scenes yet. Use a starter preset above or save the current setup.</p></div>';
      return;
    }

    scenes.forEach((scene) => {
      const item = document.createElement("div");
      item.className = "scene-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(scene.name)}</strong>
          <small>${new Date(scene.createdAt).toLocaleString()}</small>
        </div>
        <div class="scene-actions">
          <button data-load="${scene.id}">Load</button>
          <button data-duplicate="${scene.id}">Duplicate</button>
          <button data-rename="${scene.id}">Rename</button>
          <button data-delete="${scene.id}">Delete</button>
        </div>`;
      list.appendChild(item);
    });

    list.querySelectorAll("[data-load]").forEach((b)=>b.onclick=()=>{State.loadScene(b.dataset.load); fillControls();});
    list.querySelectorAll("[data-duplicate]").forEach((b)=>b.onclick=()=>{State.duplicateScene(b.dataset.duplicate); renderScenes();});
    list.querySelectorAll("[data-delete]").forEach((b)=>b.onclick=()=>{State.deleteScene(b.dataset.delete); renderScenes();});
    list.querySelectorAll("[data-rename]").forEach((b)=>b.onclick=()=>{
      const scene = State.getScenes().find((s)=>s.id===b.dataset.rename);
      const name = prompt("Rename scene:", scene?.name || "");
      if (name) { State.renameScene(b.dataset.rename,name); renderScenes(); }
    });
  }

  byId("saveSceneBtn").addEventListener("click", () => {
    State.saveScene(byId("sceneName").value);
    byId("sceneName").value = "";
    renderScenes();
  });

  const PRESETS = {
    daily: {},
    competition: {
      branding:{subtitle:"COMPETITION LIVE",freeText:"RX DIVISION"},
      workout:{title:"EVENT WOD"},
      layout:{leftWidth:23,rightWidth:27,panelOpacity:88}
    },
    minimal: {
      branding:{visible:false},
      workout:{visible:false},
      timer:{size:170}
    },
    coach: {
      branding:{visible:true,title:"COACH SESSION",subtitle:"LIVE TRAINING"},
      workout:{title:"COACH NOTES",body:"Technique\nTempo\nBreathing"},
      layout:{leftWidth:24,rightWidth:29}
    }
  };

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const base = JSON.parse(JSON.stringify(State.DEFAULT_STATE));
      const patch = PRESETS[button.dataset.preset] || {};
      for (const section of Object.keys(patch)) Object.assign(base[section], patch[section]);
      State.setState(base,{type:"preset"});
      fillControls();
    });
  });

  byId("resetLayoutBtn").addEventListener("click", () => {
    State.updateState("layout", JSON.parse(JSON.stringify(State.DEFAULT_STATE.layout)));
    fillControls();
  });

  byId("openOverlayBtn").addEventListener("click", () => window.open("overlay.html","crossfit-overlay"));
  byId("openRemoteBtn").addEventListener("click", () => window.open("remote.html","crossfit-remote"));
  byId("refreshPreviewBtn").addEventListener("click", () => previewFrame.src=`overlay.html?preview=1&t=${Date.now()}`);
  byId("fullscreenPreviewBtn").addEventListener("click", async () => {
    try { await previewFrame.requestFullscreen?.(); } catch {}
  });

  let controlCameraStream = null;

  function stopControlCameraPreview() {
    if (controlCameraStream) {
      controlCameraStream.getTracks().forEach((track) => track.stop());
    }
    controlCameraStream = null;
    const video = byId("controlCameraPreview");
    video.srcObject = null;
    byId("cameraPreviewPlaceholder").style.display = "grid";
  }

  async function startControlCameraPreview(force = false) {
    const layout = State.getState().layout;
    if (!force && !layout.cameraEnabled) {
      stopControlCameraPreview();
      updateCameraStatus();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      updateCameraStatus({ detail:{ status:"error", message:"Camera API is unavailable in this browser/context." } });
      return;
    }

    stopControlCameraPreview();
    updateCameraStatus({ detail:{ status:"loading" } });

    try {
      const videoConstraint = layout.cameraDeviceId
        ? { deviceId:{ exact:layout.cameraDeviceId } }
        : { facingMode:"user" };

      controlCameraStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false
      });

      const video = byId("controlCameraPreview");
      video.srcObject = controlCameraStream;
      video.style.transform = layout.cameraMirror ? "scaleX(-1)" : "none";
      byId("cameraPreviewPlaceholder").style.display = "none";
      await video.play().catch(() => {});
      updateCameraStatus({ detail:{ status:"ready", message:"Camera preview is live." } });

      // Permission unlocks device labels in many browsers.
      populateCameraDevices();
    } catch (error) {
      stopControlCameraPreview();
      updateCameraStatus({
        detail:{ status:"error", message:error?.message || "Permission denied or camera unavailable." }
      });
    }
  }

  byId("testCameraBtn").addEventListener("click", () => {
    byId("cameraWorkflow").value = "browser";
    State.updateState("layout.cameraWorkflow", "browser");
    startControlCameraPreview(true);
  });

  byId("cameraWorkflow").addEventListener("change", () => {
    const workflow = byId("cameraWorkflow").value;
    if (workflow === "obs") {
      byId("cameraEnabled").checked = false;
      State.updateState("layout.cameraEnabled", false);
      stopControlCameraPreview();
    }
    renderIntegrationStatus();
    renderOperationalSummary();
  });

  byId("cameraEnabled").addEventListener("change", () => {
    if (byId("cameraEnabled").checked) startControlCameraPreview(true);
    else stopControlCameraPreview();
  });

  byId("cameraDevice").addEventListener("change", () => {
    if (State.getState().layout.cameraEnabled) startControlCameraPreview(true);
  });

  byId("cameraMirror").addEventListener("change", () => {
    const video = byId("controlCameraPreview");
    video.style.transform = byId("cameraMirror").checked ? "scaleX(-1)" : "none";
  });

  function playTestTone() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volume = Math.max(0, Math.min(1, State.getState().timer.soundVolume / 100));

      osc.frequency.value = 980;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(.001, .18 * volume), ctx.currentTime + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + .22);
    } catch {}
  }

  byId("testSoundBtn").addEventListener("click", playTestTone);

  async function populateCameraDevices() {
    const select = byId("cameraDevice");
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d)=>d.kind==="videoinput");
      select.innerHTML='<option value="">Default camera</option>';
      cameras.forEach((camera,index)=>{
        const option=document.createElement("option");
        option.value=camera.deviceId;
        option.textContent=camera.label || `Camera ${index+1}`;
        select.appendChild(option);
      });
      select.value=State.getState().layout.cameraDeviceId || "";
    } catch {}
  }

  function updateCameraStatus(event) {
    const dot=byId("cameraStatusDot");
    const title=byId("cameraStatusTitle");
    const text=byId("cameraStatusText");
    const detail=event?.detail || {};
    const state=State.getState();

    if (!state.layout.cameraEnabled && detail.status !== "ready") {
      dot.style.background="#596474";
      title.textContent="Camera disabled";
      text.textContent="Enable the browser camera only when you want it.";
      if (byId("cameraCardStatus")) byId("cameraCardStatus").textContent="Off";
      if (byId("cameraCardText")) byId("cameraCardText").textContent="OBS native camera recommended";
      return;
    }
    if (detail.status==="ready") {
      dot.style.background="#34c759";
      title.textContent="Camera ready";
      text.textContent=detail.message || "Video stream connected.";
      if (byId("cameraCardStatus")) byId("cameraCardStatus").textContent="Ready";
      if (byId("cameraCardText")) byId("cameraCardText").textContent="Browser camera preview available";
    } else if (detail.status==="error") {
      dot.style.background="#ff453a";
      title.textContent="Camera unavailable";
      text.textContent=detail.message || "Check permission or device availability.";
      if (byId("cameraCardStatus")) byId("cameraCardStatus").textContent="Error";
      if (byId("cameraCardText")) byId("cameraCardText").textContent="Check camera permission/device";
    } else {
      dot.style.background="#ffd60a";
      title.textContent="Camera requested";
      text.textContent="Waiting for browser permission/device.";
    }
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  byId("exportConfigBtn").addEventListener("click", () => {
    downloadJson("crossfit-broadcast-config.json", State.exportConfig());
  });

  byId("importConfigInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      State.importConfig(payload);
      fillControls();
      alert("Configuration imported successfully.");
    } catch (error) {
      alert(error?.message || "Could not import configuration.");
    } finally {
      event.target.value = "";
    }
  });

  byId("focusModeBtn").addEventListener("click", async () => {
    document.body.classList.toggle("focus-mode");
    const active = document.body.classList.contains("focus-mode");
    byId("focusModeBtn").textContent = active ? "Exit Focus" : "Focus Mode";
    if (active) {
      try { await document.documentElement.requestFullscreen?.(); } catch {}
    } else {
      try { if (document.fullscreenElement) await document.exitFullscreen?.(); } catch {}
    }
  });

  window.addEventListener("camera-status", updateCameraStatus);
  window.addEventListener("overlay-sync-status",(e)=>{ renderSyncStatus(e.detail); renderIntegrationStatus(); });
  window.addEventListener("overlay-state-changed",()=>{ flashAutosave(); renderTimer(); renderOperationalSummary(); });
  window.addEventListener("overlay-state-received",()=>{ fillControls(); });

  window.addEventListener("keydown",(event)=>{
    const tag=event.target?.tagName?.toLowerCase();
    if (["input","textarea","select"].includes(tag)) return;
    if (event.code==="Space") {
      event.preventDefault();
      State.getState().timer.running ? Timer.pauseTimer() : Timer.startTimer();
    }
    if (event.key.toLowerCase()==="r") Timer.resetTimer();
    if (event.key.toLowerCase()==="n") Timer.nextSegment();
    if (event.key.toLowerCase()==="f") byId("fullscreenPreviewBtn").click();
  });

  bindTabs();
  bindControls();
  fillControls();
  populateCameraDevices();
  updateCameraStatus();
  if (State.getState().layout.cameraEnabled) startControlCameraPreview(true);

  // Visual timer refresh only. No shared state mutation occurs here.
  setInterval(()=>{ renderTimer(); renderOperationalSummary(); }, 100);
})();
