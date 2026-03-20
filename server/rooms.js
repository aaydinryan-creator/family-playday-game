const { getCurrentPlayer } = require("./gameState");

function generateRoomCode(existingRooms = {}) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (existingRooms[code]);

  return code;
}

function getRoomBySocketId(rooms, socketId) {
  return Object.values(rooms).find((room) =>
    room.players.some((player) => player.id === socketId)
  );
}

function getPlayerBySocketId(room, socketId) {
  if (!room) return null;
  return room.players.find((player) => player.id === socketId) || null;
}

function removePlayerFromRoom(room, socketId) {
  if (!room) {
    return {
      removedPlayer: null,
      removedIndex: -1
    };
  }

  const removedIndex = room.players.findIndex((player) => player.id === socketId);
  if (removedIndex === -1) {
    return {
      removedPlayer: null,
      removedIndex: -1
    };
  }

  const removedPlayer = room.players[removedIndex];
  room.players.splice(removedIndex, 1);

  return {
    removedPlayer,
    removedIndex
  };
}

function ensureValidTurnIndex(room) {
  if (!room || !room.players.length) {
    if (room) room.turnIndex = 0;
    return;
  }

  if (!Number.isInteger(room.turnIndex) || room.turnIndex < 0) {
    room.turnIndex = 0;
  }

  if (room.turnIndex >= room.players.length) {
    room.turnIndex = 0;
  }
}

function transferHostIfNeeded(room, oldHostId) {
  if (!room || !room.players.length) return;

  if (room.hostId === oldHostId) {
    room.hostId = room.players[0].id;
  }
}

function getSafeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    bank: room.bank,
    turnIndex: room.turnIndex,
    currentPlayerId: getCurrentPlayer(room)?.id || null,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      cash: player.cash,
      avatar: player.avatar,
      connected: player.connected !== false,
      deals: Array.isArray(player.deals) ? player.deals : []
    })),
    chat: Array.isArray(room.chat) ? room.chat.slice(-40) : []
  };
}

function emitRoomUpdate(io, room) {
  io.to(room.code).emit("roomUpdated", getSafeRoom(room));
}

function pushSystemMessage(room, text) {
  if (!room.chat) room.chat = [];
  room.chat.push({
    system: true,
    text: String(text || "")
  });
}

module.exports = {
  generateRoomCode,
  getRoomBySocketId,
  getPlayerBySocketId,
  removePlayerFromRoom,
  ensureValidTurnIndex,
  transferHostIfNeeded,
  getSafeRoom,
  emitRoomUpdate,
  pushSystemMessage
};