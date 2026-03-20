const socket = io("https://family-playday-game.onrender.com");

let currentRoom = null;
let myId = null;
let currentTurnPlayerId = null;
let eventTimeout = null;
let sharedRollingInterval = null;
let sharedTurnRollAnimating = false;
let globalAlertTimeout = null;
let allowPageExit = false;

const CARD_READ_TIME = 9000;
const GLOBAL_ALERT_TIME = 2400;

const EMOJI_OPTIONS = ["😎", "🤠", "😈", "👽", "🤖", "🐸", "🦊", "🐵", "🐼", "🦄", "🐱", "🐶"];
const HAT_OPTIONS = ["🧢", "🎩", "👑", "🪖", "⛑️", "🎓", "🤠", "🪩", "✨", "❌"];
const COLOR_OPTIONS = ["#4fd081", "#5b88f1", "#f05b5b", "#f0c64d", "#9b6bff", "#ff8f4f", "#3ed1d7", "#f26bd3"];

let selectedAvatar = {
  emoji: "😎",
  hat: "🧢",
  color: "#4fd081"
};

let audioContext = null;
let musicStarted = false;
let musicEnabled = false;

const menuScreen = document.getElementById("menuScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const rollScreen = document.getElementById("rollScreen");
const gameScreen = document.getElementById("gameScreen");

const nameInput = document.getElementById("nameInput");
const roomCodeInput = document.getElementById("roomCodeInput");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const startGameBtn = document.getElementById("startGameBtn");
const leaveLobbyBtn = document.getElementById("leaveLobbyBtn");
const rollBtn = document.getElementById("rollBtn");
const rollTurnBtn = document.getElementById("rollTurnBtn");

const messageEl = document.getElementById("message");
const lobbyMessageEl = document.getElementById("lobbyMessage");
const rollMessageEl = document.getElementById("rollMessage");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const rollRoomCodeDisplay = document.getElementById("rollRoomCodeDisplay");
const gameRoomCodeShort = document.getElementById("gameRoomCodeShort");
const bankAmount = document.getElementById("bankAmount");
const currentTurnText = document.getElementById("currentTurnText");
const turnInfoText = document.getElementById("turnInfoText");

const playerList = document.getElementById("playerList");
const gamePlayersList = document.getElementById("gamePlayersList");
const rollResults = document.getElementById("rollResults");
const turnOrderResults = document.getElementById("turnOrderResults");

const lobbyChatList = document.getElementById("lobbyChatList");
const lobbyChatInput = document.getElementById("lobbyChatInput");
const sendLobbyChatBtn = document.getElementById("sendLobbyChatBtn");

const gameChatList = document.getElementById("gameChatList");
const gameChatInput = document.getElementById("gameChatInput");
const sendGameChatBtn = document.getElementById("sendGameChatBtn");

const dice = document.getElementById("dice");
const diceValueText = document.getElementById("diceValueText");

const eventPopup = document.getElementById("eventPopup");
const eventTitle = document.getElementById("eventTitle");
const eventMessage = document.getElementById("eventMessage");

const revealOverlay = document.getElementById("revealOverlay");
const revealPlayer = document.getElementById("revealPlayer");
const revealCount = document.getElementById("revealCount");
const revealCard = document.getElementById("revealCard");
const revealFrontTitle = document.getElementById("revealFrontTitle");
const revealFrontText = document.getElementById("revealFrontText");
const revealAmount = document.getElementById("revealAmount");

const sharedDiceOverlay = document.getElementById("sharedDiceOverlay");
const sharedDiceTitle = document.getElementById("sharedDiceTitle");
const sharedDiceCube = document.getElementById("sharedDiceCube");
const sharedDiceValue = document.getElementById("sharedDiceValue");

const playdayOverlay = document.getElementById("playdayOverlay");
const playdayTitle = document.getElementById("playdayTitle");
const playdayText = document.getElementById("playdayText");
const playdayRain = document.getElementById("playdayRain");

const dealDeckCard = document.querySelector(".dealDeck");
const mailDeckCard = document.querySelector(".mailDeck");

const emojiChoices = document.getElementById("emojiChoices");
const hatChoices = document.getElementById("hatChoices");
const colorChoices = document.getElementById("colorChoices");
const avatarPreview = document.getElementById("avatarPreview");

const bgMusic = document.getElementById("bgMusic");
const musicToggleBtn = document.getElementById("musicToggleBtn");

function getReconnectId() {
  let reconnectId = sessionStorage.getItem("playday_reconnect_id");
  if (!reconnectId) {
    reconnectId = `playday_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    sessionStorage.setItem("playday_reconnect_id", reconnectId);
  }
  return reconnectId;
}

function clearReconnectId() {
  sessionStorage.removeItem("playday_reconnect_id");
}

let reconnectId = getReconnectId();

function resetReconnectId() {
  clearReconnectId();
  reconnectId = getReconnectId();
}

function isTypingInField(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function isInActiveRoom() {
  return !!(currentRoom && currentRoom.code && currentRoom.phase);
}

function enableIntentionalPageExit() {
  allowPageExit = true;
  setTimeout(() => {
    allowPageExit = false;
  }, 2500);
}

window.addEventListener("beforeunload", (e) => {
  if (allowPageExit) return;
  if (!isInActiveRoom()) return;

  e.preventDefault();
  e.returnValue = "";
});

document.addEventListener("keydown", (e) => {
  if (allowPageExit) return;
  if (!isInActiveRoom()) return;

  const key = String(e.key || "").toLowerCase();
  const refreshing =
    key === "f5" ||
    ((e.ctrlKey || e.metaKey) && key === "r");

  if (refreshing && !isTypingInField(e.target)) {
    e.preventDefault();
    showEvent("Hold up", "Refreshing now could kick you out of the game.", "default", 2200);
  }
});

function ensureAudioContext() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      audioContext = new Ctx();
    }
  }

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

function playTone({
  frequency = 440,
  type = "sine",
  duration = 0.12,
  volume = 0.035,
  startTime = null,
  rampTo = null
}) {
  ensureAudioContext();
  if (!audioContext) return;

  const now = startTime ?? audioContext.currentTime;
  const end = now + duration;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (rampTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, rampTo), end);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(now);
  osc.stop(end + 0.02);
}

function playDiceRollSound(durationMs = 900) {
  ensureAudioContext();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const endAt = now + durationMs / 1000;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(90, endAt);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(300, endAt);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.03, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(now);
  osc.stop(endAt + 0.05);
}

function playMailSound() {
  ensureAudioContext();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  playTone({ frequency: 540, type: "triangle", duration: 0.08, volume: 0.03, startTime: now });
  playTone({ frequency: 760, type: "triangle", duration: 0.08, volume: 0.025, startTime: now + 0.09 });
  playTone({ frequency: 620, type: "sine", duration: 0.12, volume: 0.02, startTime: now + 0.18 });
}

function playDealSound() {
  ensureAudioContext();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  playTone({ frequency: 220, type: "sawtooth", duration: 0.12, volume: 0.04, startTime: now, rampTo: 180 });
  playTone({ frequency: 160, type: "square", duration: 0.14, volume: 0.03, startTime: now + 0.1, rampTo: 110 });
  playTone({ frequency: 95, type: "sawtooth", duration: 0.16, volume: 0.02, startTime: now + 0.18, rampTo: 70 });
}

function playPaydaySound() {
  ensureAudioContext();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  playTone({ frequency: 660, type: "triangle", duration: 0.09, volume: 0.03, startTime: now });
  playTone({ frequency: 880, type: "triangle", duration: 0.09, volume: 0.03, startTime: now + 0.08 });
  playTone({ frequency: 1320, type: "triangle", duration: 0.16, volume: 0.03, startTime: now + 0.16 });
}

function playChaosSound() {
  ensureAudioContext();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  playTone({ frequency: 180, type: "square", duration: 0.12, volume: 0.04, startTime: now, rampTo: 120 });
  playTone({ frequency: 120, type: "sawtooth", duration: 0.18, volume: 0.04, startTime: now + 0.1, rampTo: 70 });
}

function playBuyerSound() {
  ensureAudioContext();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  playTone({ frequency: 500, type: "sine", duration: 0.08, volume: 0.03, startTime: now });
  playTone({ frequency: 640, type: "sine", duration: 0.08, volume: 0.03, startTime: now + 0.08 });
}

function tryStartMusic() {
  if (!bgMusic || musicStarted || !musicEnabled) return;

  bgMusic.volume = 0.18;
  bgMusic.play()
    .then(() => {
      musicStarted = true;
      updateMusicButton();
    })
    .catch(() => {});
}

function updateMusicButton() {
  if (!musicToggleBtn) return;
  musicToggleBtn.textContent = musicEnabled ? "Music: ON" : "Music: OFF";
}

function toggleMusic() {
  musicEnabled = !musicEnabled;

  if (musicEnabled) {
    ensureAudioContext();

    if (bgMusic) {
      bgMusic.volume = 0.18;
      bgMusic.play()
        .then(() => {
          musicStarted = true;
          updateMusicButton();
        })
        .catch(() => {
          updateMusicButton();
        });
    } else {
      updateMusicButton();
    }
  } else {
    if (bgMusic) bgMusic.pause();
    updateMusicButton();
  }
}

function showScreen(screenName) {
  menuScreen?.classList.add("hidden");
  lobbyScreen?.classList.add("hidden");
  rollScreen?.classList.add("hidden");
  gameScreen?.classList.add("hidden");

  if (screenName === "menu") menuScreen?.classList.remove("hidden");
  if (screenName === "lobby") lobbyScreen?.classList.remove("hidden");
  if (screenName === "roll") rollScreen?.classList.remove("hidden");
  if (screenName === "game") gameScreen?.classList.remove("hidden");
}

function setMessage(text) {
  if (messageEl) messageEl.textContent = text || "";
}

function setLobbyMessage(text) {
  if (lobbyMessageEl) lobbyMessageEl.textContent = text || "";
}

function setRollMessage(text) {
  if (rollMessageEl) rollMessageEl.textContent = text || "";
}

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAvatarMarkup(avatar, extraClass = "") {
  const safeAvatar = avatar || { emoji: "😎", hat: "🧢", color: "#4fd081" };
  const hat = safeAvatar.hat === "❌" ? "" : safeAvatar.hat;

  return `
    <div class="avatarPiece ${extraClass}" style="--piece-color:${escapeHtml(safeAvatar.color || "#4fd081")}">
      <span class="avatarHat">${escapeHtml(hat)}</span>
      <span class="avatarEmoji">${escapeHtml(safeAvatar.emoji || "😎")}</span>
    </div>
  `;
}

function getInventoryCount(player) {
  return Array.isArray(player?.inventory?.items) ? player.inventory.items.length : 0;
}

function renderAvatarPicker() {
  if (!emojiChoices || !hatChoices || !colorChoices || !avatarPreview) return;

  emojiChoices.innerHTML = EMOJI_OPTIONS.map((emoji) => `
    <button
      type="button"
      class="pickerBtn emojiBtn ${selectedAvatar.emoji === emoji ? "active" : ""}"
      data-type="emoji"
      data-value="${emoji}"
    >
      ${emoji}
    </button>
  `).join("");

  hatChoices.innerHTML = HAT_OPTIONS.map((hat) => `
    <button
      type="button"
      class="pickerBtn hatBtn ${selectedAvatar.hat === hat ? "active" : ""}"
      data-type="hat"
      data-value="${hat}"
    >
      ${hat === "❌" ? "No Hat" : hat}
    </button>
  `).join("");

  colorChoices.innerHTML = COLOR_OPTIONS.map((color) => `
    <button
      type="button"
      class="colorBtn ${selectedAvatar.color === color ? "active" : ""}"
      data-type="color"
      data-value="${color}"
      style="background:${color}"
      aria-label="${color}"
    ></button>
  `).join("");

  avatarPreview.innerHTML = createAvatarMarkup(selectedAvatar, "largePreview");
}

function getSelectedAvatar() {
  return {
    emoji: selectedAvatar.emoji,
    hat: selectedAvatar.hat,
    color: selectedAvatar.color
  };
}

function initAvatarPicker() {
  renderAvatarPicker();

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-type][data-value]");
    if (!btn) return;

    const type = btn.getAttribute("data-type");
    const value = btn.getAttribute("data-value");

    if (!type || value === null) return;

    if (type === "emoji") selectedAvatar.emoji = value;
    if (type === "hat") selectedAvatar.hat = value;
    if (type === "color") selectedAvatar.color = value;

    renderAvatarPicker();
  });
}

function ensureGlobalAlertDom() {
  let overlay = document.getElementById("globalAlertOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "globalAlertOverlay";
  overlay.className = "globalAlertOverlay hidden";
  overlay.innerHTML = `
    <div id="globalAlertBox" class="globalAlertBox">
      <div id="globalAlertTitle" class="globalAlertTitle"></div>
      <div id="globalAlertText" class="globalAlertText"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function showGlobalAlert(title, text, theme = "chaos", duration = GLOBAL_ALERT_TIME) {
  const overlay = ensureGlobalAlertDom();
  const box = document.getElementById("globalAlertBox");
  const titleEl = document.getElementById("globalAlertTitle");
  const textEl = document.getElementById("globalAlertText");

  if (!overlay || !box || !titleEl || !textEl) return;

  clearTimeout(globalAlertTimeout);

  overlay.classList.remove("hidden");
  box.className = `globalAlertBox ${theme}`;
  titleEl.textContent = title || "ALERT";
  textEl.textContent = text || "";

  box.classList.remove("show");
  void box.offsetWidth;
  box.classList.add("show");

  globalAlertTimeout = setTimeout(() => {
    overlay.classList.add("hidden");
    box.classList.remove("show");
  }, duration);
}

function triggerScreenShake(level = "light") {
  const target = document.body;
  if (!target) return;

  const className = level === "heavy" ? "screenShakeHeavy" : "screenShakeLight";
  target.classList.remove("screenShakeLight", "screenShakeHeavy");
  void target.offsetWidth;
  target.classList.add(className);

  setTimeout(() => {
    target.classList.remove(className);
  }, level === "heavy" ? 850 : 500);
}

function renderRoom(room) {
  if (!room) return;

  currentRoom = room;

  if (roomCodeDisplay) roomCodeDisplay.textContent = room.code || "----";
  if (rollRoomCodeDisplay) rollRoomCodeDisplay.textContent = room.code || "----";
  if (gameRoomCodeShort) gameRoomCodeShort.textContent = room.code || "----";
  if (bankAmount) bankAmount.textContent = formatMoney(room.bank);

  renderPlayers(room);
  renderGameMoneyBoard(room.players || []);
  renderChat(room.chat || []);
  renderBoardPieces(room.players || []);

  if (startGameBtn) {
    const amHost = room.hostId === myId;
    if (amHost && room.phase === "lobby") {
      startGameBtn.classList.remove("hidden");
    } else {
      startGameBtn.classList.add("hidden");
    }
  }

  if (room.phase === "lobby") {
    showScreen("lobby");
  } else if (
    room.phase === "game" ||
    room.phase === "rolling" ||
    room.phase === "moving" ||
    room.phase === "resolving"
  ) {
    showScreen("game");
  }
}

function renderPlayers(room) {
  if (!playerList) return;

  const sortedPlayers = [...(room.players || [])].sort((a, b) => {
    return Number(b.cash || 0) - Number(a.cash || 0);
  });

  playerList.innerHTML = "";

  sortedPlayers.forEach((player, index) => {
    const li = document.createElement("li");

    const hostBadge = player.id === room.hostId
      ? `<span class="hostTag">HOST</span>`
      : "";

    const youBadge = player.id === myId
      ? `<span class="youTag">YOU</span>`
      : "";

    const offlineBadge = player.connected === false
      ? `<span class="rolledTag">OFFLINE</span>`
      : "";

    const placeBadge = `<span class="rolledTag">#${index + 1}</span>`;
    const itemCount = getInventoryCount(player);

    li.innerHTML = `
      <div class="playerLine">
        ${createAvatarMarkup(player.avatar)}
        <span>${escapeHtml(player.name)}</span>
      </div>
      <div class="playerTags">
        ${placeBadge}
        ${hostBadge}
        ${youBadge}
        ${offlineBadge}
        <span class="rolledTag">ITEMS ${itemCount}</span>
      </div>
    `;

    playerList.appendChild(li);
  });
}

function renderGameMoneyBoard(players) {
  if (!gamePlayersList) return;

  const sortedPlayers = [...players].sort((a, b) => {
    return Number(b.cash || 0) - Number(a.cash || 0);
  });

  gamePlayersList.innerHTML = "";

  sortedPlayers.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "moneyRow";
    row.innerHTML = `
      <div class="moneyNameWrap">
        ${createAvatarMarkup(player.avatar)}
        <span class="moneyName">#${index + 1} ${escapeHtml(player.name)}</span>
      </div>
      <span class="moneyCash">${formatMoney(player.cash)} · ${getInventoryCount(player)} items${player.connected === false ? " · offline" : ""}</span>
    `;
    gamePlayersList.appendChild(row);
  });
}

function renderBoardPieces(players) {
  document.querySelectorAll(".tilePieces").forEach((container) => {
    container.innerHTML = "";
  });

  players.forEach((player) => {
    const tilePieces = document.querySelector(`.tile[data-pos="${player.position}"] .tilePieces`);
    if (!tilePieces) return;

    const piece = document.createElement("div");
    piece.className = `boardPiece ${player.id === currentTurnPlayerId ? "currentTurnPiece" : ""}`;
    piece.innerHTML = createAvatarMarkup(player.avatar, "boardAvatar");
    piece.title = player.name;
    if (player.connected === false) {
      piece.style.opacity = "0.45";
    }
    tilePieces.appendChild(piece);
  });
}

function renderChat(chatItems) {
  const html = chatItems.map((item) => {
    if (item.system) {
      return `<div class="chatLine systemLine">${escapeHtml(item.text)}</div>`;
    }

    return `
      <div class="chatLine">
        <span class="chatName">${escapeHtml(item.name)}:</span>
        <span>${escapeHtml(item.text)}</span>
      </div>
    `;
  }).join("");

  if (lobbyChatList) {
    lobbyChatList.innerHTML = html;
    lobbyChatList.scrollTop = lobbyChatList.scrollHeight;
  }

  if (gameChatList) {
    gameChatList.innerHTML = html;
    gameChatList.scrollTop = gameChatList.scrollHeight;
  }
}

function sendChatMessageFromInput(inputEl) {
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text) return;

  socket.emit("sendChatMessage", { text });
  inputEl.value = "";
}

