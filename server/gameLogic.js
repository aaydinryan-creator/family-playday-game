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

const MAIL_CARDS = [
  {
    text: "You blew your back out playing golf trying to look athletic. Pay $400.",
    amount: -400
  },
  {
    text: "Your grandma felt bad for you and mailed you cash for no reason. Collect $300.",
    amount: 300
  },
  {
    text: "Your car made that weird sound again and now the mechanic is smiling. Pay $500.",
    amount: -500
  },
  {
    text: "You found money in an old jacket pocket like a broke magician. Collect $120.",
    amount: 120
  },
  {
    text: "You paid for everybody at brunch trying to act rich. Lose $250.",
    amount: -250
  },
  {
    text: "A refund you forgot about finally hit. Collect $275.",
    amount: 275
  },
  {
    text: "You signed up for something dumb and forgot to cancel it. Pay $180.",
    amount: -180
  },
  {
    text: "Your aunt slid you some secret family money. Collect $200.",
    amount: 200
  },
  {
    text: "You dropped your phone and now the screen looks like a spider web. Pay $300.",
    amount: -300
  },
  {
    text: "Somebody actually paid you back. Miracles do happen. Collect $220.",
    amount: 220
  },
  {
    text: "You tried fixing something yourself after one YouTube video. Pay $350.",
    amount: -350
  },
  {
    text: "You won a gas station scratch-off and felt powerful for 7 minutes. Collect $150.",
    amount: 150
  },
  {
    text: "You got hit with a random dentist bill and now you're mad at your own teeth. Pay $260.",
    amount: -260
  },
  {
    text: "Your old coworker finally returned the money they owed you. Collect $175.",
    amount: 175
  },
  {
    text: "You bought late-night fast food for everybody and regretted it spiritually and financially. Pay $140.",
    amount: -140
  },
  {
    text: "Your tax refund came in a little stronger than expected. Collect $425.",
    amount: 425
  }
];

const DEAL_CARDS = [
  {
    text: "You flipped a dusty garage find online and somebody actually bought it. Collect $650.",
    amount: 650
  },
  {
    text: "Your cousin promised this was guaranteed money. It was not. Lose $500.",
    amount: -500
  },
  {
    text: "You bought a sketchy grill off Facebook Marketplace. Immediate regret. Lose $300.",
    amount: -300
  },
  {
    text: "You sold random junk and called it vintage. It worked. Collect $450.",
    amount: 450
  },
  {
    text: "You invested in a terrible side hustle with too much confidence. Lose $400.",
    amount: -400
  },
  {
    text: "You found a cheap lawn mower, cleaned it up, and sold it for profit. Collect $550.",
    amount: 550
  },
  {
    text: "The hustle hustled back. Lose $250.",
    amount: -250
  },
  {
    text: "An unbelievably dumb idea somehow worked. Collect $800.",
    amount: 800
  },
  {
    text: "You bought something 'limited edition' that nobody on Earth wanted. Lose $350.",
    amount: -350
  },
  {
    text: "You turned clutter into cash and acted like a business genius. Collect $500.",
    amount: 500
  },
  {
    text: "You bought concert tickets planning to resell them. Nobody bit. Lose $275.",
    amount: -275
  },
  {
    text: "You sold an old game console for way more than expected. Collect $375.",
    amount: 375
  },
  {
    text: "You tried a sneaker flip and got cooked. Lose $450.",
    amount: -450
  },
  {
    text: "You found a collector willing to overpay for something useless. Collect $700.",
    amount: 700
  }
];

function drawMailCards(player, room, count) {
  const cards = [];
  let total = 0;

  for (let i = 0; i < count; i += 1) {
    const card = randomFrom(MAIL_CARDS);

    if (card.amount >= 0) {
      addMoney(player, room, card.amount);
    } else {
      removeMoney(player, room, Math.abs(card.amount));
    }

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

  if (card.amount >= 0) {
    addMoney(player, room, card.amount);
  } else {
    removeMoney(player, room, Math.abs(card.amount));
  }

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

function getRevealDuration(cards) {
  if (!cards || !cards.length) return 2600;
  return cards.length * 2200 + 900;
}

function handleTile(room, player, roll) {
  const tile = getTileAtPosition(player.position);

  if (!tile) {
    return {
      title: "Unknown Tile",
      message: `${player.name} landed on something weird...`,
      tile: null,
      cards: [],
      revealDuration: 2200
    };
  }

  let title = tile.label || tile.type;
  let message = `${player.name} landed on ${tile.label || tile.type}.`;
  let cards = [];

  switch (tile.type) {
    case "mail": {
      const result = drawMailCards(player, room, tile.count || 1);
      cards = result.cards;

      if (result.total >= 0) {
        message = `${player.name} checked the mail and came out up ${formatMoney(result.total)}.`;
      } else {
        message = `${player.name} checked the mail and got cooked for ${formatMoney(Math.abs(result.total))}.`;
      }

      break;
    }

    case "sweepstakes":
      addMoney(player, room, tile.amount);
      message = `${player.name} won ${formatMoney(tile.amount)} in Sweepstakes!`;
      break;

    case "deal": {
      const result = drawDealCard(player, room);
      cards = result.cards;

      if (result.total >= 0) {
        message = `${player.name} pulled a DEAL card and made ${formatMoney(result.total)}.`;
      } else {
        message = `${player.name} pulled a DEAL card and lost ${formatMoney(Math.abs(result.total))}.`;
      }

      break;
    }

    case "lottery": {
      const win = 500;
      addMoney(player, room, win);
      message = `${player.name} won ${formatMoney(win)} in the Lottery!`;
      break;
    }

    case "radio":
      addMoney(player, room, tile.amount);
      message = `${player.name} won the radio contest and collected ${formatMoney(tile.amount)}.`;
      break;

    case "buyer":
      message = `${player.name} found a buyer. Hope you actually have something worth selling.`;
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
      break;
    }

    case "ski":
      removeMoney(player, room, tile.cost);
      message = `${player.name} paid ${formatMoney(tile.cost)} for Super Ski Sunday.`;
      break;

    case "charity":
      removeMoney(player, room, tile.cost);
      message = `${player.name} donated ${formatMoney(tile.cost)} to charity. Very noble. Very broke.`;
      break;

    case "yardsale": {
      const cost = roll * 100;
      removeMoney(player, room, cost);
      message = `${player.name} spent ${formatMoney(cost)} at a yard sale after rolling a ${roll}.`;
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
      break;
    }

    case "payday":
      addMoney(player, room, tile.salary);
      message = `${player.name} hit PAY DAY and collected ${formatMoney(tile.salary)}.`;
      break;

    default:
      message = `${player.name} landed on ${tile.label || tile.type}.`;
      break;
  }

  return {
    title,
    message,
    tile,
    cards,
    revealDuration: getRevealDuration(cards)
  };
}

module.exports = {
  handleTile,
  getTileAtPosition
};