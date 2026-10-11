/* =========================================================
   Shared state + local/server synchronization
   - file:// mode: localStorage + BroadcastChannel
   - server mode: localStorage + BroadcastChannel + SSE/POST
   - no paid service or framework required
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "crossfit-overlay-state-v2";
  const SCENE_KEY = "crossfit-overlay-scenes-v2";
  const CHANNEL_NAME = "crossfit-overlay-sync-v2";
  const serverCapable = location.protocol === "http:" || location.protocol === "https:";
  const isGitHubPages = location.hostname.endsWith("github.io");
  const isFileMode = location.protocol === "file:";

  const DEFAULT_STATE = {
    branding: {
      visible: true,
      showLogo: true,
      showTitle: true,
      showSubtitle: true,
      showText: true,
      logoDataUrl: "assets/the-online-box-logo.png",
      title: "CROSSFIT OPEN 26.1",
      subtitle: "LIVE WORKOUT",
      freeText: "RX DIVISION",
      fontFamily: "system",
      fontSize: 38,
      align: "left",
      accentColor: "#ff3b30",
      textColor: "#ffffff"
    },
    timer: {
      visible: true,
      showState: true,
      showRound: true,
      showTimeCap: true,
      mode: "interval",
      leadIn: 5,
      timeCapMinutes: 20,
      rounds: 5,
      workSeconds: 60,
      restSeconds: 30,
      customSequence: "",
      size: 132,
      color: "#ffffff",
      trafficColors: true,
      trafficBasis: "overall",
      sound: true,
      soundVolume: 65,
      soundCountdown: true,
      soundWork: true,
      soundRest: true,
      soundFinish: true,
      preset: "interval",

      running: false,
      paused: false,
      baseElapsedMs: 0,
      startedAt: null
    },
    workout: {
      visible: true,
      showTitle: true,
      showBody: true,
      title: "TODAY'S WOD",
      body: "5 ROUNDS\n10 Burpees\n15 Wall Balls\n20 Double Unders",
      coach: "COACH MICHAEL",
      notice: "STAY STRONG • MOVE WELL",
      showCoach: true,
      showNotice: true,
      showClock: true,
      fontFamily: "system",
      titleSize: 36,
      bodySize: 24,
      lineHeight: 150,
      align: "left"
    },
    layout: {
      leftWidth: 25,
      rightWidth: 25,
      panelOpacity: 84,
      cornerRadius: 24,
      showSafeGuides: false,
      cameraWorkflow: "obs",
      cameraEnabled: false,
      cameraDeviceId: "",
      cameraPlacement: "background",
      cameraFit: "cover",
      cameraMirror: true
    }
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function mergeDeep(target, source) {
    for (const key of Object.keys(source || {})) {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] = mergeDeep(target[key] || {}, value);
      } else {
        target[key] = value;
      }
    }
    return target;
  }

  function readLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved ? mergeDeep(clone(DEFAULT_STATE), saved) : clone(DEFAULT_STATE);
    } catch {
      return clone(DEFAULT_STATE);
    }
  }

  let state = readLocal();
  let channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  let source = null;
  let serverConnected = false;
  let pushTimer = null;
  let applyingRemote = false;

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function emit(name = "overlay-state-changed", detail = state) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function emitSync() {
    emit("overlay-sync-status", { connected: serverConnected, mode: serverConnected ? "server" : "local" });
  }

  async function pushToServer(immediate = false) {
    if (!serverCapable || applyingRemote) return;

    const send = async () => {
      try {
        const response = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
          cache: "no-store"
        });
        serverConnected = response.ok;
      } catch {
        serverConnected = false;
      }
      emitSync();
    };

    if (immediate) {
      clearTimeout(pushTimer);
      pushTimer = null;
      await send();
      return;
    }

    clearTimeout(pushTimer);
    pushTimer = setTimeout(send, 70);
  }

  function broadcast(type = "state") {
    if (channel) channel.postMessage({ type, state });
    emit("overlay-state-changed", state);
    pushToServer();
  }

  function setState(nextState, options = {}) {
    state = mergeDeep(clone(DEFAULT_STATE), clone(nextState));
    persist();
    if (!options.silent) broadcast(options.type || "state");
    return state;
  }

  function updateState(path, value, options = {}) {
    const keys = path.split(".");
    let cursor = state;

    while (keys.length > 1) {
      const key = keys.shift();
      cursor[key] = cursor[key] || {};
      cursor = cursor[key];
    }

    cursor[keys[0]] = value;
    persist();

    if (!options.silent) {
      if (channel) channel.postMessage({ type: options.type || "state", state });
      emit("overlay-state-changed", state);
      pushToServer(Boolean(options.immediate));
    }

    return state;
  }

  function replaceFromRemote(nextState, type = "server") {
    applyingRemote = true;
    state = mergeDeep(clone(DEFAULT_STATE), clone(nextState));
    persist();
    emit("overlay-state-received", { type, state });
    applyingRemote = false;
  }

  function getState() { return state; }

  function resetState() {
    state = clone(DEFAULT_STATE);
    persist();
    broadcast("reset");
    return state;
  }

  function sanitizeSceneState(current) {
    const clean = clone(current);
    clean.timer.running = false;
    clean.timer.paused = false;
    clean.timer.baseElapsedMs = 0;
    clean.timer.startedAt = null;
    clean.layout.cameraEnabled = false;
    return clean;
  }

  function getScenes() {
    try { return JSON.parse(localStorage.getItem(SCENE_KEY) || "[]"); }
    catch { return []; }
  }

  function saveScene(name) {
    const scenes = getScenes();
    scenes.push({
      id: `scene-${Date.now()}`,
      name: name.trim() || `Scene ${scenes.length + 1}`,
      createdAt: new Date().toISOString(),
      state: sanitizeSceneState(state)
    });
    localStorage.setItem(SCENE_KEY, JSON.stringify(scenes));
    return scenes;
  }

  function loadScene(id) {
    const scene = getScenes().find((item) => item.id === id);
    if (!scene) return null;
    setState(scene.state, { type: "scene-loaded" });
    return scene;
  }

  function deleteScene(id) {
    const scenes = getScenes().filter((item) => item.id !== id);
    localStorage.setItem(SCENE_KEY, JSON.stringify(scenes));
    return scenes;
  }

  function renameScene(id, name) {
    const scenes = getScenes();
    const item = scenes.find((scene) => scene.id === id);
    if (item && name.trim()) item.name = name.trim();
    localStorage.setItem(SCENE_KEY, JSON.stringify(scenes));
    return scenes;
  }

  function duplicateScene(id) {
    const scenes = getScenes();
    const sourceScene = scenes.find((scene) => scene.id === id);
    if (!sourceScene) return scenes;
    scenes.push({
      ...clone(sourceScene),
      id: `scene-${Date.now()}`,
      name: `${sourceScene.name} Copy`,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(SCENE_KEY, JSON.stringify(scenes));
    return scenes;
  }

  if (channel) {
    channel.addEventListener("message", (event) => {
      if (!event.data?.state) return;
      replaceFromRemote(event.data.state, event.data.type || "broadcast");
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { replaceFromRemote(JSON.parse(event.newValue), "storage"); } catch {}
  });

  async function connectServer() {
    // GitHub Pages is intentionally a static demo host.
    // Same-browser tabs still sync through BroadcastChannel/localStorage.
    // Cross-device LAN sync uses the included Node server instead.
    if (!serverCapable || isGitHubPages) {
      serverConnected = false;
      emitSync();
      return;
    }

    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.ok) {
        const serverState = await response.json();
        if (serverState && Object.keys(serverState).length) {
          replaceFromRemote(serverState, "server-initial");
        } else {
          await pushToServer(true);
        }
        serverConnected = true;
      }
    } catch {
      serverConnected = false;
    }
    emitSync();

    try {
      source = new EventSource("/events");
      source.addEventListener("state", (event) => {
        try {
          const incoming = JSON.parse(event.data);
          serverConnected = true;
          replaceFromRemote(incoming, "server-event");
          emitSync();
        } catch {}
      });
      source.onopen = () => {
        serverConnected = true;
        emitSync();
      };
      source.onerror = () => {
        serverConnected = false;
        emitSync();
      };
    } catch {
      serverConnected = false;
      emitSync();
    }
  }


  function exportConfig() {
    const clean = clone(state);
    clean.timer.running = false;
    clean.timer.paused = false;
    clean.timer.baseElapsedMs = 0;
    clean.timer.startedAt = null;
    clean.layout.cameraEnabled = false;

    return {
      app: "CrossFit Broadcast Studio",
      version: 4,
      exportedAt: new Date().toISOString(),
      state: clean
    };
  }

  function importConfig(payload) {
    if (!payload || typeof payload !== "object") throw new Error("Invalid configuration file.");
    const next = payload.state || payload;
    if (!next.branding || !next.timer || !next.workout || !next.layout) {
      throw new Error("Configuration file is missing required sections.");
    }
    setState(next, { type: "config-import" });
    return state;
  }

  window.CrossFitState = {
    DEFAULT_STATE,
    getState,
    setState,
    updateState,
    resetState,
    saveScene,
    getScenes,
    loadScene,
    deleteScene,
    renameScene,
    duplicateScene,
    pushToServer,
    exportConfig,
    importConfig,
    isServerConnected: () => serverConnected,
    getEnvironmentMode: () => {
      if (serverConnected) return "server";
      if (isGitHubPages) return "github";
      if (isFileMode) return "file";
      return "local";
    }
  };

  connectServer();
})();