function setSharedDiceFace(value) {
  if (!sharedDiceCube) return;

  const faceTransforms = {
    1: "rotateX(0deg) rotateY(0deg)",
    2: "rotateX(0deg) rotateY(-90deg)",
    3: "rotateX(0deg) rotateY(-180deg)",
    4: "rotateX(0deg) rotateY(90deg)",
    5: "rotateX(-90deg) rotateY(0deg)",
    6: "rotateX(90deg) rotateY(0deg)"
  };

  sharedDiceCube.classList.remove("rolling");
  sharedDiceCube.style.transform = faceTransforms[value] || faceTransforms[1];
}

function showSharedDice(titleText) {
  if (!sharedDiceOverlay || !sharedDiceTitle || !sharedDiceValue || !sharedDiceCube) return;

  clearInterval(sharedRollingInterval);
  playDiceRollSound(1200);

  sharedDiceTitle.textContent = titleText;
  sharedDiceValue.textContent = "Rolling...";
  sharedDiceOverlay.classList.remove("hidden");
  sharedDiceCube.classList.add("rolling");

  let fakeValue = 1;
  sharedRollingInterval = setInterval(() => {
    fakeValue = (fakeValue % 6) + 1;
    setSharedDiceFace(fakeValue);
  }, 120);
}

function stopSharedDice(value, playerName) {
  if (!sharedDiceCube || !sharedDiceValue || !sharedDiceOverlay) return;

  clearInterval(sharedRollingInterval);
  sharedDiceCube.classList.remove("rolling");
  setSharedDiceFace(value);
  sharedDiceValue.textContent = `${playerName} rolled a ${value}`;

  setTimeout(() => {
    sharedDiceOverlay.classList.add("hidden");
  }, 1600);
}

