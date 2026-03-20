const board = require("./board");

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

function getTileAtPosition(position) {
  if (position < 0 || position >= board.length) return null;
  return board[position];
}

// Safe money transfer (prevents weird negatives/crashes)
function addMoney(player, room, amount) {
  player.cash += amount;
  room.bank -= amount;
}

function removeMoney(player, room, amount) {
  player.cash -= amount;
  room.bank += amount;
}

function handleTile(room, player, roll) {
  const tile = getTileAtPosition(player.position);

  if (!tile) {
    return {
      title: "Unknown Tile",
      message: `${player.name} landed on something weird...`,
      tile
    };
  }

  let title = tile.label || tile.type;
  let message = `${player.name} landed on ${tile.label}.`;

  switch (tile.type) {

    // =========================
    // MAIL
    // =========================
    case "mail":
      message = `${player.name} checks the MAIL (${tile.count} card${tile.count > 1 ? "s" : ""}).`;
      break;

    // =========================
    // SWEEPSTAKES
    // =========================
    case "sweepstakes":
      addMoney(player, room, tile.amount);
      message = `${player.name} won ${formatMoney(tile.amount)} in Sweepstakes!`;
      break;

    // =========================
    // DEAL
    // =========================
    case "deal":
      message = `${player.name} can draw a DEAL card. Big risk 👀`;
      break;

    // =========================
    // LOTTERY
    // =========================
    case "lottery": {
      const win = 500;
      addMoney(player, room, win);
      message = `${player.name} won ${formatMoney(win)} in the Lottery!`;
      break;
    }

    // =========================
    // RADIO
    // =========================
    case "radio":
      addMoney(player, room, tile.amount);
      message = `${player.name} won the radio contest (${formatMoney(tile.amount)})`;
      break;

    // =========================
    // BUYER
    // =========================
    case "buyer":
      message = `${player.name} found a buyer. Hope you got something to sell...`;
      break;

    // =========================
    // BIRTHDAY
    // =========================
    case "birthday": {
      let total = 0;

      room.players.forEach((p) => {
        if (p.id !== player.id) {
          p.cash -= tile.amountPerPlayer;
          player.cash += tile.amountPerPlayer;
          total += tile.amountPerPlayer;
        }
      });

      message = `${player.name} had a birthday and collected ${formatMoney(total)} 🎉`;
      break;
    }

    // =========================
    // SKI
    // =========================
    case "ski":
      removeMoney(player, room, tile.cost);
      message = `${player.name} paid ${formatMoney(tile.cost)} for skiing ❄️`;
      break;

    // =========================
    // CHARITY
    // =========================
    case "charity":
      removeMoney(player, room, tile.cost);
      message = `${player.name} donated ${formatMoney(tile.cost)} ❤️`;
      break;

    // =========================
    // YARD SALE
    // =========================
    case "yardsale": {
      const cost = roll * 100;
      removeMoney(player, room, cost);
      message = `${player.name} paid ${formatMoney(cost)} at a yard sale (rolled ${roll})`;
      break;
    }

    // =========================
    // WALK FOR CHARITY
    // =========================
    case "walk": {
      let total = 0;

      room.players.forEach((p) => {
        if (p.id !== player.id) {
          const r = Math.floor(Math.random() * 6) + 1;
          const amount = r * 100;

          p.cash -= amount;
          room.bank += amount;
          total += amount;
        }
      });

      message = `${player.name} triggered charity walk. Others paid ${formatMoney(total)} 💀`;
      break;
    }

    // =========================
    // PAYDAY
    // =========================
    case "payday":
      addMoney(player, room, tile.salary);
      message = `${player.name} hit PAYDAY and earned ${formatMoney(tile.salary)} 💰`;
      break;

    default:
      message = `${player.name} landed on ${tile.label}.`;
      break;
  }

  return {
    title,
    message,
    tile
  };
}

module.exports = {
  handleTile,
  getTileAtPosition
};