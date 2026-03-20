const board = require("./board");

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

function getTileAtPosition(position) {
  if (position < 0 || position >= board.length) return null;
  return board[position];
}

function addMoney(player, room, amount) {
  const value = Number(amount || 0);
  player.cash += value;
  room.bank -= value;
}

function removeMoney(player, room, amount) {
  const value = Number(amount || 0);
  player.cash -= value;
  room.bank += value;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function personalizeText(text, playerName) {
  const greetings = [
    `Hey ${playerName}...`,
    `Yo ${playerName}...`,
    `${playerName}, listen...`,
    `Alright ${playerName}...`,
    `Look ${playerName}...`,
    `${playerName}... yeah you...`
  ];

  return `${randomFrom(greetings)} ${text}`;
}

function applyCardAmount(player, room, amount) {
  if (amount > 0) {
    addMoney(player, room, amount);
  } else if (amount < 0) {
    removeMoney(player, room, Math.abs(amount));
  }
}

const MAIL_CARDS = [
  { text: "Hospital bill shows up from something you don't even remember doing. Pay $600.", amount: -600 },
  { text: "Your bank hit you with a 'maintenance fee' for being broke. Pay $120.", amount: -120 },
  { text: "A letter arrives just to remind you you're not where you thought you'd be in life.", amount: 0 },
  { text: "You got a refund and immediately spent it on dumb stuff. Net gain $50.", amount: 50 },
  { text: "Your phone auto-renewed 3 subscriptions you forgot about. Pay $210.", amount: -210 },
  { text: "Your grandma sent money and a note saying 'please get your life together.' Collect $350.", amount: 350 },
  { text: "Jury duty notice. No pay. Just vibes. Lose $80 in food and parking.", amount: -80 },
  { text: "Someone mailed you $200 by accident and you kept it. Collect $200.", amount: 200 },
  { text: "You got a bill so high you had to sit down after opening it. Pay $700.", amount: -700 },
  { text: "You got a check in the mail and immediately felt rich for 4 minutes. Collect $180.", amount: 180 },
  { text: "Letter just says: 'You fell off.' No money. Just facts.", amount: 0 },
  { text: "A birthday card arrives empty. Not even signed.", amount: 0 },
  { text: "You opened a letter that just said 'do better.'", amount: 0 },
  { text: "You tried to cut your own hair. Emergency fix required. Pay $90.", amount: -90 },
  { text: "You ordered food twice and still ate both. Pay $60.", amount: -60 },
  { text: "You lost your wallet and replaced everything. Pay $150.", amount: -150 },
  { text: "You found $20 on the ground and felt rich. Collect $20.", amount: 20 },
  { text: "Someone finally paid you back. Collect $250.", amount: 250 },
  { text: "Bed Sheet cooking Oil angels aren't as sexy as you had hoped cost of new bed sheet $150.", amount: -150 }
];

const DEAL_CARDS = [
  { text: "You bought something to flip and nobody wanted it. Lose $500.", amount: -500 },
  { text: "You trusted a random guy online. Lose $600.", amount: -600 },
  { text: "You flipped something and it actually worked. Collect $700.", amount: 700 },
  { text: "You invested in something you didn't understand. Lose $450.", amount: -450 },
  { text: "You sold something broken and got away with it. Collect $550.", amount: 550 },
  { text: "You tried to start a business at 2AM. It failed instantly. Lose $300.", amount: -300 },
  { text: "You made money off the dumbest idea ever. Collect $900.", amount: 900 },
  { text: "You got scammed and knew better. Lose $700.", amount: -700 },
  { text: "You found something valuable and sold it big. Collect $1000.", amount: 1000 },
  { text: "You thought it was a good deal and it wasn't. Lose $375.", amount: -375 }
];

const ALAYNA_FORCED_DOUBLE_MAIL = [
  {
    text: "Congragulations you have just been approved for a 3,000 dolla credit card.",
    amount: 3000
  },
  {
    text: "Surprise Bill from your lawyer -5,000.",
    amount: -5000
  }
];

const LORI_FORCED_DOUBLE_MAIL = [
  {
    text: "Congragulation on losing 5 lbs your free gift was supposed to be a body length mirror however we do not have mirrors wide enough.",
    amount: 0
  },
  {
    text: "Sorry about the mirror mix up here is a coupon for free cookies 🍪🍪 REMEMBER YOU'RE WORTH IT.",
    amount: 0
  }
];

function getForcedDoubleMailKey(player, tile) {
  if (!player || !tile) return null;
  if (tile.type !== "mail" || Number(tile.count || 1) !== 2) return null;

  const playerName = String(player.name || "").trim().toLowerCase();

  if (playerName === "alayna") return "alayna";
  if (playerName === "lori") return "lori";

  return null;
}

function getForcedDoubleMailCards(forcedKey) {
  switch (forcedKey) {
    case "alayna":
      return ALAYNA_FORCED_DOUBLE_MAIL;
    case "lori":
      return LORI_FORCED_DOUBLE_MAIL;
    default:
      return null;
  }
}

function drawSpecificCards(player, room, cardList, type, title, soundCue = null) {
  const cards = [];
  let total = 0;

  for (const card of cardList) {
    applyCardAmount(player, room, card.amount);
    total += card.amount;

    cards.push({
      title,
      text: personalizeText(card.text, player.name),
      amount: card.amount,
      type,
      sound: soundCue
    });
  }

  return { cards, total, soundCue };
}

function drawMailCards(player, room, count) {
  const cards = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const card = randomFrom(MAIL_CARDS);

    applyCardAmount(player, room, card.amount);
    total += card.amount;

    let sound = "mail_weird";
    if (card.amount > 0) sound = "mail_good";
    if (card.amount < 0) sound = "mail_bad";

    cards.push({
      title: "MAIL",
      text: personalizeText(card.text, player.name),
      amount: card.amount,
      type: "mail",
      sound
    });
  }

  let soundCue = "mail_weird";
  if (total > 0) soundCue = "mail_good";
  if (total < 0) soundCue = "mail_bad";

  return { cards, total, soundCue };
}