function clearPopupTheme() {
  if (!eventPopup) return;

  eventPopup.classList.remove(
    "mailEvent",
    "dealEvent",
    "lotteryEvent",
    "radioEvent",
    "paydayEvent",
    "defaultEvent",
    "popupShow"
  );
}

function showEvent(title, message, type = "default", duration = 4200) {
  if (!eventPopup || !eventTitle || !eventMessage) return;

  clearTimeout(eventTimeout);

  eventTitle.textContent = title || "Event";
  eventMessage.textContent = message || "";

  clearPopupTheme();

  if (type === "mail") eventPopup.classList.add("mailEvent");
  else if (type === "deal") eventPopup.classList.add("dealEvent");
  else if (type === "lottery") eventPopup.classList.add("lotteryEvent");
  else if (type === "radio") eventPopup.classList.add("radioEvent");
  else if (type === "payday") eventPopup.classList.add("paydayEvent");
  else eventPopup.classList.add("defaultEvent");

  eventPopup.classList.remove("hidden");
  void eventPopup.offsetWidth;
  eventPopup.classList.add("popupShow");

  eventTimeout = setTimeout(() => {
    eventPopup.classList.add("hidden");
    eventPopup.classList.remove("popupShow");
  }, duration);
}

function pulseDeck(type) {
  if (type === "mail" && mailDeckCard) {
    mailDeckCard.classList.remove("deckPulse");
    void mailDeckCard.offsetWidth;
    mailDeckCard.classList.add("deckPulse");
    setTimeout(() => mailDeckCard.classList.remove("deckPulse"), 900);
  }

  if (type === "deal" && dealDeckCard) {
    dealDeckCard.classList.remove("deckPulse");
    void dealDeckCard.offsetWidth;
    dealDeckCard.classList.add("deckPulse");
    setTimeout(() => dealDeckCard.classList.remove("deckPulse"), 900);
  }
}

