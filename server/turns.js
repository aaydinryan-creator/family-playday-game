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

  if (room.bank < 0) {
    room.bank = 0;
  }
}

function ensureTurnRoomState(room) {
  if (!room) return;

  if (typeof room.pot !== "number" || !Number.isFinite(room.pot)) {
    room.pot = 0;
  }

  if (typeof room.potBattleReady !== "boolean") {
    room.potBattleReady = false;
  }

  if (typeof room.potBattleTriggered !== "boolean") {
    room.potBattleTriggered = false;
  }

  if (!Number.isFinite(room.potBattleThreshold)) {
    room.potBattleThreshold = 3000;
  }
}

function getSafePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    cash: player.cash,
    money: typeof player.money === "number" ? player.money : player.cash,
    avatar: player.avatar,
    connected: player.connected !== false,
    inventory: {
      items: Array.isArray(player.inventory?.items) ? player.inventory.items : []
    }
  };
}

function getSafeRoomSnapshot(room) {
  ensureTurnRoomState(room);

  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    bank: room.bank,
    pot: typeof room.pot === "number" ? room.pot : 0,
    potBattleReady: !!room.potBattleReady,
    potBattleTriggered: !!room.potBattleTriggered,
    potBattleThreshold: Number(room.potBattleThreshold || 3000),
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
  ensureTurnRoomState(room);

  // STOP if pot battle started or is ready to start
  if (room.phase === "pot-battle" || room.potBattleReady) return;

  nextTurn(room);
  skipOfflinePlayers(room);

  room.phase = "game";

  sendTurnUpdate(io, room);
  emitRoomUpdate(io, room);
}

function handlePlayerRoll(io, room, player, emitRoomUpdate, pushSystemMessage) {
  if (!room || !player) return;

  ensureTurnRoomState(room);

  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.id !== player.id) return;

  // BLOCK rolling during pot battle or if pot battle is already ready
  if (room.phase === "pot-battle" || room.potBattleReady) return;

  room.phase = "rolling";
  emitRoomUpdate(io, room);

  const roll = Math.floor(Math.random() * 6) + 1;
  const from = Number(player.position || 0);
  const rawTo = from + roll;

  const passedPlayday = rawTo >= board.length && from !== board.length - 1;
  const to = rawTo % board.length;

  io.to(room.code).emit("turnRolled", {
    playerId: player.id,
    playerName: player.name,
    roll
  });

  setTimeout(() => {
    // STOP if pot battle triggered during roll
    if (room.phase === "pot-battle" || room.potBattleReady) return;

    room.phase = "moving";
    player.position = to;

    if (passedPlayday) {
      player.cash += PLAYDAY_AMOUNT;
      if (typeof player.money === "number") player.money += PLAYDAY_AMOUNT;

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
      // STOP if pot battle triggered during move
      if (room.phase === "pot-battle" || room.potBattleReady) return;

      room.phase = "resolving";

      const beforeCash = Number(player.cash || 0);

      const result = handleTile(room, player, roll) || {
        title: "Tile",
        message: `${player.name} landed somewhere.`,
        tile: null,
        cards: [],
        revealDuration: 3500,
        soundCue: "tile_land",
        pot: room.pot,
        potBattleReady: room.potBattleReady,
        potBattleTriggered: false,
        potBattleThreshold: room.potBattleThreshold
      };

      const afterCash = Number(player.cash || 0);
      const delta = afterCash - beforeCash;

      player.money = afterCash;

      if (typeof result.pot === "number" && Number.isFinite(result.pot)) {
        room.pot = result.pot;
      }

      if (typeof result.potBattleReady === "boolean") {
        room.potBattleReady = result.potBattleReady;
      }

      if (typeof result.potBattleTriggered === "boolean") {
        room.potBattleTriggered = result.potBattleTriggered;
      }

      if (
        typeof result.potBattleThreshold === "number" &&
        Number.isFinite(result.potBattleThreshold)
      ) {
        room.potBattleThreshold = result.potBattleThreshold;
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
        pot: room.pot,
        potBattleReady: !!room.potBattleReady,
        potBattleTriggered: !!room.potBattleTriggered,
        potBattleThreshold: Number(room.potBattleThreshold || 3000),
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