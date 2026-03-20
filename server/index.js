const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const rooms = {};

app.use(express.static("public"));

const TILE_DATA = [
  { label: "START", type: "start" },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "2 MAIL", type: "mail", count: 2 },
  { label: "DEAL", type: "deal" },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "MAIL", type: "mail", count: 1 },

  { label: "MAIL", type: "mail", count: 1 },
  { label: "DEAL", type: "deal" },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "LOTTERY", type: "lottery" },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "MAIL", type: "mail", count: 1 },

  { label: "DEAL", type: "deal" },
  { label: "3 MAIL", type: "mail", count: 3 },
  { label: "RADIO", type: "radio" },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "DEAL", type: "deal" },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "2 MAIL", type: "mail", count: 2 },

  { label: "MAIL", type: "mail", count: 1 },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "DEAL", type: "deal" },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "LOTTERY", type: "lottery" },
  { label: "MAIL", type: "mail", count: 1 },

  { label: "MAIL", type: "mail", count: 1 },
  { label: "MAIL", type: "mail", count: 1 },
  { label: "PAYDAY", type: "payday" }
];

const MAIL_CARDS = [
  { text: "Oh no, you broke your phone. Pay $300.", amount: -300 },
  { text: "Happy birthday. Somebody actually remembered. Collect $250.", amount: 250 },
  { text: "Damn, you blew your back out at golf. Pay $400.", amount: -400 },
  { text: "Grandma sent you money for no reason. Collect $300.", amount: 300 },
  { text: "Your car made that weird sound again. Pay $500.", amount: -500 },
  { text: "You found money in an old jacket pocket. Collect $120.", amount: 120 },
  { text: "You signed up for something dumb and forgot. Pay $180.", amount: -180 },
  { text: "A refund you forgot about finally hit. Collect $275.", amount: 275 },
  { text: "You tried to fix it yourself and made it worse. Pay $350.", amount: -350 },
  { text: "Somebody finally paid you back. Collect $220.", amount: 220 },
  { text: "You paid for everybody at brunch trying to look rich. Lose $250.", amount: -250 },
  { text: "Your aunt felt bad for you and slid you some money. Collect $200.", amount: 200 }
];

const DEAL_CARDS = [
  { text: "Your cousin said this was guaranteed money. You believed him. Lose $500.", amount: -500 },
  { text: "You flipped a dusty garage find for a profit. Collect $650.", amount: 650 },
  { text: "You bought a sketchy grill off Facebook Marketplace. Lose $300.", amount: -300 },
  { text: "You sold junk and called it vintage. Collect $450.", amount: 450 },
  { text: "You invested in a terrible side hustle. Lose $400.", amount: -400 },
  { text: "You found a cheap lawn mower, cleaned it up, and sold it. Collect $550.", amount: 550 },
  { text: "The hustle hustled back. Lose $250.", amount: -250 },
  { text: "An unbelievably dumb idea somehow worked. Collect $800.", amount: 800 },
  { text: "You bought something limited edition that nobody wanted. Lose $350.", amount: -350 },
  { text: "You turned clutter into cash. Collect $500.", amount: 500 }
];

const DEFAULT_AVATAR = {
  emoji: "😎",
  hat: "🧢",
  color: "#4fd081"
};

function normalizeAvatar(avatar) {
  if (!avatar || typeof avatar !== "object") {
    return { ...DEFAULT_AVATAR };
  }

  const emoji =
    typeof avatar.emoji === "string" && avatar.emoji.trim()
      ? avatar.emoji
      : DEFAULT_AVATAR.emoji;

  const hat =
    typeof avatar.hat === "string" && avatar.hat.trim()
      ? avatar.hat
      : DEFAULT_AVATAR.hat;

  const color =
    typeof avatar.color === "string" && avatar.color.trim()
      ? avatar.color
      : DEFAULT_AVATAR.color;

  return { emoji, hat, color };
}

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getRoomBySocketId(socketId) {
  return Object.values(rooms).find((room) =>
    room.players.some((player) => player.id === socketId)
  );
}

function getSafeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    bank: room.bank,
    turnIndex: room.turnIndex,
    currentPlayerId:
      room.phase === "game" && room.players[room.turnIndex]
        ? room.players[room.turnIndex].id
        : null,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      cash: player.cash,
      roll: player.roll,
      avatar: player.avatar
    })),
    chat: room.chat.slice(-40)
  };
}

function emitRoomUpdate(room) {
  io.to(room.code).emit("roomUpdated", getSafeRoom(room));
}

function getCurrentPlayer(room) {
  return room.players[room.turnIndex] || null;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function applyAmountToPlayerAndBank(player, room, amount) {
  player.cash += amount;
  room.bank -= amount;
}

function drawMailCards(player, room, count) {
  const cards = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const card = randomFrom(MAIL_CARDS);
    applyAmountToPlayerAndBank(player, room, card.amount);
    total += card.amount;
    cards.push({
      title: "MAIL",
      text: card.text,
      amount: card.amount,
      type: "mail"
    });
  }

  return { cards, total };
}

