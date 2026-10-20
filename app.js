const PROMPTS = [
  "Write about a room you have never entered.",
  "A letter arrives forty years late.",
  "Describe the last train of the night.",
  "Someone is practising the same three notes next door.",
  "The lighthouse keeper finds a note in a bottle.",
  "Begin with: The kettle had been boiling for an hour.",
  "A map with one place crossed out.",
  "Write a conversation conducted entirely in apologies.",
  "What the river kept.",
  "A key that no longer fits any door.",
  "Describe a meal you cannot quite remember.",
  "Two strangers wait for the same bus in the rain.",
  "A museum label for an object that does not exist.",
  "The house remembers every argument.",
  "Write about a colour you have never worn.",
  "A small town where nothing opens before ten.",
  "A parcel addressed to the previous tenant.",
  "The last five minutes before a thunderstorm.",
  "A book returned with margin notes in a stranger's hand.",
  "Tell the story backwards, beginning at the goodbye.",
  "An instruction manual for a machine that makes silence.",
  "A photograph nobody in the family recognises.",
  "The sound of a door closing in another room.",
  "Write without using the word I."
];

const STORAGE_HISTORY = "sprint.history.v1";
const STORAGE_DURATION = "sprint.duration.v1";
const STORAGE_MUTED = "sprint.muted.v1";
const DURATIONS = [5, 10, 15, 25];

const byId = (id) => document.getElementById(id);

