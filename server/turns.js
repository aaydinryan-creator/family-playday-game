const board = require("./board");
const { getCurrentPlayer, nextTurn } = require("./gameState");
const { handleTile } = require("./gameLogic");

const PLAYDAY_AMOUNT = 3500;
const ROLL_ANIMATION_MS = 1100;
const MOVE_ANIMATION_MS = 1150;
const PRE_RESOLVE_PAUSE_MS = 350;

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

function safelyClampRoomBank(room, fallback = 50000) {
  if (!Number.isFinite(room.bank)) {
    room.bank = fallback;
  }
}

function getSafePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    cash: player.cash,
    avatar: player.avatar,
    connected: player.connected !== false,
    deals: Array.isArray(player.deals) ? player.deals : [],
    hand: Array.isArray(player.hand) ? player.hand : [],
    inventory: {
      items: Array.isArray(player.inventory?.items) ? player.inventory.items : []
    },
    stats: {
      totalEarned: Number(player.stats?.totalEarned || 0),
      totalLost: Number(player.stats?.totalLost || 0)
    }
  };
}

function getSafeRoomSnapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    bank: room.bank,
    turnIndex: room.turnIndex,
    currentPlayerId: getCurrentPlayer(room)?.id || null,
    players: room.players.map(getSafePlayer),
    chat: Array.isArray(room.chat) ? room.chat.slice(-50) : []
  };
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

      if (player.stats) {
        player.stats.totalEarned = Number(player.stats.totalEarned || 0) + PLAYDAY_AMOUNT;
      }

      pushSystemMessage(
        room,
        `${player.name} hit PLAYDAY and collected ${formatMoney(PLAYDAY_AMOUNT)}.`
      );

      io.to(room.code).emit("playdayPassed", {
        playerId: player.id,
        playerName: player.name,
        amount: PLAYDAY_AMOUNT,
        room: getSafeRoomSnapshot(room)
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

      const beforeCash = Number(player.cash || 0);

      const result = handleTile(room, player, roll) || {
        title: "Tile",
        message: `${player.name} landed on a tile.`,
        tile: null,
        cards: [],
        revealDuration: 3500,
        soundCue: "tile_land"
      };

      const afterCash = Number(player.cash || 0);
      const delta = afterCash - beforeCash;

      if (player.stats) {
        if (delta > 0) {
          player.stats.totalEarned = Number(player.stats.totalEarned || 0) + delta;
        } else if (delta < 0) {
          player.stats.totalLost = Number(player.stats.totalLost || 0) + Math.abs(delta);
        }
      }

      safelyClampRoomBank(room);
      pushSystemMessage(room, result.message);

      io.to(room.code).emit("tileResult", {
        title: result.title,
        message: result.message,
        eventType: result.tile?.type || "default",
        landedPosition: player.position,
        playerName: player.name,
        cards: result.cards || [],
        revealDuration: result.revealDuration || 3500,
        soundCue: result.soundCue || null,
        cashDelta: delta,
        room: getSafeRoomSnapshot(room)
      });

      emitRoomUpdate(io, room);

      setTimeout(() => {
        beginNextTurn(io, room, emitRoomUpdate);
      }, result.revealDuration || 3500);
    }, MOVE_ANIMATION_MS + PRE_RESOLVE_PAUSE_MS);
  }, ROLL_ANIMATION_MS);
}

module.exports = {
  sendTurnUpdate,
  beginNextTurn,
  handlePlayerRoll
};