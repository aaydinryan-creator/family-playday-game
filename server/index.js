const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const { createRoom, createPlayer, getCurrentPlayer } = require("./gameState");
const {
  generateRoomCode,
  getRoomBySocketId,
  getPlayerBySocketId,
  ensureValidTurnIndex,
  transferHostIfNeeded,
  getSafeRoom,
  emitRoomUpdate,
  pushSystemMessage
} = require("./rooms");
const { sendTurnUpdate, handlePlayerRoll } = require("./turns");

app.use(express.static("public"));

const rooms = {};
const MAX_PLAYERS = 12;
const RECONNECT_GRACE_MS = 45000;

const DEFAULT_AVATAR = {
  emoji: "😎",
  hat: "🧢",
  color: "#4fd081"
};

const POT_BATTLE_TRIGGER_AMOUNT = 3000;

// ---------------------- UTIL ----------------------

function normalizeAvatar(avatar) {
  if (!avatar || typeof avatar !== "object") return { ...DEFAULT_AVATAR };

  return {
    emoji: avatar.emoji || DEFAULT_AVATAR.emoji,
    hat: avatar.hat || DEFAULT_AVATAR.hat,
    color: avatar.color || DEFAULT_AVATAR.color
  };
}

function ensureExtendedRoomState(room) {
  if (!room) return;

  if (typeof room.pot !== "number" || !Number.isFinite(room.pot)) {
    room.pot = 0;
  }

  if (typeof room.potBattleReady !== "boolean") {
    room.potBattleReady = false;
  }

  if (typeof room.potBattleTriggered !== "boolean") {
    room.potBattleTriggered = false;
  }

  if (!Number.isFinite(room.potBattleThreshold)) {
    room.potBattleThreshold = POT_BATTLE_TRIGGER_AMOUNT;
  }

  if (!room.startRollState) {
    room.startRollState = {
      active: false,
      round: 1,
      eligiblePlayerIds: [],
      rolls: {}
    };
  }

  if (!room.potBattleState) {
    room.potBattleState = {
      active: false,
      round: 1,
      eligiblePlayerIds: [],
      rolls: {}
    };
  }

  if (!Array.isArray(room.chat)) {
    room.chat = [];
  }

  syncPotBattleState(room);
}

function syncPotBattleState(room) {
  if (!room) return;

  const threshold = Number.isFinite(room.potBattleThreshold)
    ? room.potBattleThreshold
    : POT_BATTLE_TRIGGER_AMOUNT;

  room.potBattleThreshold = threshold;

  if (room.pot >= threshold && !room.potBattleState?.active) {
    room.potBattleReady = true;
  }

  if (room.pot < threshold && !room.potBattleState?.active) {
    room.potBattleReady = false;
    room.potBattleTriggered = false;
  }
}

function getPlayerName(room, id) {
  const p = room.players.find((p) => p.id === id);
  return p ? p.name : "Unknown";
}

function findPlayerByReconnectId(room, reconnectId) {
  if (!room || !reconnectId) return null;
  return room.players.find((p) => p.reconnectId === reconnectId) || null;
}

function cleanupDisconnectedPlayers() {
  const now = Date.now();

  Object.values(rooms).forEach((room) => {
    if (!room || !Array.isArray(room.players)) return;

    room.players = room.players.filter((player) => {
      if (player.connected !== false) return true;
      if (!player.lastSeenAt) return true;
      return now - player.lastSeenAt < RECONNECT_GRACE_MS;
    });

    ensureValidTurnIndex(room);

    if (room.players.length === 0) {
      delete rooms[room.code];
    }
  });
}

setInterval(cleanupDisconnectedPlayers, 10000);

// ---------------------- POT ----------------------

function addToPot(room, amount, reason) {
  const val = Number(amount) || 0;
  if (val <= 0) return;

  room.pot += val;
  syncPotBattleState(room);

  io.to(room.code).emit("potUpdated", {
    pot: room.pot,
    amountAdded: val,
    reason
  });

  pushSystemMessage(room, `${reason} +$${val} added to pot.`);
  emitRoomUpdate(io, room);
}

// ---------------------- START ROLL ----------------------

function beginStartRollPhase(room) {
  room.phase = "start-roll";
  room.startRollState = {
    active: true,
    round: 1,
    eligiblePlayerIds: room.players
      .filter((p) => p.connected !== false)
      .map((p) => p.id),
    rolls: {}
  };

  io.to(room.code).emit("startRollPhaseBegan", {
    players: room.players
  });

  pushSystemMessage(room, "Everyone roll for turn order.");
  emitRoomUpdate(io, room);
}

