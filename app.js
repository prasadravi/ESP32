// ==========================================================
// Voice home control — web app prototype
// Stage 1 of the project: standalone web app with speech
// recognition/synthesis, simulated devices, and settings.
// Stage 3+: same code talks to the real ESP32 over Wi-Fi
// once "ESP32 mode" is selected in settings.
// ==========================================================

const STORAGE_KEY = "voiceHomeControlState";

const defaultState = {
  assistantName: "Mitra",
  language: "en-US",
  mode: "simulated", // "simulated" | "esp32"
  esp32Ip: "",
  voiceReply: true,
  devices: { light: false, fan: false },
  lastTemperature: null,
  history: [] // { time, transcript, commandId, status, detail }
};

let state = loadState();

// ----------------------------------------------------------
// Command dictionary
// Add more phrases here as you test real speech patterns —
// matching is substring-based, not exact, so near variations
// of a listed phrase will still match.
// ----------------------------------------------------------

const commandPatterns = [
  {
    id: "LIGHT_ON",
    patterns: [
      "turn on the light", "turn on light", "light on", "switch on the light",
      "లైట్ ఆన్", "లైట్ వెలిగించు"
    ]
  },
  {
    id: "LIGHT_OFF",
    patterns: [
      "turn off the light", "turn off light", "light off", "switch off the light",
      "లైట్ ఆఫ్", "లైట్ ఆర్పు"
    ]
  },
  {
    id: "FAN_ON",
    patterns: [
      "turn on the fan", "turn on fan", "fan on", "switch on the fan",
      "ఫ్యాన్ ఆన్", "ఫ్యాన్ వేయి"
    ]
  },
  {
    id: "FAN_OFF",
    patterns: [
      "turn off the fan", "turn off fan", "fan off", "switch off the fan",
      "ఫ్యాన్ ఆఫ్", "ఫ్యాన్ ఆపు"
    ]
  },
  {
    id: "GET_TEMPERATURE",
    patterns: [
      "what is the temperature", "tell me the temperature", "temperature please",
      "check the temperature", "how hot is it",
      "ఉష్ణోగ్రత ఎంత", "ఉష్ణోగ్రత చెప్పు"
    ]
  }
];

function matchCommand(transcript) {
  const t = transcript.toLowerCase().trim();
  for (const entry of commandPatterns) {
    for (const phrase of entry.patterns) {
      if (t.includes(phrase.toLowerCase())) return entry.id;
    }
  }
  return null;
}

// ----------------------------------------------------------
// State persistence
// ----------------------------------------------------------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed, devices: { ...defaultState.devices, ...(parsed.devices || {}) } };
  } catch (e) {
    console.error("Failed to load saved state, using defaults.", e);
    return { ...defaultState };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state.", e);
  }
}

// ----------------------------------------------------------
// DOM references
// ----------------------------------------------------------