function flashTile(position) {
  const tileEl = document.querySelector(`.tile[data-pos="${position}"]`);
  if (!tileEl) return;

  tileEl.classList.remove("tileFlash");
  void tileEl.offsetWidth;
  tileEl.classList.add("tileFlash");

  setTimeout(() => {
    tileEl.classList.remove("tileFlash");
  }, 1100);

  if (window.innerWidth <= 950) {
    tileEl.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center"
    });
  }
}

function getAmountLabel(amount) {
  if (amount >= 0) return `+${formatMoney(amount)}`;
  return `-${formatMoney(Math.abs(amount))}`;
}

function setRevealTheme(type) {
  if (!revealCard) return;

  revealCard.classList.remove("revealMail", "revealDeal", "revealDefault");
  if (type === "mail") revealCard.classList.add("revealMail");
  else if (type === "deal") revealCard.classList.add("revealDeal");
  else revealCard.classList.add("revealDefault");
}

function getCardNetAmount(cards = []) {
  return cards.reduce((sum, card) => sum + Number(card?.amount || 0), 0);
}

function detectChaosTier(eventType, cards, title, message) {
  const net = getCardNetAmount(cards);
  const rawText = `${title || ""} ${message || ""} ${cards?.map((c) => `${c.title || ""} ${c.text || ""}`).join(" ") || ""}`.toLowerCase();

  if (net <= -400 || rawText.includes("fat fook") || rawText.includes("broke") || rawText.includes("destroyed") || rawText.includes("ruined")) {
    return "heavy";
  }

  if (net < 0 || eventType === "deal" || rawText.includes("lost") || rawText.includes("pay") || rawText.includes("cooked")) {
    return "light";
  }

  return null;
}

