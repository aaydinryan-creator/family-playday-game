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
  removePlayerFromRoom,
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

function normalizeAvatar(avatar) {
  if (!avatar || typeof avatar !== "object") {
    return { ...DEFAULT_AVATAR };
  }

  const emoji =
    typeof avatar.emoji === "string" && avatar.emoji.trim()
      ? avatar.emoji
      : DEFAULT_AVATAR.emoji;

  const hat =
    typeof avatar.hat === "string" && avatar.hat.trim()
      ? avatar.hat
      : DEFAULT_AVATAR.hat;

  const color =
    typeof avatar.color === "string" && avatar.color.trim()
      ? avatar.color
      : DEFAULT_AVATAR.color;

  return { emoji, hat, color };
}

function findRoomByReconnectId(reconnectId) {
  if (!reconnectId) return null;

  for (const room of Object.values(rooms)) {
    const foundPlayer = room.players.find(
      (player) => player.reconnectId && player.reconnectId === reconnectId
    );

    if (foundPlayer) {
      return room;
    }
  }

  return null;
}

function findPlayerByReconnectId(room, reconnectId) {
  if (!room || !reconnectId) return null;

  return room.players.find(
    (player) => player.reconnectId && player.reconnectId === reconnectId
  ) || null;
}

function attachSocketToRoom(socket, room, reconnectId = null) {
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.reconnectId = reconnectId || null;
}

function markPlayerConnected(player, socket, name, avatar) {
  if (!player) return;

  if (player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }

  player.id = socket.id;
  player.connected = true;
  player.lastSeenAt = Date.now();

  if (typeof name === "string" && name.trim()) {
    player.name = name.trim().slice(0, 16);
  }

  if (avatar) {
    player.avatar = normalizeAvatar(avatar);
  }
}

function decoratePlayerForReconnect(player, reconnectId) {
  player.reconnectId = reconnectId || null;
  player.connected = true;
  player.disconnectTimer = null;
  player.lastSeenAt = Date.now();
  return player;
}