const el = {
  pageTitle: document.getElementById("pageTitle"),
  assistantNameDisplay: document.getElementById("assistantNameDisplay"),
  micButton: document.getElementById("micButton"),
  micStatus: document.getElementById("micStatus"),
  transcript: document.getElementById("transcript"),
  lightState: document.getElementById("lightState"),
  fanState: document.getElementById("fanState"),
  tempReading: document.getElementById("tempReading"),
  historyList: document.getElementById("historyList"),
  clearHistory: document.getElementById("clearHistory"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsPanel: document.getElementById("settingsPanel"),
  settingsBackdrop: document.getElementById("settingsBackdrop"),
  closeSettings: document.getElementById("closeSettings"),
  assistantNameInput: document.getElementById("assistantNameInput"),
  languageSelect: document.getElementById("languageSelect"),
  modeSimulated: document.getElementById("modeSimulated"),
  modeEsp32: document.getElementById("modeEsp32"),
  espIpField: document.getElementById("espIpField"),
  esp32IpInput: document.getElementById("esp32IpInput"),
  voiceReplyToggle: document.getElementById("voiceReplyToggle"),
  saveSettings: document.getElementById("saveSettings"),
  deviceButtons: document.querySelectorAll(".device-btn")
};

// ----------------------------------------------------------
// Rendering
// ----------------------------------------------------------

function renderAll() {
  el.pageTitle.textContent = state.assistantName + " · Voice home control";
  el.assistantNameDisplay.textContent = state.assistantName;

  el.lightState.textContent = state.devices.light ? "ON" : "OFF";
  el.lightState.className = "device-state " + (state.devices.light ? "on" : "off");

  el.fanState.textContent = state.devices.fan ? "ON" : "OFF";
  el.fanState.className = "device-state " + (state.devices.fan ? "on" : "off");

  if (state.lastTemperature !== null) {
    el.tempReading.textContent = state.lastTemperature.toFixed(1) + " °C";
    el.tempReading.className = "device-state neutral";
  }

  // Settings fields
  el.assistantNameInput.value = state.assistantName;
  el.languageSelect.value = state.language;
  el.modeSimulated.checked = state.mode === "simulated";
  el.modeEsp32.checked = state.mode === "esp32";
  el.esp32IpInput.value = state.esp32Ip;
  el.voiceReplyToggle.checked = state.voiceReply;
  el.espIpField.style.display = state.mode === "esp32" ? "flex" : "none";

  renderHistory();
}

function renderHistory() {
  el.historyList.innerHTML = "";

  if (state.history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "No commands yet — try the mic or a device button.";
    el.historyList.appendChild(empty);
    return;
  }

  // Newest first
  for (const entry of [...state.history].reverse()) {
    const li = document.createElement("li");
    li.className = "history-item";

    const top = document.createElement("div");
    top.className = "history-item-top";
    top.innerHTML = `<span>${entry.time}</span><span>${entry.source}</span>`;

    const transcriptLine = document.createElement("div");
    transcriptLine.className = "history-item-transcript";
    transcriptLine.textContent = entry.transcript || "(manual button press)";

    const commandLine = document.createElement("div");
    commandLine.className = "history-item-command " + (entry.status === "ok" ? "ok" : "error");
    commandLine.textContent = (entry.commandId || "NO_MATCH") + " — " + entry.detail;

    li.appendChild(top);
    li.appendChild(transcriptLine);
    li.appendChild(commandLine);
    el.historyList.appendChild(li);
  }
}

function addHistory(transcript, commandId, status, detail, source) {
  state.history.push({
    time: new Date().toLocaleTimeString(),
    transcript,
    commandId,
    status,
    detail,
    source
  });
  if (state.history.length > 50) state.history.shift();
  saveState();
  renderHistory();
}

// ----------------------------------------------------------
// Speech synthesis
// ----------------------------------------------------------

function speak(text) {
  if (!state.voiceReply) return;
  if (!("speechSynthesis" in window)) return;

  const addressedText = state.assistantName ? `${state.assistantName}, ${text}` : text;
  const utterance = new SpeechSynthesisUtterance(addressedText);
  utterance.lang = state.language;
  window.speechSynthesis.cancel(); // stop any overlapping speech
  window.speechSynthesis.speak(utterance);
}

// ----------------------------------------------------------
// Command execution
// ----------------------------------------------------------

async function executeCommand(commandId, transcript, source) {
  if (state.mode === "simulated") {
    executeSimulated(commandId, transcript, source);
  } else {
    await executeOnEsp32(commandId, transcript, source);
  }
}

function executeSimulated(commandId, transcript, source) {
  let detail = "";

  switch (commandId) {
    case "LIGHT_ON":
      state.devices.light = true;
      detail = "light switched on (simulated)";
      speak("Turning on the light.");
      break;
    case "LIGHT_OFF":
      state.devices.light = false;
      detail = "light switched off (simulated)";
      speak("Turning off the light.");
      break;
    case "FAN_ON":
      state.devices.fan = true;
      detail = "fan switched on (simulated)";
      speak("Turning on the fan.");
      break;
    case "FAN_OFF":
      state.devices.fan = false;
      detail = "fan switched off (simulated)";
      speak("Turning off the fan.");
      break;
    case "GET_TEMPERATURE": {
      const simulatedTemp = 24 + Math.random() * 8; // 24-32°C
      state.lastTemperature = simulatedTemp;
      detail = "simulated reading";
      speak(`The temperature is ${simulatedTemp.toFixed(1)} degrees.`);
      break;
    }
  }

  saveState();
  renderAll();
  addHistory(transcript, commandId, "ok", detail, source);
}

async function executeOnEsp32(commandId, transcript, source) {
  if (!state.esp32Ip) {
    speak("ESP32 IP address is not set. Please add it in settings.");
    addHistory(transcript, commandId, "error", "ESP32 IP not configured", source);
    return;
  }

  const url = `http://${state.esp32Ip}/command?cmd=${encodeURIComponent(commandId)}`;

  try {
    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    if (data.status !== "ok") {
      speak("The device reported an error.");
      addHistory(transcript, commandId, "error", data.message || "device error", source);
      return;
    }

    if (commandId === "LIGHT_ON") state.devices.light = true;
    if (commandId === "LIGHT_OFF") state.devices.light = false;
    if (commandId === "FAN_ON") state.devices.fan = true;
    if (commandId === "FAN_OFF") state.devices.fan = false;

    let detail = "confirmed by ESP32";

    if (commandId === "GET_TEMPERATURE") {
      state.lastTemperature = data.temperature;
      detail = `${data.temperature}°C, ${data.humidity}% humidity`;
      speak(`The temperature is ${data.temperature} degrees.`);
    } else if (commandId.startsWith("LIGHT")) {
      speak(commandId === "LIGHT_ON" ? "Light is on." : "Light is off.");
    } else if (commandId.startsWith("FAN")) {
      speak(commandId === "FAN_ON" ? "Fan is on." : "Fan is off.");
    }

    saveState();
    renderAll();
    addHistory(transcript, commandId, "ok", detail, source);

  } catch (err) {
    console.error(err);
    speak("Could not reach the ESP32. Check that it's on the same Wi-Fi network.");
    addHistory(transcript, commandId, "error", "network error — could not reach ESP32", source);
  }
}

// ----------------------------------------------------------
// Speech recognition
// ----------------------------------------------------------

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecognitionActive = false;

if (SpeechRecognitionImpl) {
  recognition = new SpeechRecognitionImpl();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    el.transcript.textContent = transcript;
    handleTranscript(transcript);
  };

  recognition.onerror = (event) => {
    isRecognitionActive = false;
    setListeningUI(false);
    const messages = {
      "not-allowed": "Microphone blocked. Allow microphone access in browser settings, then try again.",
      "service-not-allowed": "Speech service is unavailable. Try Chrome or Edge with an internet connection.",
      "audio-capture": "No microphone was found. Connect a microphone and try again.",
      "network": "Speech recognition needs an internet connection.",
      "no-speech": "No speech detected. Tap the microphone and try again."
    };
    el.micStatus.textContent = messages[event.error] || "Microphone error: " + event.error;
  };

  recognition.onend = () => {
    isRecognitionActive = false;
    setListeningUI(false);
  };
}