function maybePlayEventSound(eventType, cards, title, message) {
  const net = getCardNetAmount(cards);
  const lower = `${title || ""} ${message || ""}`.toLowerCase();

  if (eventType === "mail") {
    playMailSound();
    return;
  }

  if (eventType === "deal") {
    playDealSound();
    return;
  }

  if (eventType === "buyer" || lower.includes("sold") || lower.includes("buyer")) {
    playBuyerSound();
    return;
  }

  if (eventType === "payday" || eventType === "radio" || eventType === "lottery" || net >= 300) {
    playPaydaySound();
    return;
  }

  if (net <= -250) {
    playChaosSound();
  }
}

function maybeShowGlobalAlert({ playerName, eventType, cards, title, message, explicitAmount = null }) {
  const net = getCardNetAmount(cards);
  const chaosTier = detectChaosTier(eventType, cards, title, message);
  const lower = `${title || ""} ${message || ""}`.toLowerCase();

  if (eventType === "payday" || net >= 300) {
    const paydayAmount = explicitAmount ?? (net > 0 ? net : 0);

    showGlobalAlert(
      "💰 PAYDAY CHA-CHING 💰",
      `${playerName} just got paid ${formatMoney(paydayAmount)}.`,
      "money"
    );
    return;
  }

  if (eventType === "mail" && net <= -250) {
    showGlobalAlert(
      "📬 EVIL MAIL 📬",
      `${playerName} opened mail and got absolutely cooked.`,
      "mail"
    );
    return;
  }

  if (eventType === "deal" && net <= -250) {
    showGlobalAlert(
      "💀 TERRIBLE DEAL 💀",
      `${playerName} fell for a brutal deal.`,
      "deal"
    );
    return;
  }

  if (lower.includes("sold") && lower.includes("for $")) {
    showGlobalAlert(
      "🛒 IT SOLD 🛒",
      `${playerName} finally moved some junk and got paid.`,
      "money"
    );
    return;
  }

  if (chaosTier === "heavy") {
    showGlobalAlert(
      "🚨 SERVER-WIDE CHAOS 🚨",
      `${playerName} just got SMOKED.`,
      "chaos"
    );
  }
}

