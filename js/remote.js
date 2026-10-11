/* Mobile/tablet remote controller */
(function () {
  "use strict";
  const State=window.CrossFitState;
  const Timer=window.CrossFitTimer;
  const byId=(id)=>document.getElementById(id);

  function render() {
    const state=State.getState();
    const model=Timer.displayModel(state);
    byId("remotePhase").textContent=model.phase;
    byId("remoteTimer").textContent=model.text;
    byId("remoteRound").textContent=model.roundText || "";
    byId("remoteStart").textContent=state.timer.paused ? "RESUME" : state.timer.running ? "RUNNING" : "START";
    byId("remoteNext").disabled = state.timer.mode !== "interval";
    byId("remoteMode").textContent=state.timer.mode==="interval" ? "Work / Rest" : state.timer.mode[0].toUpperCase()+state.timer.mode.slice(1);
    byId("remoteCap").textContent=Timer.formatTime(state.timer.timeCapMinutes*60*1000);
  }

  function haptic() { try { navigator.vibrate?.(35); } catch {} }

  byId("remoteStart").onclick=()=>{ haptic(); if (!State.getState().timer.running) Timer.startTimer(); };
  byId("remotePause").onclick=()=>{ haptic(); Timer.pauseTimer(); };
  byId("remoteNext").onclick=()=>{ haptic(); Timer.nextSegment(); };
  byId("remoteReset").onclick=()=>{ haptic(); Timer.resetTimer(); };

  window.addEventListener("overlay-state-changed",render);
  window.addEventListener("overlay-state-received",render);
  function renderRemoteStatus(connected = State.isServerConnected()) {
    const mode = State.getEnvironmentMode();
    byId("remoteSyncStatus").textContent = connected
      ? "Synced"
      : (mode === "github" ? "GitHub demo" : mode === "file" ? "File demo" : "Local");
  }

  window.addEventListener("overlay-sync-status",(event)=>{
    renderRemoteStatus(event.detail.connected);
  });

  let wakeLock = null;

  async function requestWakeLock() {
    if (!("wakeLock" in navigator) || !byId("wakeLockToggle").checked) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch {}
  }

  async function releaseWakeLock() {
    try { await wakeLock?.release(); } catch {}
    wakeLock = null;
  }

  byId("wakeLockToggle").addEventListener("change", () => {
    byId("wakeLockToggle").checked ? requestWakeLock() : releaseWakeLock();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && byId("wakeLockToggle").checked) requestWakeLock();
  });

  render();
  renderRemoteStatus();
  requestWakeLock();
  setInterval(render,100);
})();