function setListeningUI(isListening) {
  el.micButton.classList.toggle("listening", isListening);
  el.micStatus.textContent = isListening ? "Listening…" : "Tap to speak";
}

async function startListening() {
  if (!recognition) {
    el.micStatus.textContent = "Speech recognition is unavailable. Try Chrome or Edge.";
    return;
  }

  if (!window.isSecureContext) {
    el.micStatus.textContent = "Microphone requires http://localhost or https://.";
    return;
  }

  if (isRecognitionActive) return;

  recognition.lang = state.language;
  el.transcript.textContent = "";
  isRecognitionActive = true;
  el.micStatus.textContent = "Requesting microphone access…";

  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    }
    recognition.start();
    setListeningUI(true);
  } catch (error) {
    isRecognitionActive = false;
    setListeningUI(false);
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      el.micStatus.textContent = "Microphone blocked. Allow access and try again.";
    } else if (error.name === "NotFoundError") {
      el.micStatus.textContent = "No microphone was found.";
    } else if (error.name !== "InvalidStateError") {
      el.micStatus.textContent = "Could not start the microphone. Try again.";
    }
    console.warn("Could not start speech recognition.", error);
  }
}

function handleTranscript(transcript) {
  const assistantName = state.assistantName.trim().toLowerCase();
  const normalizedTranscript = transcript.trim().toLowerCase().replace(/[,.!?]/g, "");

  if (assistantName && normalizedTranscript === assistantName) {
    speak("Yes, how can I help?");
    return;
  }

  const commandId = matchCommand(transcript);
  if (!commandId) {
    speak("Sorry, I didn't understand that.");
    addHistory(transcript, null, "error", "no matching command", "voice");
    return;
  }
  executeCommand(commandId, transcript, "voice");
}

// ----------------------------------------------------------
// Event wiring
// ----------------------------------------------------------

el.micButton.addEventListener("click", startListening);

el.deviceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    executeCommand(btn.dataset.cmd, null, "button");
  });
});

el.clearHistory.addEventListener("click", () => {
  state.history = [];
  saveState();
  renderHistory();
});

function openSettings() {
  el.settingsPanel.classList.add("open");
  el.settingsPanel.setAttribute("aria-hidden", "false");
  el.settingsBackdrop.classList.add("visible");
}

function closeSettingsPanel() {
  el.settingsPanel.classList.remove("open");
  el.settingsPanel.setAttribute("aria-hidden", "true");
  el.settingsBackdrop.classList.remove("visible");
}

el.settingsToggle.addEventListener("click", openSettings);
el.closeSettings.addEventListener("click", closeSettingsPanel);
el.settingsBackdrop.addEventListener("click", closeSettingsPanel);

// Show/hide the ESP32 IP field based on the selected connection mode
el.modeSimulated.addEventListener("change", () => {
  if (el.modeSimulated.checked) el.espIpField.style.display = "none";
});
el.modeEsp32.addEventListener("change", () => {
  if (el.modeEsp32.checked) el.espIpField.style.display = "flex";
});

el.saveSettings.addEventListener("click", () => {
  state.assistantName = el.assistantNameInput.value.trim() || defaultState.assistantName;
  state.language = el.languageSelect.value;
  state.mode = el.modeEsp32.checked ? "esp32" : "simulated";
  state.esp32Ip = el.esp32IpInput.value.trim();
  state.voiceReply = el.voiceReplyToggle.checked;

  saveState();
  renderAll();
  closeSettingsPanel();
});

// ----------------------------------------------------------
// Init
// ----------------------------------------------------------

renderAll();