function resolveStartRollRound(room) {
  const rolls = room.startRollState.rolls;
  const ids = room.startRollState.eligiblePlayerIds;

  const highest = Math.max(...Object.values(rolls));
  const winners = ids.filter((id) => rolls[id] === highest);

  if (winners.length === 1) {
    const winnerId = winners[0];

    room.turnIndex = room.players.findIndex((p) => p.id === winnerId);
    room.phase = "game";
    room.startRollState.active = false;

    io.to(room.code).emit("firstPlayerChosen", { playerId: winnerId });

    sendTurnUpdate(io, room);
    emitRoomUpdate(io, room);
    return;
  }

  room.startRollState.round++;
  room.startRollState.eligiblePlayerIds = winners;
  room.startRollState.rolls = {};

  io.to(room.code).emit("startRollTieBreaker", { players: winners });
  emitRoomUpdate(io, room);
}

// ---------------------- POT BATTLE ----------------------

function startPotBattle(room) {
  if (!room) return;

  ensureExtendedRoomState(room);

  if (room.phase !== "game") return;
  if (room.potBattleState?.active) return;

  const threshold = room.potBattleThreshold || POT_BATTLE_TRIGGER_AMOUNT;
  if (room.pot < threshold && !room.potBattleReady) return;

  const eligiblePlayers = room.players.filter((p) => p.connected !== false);
  if (eligiblePlayers.length < 2) return;

  room.phase = "pot-battle";
  room.potBattleReady = false;
  room.potBattleTriggered = true;

  room.potBattleState = {
    active: true,
    round: 1,
    eligiblePlayerIds: eligiblePlayers.map((p) => p.id),
    rolls: {}
  };

  io.to(room.code).emit("globalAlert", {
    type: "pot",
    text: `💰 POT BATTLE FOR $${room.pot}!`
  });

  io.to(room.code).emit("potBattleStarted", {
    pot: room.pot
  });

  pushSystemMessage(room, `POT BATTLE for $${room.pot}!`);
  emitRoomUpdate(io, room);
}

function resolvePotBattleRound(room) {
  const rolls = room.potBattleState.rolls;
  const ids = room.potBattleState.eligiblePlayerIds;

  const highest = Math.max(...Object.values(rolls));
  const winners = ids.filter((id) => rolls[id] === highest);

  if (winners.length === 1) {
    const winner = room.players.find((p) => p.id === winners[0]);

    if (winner) {
      winner.cash += room.pot;
    }

    io.to(room.code).emit("potBattleWinner", {
      winnerId: winner ? winner.id : null,
      amount: room.pot
    });

    if (winner) {
      pushSystemMessage(room, `${winner.name} won the POT BATTLE and took $${room.pot}!`);
    }

    room.pot = 0;
    room.phase = "game";
    room.potBattleState.active = false;
    room.potBattleReady = false;
    room.potBattleTriggered = false;

    io.to(room.code).emit("potUpdated", {
      pot: room.pot,
      amountAdded: 0,
      reason: "Pot battle resolved"
    });

    sendTurnUpdate(io, room);
    emitRoomUpdate(io, room);
    return;
  }

  room.potBattleState.round++;
  room.potBattleState.eligiblePlayerIds = winners;
  room.potBattleState.rolls = {};

  io.to(room.code).emit("potBattleTieBreaker", {
    players: winners
  });

  emitRoomUpdate(io, room);
}

function maybeTriggerPotBattle(room) {
  if (!room) return;

  ensureExtendedRoomState(room);

  if (room.phase !== "game") return;
  if (room.potBattleState?.active) return;

  const threshold = room.potBattleThreshold || POT_BATTLE_TRIGGER_AMOUNT;

  if (room.pot >= threshold || room.potBattleReady) {
    room.potBattleReady = true;
    startPotBattle(room);
  }
}

