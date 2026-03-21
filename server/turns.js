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

// ============================
// 🔥 NEW: POT BATTLE SYSTEM
// ============================
function runPotBattle(io, room, emitRoomUpdate, pushSystemMessage) {
  if (!room.players.length) return;

  room.phase = "battle";

  const rolls = room.players.map(p => ({
    player: p,
    roll: Math.floor(Math.random() * 6) + 1
  }));

  const highest = Math.max(...rolls.map(r => r.roll));
  const winners = rolls.filter(r => r.roll === highest);

  io.to(room.code).emit("potBattleRolls", {
    rolls: rolls.map(r => ({
      playerName: r.player.name,
      roll: r.roll
    }))
  });

  setTimeout(() => {
    if (winners.length > 1) {
      pushSystemMessage(room, `Tie for pot battle! Rolling again...`);
      runPotBattle(io, room, emitRoomUpdate, pushSystemMessage);
      return;
    }

    const winner = winners[0].player;
    const pot = room.bank;

    winner.cash += pot;
    room.bank = 0;

    pushSystemMessage(room, `${winner.name} WON THE POT and collected ${formatMoney(pot)} 💰`);

    io.to(room.code).emit("potBattleWinner", {
      playerName: winner.name,
      amount: pot
    });

    emitRoomUpdate(io, room);

    setTimeout(() => {
      beginNextTurn(io, room, emitRoomUpdate);
    }, 2500);
  }, 2000);
}

// ============================
// EXISTING (UNCHANGED)
// ============================
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
// 🔥 MODIFIED ROLL (ADDED POT CHANCE)
// ============================
function handlePlayerRoll(io, room, player, emitRoomUpdate, pushSystemMessage) {
  if (!room || !player) return;

  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.id !== player.id) return;

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
      // 🔥 RANDOM POT BATTLE (20% chance)
      if (Math.random() < 0.2) {
        pushSystemMessage(room, `⚔️ POT BATTLE TRIGGERED! Everyone rolls for the bank!`);
        runPotBattle(io, room, emitRoomUpdate, pushSystemMessage);
        return;
      }

      room.phase = "resolving";

      const result = handleTile(room, player, roll);

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