const board = require("./board");
const { getCurrentPlayer, nextTurn } = require("./gameState");
const { handleTile } = require("./gameLogic");

const PLAYDAY_AMOUNT = 3500;

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

function safelyClampRoomBank(room, fallback = 50000) {
  if (!Number.isFinite(room.bank)) {
    room.bank = fallback;
  }
}

function sendTurnUpdate(io, room) {
  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer) return;

  io.to(room.code).emit("turnUpdate", {
    currentPlayerId: currentPlayer.id,
    currentPlayerName: currentPlayer.name
  });
}

function beginNextTurn(io, room, emitRoomUpdate) {
  room.phase = "game";
  nextTurn(room);
  sendTurnUpdate(io, room);
  emitRoomUpdate(io, room);
}

function handlePlayerRoll(io, room, player, emitRoomUpdate, pushSystemMessage) {
  if (!room || !player) return;

  room.phase = "rolling";
  emitRoomUpdate(io, room);

  const roll = Math.floor(Math.random() * 6) + 1;
  const from = player.position;
  const rawTo = from + roll;
  const passedPlayday = rawTo >= board.length;
  const to = rawTo % board.length;

  io.to(room.code).emit("turnRolled", {
    playerId: player.id,
    playerName: player.name,
    roll
  });

  setTimeout(() => {
    room.phase = "moving";
    player.position = to;

    if (passedPlayday) {
      player.cash += PLAYDAY_AMOUNT;
      room.bank -= PLAYDAY_AMOUNT;
      safelyClampRoomBank(room);

      pushSystemMessage(
        room,
        `${player.name} hit PLAYDAY and collected ${formatMoney(PLAYDAY_AMOUNT)}.`
      );

      io.to(room.code).emit("playdayPassed", {
        playerId: player.id,
        playerName: player.name,
        amount: PLAYDAY_AMOUNT,
        room: {
          code: room.code,
          hostId: room.hostId,
          phase: room.phase,
          bank: room.bank,
          turnIndex: room.turnIndex,
          currentPlayerId: getCurrentPlayer(room)?.id || null,
          players: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            cash: p.cash,
            avatar: p.avatar,
            connected: p.connected !== false,
            deals: Array.isArray(p.deals) ? p.deals : []
          })),
          chat: Array.isArray(room.chat) ? room.chat.slice(-40) : []
        }
      });
    }

    io.to(room.code).emit("playerMoved", {
      playerId: player.id,
      playerName: player.name,
      from,
      to,
      roll
    });

    emitRoomUpdate(io, room);

    setTimeout(() => {
      room.phase = "resolving";

      const result = handleTile(room, player, roll) || {
        title: "Tile",
        message: `${player.name} landed on a tile.`,
        tile: null,
        cards: [],
        revealDuration: 2500
      };

      safelyClampRoomBank(room);
      pushSystemMessage(room, result.message);

      io.to(room.code).emit("tileResult", {
        title: result.title,
        message: result.message,
        eventType: result.tile?.type || "default",
        landedPosition: player.position,
        playerName: player.name,
        cards: result.cards || [],
        room: {
          code: room.code,
          hostId: room.hostId,
          phase: room.phase,
          bank: room.bank,
          turnIndex: room.turnIndex,
          currentPlayerId: getCurrentPlayer(room)?.id || null,
          players: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            cash: p.cash,
            avatar: p.avatar,
            connected: p.connected !== false,
            deals: Array.isArray(p.deals) ? p.deals : []
          })),
          chat: Array.isArray(room.chat) ? room.chat.slice(-40) : []
        }
      });

      emitRoomUpdate(io, room);

      setTimeout(() => {
        beginNextTurn(io, room, emitRoomUpdate);
      }, result.revealDuration || 2500);
    }, 1100);
  }, 1000);
}

module.exports = {
  sendTurnUpdate,
  beginNextTurn,
  handlePlayerRoll
};