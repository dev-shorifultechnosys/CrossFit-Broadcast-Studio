/* =========================================================
   Timestamp-based timer engine
   One important reliability change in V2:
   no page continuously writes timer ticks to shared storage.
   Every client derives the same display from absolute timestamps.
   This prevents double-speed timers when Control + OBS + Remote
   are all open at the same time.
   ========================================================= */
(function () {
  "use strict";

  const State = window.CrossFitState;

  function formatTime(milliseconds, floor = false) {
    const ms = Math.max(0, Number(milliseconds) || 0);
    const totalSeconds = floor ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mm = minutes % 60;
      return [hours, mm, seconds].map((v) => String(v).padStart(2, "0")).join(":");
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function parseDuration(token) {
    const value = String(token || "").trim().toLowerCase();
    if (!value) return null;

    if (/^\d+:\d{1,2}$/.test(value)) {
      const [m, s] = value.split(":").map(Number);
      if (s > 59) return null;
      return m * 60 + s;
    }
    if (/^\d+(\.\d+)?m$/.test(value)) return Math.round(parseFloat(value) * 60);
    if (/^\d+(\.\d+)?s?$/.test(value)) return Math.round(parseFloat(value.replace("s", "")));
    return null;
  }

  function splitTopLevel(expression) {
    const parts = [];
    let depth = 0, current = "";
    for (const character of expression) {
      if (character === "(") depth++;
      if (character === ")") depth--;
      if (depth < 0) throw new Error("Unbalanced parentheses");

      if (character === "+" && depth === 0) {
        if (current) parts.push(current);
        current = "";
      } else {
        current += character;
      }
    }
    if (depth !== 0) throw new Error("Unbalanced parentheses");
    if (current) parts.push(current);
    return parts;
  }

  function parseSequence(expression) {
    const input = String(expression || "").replace(/\s+/g, "");
    if (!input) return [];

    function parseGroup(group) {
      let result = [];
      for (let part of splitTopLevel(group)) {
        if (!part) continue;

        let match = part.match(/^(\d+)\*\((.+)\)$/);
        if (match) {
          const count = Number(match[1]);
          const nested = parseGroup(match[2]);
          for (let i = 0; i < count; i++) result = result.concat(nested);
          continue;
        }

        match = part.match(/^(\d+)\*(.+)$/);
        if (match) {
          const count = Number(match[1]);
          const duration = parseDuration(match[2]);
          if (duration === null) throw new Error(`Invalid duration: ${match[2]}`);
          for (let i = 0; i < count; i++) result.push(duration);
          continue;
        }

        if (part.startsWith("(") && part.endsWith(")")) {
          result = result.concat(parseGroup(part.slice(1, -1)));
          continue;
        }

        const duration = parseDuration(part);
        if (duration === null) throw new Error(`Invalid duration: ${part}`);
        result.push(duration);
      }
      return result;
    }

    return parseGroup(input).filter((s) => Number.isFinite(s) && s >= 0);
  }

  function validateSequence(expression) {
    if (!String(expression || "").trim()) {
      return { valid: true, empty: true, segments: [], totalSeconds: 0 };
    }
    try {
      const segments = parseSequence(expression);
      if (!segments.length) throw new Error("No valid intervals");
      return {
        valid: true,
        empty: false,
        segments,
        totalSeconds: segments.reduce((a, b) => a + b, 0)
      };
    } catch (error) {
      return { valid: false, empty: false, segments: [], totalSeconds: 0, message: error.message };
    }
  }

  function configuredSegments(timer) {
    const custom = validateSequence(timer.customSequence);
    if (custom.valid && !custom.empty) {
      return custom.segments.map((seconds, index) => ({
        seconds, label: `INTERVAL ${index + 1}`, round: index + 1, totalRounds: custom.segments.length
      }));
    }

    if (timer.mode === "interval") {
      const result = [];
      for (let round = 1; round <= timer.rounds; round++) {
        result.push({ seconds: timer.workSeconds, label: "WORK", round, totalRounds: timer.rounds });
        if (timer.restSeconds > 0 && round < timer.rounds) {
          result.push({ seconds: timer.restSeconds, label: "REST", round, totalRounds: timer.rounds });
        }
      }
      return result;
    }

    return [{ seconds: timer.timeCapMinutes * 60, label: timer.mode === "stopwatch" ? "STOPWATCH" : "COUNTDOWN", round:1, totalRounds:1 }];
  }

  function elapsedMs(timer, now = Date.now()) {
    const base = Math.max(0, Number(timer.baseElapsedMs) || 0);
    if (timer.running && timer.startedAt) return base + Math.max(0, now - timer.startedAt);
    return base;
  }

  function totalProgramMs(timer) {
    const lead = Math.max(0, timer.leadIn) * 1000;
    if (timer.mode === "stopwatch" || timer.mode === "countdown") {
      return lead + Math.max(0, timer.timeCapMinutes) * 60 * 1000;
    }
    return lead + configuredSegments(timer).reduce((sum, item) => sum + item.seconds * 1000, 0);
  }

  function displayModel(state = State.getState(), now = Date.now()) {
    const timer = state.timer;
    const leadMs = Math.max(0, timer.leadIn) * 1000;
    const elapsed = elapsedMs(timer, now);
    const segments = configuredSegments(timer);
    const total = totalProgramMs(timer);

    if (!timer.running && !timer.paused && timer.baseElapsedMs === 0) {
      if (leadMs > 0) {
        return {
          text: timer.mode === "stopwatch" ? "00:00" : formatTime((segments[0]?.seconds || timer.timeCapMinutes * 60) * 1000),
          phase: "READY",
          roundText: segments[0] ? `ROUND ${segments[0].round} / ${segments[0].totalRounds}` : "",
          timeCapText: `TIME CAP ${formatTime(timer.timeCapMinutes * 60 * 1000)}`,
          progress: 0,
          finished: false,
          segmentIndex: 0,
          segment: segments[0],
          overallElapsedMs: 0
        };
      }
    }

    if (elapsed < leadMs) {
      const remaining = leadMs - elapsed;
      return {
        text: formatTime(remaining),
        phase: "GET READY",
        roundText: "STARTING SOON",
        timeCapText: `TIME CAP ${formatTime(timer.timeCapMinutes * 60 * 1000)}`,
        progress: 1 - remaining / Math.max(1, leadMs),
        finished: false,
        segmentIndex: -1,
        segment: null,
        overallElapsedMs: elapsed
      };
    }

    const activeElapsed = elapsed - leadMs;

    if (timer.mode === "stopwatch") {
      const cap = timer.timeCapMinutes * 60 * 1000;
      const shown = Math.min(activeElapsed, cap);
      return {
        text: formatTime(shown, true),
        phase: activeElapsed >= cap ? "FINISHED" : (timer.paused ? "PAUSED" : "STOPWATCH"),
        roundText: "",
        timeCapText: `TIME CAP ${formatTime(cap)}`,
        progress: Math.min(1, shown / Math.max(1, cap)),
        finished: activeElapsed >= cap,
        segmentIndex: 0,
        segment: segments[0],
        overallElapsedMs: activeElapsed
      };
    }

    if (timer.mode === "countdown") {
      const cap = timer.timeCapMinutes * 60 * 1000;
      const remaining = Math.max(0, cap - activeElapsed);
      return {
        text: formatTime(remaining),
        phase: remaining <= 0 ? "FINISHED" : (timer.paused ? "PAUSED" : "COUNTDOWN"),
        roundText: "",
        timeCapText: `TIME CAP ${formatTime(cap)}`,
        progress: Math.min(1, activeElapsed / Math.max(1, cap)),
        finished: remaining <= 0,
        segmentIndex: 0,
        segment: segments[0],
        overallElapsedMs: activeElapsed
      };
    }

    let cursor = 0;
    for (let i = 0; i < segments.length; i++) {
      const duration = segments[i].seconds * 1000;
      if (activeElapsed < cursor + duration) {
        const within = activeElapsed - cursor;
        const remaining = duration - within;
        return {
          text: formatTime(remaining),
          phase: timer.paused ? "PAUSED" : segments[i].label,
          roundText: `ROUND ${segments[i].round} / ${segments[i].totalRounds}`,
          timeCapText: `TIME CAP ${formatTime(timer.timeCapMinutes * 60 * 1000)}`,
          progress: Math.min(1, within / Math.max(1, duration)),
          finished: false,
          segmentIndex: i,
          segment: segments[i],
          overallElapsedMs: activeElapsed,
          segmentElapsedMs: within,
          segmentDurationMs: duration
        };
      }
      cursor += duration;
    }

    const finalSegment = segments[segments.length - 1];
    return {
      text: "00:00",
      phase: "FINISHED",
      roundText: finalSegment ? `ROUND ${finalSegment.round} / ${finalSegment.totalRounds}` : "",
      timeCapText: `TIME CAP ${formatTime(timer.timeCapMinutes * 60 * 1000)}`,
      progress: 1,
      finished: true,
      segmentIndex: Math.max(0, segments.length - 1),
      segment: finalSegment,
      overallElapsedMs: activeElapsed
    };
  }

  function mutateTimer(mutator, type) {
    const state = State.getState();
    const timer = { ...state.timer };
    mutator(timer);
    State.updateState("timer", timer, { type, immediate: true });
  }

  function startTimer() {
    const current = State.getState().timer;
    if (current.running) return;

    mutateTimer((timer) => {
      timer.running = true;
      timer.paused = false;
      timer.startedAt = Date.now();
    }, "timer-start");
  }

  function pauseTimer() {
    const current = State.getState().timer;
    if (!current.running) return;
    const elapsed = elapsedMs(current);

    mutateTimer((timer) => {
      timer.baseElapsedMs = elapsed;
      timer.startedAt = null;
      timer.running = false;
      timer.paused = true;
    }, "timer-pause");
  }

  function resetTimer() {
    mutateTimer((timer) => {
      timer.running = false;
      timer.paused = false;
      timer.baseElapsedMs = 0;
      timer.startedAt = null;
    }, "timer-reset");
  }

  function nextSegment() {
    const state = State.getState();
    const timer = state.timer;
    if (timer.mode !== "interval") return;

    const model = displayModel(state);
    const leadMs = Math.max(0, timer.leadIn) * 1000;
    const segments = configuredSegments(timer);

    let target = leadMs;
    const nextIndex = Math.max(0, model.segmentIndex + 1);
    for (let i = 0; i < nextIndex && i < segments.length; i++) target += segments[i].seconds * 1000;

    mutateTimer((draft) => {
      draft.baseElapsedMs = target;
      draft.startedAt = draft.running ? Date.now() : null;
      if (!draft.running) draft.paused = true;
    }, "timer-next");
  }

  function trafficColor(state = State.getState(), model = displayModel(state)) {
    const timer = state.timer;
    if (!timer.trafficColors) return timer.color;

    let progress = model.progress;
    if (timer.trafficBasis === "overall") {
      const cap = Math.max(1, timer.timeCapMinutes * 60 * 1000);
      progress = Math.min(1, model.overallElapsedMs / cap);
    }

    if (progress >= .9) return "#ff453a";
    if (progress >= .75) return "#ffd60a";
    return "#34c759";
  }


  function modeLabel(timer) {
    const preset = timer.preset || "";
    const labels = {
      "for-time": "For Time",
      "amrap": "AMRAP",
      "emom": "EMOM",
      "tabata": "Tabata",
      "interval": "Interval",
      "custom": "Custom"
    };
    return labels[preset] || (timer.mode === "stopwatch" ? "Stopwatch" : timer.mode === "countdown" ? "Countdown" : "Interval");
  }

  window.CrossFitTimer = {
    formatTime,
    parseSequence,
    validateSequence,
    configuredSegments,
    elapsedMs,
    displayModel,
    trafficColor,
    startTimer,
    pauseTimer,
    resetTimer,
    nextSegment,
    modeLabel
  };
})();
