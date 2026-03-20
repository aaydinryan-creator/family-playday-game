// gameState.js

function createRoom(code, hostId) {
  return {
    code,
    hostId,
    phase: "lobby", // lobby → game → rolling → moving → resolving
    bank: 50000,
    turnIndex: 0,
    players: [],
    chat: [],
    decks: {
      mail: [],
      deal: []
    },
    cardDecks: {
      mailDraw: [],
      mailDiscard: [],
      dealDraw: [],
      dealDiscard: []
    }
  };
}

function createPlayer(id, name, avatar) {
  return {
    id,
    reconnectId: null,
    name,
    position: 0,
    cash: 3500,
    avatar,
    connected: true,
    disconnectTimer: null,
    lastSeenAt: Date.now(),
    deals: [],
    hand: [],
    inventory: {
      items: []
    },
    stats: {
      totalEarned: 0,
      totalLost: 0
    }
  };
}

function getCurrentPlayer(room) {
  if (!room || !Array.isArray(room.players) || !room.players.length) {
    return null;
  }

  return room.players[room.turnIndex] || null;
}

function nextTurn(room) {
  if (!room || !Array.isArray(room.players) || !room.players.length) return;
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
}

module.exports = {
  createRoom,
  createPlayer,
  getCurrentPlayer,
  nextTurn
};