function maybeShowTilePopup(eventType, title, message, playerName) {
  if (!title && !message) return;

  if (eventType === "lottery") {
    showEvent(title || "Lucky BS", message || `${playerName} hit a lucky tile.`, "lottery", 3600);
    return;
  }

  if (eventType === "radio") {
    showEvent(title || "Radio Flex", message || `${playerName} flexed on the radio.`, "radio", 3600);
    return;
  }

  if (eventType === "payday") {
    showEvent(title || "PAYDAY", message || `${playerName} got paid.`, "payday", 3600);
    return;
  }

  if (eventType === "buyer") {
    showEvent(title || "Buyer", message || `${playerName} found somebody interested.`, "default", 3800);
    return;
  }

  if (eventType === "birthday") {
    showEvent(title || "Birthday Tax", message || `${playerName} collected from everybody.`, "default", 3800);
    return;
  }

  if (eventType === "charity" || eventType === "walk" || eventType === "ski" || eventType === "yardsale") {
    showEvent(title || "Ouch", message || `${playerName} landed on a brutal tile.`, "default", 3800);
    return;
  }

  if (!eventType || eventType === "default") {
    showEvent(title || "Tile Hit", message || `${playerName} landed on something weird.`, "default", 3600);
  }
}

async function showCardSequence(playerName, cards) {
  if (!cards || !cards.length) return;
  if (!revealOverlay || !revealPlayer || !revealCount || !revealFrontTitle || !revealFrontText || !revealAmount || !revealCard) return;

  revealOverlay.classList.remove("hidden");
  revealPlayer.textContent = `${playerName} drew a card`;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    revealCount.textContent = cards.length > 1 ? `Card ${i + 1} of ${cards.length}` : "";
    revealFrontTitle.textContent = card.title || card.type?.toUpperCase() || "CARD";
    revealFrontText.textContent = card.text || "";
    revealAmount.textContent = getAmountLabel(card.amount || 0);
    revealAmount.classList.toggle("positiveAmount", (card.amount || 0) >= 0);
    revealAmount.classList.toggle("negativeAmount", (card.amount || 0) < 0);

    setRevealTheme(card.type || "default");
    revealCard.classList.remove("flipped");
    void revealCard.offsetWidth;

    await wait(700);
    revealCard.classList.add("flipped");
    await wait(CARD_READ_TIME);
  }

  await wait(600);
  revealOverlay.classList.add("hidden");
}

