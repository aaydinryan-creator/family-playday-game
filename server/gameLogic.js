const board = require("./board");

function formatMoney(amount) {
  return `$${amount.toLocaleString()}`;
}

function getTileAtPosition(position) {
  if (position < 0 || position >= board.length) return null;
  return board[position];
}

function handleTile(room, player, roll) {
  const tile = getTileAtPosition(player.position);
  if (!tile) {
    return {
      title: "Unknown Tile",
      message: `${player.name} landed on an unknown tile.`,
      tile
    };
  }

  let title = tile.label || tile.type;
  let message = `${player.name} landed on ${tile.label || tile.type}.`;

  switch (tile.type) {
    case "mail":
      message = `${player.name} landed on MAIL and draws ${tile.count} card${tile.count > 1 ? "s" : ""}.`;
      break;

    case "sweepstakes":
      player.cash += tile.amount;
      room.bank -= tile.amount;
      message = `${player.name} won ${formatMoney(tile.amount)} from the bank in Sweepstakes.`;
      break;

    case "deal":
      message = `${player.name} landed on DEAL and can draw a deal card later.`;
      break;

    case "lottery":
      room.bank += 1000;
      message = `${player.name} triggered the Lottery. The bank adds ${formatMoney(1000)} to the pot.`;
      break;

    case "radio":
      player.cash += tile.amount;
      room.bank -= tile.amount;
      message = `${player.name} won the Radio Contest and gets ${formatMoney(tile.amount)}.`;
      break;

    case "buyer":
      message = `${player.name} found a buyer. If they own a deal later, this can be used to sell it.`;
      break;

    case "birthday": {
      let totalReceived = 0;

      room.players.forEach((otherPlayer) => {
        if (otherPlayer.id !== player.id) {
          otherPlayer.cash -= tile.amountPerPlayer;
          player.cash += tile.amountPerPlayer;
          totalReceived += tile.amountPerPlayer;
        }
      });

      message = `${player.name} landed on Happy Birthday and collects ${formatMoney(totalReceived)} from the other players.`;
      break;
    }

    case "ski":
      player.cash -= tile.cost;
      room.bank += tile.cost;
      message = `${player.name} paid ${formatMoney(tile.cost)} for Super Ski Sunday.`;
      break;

    case "charity":
      player.cash -= tile.cost;
      room.bank += tile.cost;
      message = `${player.name} paid ${formatMoney(tile.cost)} for Charity Concert.`;
      break;

    case "yardsale": {
      const yardSaleCost = roll * 100;
      player.cash -= yardSaleCost;
      room.bank += yardSaleCost;
      message = `${player.name} rolled a ${roll} at Yard Sale and paid ${formatMoney(yardSaleCost)}.`;
      break;
    }

    case "walk": {
      let totalCollected = 0;

      room.players.forEach((otherPlayer) => {
        if (otherPlayer.id !== player.id) {
          const charityRoll = Math.floor(Math.random() * 6) + 1;
          const payAmount = charityRoll * 100;
          otherPlayer.cash -= payAmount;
          room.bank += payAmount;
          totalCollected += payAmount;
        }
      });

      message = `${player.name} triggered Walk for Charity. Other players paid a total of ${formatMoney(totalCollected)} into the pot.`;
      break;
    }

    case "payday":
      player.cash += tile.salary;
      room.bank -= tile.salary;
      message = `${player.name} reached PAY DAY and collects ${formatMoney(tile.salary)} salary.`;
      break;

    default:
      message = `${player.name} landed on ${tile.label || tile.type}.`;
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