function drawDealCard(player, room) {
  const card = randomFrom(DEAL_CARDS);
  applyAmountToPlayerAndBank(player, room, card.amount);

  return {
    cards: [
      {
        title: "DEAL",
        text: card.text,
        amount: card.amount,
        type: "deal"
      }
    ],
    total: card.amount
  };
}

function getTileEffect(tile, player, room) {
  let title = tile.label;
  let message = `${player.name} landed on ${tile.label}.`;
  let eventType = tile.type || "default";
  let cards = [];

  switch (tile.type) {
    case "start":
      title = "START";
      message = `${player.name} is at START.`;
      break;

    case "mail": {
      const result = drawMailCards(player, room, tile.count || 1);
      cards = result.cards;
      title = (tile.count || 1) > 1 ? `${tile.count} MAIL` : "MAIL";
      message = `${player.name} checked the mail.`;
      break;
    }

    case "deal": {
      const result = drawDealCard(player, room);
      cards = result.cards;
      title = "DEAL";
      message = `${player.name} pulled a DEAL card.`;
      break;
    }

    case "lottery": {
      const amount = 500;
      player.cash += amount;
      room.bank -= amount;
      title = "LOTTERY";
      message = `${player.name} won ${formatMoney(amount)} in the LOTTERY.`;
      break;
    }

    case "radio": {
      const amount = 1000;
      player.cash += amount;
      room.bank -= amount;
      title = "RADIO";
      message = `${player.name} won the RADIO CONTEST and collected ${formatMoney(amount)}.`;
      break;
    }

    case "payday": {
      const amount = 3500;
      player.cash += amount;
      room.bank -= amount;
      title = "PAYDAY";
      message = `${player.name} reached PAYDAY and collected ${formatMoney(amount)}.`;
      break;
    }

    default:
      title = tile.label || "Tile";
      message = `${player.name} landed on ${tile.label || tile.type}.`;
      eventType = "default";
      break;
  }

  return {
    title,
    message,
    eventType,
    cards
  };
}

function getRevealDurationMs(cards) {
  if (!cards || !cards.length) return 3200;
  return (cards.length * 2300) + 1200;
}