function drawDealCard(player, room) {
  const card = randomFrom(DEAL_CARDS);

  applyCardAmount(player, room, card.amount);

  const soundCue = card.amount >= 0 ? "deal_good" : "deal_bad";

  return {
    cards: [
      {
        title: "DEAL",
        text: personalizeText(card.text, player.name),
        amount: card.amount,
        type: "deal",
        sound: soundCue
      }
    ],
    total: card.amount,
    soundCue
  };
}

function getRevealDuration(cards) {
  if (!cards || !cards.length) return 4500;
  return cards.length * 4000 + 1500;
}

function handleTile(room, player, roll) {
  const tile = getTileAtPosition(player.position);

  if (!tile) {
    return {
      title: "Unknown Tile",
      message: `${player.name} landed somewhere weird...`,
      tile: null,
      cards: [],
      revealDuration: 3000,
      soundCue: "weird_tile"
    };
  }

  let title = tile.label || tile.type;
  let message = `${player.name} landed on ${tile.label || tile.type}.`;
  let cards = [];
  let soundCue = null;

  switch (tile.type) {
    case "mail": {
      let result;
      const forcedKey = getForcedDoubleMailKey(player, tile);

      if (forcedKey) {
        const forcedCards = getForcedDoubleMailCards(forcedKey);

        let forcedSound = "mail_weird";
        if (forcedKey === "alayna") forcedSound = "credit_card_trap";
        if (forcedKey === "lori") forcedSound = "lori_mirror";

        result = drawSpecificCards(
          player,
          room,
          forcedCards,
          "mail",
          "MAIL",
          forcedSound
        );
      } else {
        result = drawMailCards(player, room, tile.count || 1);
      }

      cards = result.cards;
      soundCue = result.soundCue;

      if (forcedKey === "alayna") {
        message = `${player.name} got approved for a credit card and immediately ruined their life.`;
      } else if (forcedKey === "lori") {
        message = `${player.name} checked the mail and got roasted twice for free.`;
      } else if (result.total > 0) {
        message = `${player.name} checked the mail and came up ${formatMoney(result.total)}.`;
      } else if (result.total < 0) {
        message = `${player.name} checked the mail and got cooked for ${formatMoney(Math.abs(result.total))}.`;
      } else {
        message = `${player.name} checked the mail and got nothing but emotional damage.`;
      }

      break;
    }

    case "deal": {
      const result = drawDealCard(player, room);
      cards = result.cards;
      soundCue = result.soundCue;

      if (result.total >= 0) {
        message = `${player.name} made ${formatMoney(result.total)} from a deal.`;
      } else {
        message = `${player.name} lost ${formatMoney(Math.abs(result.total))} on a deal.`;
      }

      break;
    }

    case "sweepstakes":
      addMoney(player, room, tile.amount);
      message = `${player.name} won ${formatMoney(tile.amount)} in Sweepstakes!`;
      soundCue = "cash_win";
      break;

    case "lottery": {
      const win = 500;
      addMoney(player, room, win);
      message = `${player.name} won ${formatMoney(win)} in the Lottery!`;
      soundCue = "cash_win";
      break;
    }

    case "radio":
      addMoney(player, room, tile.amount);
      message = `${player.name} won the radio contest and collected ${formatMoney(tile.amount)}.`;
      soundCue = "cash_win";
      break;

    case "buyer":
      message = `${player.name} found a buyer. Hope you actually have something worth selling.`;
      soundCue = "buyer_tile";
      break;

    case "birthday": {
      let total = 0;

      room.players.forEach((otherPlayer) => {
        if (otherPlayer.id !== player.id) {
          otherPlayer.cash -= tile.amountPerPlayer;
          player.cash += tile.amountPerPlayer;
          total += tile.amountPerPlayer;
        }
      });

      message = `${player.name} had a birthday and collected ${formatMoney(total)} from everyone else.`;
      soundCue = "birthday_tile";
      break;
    }

    case "ski":
      removeMoney(player, room, tile.cost);
      message = `${player.name} paid ${formatMoney(tile.cost)} for Super Ski Sunday.`;
      soundCue = "money_loss";
      break;

    case "charity":
      removeMoney(player, room, tile.cost);
      message = `${player.name} donated ${formatMoney(tile.cost)} to charity. Very noble. Very broke.`;
      soundCue = "money_loss";
      break;

    case "yardsale": {
      const cost = roll * 100;
      removeMoney(player, room, cost);
      message = `${player.name} spent ${formatMoney(cost)} at a yard sale after rolling a ${roll}.`;
      soundCue = "money_loss";
      break;
    }

    case "walk": {
      let total = 0;

      room.players.forEach((otherPlayer) => {
        if (otherPlayer.id !== player.id) {
          const charityRoll = Math.floor(Math.random() * 6) + 1;
          const amount = charityRoll * 100;
          otherPlayer.cash -= amount;
          room.bank += amount;
          total += amount;
        }
      });

      message = `${player.name} triggered Walk for Charity. Everyone else paid a total of ${formatMoney(total)} into the pot.`;
      soundCue = "charity_walk";
      break;
    }

    case "payday":
      addMoney(player, room, tile.salary);
      message = `${player.name} got paid ${formatMoney(tile.salary)}.`;
      soundCue = "cash_win";
      break;

    default:
      message = `${player.name} landed on ${tile.label || tile.type}.`;
      soundCue = "tile_land";
      break;
  }

  return {
    title,
    message,
    tile,
    cards,
    revealDuration: getRevealDuration(cards),
    soundCue
  };
}

module.exports = {
  handleTile,
  getTileAtPosition
};