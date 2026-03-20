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
    }
  };
}

function createPlayer(id, name, avatar) {
  return {
    id,
    name,
    position: 0,
    cash: 3500,
    avatar,
    connected: true,
    deals: [],
    hand: []
  };
}

function getCurrentPlayer(room) {
  return room.players[room.turnIndex] || null;
}

function nextTurn(room) {
  if (!room.players.length) return;
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
}

module.exports = {
  createRoom,
  createPlayer,
  getCurrentPlayer,
  nextTurn
};