function spawnPlaydayMoney() {
  if (!playdayRain) return;

  playdayRain.innerHTML = "";

  for (let i = 0; i < 26; i++) {
    const money = document.createElement("span");
    money.className = "playdayMoney";
    money.textContent = i % 2 === 0 ? "$" : "💸";
    money.style.left = `${Math.random() * 100}%`;
    money.style.animationDelay = `${Math.random() * 0.8}s`;
    money.style.animationDuration = `${2.4 + Math.random() * 1.6}s`;
    money.style.fontSize = `${22 + Math.random() * 26}px`;
    money.style.transform = `rotate(${(-25 + Math.random() * 50).toFixed(1)}deg)`;
    playdayRain.appendChild(money);
  }
}

async function showPlaydaySequence(playerName, amount) {
  if (!playdayOverlay || !playdayTitle || !playdayText) return;

  spawnPlaydayMoney();
  playdayTitle.textContent = "PLAYDAYYYY";
  playdayText.textContent = `${playerName} collected ${formatMoney(amount)}!`;

  playdayOverlay.classList.remove("hidden");
  void playdayOverlay.offsetWidth;
  playdayOverlay.classList.add("show");

  await wait(2600);

  playdayOverlay.classList.remove("show");
  await wait(450);
  playdayOverlay.classList.add("hidden");
}

function updateTurnUI() {
  if (!currentRoom) return;

  const player = currentRoom.players?.find((p) => p.id === currentTurnPlayerId);
  const name = player ? player.name : "Waiting...";

  if (currentTurnText) currentTurnText.textContent = name;

  if (turnInfoText) {
    turnInfoText.textContent =
      currentTurnPlayerId === myId
        ? "It is your turn. Press Roll Turn."
        : `${name} is taking their turn.`;
  }

  if (rollTurnBtn) {
    rollTurnBtn.disabled = currentTurnPlayerId !== myId || sharedTurnRollAnimating;
  }

  renderBoardPieces(currentRoom.players || []);
}

function primeAudioAndMusic() {
  ensureAudioContext();
  tryStartMusic();
}

createRoomBtn?.addEventListener("click", () => {
  primeAudioAndMusic();
  setMessage("");
  resetReconnectId();

  socket.emit("createRoom", {
    name: nameInput?.value || "",
    avatar: getSelectedAvatar(),
    reconnectId
  });
});

joinRoomBtn?.addEventListener("click", () => {
  primeAudioAndMusic();
  setMessage("");

  socket.emit("joinRoom", {
    name: nameInput?.value || "",
    roomCode: roomCodeInput?.value || "",
    avatar: getSelectedAvatar(),
    reconnectId
  });
});

startGameBtn?.addEventListener("click", () => {
  primeAudioAndMusic();
  setLobbyMessage("");
  socket.emit("startGame");
});