function getChatSummary(playerName, eventType, cards, fallbackMessage) {
  if (!cards || !cards.length) return fallbackMessage;

  const total = cards.reduce((sum, card) => sum + card.amount, 0);
  const verb = eventType === "deal" ? "pulled a DEAL card" : "checked the mail";
  const resultText =
    total >= 0
      ? `and gained ${formatMoney(total)}`
      : `and lost ${formatMoney(Math.abs(total))}`;

  return `${playerName} ${verb} ${resultText}.`;
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, avatar }) => {
    const trimmedName = String(name || "").trim();

    if (!trimmedName) {
      socket.emit("errorMessage", "Please enter your name.");
      return;
    }

    let code = generateRoomCode();
    while (rooms[code]) {
      code = generateRoomCode();
    }

    rooms[code] = {
      code,
      hostId: socket.id,
      phase: "lobby",
      bank: 50000,
      turnIndex: 0,
      players: [
        {
          id: socket.id,
          name: trimmedName,
          position: 0,
          cash: 3500,
          roll: null,
          avatar: normalizeAvatar(avatar)
        }
      ],
      chat: [
        {
          system: true,
          text: `${trimmedName} created the room.`
        }
      ]
    };

    socket.join(code);
    socket.data.roomCode = code;

    socket.emit("roomJoined", {
      room: getSafeRoom(rooms[code]),
      yourId: socket.id
    });

    emitRoomUpdate(rooms[code]);
  });

  socket.on("joinRoom", ({ name, roomCode, avatar }) => {
    const trimmedName = String(name || "").trim();
    const code = String(roomCode || "").trim().toUpperCase();

    if (!trimmedName) {
      socket.emit("errorMessage", "Please enter your name.");
      return;
    }

    if (!code) {
      socket.emit("errorMessage", "Please enter a room code.");
      return;
    }

    const room = rooms[code];
    if (!room) {
      socket.emit("errorMessage", "Room not found.");
      return;
    }

    if (room.phase !== "lobby") {
      socket.emit("errorMessage", "That game already started.");
      return;
    }

    if (room.players.length >= 12) {
      socket.emit("errorMessage", "That room is full.");
      return;
    }

    room.players.push({
      id: socket.id,
      name: trimmedName,
      position: 0,
      cash: 3500,
      roll: null,
      avatar: normalizeAvatar(avatar)
    });

    room.chat.push({
      system: true,
      text: `${trimmedName} joined the room.`
    });

    socket.join(code);
    socket.data.roomCode = code;

    socket.emit("roomJoined", {
      room: getSafeRoom(room),
      yourId: socket.id
    });

    emitRoomUpdate(room);
  });

  socket.on("startGame", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit("errorMessage", "Only the host can start the game.");
      return;
    }

    if (room.players.length < 2) {
      socket.emit("errorMessage", "You need at least 2 players to start.");
      return;
    }

    room.phase = "roll";
    room.players.forEach((player) => {
      player.roll = null;
    });

    room.chat.push({
      system: true,
      text: "Roll phase started. Highest roll goes first."
    });

    io.to(room.code).emit("startRollPhase", getSafeRoom(room));
    emitRoomUpdate(room);
  });

  socket.on("rollForOrder", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room || room.phase !== "roll") return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.roll !== null) return;

    io.to(room.code).emit("orderRollStarted", {
      playerId: player.id,
      playerName: player.name
    });

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      player.roll = roll;

      room.chat.push({
        system: true,
        text: `${player.name} rolled a ${roll}.`
      });

      io.to(room.code).emit("playerRolled", {
        id: player.id,
        name: player.name,
        roll
      });

      const allRolled = room.players.every((p) => p.roll !== null);
      if (!allRolled) {
        emitRoomUpdate(room);
        return;
      }

      room.players.sort((a, b) => b.roll - a.roll);

      io.to(room.code).emit(
        "finalOrder",
        room.players.map((p) => ({
          id: p.id,
          name: p.name,
          roll: p.roll
        }))
      );

      room.chat.push({
        system: true,
        text: `${room.players[0].name} goes first.`
      });

      setTimeout(() => {
        room.phase = "game";
        room.turnIndex = 0;

        io.to(room.code).emit("gameStarted", {
          room: getSafeRoom(room)
        });

        const currentPlayer = getCurrentPlayer(room);
        if (currentPlayer) {
          io.to(room.code).emit("turnUpdate", {
            currentPlayerId: currentPlayer.id,
            currentPlayerName: currentPlayer.name
          });
        }

        emitRoomUpdate(room);
      }, 2200);
    }, 1200);
  });

  socket.on("rollTurn", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room || room.phase !== "game") return;

    const currentPlayer = getCurrentPlayer(room);
    if (!currentPlayer) return;

    if (currentPlayer.id !== socket.id) {
      socket.emit("errorMessage", "It is not your turn.");
      return;
    }

    io.to(room.code).emit("sharedTurnRollStarted", {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name
    });

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      const from = currentPlayer.position;
      const to = Math.min(TILE_DATA.length - 1, from + roll);

      io.to(room.code).emit("turnRolled", {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        roll
      });

      setTimeout(() => {
        currentPlayer.position = to;

        io.to(room.code).emit("playerMoved", {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          from,
          to,
          roll
        });

        setTimeout(() => {
          const tile = TILE_DATA[currentPlayer.position];
          const result = getTileEffect(tile, currentPlayer, room);

          room.chat.push({
            system: true,
            text: getChatSummary(currentPlayer.name, result.eventType, result.cards, result.message)
          });

          const revealDuration = getRevealDurationMs(result.cards);

          io.to(room.code).emit("tileResult", {
            title: result.title,
            message: result.message,
            eventType: result.eventType,
            cards: result.cards,
            landedPosition: currentPlayer.position,
            playerName: currentPlayer.name,
            room: getSafeRoom(room)
          });

          emitRoomUpdate(room);

          setTimeout(() => {
            room.turnIndex = (room.turnIndex + 1) % room.players.length;

            const nextPlayer = getCurrentPlayer(room);
            if (nextPlayer) {
              io.to(room.code).emit("turnUpdate", {
                currentPlayerId: nextPlayer.id,
                currentPlayerName: nextPlayer.name
              });
            }

            emitRoomUpdate(room);
          }, revealDuration);
        }, 700);
      }, 1400);
    }, 300);
  });

  socket.on("sendChatMessage", ({ text }) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const trimmedText = String(text || "").trim();
    if (!trimmedText) return;

    room.chat.push({
      system: false,
      name: player.name,
      text: trimmedText.slice(0, 180)
    });

    emitRoomUpdate(room);
  });

  socket.on("disconnect", () => {
    const room = getRoomBySocketId(socket.id);
    if (!room) return;

    const leavingPlayer = room.players.find((p) => p.id === socket.id);
    const leavingIndex = room.players.findIndex((p) => p.id === socket.id);

    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      delete rooms[room.code];
      return;
    }

    if (leavingPlayer) {
      room.chat.push({
        system: true,
        text: `${leavingPlayer.name} left the room.`
      });
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }

    if (room.phase === "game") {
      if (leavingIndex < room.turnIndex) {
        room.turnIndex -= 1;
      }
      if (room.turnIndex >= room.players.length) {
        room.turnIndex = 0;
      }

      const currentPlayer = getCurrentPlayer(room);
      if (currentPlayer) {
        io.to(room.code).emit("turnUpdate", {
          currentPlayerId: currentPlayer.id,
          currentPlayerName: currentPlayer.name
        });
      }
    }

    emitRoomUpdate(room);
  });
});

http.listen(3000, () => {
  console.log("Running on http://localhost:3000");
});