function finalizePlayerRemoval(room, playerIdToRemove) {
  const removedIndex = room.players.findIndex((player) => player.id === playerIdToRemove);
  if (removedIndex === -1) return;

  const removedPlayer = room.players[removedIndex];

  room.players.splice(removedIndex, 1);

  if (room.players.length === 0) {
    delete rooms[room.code];
    return;
  }

  pushSystemMessage(room, `${removedPlayer.name} left the room.`);

  transferHostIfNeeded(room, playerIdToRemove);

  if (removedIndex < room.turnIndex) {
    room.turnIndex -= 1;
  }

  ensureValidTurnIndex(room);

  if (room.phase !== "lobby") {
    room.phase = "game";
    if (getCurrentPlayer(room)) {
      sendTurnUpdate(io, room);
    }
  }

  emitRoomUpdate(io, room);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, avatar, reconnectId }) => {
    const trimmedName = String(name || "").trim().slice(0, 16);
    const normalizedAvatar = normalizeAvatar(avatar);
    const safeReconnectId = String(reconnectId || "").trim();

    if (!trimmedName) {
      socket.emit("errorMessage", "Please enter your name.");
      return;
    }

    const existingRoom = findRoomByReconnectId(safeReconnectId);
    const existingPlayer = existingRoom
      ? findPlayerByReconnectId(existingRoom, safeReconnectId)
      : null;

    if (existingRoom && existingPlayer) {
      markPlayerConnected(existingPlayer, socket, trimmedName, normalizedAvatar);
      attachSocketToRoom(socket, existingRoom, safeReconnectId);

      socket.emit("roomJoined", {
        room: getSafeRoom(existingRoom),
        yourId: socket.id
      });

      emitRoomUpdate(io, existingRoom);

      if (existingRoom.phase !== "lobby") {
        sendTurnUpdate(io, existingRoom);
      }

      return;
    }

    const code = generateRoomCode(rooms);
    const room = createRoom(code, socket.id);

    const player = createPlayer(
      socket.id,
      trimmedName,
      normalizedAvatar
    );

    decoratePlayerForReconnect(player, safeReconnectId);

    room.players.push(player);
    pushSystemMessage(room, `${trimmedName} created the room.`);

    rooms[code] = room;

    attachSocketToRoom(socket, room, safeReconnectId);

    socket.emit("roomJoined", {
      room: getSafeRoom(room),
      yourId: socket.id
    });

    emitRoomUpdate(io, room);
  });

  socket.on("joinRoom", ({ name, roomCode, avatar, reconnectId }) => {
    const trimmedName = String(name || "").trim().slice(0, 16);
    const code = String(roomCode || "").trim().toUpperCase();
    const normalizedAvatar = normalizeAvatar(avatar);
    const safeReconnectId = String(reconnectId || "").trim();

    if (!trimmedName) {
      socket.emit("errorMessage", "Please enter your name.");
      return;
    }

    if (!code && !safeReconnectId) {
      socket.emit("errorMessage", "Please enter a room code.");
      return;
    }

    let room = null;
    let reconnectingPlayer = null;

    if (safeReconnectId) {
      const reconnectRoom = findRoomByReconnectId(safeReconnectId);
      const reconnectPlayer = reconnectRoom
        ? findPlayerByReconnectId(reconnectRoom, safeReconnectId)
        : null;

      if (reconnectRoom && reconnectPlayer) {
        room = reconnectRoom;
        reconnectingPlayer = reconnectPlayer;
      }
    }

    if (!room) {
      room = rooms[code];
    }

    if (!room) {
      socket.emit("errorMessage", "Room not found.");
      return;
    }

    if (reconnectingPlayer) {
      markPlayerConnected(reconnectingPlayer, socket, trimmedName, normalizedAvatar);
      attachSocketToRoom(socket, room, safeReconnectId);

      pushSystemMessage(room, `${reconnectingPlayer.name} rejoined the room.`);

      socket.emit("roomJoined", {
        room: getSafeRoom(room),
        yourId: socket.id
      });

      emitRoomUpdate(io, room);

      if (room.phase !== "lobby") {
        sendTurnUpdate(io, room);
      }

      return;
    }

    if (room.phase !== "lobby") {
      socket.emit("errorMessage", "That game already started.");
      return;
    }

    if (room.players.length >= MAX_PLAYERS) {
      socket.emit("errorMessage", "That room is full.");
      return;
    }

    const player = createPlayer(
      socket.id,
      trimmedName,
      normalizedAvatar
    );

    decoratePlayerForReconnect(player, safeReconnectId);

    room.players.push(player);
    pushSystemMessage(room, `${trimmedName} joined the room.`);

    attachSocketToRoom(socket, room, safeReconnectId);

    socket.emit("roomJoined", {
      room: getSafeRoom(room),
      yourId: socket.id
    });

    emitRoomUpdate(io, room);
  });

  socket.on("startGame", () => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit("errorMessage", "Only the host can start the game.");
      return;
    }

    if (room.players.length < 2) {
      socket.emit("errorMessage", "You need at least 2 players to start.");
      return;
    }

    room.phase = "game";
    room.turnIndex = 0;

    pushSystemMessage(room, "The game has started.");

    io.to(room.code).emit("gameStarted", {
      room: getSafeRoom(room)
    });

    sendTurnUpdate(io, room);
    emitRoomUpdate(io, room);
  });

  socket.on("rollTurn", () => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

    if (room.phase !== "game") {
      socket.emit("errorMessage", "The game is busy right now.");
      return;
    }

    const currentPlayer = getCurrentPlayer(room);
    if (!currentPlayer) return;

    if (currentPlayer.id !== socket.id) {
      socket.emit("errorMessage", "It is not your turn.");
      return;
    }

    handlePlayerRoll(io, room, currentPlayer, emitRoomUpdate, pushSystemMessage);
  });

  socket.on("sendChatMessage", ({ text }) => {
    const room = getRoomBySocketId(rooms, socket.id);
    if (!room) return;

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

    const player = getPlayerBySocketId(room, socket.id);
    if (!player) return;

    player.connected = false;
    player.lastSeenAt = Date.now();

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }

    pushSystemMessage(room, `${player.name} disconnected. Waiting for them to come back...`);
    emitRoomUpdate(io, room);

    const playerIdAtDisconnect = player.id;

    player.disconnectTimer = setTimeout(() => {
      const stillThere = room.players.find(
        (p) =>
          p.reconnectId &&
          p.reconnectId === player.reconnectId
      );

      if (!stillThere) return;
      if (stillThere.connected) return;

      finalizePlayerRemoval(room, playerIdAtDisconnect);
    }, RECONNECT_GRACE_MS);
  });
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});