leaveLobbyBtn?.addEventListener("click", () => {
  clearReconnectId();
  enableIntentionalPageExit();
  window.location.reload();
});

rollBtn?.addEventListener("click", () => {
  setRollMessage("This phase is no longer used in this version.");
});

rollTurnBtn?.addEventListener("click", () => {
  primeAudioAndMusic();
  if (currentTurnPlayerId !== myId || sharedTurnRollAnimating) return;
  socket.emit("rollTurn");
});

sendLobbyChatBtn?.addEventListener("click", () => {
  sendChatMessageFromInput(lobbyChatInput);
});

sendGameChatBtn?.addEventListener("click", () => {
  sendChatMessageFromInput(gameChatInput);
});

musicToggleBtn?.addEventListener("click", () => {
  ensureAudioContext();
  toggleMusic();
});

lobbyChatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendChatMessageFromInput(lobbyChatInput);
});

gameChatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendChatMessageFromInput(gameChatInput);
});

roomCodeInput?.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
});

socket.on("roomJoined", ({ room, yourId }) => {
  myId = yourId;
  renderRoom(room);
  showScreen(room.phase === "lobby" ? "lobby" : "game");
});

socket.on("roomUpdated", (room) => {
  currentRoom = room;
  renderRoom(room);
  updateTurnUI();
});

socket.on("gameStarted", ({ room }) => {
  currentRoom = room;
  renderRoom(room);
  showScreen("game");
  showEvent("Game Started", "The game has begun.", "default", 3000);
  showGlobalAlert("🎲 PLAY-DAY STARTED 🎲", "Everybody lock in. The chaos begins now.", "chaos", 2300);
});

socket.on("turnUpdate", ({ currentPlayerId, currentPlayerName }) => {
  currentTurnPlayerId = currentPlayerId;
  sharedTurnRollAnimating = false;
  updateTurnUI();
  showEvent("Next Turn", `${currentPlayerName}'s turn.`, "default", 2200);
});

socket.on("turnRolled", ({ playerName, roll }) => {
  sharedTurnRollAnimating = true;
  updateTurnUI();
  showSharedDice(`${playerName} is rolling`);

  setTimeout(() => {
    stopSharedDice(roll, playerName);
  }, 1200);
});

socket.on("playerMoved", ({ playerName, from, to, roll }) => {
  console.log(`${playerName} moved from ${from} to ${to} with a roll of ${roll}.`);
});

socket.on("playdayPassed", async ({ playerName, amount, room }) => {
  currentRoom = room;
  renderRoom(room);
  updateTurnUI();

  playPaydaySound();
  showGlobalAlert("💸 PAYDAYYYYY 💸", `${playerName} just scooped ${formatMoney(amount)}.`, "money", 2300);

  await showPlaydaySequence(playerName, amount);
});

socket.on("tileResult", async ({ title, message, room, eventType, landedPosition, cards, playerName, cashDelta }) => {
  currentRoom = room;
  renderRoom(room);
  updateTurnUI();

  const safePlayerName = playerName || "Someone";

  flashTile(landedPosition);
  pulseDeck(eventType);
  maybePlayEventSound(eventType, cards, title, message);
  maybeShowGlobalAlert({
    playerName: safePlayerName,
    eventType,
    cards,
    title,
    message,
    explicitAmount: eventType === "payday" ? cashDelta : null
  });

  const chaosTier = detectChaosTier(eventType, cards, title, message);
  if (chaosTier === "heavy") {
    triggerScreenShake("heavy");
  } else if (chaosTier === "light") {
    triggerScreenShake("light");
  }

  if (cards && cards.length) {
    await showCardSequence(safePlayerName, cards);
  } else {
    maybeShowTilePopup(eventType, title, message, safePlayerName);
  }
});

socket.on("errorMessage", (message) => {
  clearInterval(sharedRollingInterval);

  if (sharedDiceCube) sharedDiceCube.classList.remove("rolling");
  if (sharedDiceOverlay) sharedDiceOverlay.classList.add("hidden");

  sharedTurnRollAnimating = false;
  updateTurnUI();

  if (menuScreen && !menuScreen.classList.contains("hidden")) {
    setMessage(message);
  } else if (lobbyScreen && !lobbyScreen.classList.contains("hidden")) {
    setLobbyMessage(message);
  } else if (rollScreen && !rollScreen.classList.contains("hidden")) {
    setRollMessage(message);
  } else {
    showEvent("Error", message, "default", 5000);
  }
});

initAvatarPicker();
updateMusicButton();
ensureGlobalAlertDom();