const muteBtn = byId("muteBtn");
const muteIcon = byId("muteIcon");
const muteLabel = byId("muteLabel");
const timerTicks = byId("timerTicks");
const timerLabels = byId("timerLabels");
const timerRing = byId("timerRing");
const timerHand = byId("timerHand");
const timerDisplay = byId("timerDisplay");
const timerState = byId("timerState");
const timerDial = byId("timerDial");
const durationButtons = Array.from(document.querySelectorAll(".type-key"));
const startBtn = byId("startBtn");
const resetBtn = byId("resetBtn");
const fileBtn = byId("fileBtn");
const instrumentWords = byId("instrumentWords");
const paperSheet = byId("paperSheet");
const sheetNumber = byId("sheetNumber");
const sheetDate = byId("sheetDate");
const promptText = byId("promptText");
const shuffleBtn = byId("shuffleBtn");
const writingArea = byId("writingArea");
const wordCount = byId("wordCount");
const liveWpm = byId("liveWpm");
const paperTimer = byId("paperTimer");
const progressPercent = byId("progressPercent");
const progressRail = byId("progressRail");
const progressFill = byId("progressFill");
const completionStamp = byId("completionStamp");
const stampText = byId("stampText");
const stampDetail = byId("stampDetail");
const historyList = byId("historyList");
const historyEmpty = byId("historyEmpty");
const historySessions = byId("historySessions");
const historyWords = byId("historyWords");
const historyBest = byId("historyBest");
const clearHistoryBtn = byId("clearHistoryBtn");
const announcer = byId("announcer");

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    return;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeId() {
  return `sprint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

let history = readStorage(STORAGE_HISTORY, []);
if (!Array.isArray(history)) {
  history = [];
}
history = history.filter((session) => {
  return session && Number.isFinite(Number(session.words)) && typeof session.date === "string";
}).slice(0, 60);

let durationMinutes = clamp(Number(readStorage(STORAGE_DURATION, 15)) || 15, 5, 25);
if (!DURATIONS.includes(durationMinutes)) {
  durationMinutes = 15;
}
let muted = Boolean(readStorage(STORAGE_MUTED, false));
let totalMs = durationMinutes * 60000;
let remainingMs = totalMs;
let running = false;
let sessionStarted = false;
let sessionSaved = false;
let endAt = 0;
let ticker = null;
let currentPrompt = "";
let audioContext = null;
let noiseBuffer = null;
let lastKeySound = 0;
let lastWordCount = 0;

function formatClock(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function elapsedSeconds() {
  if (!sessionStarted) {
    return 0;
  }
  return Math.max(0, (totalMs - remainingMs) / 1000);
}

function progressFraction() {
  if (!sessionStarted || totalMs <= 0) {
    return 0;
  }
  return clamp(1 - remainingMs / totalMs, 0, 1);
}

function currentWpm() {
  const words = countWords(writingArea.value);
  const seconds = elapsedSeconds();
  if (words === 0 || seconds < 3) {
    return 0;
  }
  return Math.round(words / (seconds / 60));
}

function setTimerState(text) {
  timerState.textContent = text;
}

function renderTimer() {
  const progress = progressFraction();
  const percent = Math.round(progress * 100);
  const clock = formatClock(remainingMs);
  timerDisplay.textContent = clock;
  paperTimer.textContent = clock;
  timerDisplay.setAttribute("datetime", `PT${Math.ceil(remainingMs / 1000)}S`);
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  progressRail.setAttribute("aria-valuenow", String(percent));
  timerHand.setAttribute("transform", `rotate(${progress * 360} 120 120)`);
  timerRing.style.strokeDasharray = "100";
  timerRing.style.strokeDashoffset = String(100 - progress * 100);
  timerDial.setAttribute("aria-label", `Analog timer, ${clock} remaining, ${percent} percent complete`);
  if (running) {
    document.title = `${clock} · The Sprint Room`;
  } else if (sessionSaved) {
    document.title = "Filed · The Sprint Room";
  } else {
    document.title = "The Sprint Room — Timed Writing Desk";
  }
}

function updateMuteControl() {
  muteBtn.setAttribute("aria-pressed", String(!muted));
  muteLabel.textContent = muted ? "Muted" : "Sound on";
  muteIcon.textContent = muted ? "×" : "♪";
  writeStorage(STORAGE_MUTED, muted);
}

function ensureAudio() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    audioContext = new AudioCtor();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function getNoiseBuffer(context) {
  if (noiseBuffer) {
    return noiseBuffer;
  }
  const length = Math.max(1, Math.floor(context.sampleRate * 0.045));
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const falloff = 1 - index / length;
    channel[index] = (Math.random() * 2 - 1) * falloff;
  }
  return noiseBuffer;
}

function playKeySound() {
  if (muted) {
    return;
  }
  const context = ensureAudio();
  if (!context) {
    return;
  }
  const nowMs = performance.now();
  if (nowMs - lastKeySound < 36) {
    return;
  }
  lastKeySound = nowMs;
  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1500 + Math.random() * 900;
  filter.Q.value = 0.9;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(now);
  source.stop(now + 0.05);

  const thump = context.createOscillator();
  const thumpGain = context.createGain();
  thump.type = "triangle";
  thump.frequency.setValueAtTime(180 + Math.random() * 60, now);
  thumpGain.gain.setValueAtTime(0.012, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  thump.connect(thumpGain);
  thumpGain.connect(context.destination);
  thump.start(now);
  thump.stop(now + 0.035);
}

function playBell(finalBell = false) {
  if (muted) {
    return;
  }
  const context = ensureAudio();
  if (!context) {
    return;
  }
  const now = context.currentTime;
  const notes = finalBell ? [523.25, 783.99, 1046.5] : [1046.5, 1568];
  notes.forEach((frequency, index) => {
    const start = now + index * 0.11;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(finalBell ? 0.045 : 0.03, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.48);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.5);
  });
}

function buildDial() {
  const ticks = document.createDocumentFragment();
  for (let index = 0; index < 60; index += 1) {
    const angle = index * 6 * Math.PI / 180;
    const major = index % 5 === 0;
    const outer = 94;
    const inner = major ? 82 : 88;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(120 + Math.sin(angle) * outer));
    line.setAttribute("y1", String(120 - Math.cos(angle) * outer));
    line.setAttribute("x2", String(120 + Math.sin(angle) * inner));
    line.setAttribute("y2", String(120 - Math.cos(angle) * inner));
    if (major) {
      line.setAttribute("class", "major");
    }
    ticks.appendChild(line);
  }
  timerTicks.appendChild(ticks);

  const labels = [
    { text: "0", angle: 0 },
    { text: "25", angle: Math.PI / 2 },
    { text: "50", angle: Math.PI },
    { text: "75", angle: Math.PI * 1.5 }
  ];
  const labelGroup = document.createDocumentFragment();
  labels.forEach((label) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
    node.setAttribute("x", String(120 + Math.sin(label.angle) * 66));
    node.setAttribute("y", String(120 - Math.cos(label.angle) * 66 + 2.5));
    node.textContent = label.text;
    labelGroup.appendChild(node);
  });
  timerLabels.appendChild(labelGroup);
}

function updateSheetNumber() {
  sheetNumber.textContent = String(history.length + 1).padStart(3, "0");
}

function setDateStamp() {
  const now = new Date();
  sheetDate.textContent = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(now).toUpperCase();
  sheetDate.setAttribute("datetime", now.toISOString().slice(0, 10));
}

function randomPrompt(exclude = "") {
  let next = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  let guard = 0;
  while (next === exclude && guard < 20) {
    next = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    guard += 1;
  }
  return next;
}

function autoGrow() {
  writingArea.style.height = "auto";
  writingArea.style.height = `${writingArea.scrollHeight}px`;
}

function updateLiveStats() {
  const words = countWords(writingArea.value);
  wordCount.textContent = String(words);
  liveWpm.textContent = String(currentWpm());
  instrumentWords.textContent = `${words} ${words === 1 ? "word" : "words"}`;
  lastWordCount = words;
  syncControls();
}

function syncControls() {
  const words = countWords(writingArea.value);
  startBtn.textContent = sessionSaved
    ? "Sprint filed"
    : running
      ? "Pause sprint"
      : sessionStarted
        ? "Resume sprint"
        : "Start sprint";
  startBtn.disabled = sessionSaved;
  resetBtn.textContent = sessionSaved ? "New sheet" : "Reset";
  durationButtons.forEach((button) => {
    const selected = Number(button.dataset.minutes) === durationMinutes;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = sessionStarted || sessionSaved;
  });
  shuffleBtn.disabled = sessionStarted || sessionSaved;
  fileBtn.disabled = !(sessionStarted && !sessionSaved && words > 0);
  writingArea.readOnly = !sessionStarted || sessionSaved;
}

function setDuration(minutes, persist = true) {
  durationMinutes = minutes;
  totalMs = durationMinutes * 60000;
  remainingMs = totalMs;
  if (persist) {
    writeStorage(STORAGE_DURATION, durationMinutes);
  }
  syncControls();
  renderTimer();
  updateLiveStats();
}

function startSprint() {
  if (sessionSaved) {
    return;
  }
  if (running) {
    pauseSprint();
    return;
  }
  if (!sessionStarted) {
    sessionStarted = true;
    totalMs = durationMinutes * 60000;
    remainingMs = totalMs;
    setTimerState("Writing");
    setDateStamp();
    playBell(false);
    announcer.textContent = `Sprint started for ${durationMinutes} minutes. Begin writing.`;
  } else {
    setTimerState("Writing");
    announcer.textContent = "Sprint resumed.";
  }
  endAt = Date.now() + remainingMs;
  running = true;
  clearInterval(ticker);
  ticker = window.setInterval(tick, 200);
  syncControls();
  renderTimer();
  window.requestAnimationFrame(() => {
    writingArea.focus();
    autoGrow();
  });
}

function pauseSprint() {
  if (!running) {
    return;
  }
  remainingMs = Math.max(0, endAt - Date.now());
  running = false;
  clearInterval(ticker);
  ticker = null;
  endAt = 0;
  setTimerState("Paused");
  syncControls();
  renderTimer();
  updateLiveStats();
  announcer.textContent = "Sprint paused. The sheet is still here when you return.";
}

function tick() {
  if (!running) {
    return;
  }
  remainingMs = Math.max(0, endAt - Date.now());
  if (remainingMs <= 0) {
    finishSprint(true);
    return;
  }
  renderTimer();
  updateLiveStats();
}

function addHistoryEntry(entry) {
  history.unshift(entry);
  history = history.slice(0, 60);
  writeStorage(STORAGE_HISTORY, history);
  renderHistory();
}

function finishSprint(auto) {
  if (sessionSaved) {
    return;
  }
  clearInterval(ticker);
  ticker = null;
  running = false;
  if (auto) {
    remainingMs = 0;
  }
  const words = countWords(writingArea.value);
  const seconds = Math.max(1, Math.round(totalMs - remainingMs) / 1000);
  const wpm = words > 0 ? Math.round(words / (seconds / 60)) : 0;
  sessionSaved = true;
  writingArea.readOnly = true;
  completionStamp.hidden = false;
  stampText.textContent = auto ? "Time" : "Filed";
  stampDetail.textContent = `${words} ${words === 1 ? "word" : "words"} · ${wpm} wpm`;
  paperSheet.classList.add("is-filed");
  setTimerState(auto ? "Time" : "Filed early");
  addHistoryEntry({
    id: makeId(),
    date: new Date().toISOString(),
    minutes: durationMinutes,
    elapsedSeconds: Math.round(seconds),
    words,
    wpm,
    prompt: currentPrompt
  });
  syncControls();
  renderTimer();
  updateLiveStats();
  playBell(auto);
  announcer.textContent = auto
    ? `Time. Sprint filed with ${words} words and ${wpm} words per minute.`
    : `Sheet filed early with ${words} words and ${wpm} words per minute.`;
}

function resetSprint() {
  if (sessionStarted && !sessionSaved && countWords(writingArea.value) > 0) {
    const approved = window.confirm("Start a new sheet? The words on this sheet have not been filed and will be lost.");
    if (!approved) {
      return;
    }
  }
  clearInterval(ticker);
  ticker = null;
  running = false;
  sessionStarted = false;
  sessionSaved = false;
  endAt = 0;
  totalMs = durationMinutes * 60000;
  remainingMs = totalMs;
  writingArea.value = "";
  writingArea.readOnly = true;
  writingArea.style.height = "";
  completionStamp.hidden = true;
  paperSheet.classList.remove("is-filed");
  currentPrompt = randomPrompt(currentPrompt);
  promptText.textContent = currentPrompt;
  setTimerState("Ready");
  setDateStamp();
  updateSheetNumber();
  syncControls();
  renderTimer();
  updateLiveStats();
  autoGrow();
  announcer.textContent = `New sheet ready. ${durationMinutes} minutes on the timer.`;
  startBtn.focus();
}

function renderHistory() {
  historyList.replaceChildren();
  const fragment = document.createDocumentFragment();
  let totalWords = 0;
  let bestWpm = 0;
  history.forEach((session) => {
    const words = Number(session.words) || 0;
    const wpm = Number(session.wpm) || 0;
    totalWords += words;
    bestWpm = Math.max(bestWpm, wpm);

    const card = document.createElement("article");
    card.className = "history-card";

    const top = document.createElement("div");
    top.className = "history-top";
    const date = document.createElement("time");
    date.className = "history-date";
    const dateValue = new Date(session.date);
    if (Number.isNaN(dateValue.getTime())) {
      date.textContent = "Date unrecorded";
    } else {
      date.textContent = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(dateValue).toUpperCase();
      date.setAttribute("datetime", dateValue.toISOString());
      date.title = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(dateValue);
    }
    const minutes = document.createElement("span");
    minutes.className = "history-minutes";
    minutes.textContent = `${Number(session.minutes) || durationMinutes} min sprint`;
    top.appendChild(date);
    top.appendChild(minutes);

    const prompt = document.createElement("p");
    prompt.className = "history-prompt";
    prompt.textContent = session.prompt || "Prompt unrecorded";
    prompt.title = session.prompt || "";

    const stats = document.createElement("div");
    stats.className = "history-stats";
    [
      [String(words), words === 1 ? "word" : "words"],
      [String(wpm), "wpm"],
      [formatSeconds(Number(session.elapsedSeconds) || 0), "written"]
    ].forEach(([value, label]) => {
      const stat = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = value;
      stat.appendChild(strong);
      stat.appendChild(document.createTextNode(` ${label}`));
      stats.appendChild(stat);
    });

    card.appendChild(top);
    card.appendChild(prompt);
    card.appendChild(stats);
    fragment.appendChild(card);
  });
  historyList.appendChild(fragment);
  historySessions.textContent = String(history.length);
  historyWords.textContent = String(totalWords);
  historyBest.textContent = String(bestWpm);
  clearHistoryBtn.disabled = history.length === 0;
  historyEmpty.hidden = history.length > 0;
}

durationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (sessionStarted || sessionSaved) {
      return;
    }
    const minutes = Number(button.dataset.minutes);
    if (!DURATIONS.includes(minutes)) {
      return;
    }
    setDuration(minutes);
    announcer.textContent = `Session length set to ${minutes} minutes.`;
  });
});

startBtn.addEventListener("click", startSprint);
resetBtn.addEventListener("click", resetSprint);

fileBtn.addEventListener("click", () => {
  if (!sessionStarted || sessionSaved || countWords(writingArea.value) === 0) {
    return;
  }
  if (running) {
    remainingMs = Math.max(0, endAt - Date.now());
  }
  finishSprint(remainingMs <= 0);
});

shuffleBtn.addEventListener("click", () => {
  if (sessionStarted || sessionSaved) {
    return;
  }
  currentPrompt = randomPrompt(currentPrompt);
  promptText.textContent = currentPrompt;
  announcer.textContent = "New prompt drawn.";
});

muteBtn.addEventListener("click", () => {
  muted = !muted;
  updateMuteControl();
  if (!muted) {
    ensureAudio();
    playKeySound();
    announcer.textContent = "Typing sounds on.";
  } else {
    announcer.textContent = "Typing sounds muted.";
  }
});

writingArea.addEventListener("keydown", (event) => {
  if (!sessionStarted || sessionSaved) {
    return;
  }
  if (event.key.length === 1 || event.key === "Backspace" || event.key === "Enter") {
    playKeySound();
  }
});

writingArea.addEventListener("input", () => {
  autoGrow();
  updateLiveStats();
});

window.addEventListener("resize", autoGrow);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && running) {
    tick();
  }
});

clearHistoryBtn.addEventListener("click", () => {
  if (history.length === 0) {
    return;
  }
  const approved = window.confirm("Empty the filing drawer? Every saved sprint sheet will be removed.");
  if (!approved) {
    return;
  }
  history = [];
  writeStorage(STORAGE_HISTORY, history);
  renderHistory();
  if (!sessionStarted) {
    updateSheetNumber();
  }
  announcer.textContent = "The filing drawer is empty.";
});

buildDial();
setDuration(durationMinutes, false);
currentPrompt = randomPrompt();
promptText.textContent = currentPrompt;
updateMuteControl();
setDateStamp();
updateSheetNumber();
renderHistory();
setTimerState("Ready");
syncControls();
renderTimer();
updateLiveStats();
autoGrow();
