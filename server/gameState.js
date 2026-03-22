// gameState.js

function createRoom(code, hostId) {
  return {
    code,
    hostId,
    phase: "lobby", // lobby -> start-roll -> game -> pot-battle
    bank: 50000,
    pot: 0,
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
    },
    startRollState: {
      active: false,
      round: 1,
      eligiblePlayerIds: [],
      rolls: {}
    },
    potBattleState: {
      active: false,
      round: 1,
      eligiblePlayerIds: [],
      rolls: {}
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
  if (!room || !Array.isArray(room.players) || room.players.length === 0) {
    return null;
  }

  if (
    typeof room.turnIndex !== "number" ||
    room.turnIndex < 0 ||
    room.turnIndex >= room.players.length
  ) {
    room.turnIndex = 0;
  }

  return room.players[room.turnIndex] || null;
}

function nextTurn(room) {
  if (!room || !Array.isArray(room.players) || room.players.length === 0) {
    return;
  }

  room.turnIndex = (room.turnIndex + 1) % room.players.length;

  if (
    typeof room.turnIndex !== "number" ||
    room.turnIndex < 0 ||
    room.turnIndex >= room.players.length
  ) {
    room.turnIndex = 0;
  }
}

module.exports = {
  createRoom,
  createPlayer,
  getCurrentPlayer,
  nextTurn
};