// ---------------------- SOCKET ----------------------

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, avatar, reconnectId }) => {
    const code = generateRoomCode(rooms);
    const room = createRoom(code, socket.id);

    ensureExtendedRoomState(room);

    const player = createPlayer(socket.id, name, normalizeAvatar(avatar));
    player.reconnectId = reconnectId || socket.id;
    player.connected = true;
    player.lastSeenAt = Date.now();

    room.players.push(player);

    rooms[code] = room;
    socket.join(code);

    socket.emit("roomJoined", {
      room: getSafeRoom(room),
      yourId: socket.id,
      reconnectId: player.reconnectId
    });

    emitRoomUpdate(io, room);
  });

  socket.on("joinRoom", ({ name, roomCode, avatar, reconnectId }) => {
    const code = String(roomCode || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return;

    ensureExtendedRoomState(room);

    const existingPlayer = findPlayerByReconnectId(room, reconnectId);

    if (existingPlayer) {
      existingPlayer.id = socket.id;
      existingPlayer.name = name || existingPlayer.name;
      existingPlayer.avatar = normalizeAvatar(avatar || existingPlayer.avatar);
      existingPlayer.connected = true;
      existingPlayer.lastSeenAt = Date.now();

      socket.join(room.code);

      socket.emit("roomJoined", {
        room: getSafeRoom(room),
        yourId: socket.id,
        reconnectId: existingPlayer.reconnectId
      });

      pushSystemMessage(room, `${existingPlayer.name} reconnected.`);
      emitRoomUpdate(io, room);
      return;
    }

    if (room.phase !== "lobby") return;
    if (room.players.length >= MAX_PLAYERS) return;

    const player = createPlayer(socket.id, name, normalizeAvatar(avatar));
    player.reconnectId = reconnectId || socket.id;
    player.connected = true;
    player.lastSeenAt = Date.now();

    room.players.push(player);

    socket.join(room.code);

    socket.emit("roomJoined", {
      room: getSafeRoom(room),
      yourId: socket.id,
      reconnectId: player.reconnectId
    });

    emitRoomUpdate(io, room);
  });

  socket.on("startGame", () => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    ensureExtendedRoomState(room);
    beginStartRollPhase(room);
  });

  socket.on("rollForStart", () => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    ensureExtendedRoomState(room);

    if (room.phase !== "start-roll" || !room.startRollState.active) return;
    if (!room.startRollState.eligiblePlayerIds.includes(socket.id)) return;
    if (typeof room.startRollState.rolls[socket.id] === "number") return;

    const roll = Math.floor(Math.random() * 6) + 1;
    room.startRollState.rolls[socket.id] = roll;

    io.to(room.code).emit("startRollSubmitted", {
      playerId: socket.id,
      roll
    });

    emitRoomUpdate(io, room);

    if (
      Object.keys(room.startRollState.rolls).length ===
      room.startRollState.eligiblePlayerIds.length
    ) {
      resolveStartRollRound(room);
    }
  });

  socket.on("rollTurn", () => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    ensureExtendedRoomState(room);

    const player = getCurrentPlayer(room);
    if (!player || player.id !== socket.id) return;
    if (room.phase !== "game") return;

    handlePlayerRoll(io, room, player, emitRoomUpdate, pushSystemMessage);

    maybeTriggerPotBattle(room);

    setTimeout(() => {
      maybeTriggerPotBattle(room);
    }, 300);
  });

  socket.on("rollForPotBattle", () => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    ensureExtendedRoomState(room);

    if (room.phase !== "pot-battle" || !room.potBattleState.active) return;
    if (!room.potBattleState.eligiblePlayerIds.includes(socket.id)) return;
    if (typeof room.potBattleState.rolls[socket.id] === "number") return;

    const roll = Math.floor(Math.random() * 6) + 1;
    room.potBattleState.rolls[socket.id] = roll;

    io.to(room.code).emit("potBattleRollSubmitted", {
      playerId: socket.id,
      roll
    });

    emitRoomUpdate(io, room);

    if (
      Object.keys(room.potBattleState.rolls).length ===
      room.potBattleState.eligiblePlayerIds.length
    ) {
      resolvePotBattleRound(room);
    }
  });

  socket.on("addMoneyToPot", ({ amount, reason }) => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    ensureExtendedRoomState(room);

    const allowed = ["charity", "top golf", "fundraiser", "donation", "event"];
    if (!allowed.includes((reason || "").toLowerCase())) return;

    addToPot(room, amount, reason);

    if (room.phase === "game") {
      maybeTriggerPotBattle(room);
    }
  });

  socket.on("sendChatMessage", ({ text }) => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    ensureExtendedRoomState(room);

    const player = getPlayerBySocketId(room, socket.id);
    if (!player) return;

    const trimmedText = String(text || "").trim().slice(0, 180);
    if (!trimmedText) return;

    room.chat.push({
      system: false,
      name: player.name,
      text: trimmedText
    });

    emitRoomUpdate(io, room);
  });

  socket.on("disconnect", () => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    ensureExtendedRoomState(room);

    const player = getPlayerBySocketId(room, socket.id);
    if (!player) return;

    player.connected = false;
    player.lastSeenAt = Date.now();

    pushSystemMessage(room, `${player.name} disconnected. Waiting for reconnect...`);

    if (room.hostId === socket.id) {
      transferHostIfNeeded(room);
    }

    emitRoomUpdate(io, room);
  });
});

// ----------------------

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Running on port", PORT));