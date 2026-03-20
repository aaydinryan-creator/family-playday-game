const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

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

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, avatar }) => {
    const trimmedName = String(name || "").trim().slice(0, 16);

    if (!trimmedName) {
      socket.emit("errorMessage", "Please enter your name.");
      return;
    }

    const code = generateRoomCode(rooms);
    const room = createRoom(code, socket.id);

    const player = createPlayer(
      socket.id,
      trimmedName,
      normalizeAvatar(avatar)
    );

    room.players.push(player);
    pushSystemMessage(room, `${trimmedName} created the room.`);

    rooms[code] = room;

    socket.join(code);
    socket.data.roomCode = code;

    socket.emit("roomJoined", {
      room: getSafeRoom(room),
      yourId: socket.id
    });

    emitRoomUpdate(io, room);
  });

  socket.on("joinRoom", ({ name, roomCode, avatar }) => {
    const trimmedName = String(name || "").trim().slice(0, 16);
    const code = String(roomCode || "").trim().toUpperCase();

    if (!trimmedName) {
      socket.emit("errorMessage", "Please enter your name.");
      return;
    }

    if (!code) {
      socket.emit("errorMessage", "Please enter a room code.");
      return;
    }

    const room = rooms[code];
    if (!room) {
      socket.emit("errorMessage", "Room not found.");
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
      normalizeAvatar(avatar)
    );

    room.players.push(player);
    pushSystemMessage(room, `${trimmedName} joined the room.`);

    socket.join(code);
    socket.data.roomCode = code;

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

    const { removedPlayer, removedIndex } = removePlayerFromRoom(room, socket.id);

    if (!removedPlayer) return;

    if (room.players.length === 0) {
      delete rooms[room.code];
      return;
    }

    pushSystemMessage(room, `${removedPlayer.name} left the room.`);

    transferHostIfNeeded(room, socket.id);

    if (removedIndex !== -1 && removedIndex < room.turnIndex) {
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
  });
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});