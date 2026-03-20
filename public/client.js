const socket = io("https://family-playday-game.onrender.com");

let currentRoom = null;
let myId = null;
let currentTurnPlayerId = null;
let eventTimeout = null;
let sharedRollingInterval = null;
let sharedTurnRollAnimating = false;

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

  playerList.innerHTML = "";

  (room.players || []).forEach((player) => {
    const li = document.createElement("li");

    const hostBadge = player.id === room.hostId
      ? `<span class="hostTag">HOST</span>`
      : "";

    const youBadge = player.id === myId
      ? `<span class="youTag">YOU</span>`
      : "";

    li.innerHTML = `
      <div class="playerLine">
        ${createAvatarMarkup(player.avatar)}
        <span>${escapeHtml(player.name)}</span>
      </div>
      <div class="playerTags">
        ${hostBadge}
        ${youBadge}
      </div>
    `;

    playerList.appendChild(li);
  });
}

function renderGameMoneyBoard(players) {
  if (!gamePlayersList) return;

  gamePlayersList.innerHTML = "";

  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "moneyRow";
    row.innerHTML = `
      <div class="moneyNameWrap">
        ${createAvatarMarkup(player.avatar)}
        <span class="moneyName">${escapeHtml(player.name)}</span>
      </div>
      <span class="moneyCash">${formatMoney(player.cash)}</span>
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

function showEvent(title, message, type = "default", duration = 7000) {
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
    await wait(5200);
  }

  await wait(1200);
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

  await wait(3200);

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

  socket.emit("createRoom", {
    name: nameInput?.value || "",
    avatar: getSelectedAvatar()
  });
});

joinRoomBtn?.addEventListener("click", () => {
  primeAudioAndMusic();
  setMessage("");

  socket.emit("joinRoom", {
    name: nameInput?.value || "",
    roomCode: roomCodeInput?.value || "",
    avatar: getSelectedAvatar()
  });
});

startGameBtn?.addEventListener("click", () => {
  primeAudioAndMusic();
  setLobbyMessage("");
  socket.emit("startGame");
});

leaveLobbyBtn?.addEventListener("click", () => {
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
  showEvent("Game Started", "The game has begun.", "default", 4500);
});

socket.on("turnUpdate", ({ currentPlayerId, currentPlayerName }) => {
  currentTurnPlayerId = currentPlayerId;
  sharedTurnRollAnimating = false;
  updateTurnUI();
  showEvent("Next Turn", `${currentPlayerName}'s turn.`, "default", 4000);
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
  await showPlaydaySequence(playerName, amount);
});

socket.on("tileResult", async ({ title, message, room, eventType, landedPosition, cards, playerName }) => {
  currentRoom = room;
  renderRoom(room);
  updateTurnUI();

  flashTile(landedPosition);
  pulseDeck(eventType);

  if (cards && cards.length) {
    await showCardSequence(playerName || "Someone", cards);
  } else {
    showEvent(title, message, eventType, 8000);
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
    showEvent("Error", message, "default", 7000);
  }
});

initAvatarPicker();
updateMusicButton();