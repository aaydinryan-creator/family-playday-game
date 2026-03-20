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
  if (!rooms || !socketId) return null;

  return (
    Object.values(rooms).find((room) =>
      Array.isArray(room.players) &&
      room.players.some((player) => player.id === socketId)
    ) || null
  );
}

function getPlayerBySocketId(room, socketId) {
  if (!room || !Array.isArray(room.players)) return null;
  return room.players.find((player) => player.id === socketId) || null;
}

function removePlayerFromRoom(room, socketId) {
  if (!room || !Array.isArray(room.players)) {
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
  if (!room) return;

  if (!Array.isArray(room.players) || room.players.length === 0) {
    room.turnIndex = 0;
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
  if (!room || !Array.isArray(room.players) || !room.players.length) return;

  if (room.hostId === oldHostId) {
    room.hostId = room.players[0].id;
  }
}

function getSafePlayer(player) {
  const inventoryItems = Array.isArray(player?.inventory?.items)
    ? player.inventory.items
    : [];

  return {
    id: player?.id || null,
    name: player?.name || "Player",
    position: Number(player?.position || 0),
    cash: Number(player?.cash || 0),
    avatar: player?.avatar || null,
    connected: player?.connected !== false,
    deals: Array.isArray(player?.deals) ? player.deals : [],
    hand: Array.isArray(player?.hand) ? player.hand : [],
    inventory: {
      items: inventoryItems
    },
    stats: {
      totalEarned: Number(player?.stats?.totalEarned || 0),
      totalLost: Number(player?.stats?.totalLost || 0)
    }
  };
}

function getSafeRoom(room) {
  const safePlayers = Array.isArray(room?.players)
    ? room.players.map(getSafePlayer)
    : [];

  return {
    code: room?.code || "",
    hostId: room?.hostId || null,
    phase: room?.phase || "lobby",
    bank: Number(room?.bank || 0),
    turnIndex: Number(room?.turnIndex || 0),
    currentPlayerId: getCurrentPlayer(room)?.id || null,
    players: safePlayers,
    chat: Array.isArray(room?.chat) ? room.chat.slice(-50) : []
  };
}

function emitRoomUpdate(io, room) {
  if (!io || !room?.code) return;
  io.to(room.code).emit("roomUpdated", getSafeRoom(room));
}

function pushSystemMessage(room, text) {
  if (!room) return;
  if (!Array.isArray(room.chat)) room.chat = [];

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