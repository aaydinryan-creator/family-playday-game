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
    inventory: {
      items: Array.isArray(player.inventory?.items) ? player.inventory.items : []
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

function skipOfflinePlayers(room) {
  let safety = 0;

  while (
    room.players.length &&
    getCurrentPlayer(room)?.connected === false &&
    safety < 20
  ) {
    nextTurn(room);
    safety++;
  }
}

function beginNextTurn(io, room, emitRoomUpdate) {
  nextTurn(room);
  skipOfflinePlayers(room);

  room.phase = "game";

  sendTurnUpdate(io, room);
  emitRoomUpdate(io, room);
}

// ============================
// POT BATTLE SYSTEM
// ============================
function runPotBattle(io, room, emitRoomUpdate, pushSystemMessage) {
  if (!room || !room.players.length) return;

  const eligiblePlayers = room.players.filter((player) => player.connected !== false);
  if (!eligiblePlayers.length) {
    beginNextTurn(io, room, emitRoomUpdate);
    return;
  }

  room.phase = "battle";
  emitRoomUpdate(io, room);

  const rolls = eligiblePlayers.map((player) => ({
    player,
    roll: Math.floor(Math.random() * 6) + 1
  }));

  const highest = Math.max(...rolls.map((r) => r.roll));
  const winners = rolls.filter((r) => r.roll === highest);

  io.to(room.code).emit("potBattleRolls", {
    rolls: rolls.map((r) => ({
      playerName: r.player.name,
      roll: r.roll
    }))
  });

  setTimeout(() => {
    if (winners.length > 1) {
      pushSystemMessage(room, `Tie for pot battle at ${highest}. Rolling again...`);
      runPotBattle(io, room, emitRoomUpdate, pushSystemMessage);
      return;
    }

    const winner = winners[0].player;
    const pot = Number(room.bank || 0);

    winner.cash += pot;
    room.bank = 0;
    safelyClampRoomBank(room, 0);

    pushSystemMessage(room, `${winner.name} WON THE POT and collected ${formatMoney(pot)}.`);

    io.to(room.code).emit("potBattleWinner", {
      playerName: winner.name,
      amount: pot,
      room: getSafeRoomSnapshot(room)
    });

    emitRoomUpdate(io, room);

    setTimeout(() => {
      beginNextTurn(io, room, emitRoomUpdate);
    }, 2500);
  }, 2000);
}

function handlePlayerRoll(io, room, player, emitRoomUpdate, pushSystemMessage) {
  if (!room || !player) return;

  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.id !== player.id) {
    return;
  }

  room.phase = "rolling";
  emitRoomUpdate(io, room);

  const roll = Math.floor(Math.random() * 6) + 1;
  const from = player.position;
  const rawTo = from + roll;

  const passedPlayday = rawTo >= board.length && from !== board.length - 1;
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
      // 20% chance to trigger pot battle before tile resolution
      if (Math.random() < 0.2) {
        pushSystemMessage(room, "⚔️ POT BATTLE TRIGGERED! Everyone rolls for the bank!");
        runPotBattle(io, room, emitRoomUpdate, pushSystemMessage);
        return;
      }

      room.phase = "resolving";

      const beforeCash = Number(player.cash || 0);

      const result = handleTile(room, player, roll) || {
        title: "Tile",
        message: `${player.name} landed somewhere.`,
        tile: null,
        cards: [],
        revealDuration: 3500,
        soundCue: "tile_land"
      };

      const afterCash = Number(player.cash || 0);
      const delta = afterCash - beforeCash;

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