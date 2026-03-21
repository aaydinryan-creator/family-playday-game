const board = require("./board");

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clampRoomBank(room, fallback = 50000) {
  if (!room || !Number.isFinite(room.bank)) {
    if (room) room.bank = fallback;
    return;
  }

  if (room.bank < 0) {
    room.bank = 0;
  }
}

function ensureRoomPot(room) {
  if (!room) return;
  if (!Number.isFinite(Number(room.pot))) {
    room.pot = 0;
  }
}

function addToPot(room, amount) {
  if (!room) return;
  ensureRoomPot(room);
  const value = safeNumber(amount);
  if (value <= 0) return;
  room.pot += value;
}

function getTileAtPosition(position) {
  if (position < 0 || position >= board.length) return null;
  return board[position];
}

function ensurePlayerInventory(player) {
  if (!player.inventory || typeof player.inventory !== "object") {
    player.inventory = {
      items: []
    };
  }

  if (!Array.isArray(player.inventory.items)) {
    player.inventory.items = [];
  }

  return player.inventory;
}

function addItem(player, item) {
  const inventory = ensurePlayerInventory(player);
  inventory.items.push(item);
}

function getRandomInventoryItem(player) {
  const inventory = ensurePlayerInventory(player);
  if (!inventory.items.length) return null;
  return inventory.items[Math.floor(Math.random() * inventory.items.length)];
}

function removeInventoryItemById(player, itemId) {
  const inventory = ensurePlayerInventory(player);
  const index = inventory.items.findIndex((item) => item.id === itemId);

  if (index === -1) return null;
  return inventory.items.splice(index, 1)[0];
}

function addMoney(player, room, amount) {
  const value = safeNumber(amount);
  player.cash += value;
  room.bank -= value;
  clampRoomBank(room);
}

function removeMoney(player, room, amount) {
  const value = safeNumber(amount);
  player.cash -= value;
  room.bank += value;
  clampRoomBank(room);
}

function transferMoney(fromPlayer, toPlayer, amount) {
  const value = safeNumber(amount);
  fromPlayer.cash -= value;
  toPlayer.cash += value;
}

function getOtherPlayers(room, player) {
  if (!room || !Array.isArray(room.players)) return [];
  return room.players.filter((p) => p.id !== player.id);
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(percent) {
  return Math.random() * 100 < percent;
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

const SELLABLE_ITEMS = [
  { name: "old air fryer", minValue: 40, maxValue: 120 },
  { name: "PS4 with one sketchy controller", minValue: 90, maxValue: 220 },
  { name: "mystery tote of clothes", minValue: 20, maxValue: 85 },
  { name: "used ring light", minValue: 25, maxValue: 75 },
  { name: "TV stand missing screws", minValue: 15, maxValue: 60 },
  { name: "gaming chair with history", minValue: 45, maxValue: 160 },
  { name: "coffee table from the trenches", minValue: 30, maxValue: 110 },
  { name: "dresser drawer set", minValue: 35, maxValue: 140 },
  { name: "barely used crockpot", minValue: 25, maxValue: 95 },
  { name: "suspiciously loud mini fridge", minValue: 60, maxValue: 180 },
  { name: "garage full of nonsense", minValue: 70, maxValue: 240 },
  { name: "vintage lamp somebody swears is rare", minValue: 30, maxValue: 130 },
  { name: "tool box from an ex", minValue: 25, maxValue: 150 },
  { name: "folding table with trauma", minValue: 15, maxValue: 65 },
  { name: "fake plant collection", minValue: 20, maxValue: 80 },
  { name: "monitor that kinda flickers", minValue: 55, maxValue: 190 }
];

let nextItemId = 1;
function createRandomItem() {
  const base = randomFrom(SELLABLE_ITEMS);
  const value = randomInt(base.minValue, base.maxValue);

  return {
    id: `item_${nextItemId++}`,
    name: base.name,
    value
  };
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
  { text: "Bed Sheet cooking Oil angels aren't as sexy as you had hoped cost of new bed sheet $150.", amount: -150 },
  { text: "Dentist bill came in and they charged you extra for having a disaster mouth. Pay $260.", amount: -260 },
  { text: "Your insurance said 'we don't cover that.' Pay $400.", amount: -400 },
  { text: "A card from your aunt had cash in it. Collect $120.", amount: 120 },
  { text: "Your electric bill arrived looking disrespectful. Pay $230.", amount: -230 },
  { text: "Someone mailed you coupons for things you will never buy.", amount: 0 },
  { text: "Parking ticket finally caught up to you. Pay $75.", amount: -75 },
  { text: "Tax refund hit out of nowhere. Collect $420.", amount: 420 },
  { text: "The letter just says 'FINAL NOTICE' in huge red text. Pay $310.", amount: -310 },
  { text: "You got reimbursed for something you forgot about. Collect $95.", amount: 95 },
  { text: "A wedding invite arrives and now you gotta pretend to care. Spend $140.", amount: -140 },
  { text: "You got a letter from collections and instantly got a headache. Pay $280.", amount: -280 },
  { text: "Someone mailed a gift card with $15 left on it. Collect $15.", amount: 15 },
  { text: "Your pet wrecked something expensive. Pay $170.", amount: -170 },
  { text: "Your car registration reminder hit at the worst time. Pay $190.", amount: -190 },
  { text: "A class action check for a weird lawsuit arrives. Collect $37.", amount: 37 },
  { text: "A letter arrives just to tell you your payment is overdue. Pay $110.", amount: -110 },
  { text: "A rebate finally came back from 8 months ago. Collect $70.", amount: 70 },
  { text: "You forgot a medical copay and now they found you. Pay $95.", amount: -95 },
  { text: "You got a sympathy card and somehow there was money inside. Collect $160.", amount: 160 },
  { text: "Your internet bill went up for absolutely no reason. Pay $85.", amount: -85 },
  { text: "Your old job sent a check for hours they forgot. Collect $210.", amount: 210 },
  { text: "You got a late fee on top of a late fee. Pay $130.", amount: -130 },
  { text: "Your neighbor mailed you a thank you card with $25 for helping them move. Collect $25.", amount: 25 },
  { text: "DMV letter arrives. You already know it's bad. Pay $145.", amount: -145 },
  { text: "Your phone protection plan did absolutely nothing. Pay $155.", amount: -155 },
  { text: "Someone paid you for old furniture through the mail. Collect $140.", amount: 140 },
  { text: "Your storage unit bill arrived and you forgot you even had one. Pay $220.", amount: -220 },
  { text: "A holiday card says 'stay strong' and includes exactly $10. Collect $10.", amount: 10 },
  { text: "You got a bill for lab work you didn't understand. Pay $240.", amount: -240 },
  { text: "The mailman brought pure stress today. Pay $90.", amount: -90 },
  { text: "A random refund from overpaying something lands in your lap. Collect $65.", amount: 65 },
  { text: "Subscription renewal notice says you are now premium broke. Pay $55.", amount: -55 },
  { text: "Your cousin mailed back money they borrowed years ago. Collect $300.", amount: 300 },
  { text: "That letter looked innocent until you opened it. Pay $360.", amount: -360 },
  { text: "You got sent a fake-looking check that somehow cleared. Collect $125.", amount: 125 },
  { text: "The city mailed you a violation notice. Disrespectful. Pay $175.", amount: -175 },
  { text: "You were chosen for nothing. The envelope was empty. Emotional damage only.", amount: 0 },
  { text: "You got a refund from returning something crusty. Collect $80.", amount: 80 },
  { text: "You opened mail while already in a bad mood. Huge mistake. Pay $205.", amount: -205 },
  { text: "A family member sent birthday money late, but still. Collect $90.", amount: 90 },

  { text: "This letter exists just to tell you nobody is impressed. Do better.", amount: 0 },
  { text: "Well well well... look who's still broke. No money. Just vibes.", amount: 0 },
  { text: "You opened this expecting money. That's actually hilarious.", amount: 0 },
  { text: "Hey just checking in to say you're not doing great.", amount: 0 },
  { text: "This envelope had potential. Just like you. Both empty.", amount: 0 },
  { text: "You thought this was going to help you? Nah.", amount: 0 },
  { text: "No money. Just disappointment delivered directly to your hands.", amount: 0 },
  { text: "This is a certified waste-of-your-time letter.", amount: 0 },
  { text: "The mailman laughed when he handed you this.", amount: 0 },
  { text: "You got mail! Unfortunately, it's useless.", amount: 0 },
  { text: "This letter just says 'you fat fuck.' No money included.", amount: 0 },
  { text: "We regret to inform you that you're still you.", amount: 0 },
  { text: "No money. No help. Just disrespect.", amount: 0 },
  { text: "This letter is here to remind you you're behind in life.", amount: 0 },
  { text: "You opened this for nothing. Let that sink in.", amount: 0 },
  { text: "No reward. Just emotional damage.", amount: 0 },
  { text: "This could've been money. It is not.", amount: 0 },
  { text: "A message from life: 'figure it out.'", amount: 0 },
  { text: "Even this letter expected more from you.", amount: 0 },
  { text: "You really stopped your turn for THIS?", amount: 0 },
  { text: "The letter just says 'lol'. That's it.", amount: 0 },
  { text: "You got mail and somehow still lost.", amount: 0 },
  { text: "This envelope contains absolutely nothing of value. Including hope.", amount: 0 },
  { text: "You expected a blessing. You got roasted instead.", amount: 0 },
  { text: "This was personal.", amount: 0 },
  { text: "Somebody spent a stamp just to hate on you. Respect.", amount: 0 },
  { text: "You opened the envelope and somehow it smelled like bad decisions.", amount: 0 },
  { text: "This card just says 'stay humble' and honestly that's fair.", amount: 0 },
  { text: "The letter inside says you peaked too early.", amount: 0 },
  { text: "This envelope had more confidence in itself than you do.", amount: 0 },

  { text: "You tried to impress somebody and ended up embarrassing yourself AND your wallet. Pay $220.", amount: -220 },
  { text: "You checked your account and just stared at it for a while. Pay $140.", amount: -140 },
  { text: "Your life isn't falling apart, it already fell. This is just the bounce. Pay $310.", amount: -310 },
  { text: "You ordered something online and it showed up looking nothing like the picture. Pay $180.", amount: -180 },
  { text: "You tried to act rich for one night and now you're broke for a week. Pay $260.", amount: -260 },
  { text: "Someone looked at your purchase and said '...why?' You had no answer. Pay $90.", amount: -90 },
  { text: "You opened your banking app and immediately closed it. Nothing changed. Pay $200.", amount: -200 },
  { text: "You got charged for something you don't even remember agreeing to. Pay $150.", amount: -150 },
  { text: "You tried to save money and somehow spent more. Incredible. Pay $175.", amount: -175 },
  { text: "You made a terrible decision and now it's a monthly payment. Pay $120.", amount: -120 },
  { text: "Against all odds, your dumb decision actually worked. Collect $400.", amount: 400 },
  { text: "You did something questionable but profitable. Respect. Collect $350.", amount: 350 },
  { text: "You got lucky for no reason. Don't question it. Collect $280.", amount: 280 },
  { text: "Someone overpaid you and you didn't correct them. Collect $300.", amount: 300 },
  { text: "You found money in a place you definitely checked before. Collect $150.", amount: 150 },
  { text: "You opened a letter that roasted you and then asked for money. Disrespectful. Pay $210.", amount: -210 },
  { text: "You got mail and immediately knew it was going to ruin your mood. It did. Pay $160.", amount: -160 },

  { text: "You started drama in the group chat and somehow got paid for it. Everyone pays you $80.", action: "collect_from_all", amountPerPlayer: 80 },
  { text: "You got exposed for acting rich. Pay every other player $60.", action: "pay_all", amountPerPlayer: 60 },
  { text: "You mailed your sob story to the wrong people and one random player had to bail you out. Steal $150 from them.", action: "steal_random_player", amount: 150 },
  { text: "You got guilt-tripped so hard you handed a random player $140.", action: "pay_random_player", amount: 140 },
  { text: "You opened a letter that legally transferred your bad luck to somebody else. Swap cash with a random player.", action: "swap_cash_with_random" },
  { text: "Your family took a vote and decided you are the broke one. Everyone gives you $50 out of pity.", action: "collect_from_all", amountPerPlayer: 50 },
  { text: "You got caught lying about being 'good for it.' Pay every other player $75.", action: "pay_all", amountPerPlayer: 75 },
  { text: "A random player accidentally mailed you money meant for their own bills. Take $120 from them.", action: "steal_random_player", amount: 120 }
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
  { text: "You thought it was a good deal and it wasn't. Lose $375.", amount: -375 },
  { text: "You bought bulk junk from Facebook Marketplace and somehow profited. Collect $420.", amount: 420 },
  { text: "You paid for an online course and learned absolutely nothing. Lose $180.", amount: -180 },
  { text: "You flipped a couch in one day. Collect $260.", amount: 260 },
  { text: "You bought an 'easy fixer upper' item and it ate your wallet. Lose $340.", amount: -340 },
  { text: "You sold old electronics to somebody who didn't ask questions. Collect $310.", amount: 310 },
  { text: "You took a chance on a sketchy side gig and got burnt. Lose $250.", amount: -250 },
  { text: "You bought concert tickets to resell and the hype died instantly. Lose $290.", amount: -290 },
  { text: "You found a ridiculous underpriced listing and flipped it clean. Collect $480.", amount: 480 },
  { text: "You bought a 'rare collectible' that turned out to be fake. Lose $410.", amount: -410 },
  { text: "You sold something out of your garage and made rent feel possible. Collect $530.", amount: 530 },
  { text: "You tried day trading with pure confidence and no knowledge. Lose $620.", amount: -620 },
  { text: "You resold a dresser and made a surprisingly clean bag. Collect $390.", amount: 390 },
  { text: "You trusted a friend-of-a-friend business idea. Terrible. Lose $275.", amount: -275 },
  { text: "You bought liquidation boxes and one actually hit. Collect $610.", amount: 610 },
  { text: "You paid for premium vendor space at a dead event. Lose $215.", amount: -215 },
  { text: "You found a collector for some random junk. Collect $350.", amount: 350 },
  { text: "You bought a broken appliance thinking it'd be easy. It wasn't. Lose $190.", amount: -190 },
  { text: "You cleaned up and resold an item for double. Collect $280.", amount: 280 },
  { text: "You got talked into a partnership that made zero sense. Lose $520.", amount: -520 },
  { text: "You sold a weird niche item to the perfect desperate buyer. Collect $460.", amount: 460 },
  { text: "You bought too much inventory and now your place looks insane. Lose $330.", amount: -330 },
  { text: "You tried flipping sneakers and got stuck with bricks. Lose $240.", amount: -240 },
  { text: "You found a small hustle that somehow paid off. Collect $225.", amount: 225 },
  { text: "You prepaid for supplies and then the deal died. Lose $205.", amount: -205 },
  { text: "You sold an old table and the buyer overpaid. Collect $170.", amount: 170 },
  { text: "You got caught in shipping fees from hell. Lose $145.", amount: -145 },
  { text: "You flipped a tool set way faster than expected. Collect $200.", amount: 200 },
  { text: "You bought mystery inventory. Big mistake. Lose $355.", amount: -355 },
  { text: "You sold a dusty lamp like it was luxury decor. Collect $145.", amount: 145 },
  { text: "You chased a hype trend too late and got folded. Lose $430.", amount: -430 },
  { text: "You found someone willing to pay dumb money for your junk. Collect $570.", amount: 570 },
  { text: "You paid a deposit and got ghosted. Lose $260.", amount: -260 },
  { text: "You flipped patio furniture right before summer. Collect $440.", amount: 440 },
  { text: "You bought something because 'it felt like money.' It wasn't. Lose $315.", amount: -315 },
  { text: "You pulled off a clean local flip. Collect $295.", amount: 295 },
  { text: "You had to refund a buyer and eat the loss. Lose $185.", amount: -185 },
  { text: "You sold leftover junk in one bundle. Collect $155.", amount: 155 },
  { text: "You got baited by a too-good-to-be-true deal. Lose $365.", amount: -365 },
  { text: "You turned a side hustle into actual money for once. Collect $505.", amount: 505 },
  { text: "You bought damaged goods thinking you were slick. Lose $225.", amount: -225 },

  { text: "You trusted your instincts. That was your first mistake. Lose $600.", amount: -600 },
  { text: "You thought you were being smart. You were not. Lose $450.", amount: -450 },
  { text: "You got absolutely finessed and had to pretend you were okay with it. Lose $700.", amount: -700 },
  { text: "You made a move so bad it should be studied. Lose $520.", amount: -520 },
  { text: "You tried to flip something and ended up flipping your financial stability instead. Lose $480.", amount: -480 },
  { text: "You invested in vibes instead of logic. Lose $650.", amount: -650 },
  { text: "You saw 'limited time offer' and lost all critical thinking. Lose $390.", amount: -390 },
  { text: "You made money doing something you probably shouldn't have. Collect $800.", amount: 800 },
  { text: "You pulled off a deal so clean it felt illegal. Collect $950.", amount: 950 },
  { text: "You got away with something and profited. Wild. Collect $700.", amount: 700 },
  { text: "Your dumb idea printed money. Nobody understands why. Collect $880.", amount: 880 },
  { text: "You finessed the system and it actually worked. Collect $920.", amount: 920 },
  { text: "You hesitated for 2 seconds and missed a huge opportunity. Sit with that. Lose $300.", amount: -300 },
  { text: "You jumped into something with confidence and no plan. It shows. Lose $410.", amount: -410 },
  { text: "You got involved in something you had no business being in. Lose $560.", amount: -560 },
  { text: "You thought 'how bad could it be?' Now you know. Lose $470.", amount: -470 },
  { text: "Your side hustle lasted 14 minutes before becoming a financial hate crime. Lose $740.", amount: -740 },
  { text: "You bought a 'great deal' off Facebook and received a box of broken lies. Lose $430.", amount: -430 },
  { text: "You got caught acting rich with broke pockets. Pay $300 immediately.", amount: -300 },
  { text: "A scammer saw you coming from a mile away and rang the register. Lose $650.", amount: -650 },
  { text: "You sold complete nonsense with full confidence and it worked. Collect $610.", amount: 610 },
  { text: "You made rent money from pure stupidity. Respectfully, collect $540.", amount: 540 },
  { text: "You got lucky and now you're going to act like it was skill. Collect $450.", amount: 450 },
  { text: "You launched a terrible idea and somehow idiots supported it. Collect $730.", amount: 730 },
  { text: "You bought into a fake hustle and got folded like laundry. Lose $580.", amount: -580 },
  { text: "You tried to move like a boss and ended up paying idiot tax. Lose $360.", amount: -360 },
  { text: "You blew money chasing hype and got left holding garbage. Lose $490.", amount: -490 },
  { text: "You found one desperate buyer with terrible judgment. Collect $390.", amount: 390 },

  { text: "You scammed the vibe right out of the room. A random player pays you $180.", action: "steal_random_player", amount: 180 },
  { text: "You talked big, failed publicly, and now you owe a random player $160.", action: "pay_random_player", amount: 160 },
  { text: "You started a fake empire and somehow everybody funded it. Every player pays you $100.", action: "collect_from_all", amountPerPlayer: 100 },
  { text: "Your genius plan collapsed on impact. Pay every other player $90 for wasting their oxygen.", action: "pay_all", amountPerPlayer: 90 },
  { text: "You bullied your way into a deal and stole lunch money from a random player. Take $140.", action: "steal_random_player", amount: 140 },
  { text: "You folded under pressure and handed a random player $200. Sad.", action: "pay_random_player", amount: 200 },
  { text: "You somehow convinced the room you were onto something. Everyone gives you $70.", action: "collect_from_all", amountPerPlayer: 70 },
  { text: "You ran your mouth, got humbled, and now must pay everyone $85.", action: "pay_all", amountPerPlayer: 85 },
  { text: "Your chaos reached legendary levels. Swap cash with a random player.", action: "swap_cash_with_random" },
  { text: "You robbed the wrong clown but still came out ahead. Steal $220 from a random player.", action: "steal_random_player", amount: 220 }
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

function shouldTriggerForcedDoubleMail(forcedKey) {
  if (!forcedKey) return false;

  if (forcedKey === "alayna") return chance(40);
  if (forcedKey === "lori") return chance(38);

  return false;
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

function shuffleDeck(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function ensureRoomDecks(room) {
  if (!room.cardDecks || typeof room.cardDecks !== "object") {
    room.cardDecks = {};
  }

  if (!Array.isArray(room.cardDecks.mailDraw) || !room.cardDecks.mailDraw.length) {
    room.cardDecks.mailDraw = shuffleDeck(MAIL_CARDS);
    room.cardDecks.mailDiscard = [];
  }

  if (!Array.isArray(room.cardDecks.mailDiscard)) {
    room.cardDecks.mailDiscard = [];
  }

  if (!Array.isArray(room.cardDecks.dealDraw) || !room.cardDecks.dealDraw.length) {
    room.cardDecks.dealDraw = shuffleDeck(DEAL_CARDS);
    room.cardDecks.dealDiscard = [];
  }

  if (!Array.isArray(room.cardDecks.dealDiscard)) {
    room.cardDecks.dealDiscard = [];
  }
}

function recycleDeckIfNeeded(drawPile, discardPile) {
  if (drawPile.length) return { drawPile, discardPile };

  const recycled = shuffleDeck(discardPile);
  return {
    drawPile: recycled,
    discardPile: []
  };
}

function drawFromRoomDeck(room, deckType) {
  ensureRoomDecks(room);

  if (deckType === "mail") {
    let drawPile = room.cardDecks.mailDraw;
    let discardPile = room.cardDecks.mailDiscard;

    ({ drawPile, discardPile } = recycleDeckIfNeeded(drawPile, discardPile));

    room.cardDecks.mailDraw = drawPile;
    room.cardDecks.mailDiscard = discardPile;

    const card = room.cardDecks.mailDraw.shift();
    room.cardDecks.mailDiscard.push(card);

    return card;
  }

  let drawPile = room.cardDecks.dealDraw;
  let discardPile = room.cardDecks.dealDiscard;

  ({ drawPile, discardPile } = recycleDeckIfNeeded(drawPile, discardPile));

  room.cardDecks.dealDraw = drawPile;
  room.cardDecks.dealDiscard = discardPile;

  const card = room.cardDecks.dealDraw.shift();
  room.cardDecks.dealDiscard.push(card);

  return card;
}

function resolveCardEffect(card, player, room) {
  const action = card.action || null;
  const others = getOtherPlayers(room, player);

  if (!action) {
    return {
      text: card.text,
      amount: Number(card.amount || 0)
    };
  }

  switch (action) {
    case "collect_from_all": {
      const perPlayer = Number(card.amountPerPlayer || 0);

      if (!others.length) {
        return {
          text: `${card.text} But there was nobody else to rob.`,
          amount: 0
        };
      }

      let total = 0;
      others.forEach((other) => {
        transferMoney(other, player, perPlayer);
        total += perPlayer;
      });

      return {
        text: `${card.text} Total collected: ${formatMoney(total)}.`,
        amount: total
      };
    }

    case "pay_all": {
      const perPlayer = Number(card.amountPerPlayer || 0);

      if (!others.length) {
        return {
          text: `${card.text} Lucky for you, nobody else was there.`,
          amount: 0
        };
      }

      let total = 0;
      others.forEach((other) => {
        transferMoney(player, other, perPlayer);
        total += perPlayer;
      });

      return {
        text: `${card.text} Total lost: ${formatMoney(total)}.`,
        amount: -total
      };
    }

    case "steal_random_player": {
      if (!others.length) {
        return {
          text: `${card.text} But there was nobody else around to victimise.`,
          amount: 0
        };
      }

      const target = randomFrom(others);
      const stealAmount = Number(card.amount || 0);
      transferMoney(target, player, stealAmount);

      return {
        text: `${card.text} You ripped ${formatMoney(stealAmount)} from ${target.name}.`,
        amount: stealAmount
      };
    }

    case "pay_random_player": {
      if (!others.length) {
        return {
          text: `${card.text} But there was nobody else there to benefit from your stupidity.`,
          amount: 0
        };
      }

      const target = randomFrom(others);
      const payAmount = Number(card.amount || 0);
      transferMoney(player, target, payAmount);

      return {
        text: `${card.text} ${target.name} received ${formatMoney(payAmount)} from your disaster.`,
        amount: -payAmount
      };
    }

    case "swap_cash_with_random": {
      if (!others.length) {
        return {
          text: `${card.text} But there was nobody else there, so you just stayed broke in peace.`,
          amount: 0
        };
      }

      const target = randomFrom(others);
      const playerBefore = player.cash;
      const targetBefore = target.cash;

      player.cash = targetBefore;
      target.cash = playerBefore;

      const net = targetBefore - playerBefore;

      let resultText = `${card.text} You swapped cash with ${target.name}.`;

      if (net > 0) {
        resultText += ` Massive theft. Net gain ${formatMoney(net)}.`;
      } else if (net < 0) {
        resultText += ` Horrific mistake. Net loss ${formatMoney(Math.abs(net))}.`;
      } else {
        resultText += ` Somehow it changed nothing.`;
      }

      return {
        text: resultText,
        amount: net
      };
    }

    default:
      return {
        text: card.text,
        amount: Number(card.amount || 0)
      };
  }
}

function getCardSound(type, total, explicitSound = null) {
  if (explicitSound) return explicitSound;

  if (type === "mail") {
    if (total > 0) return "mail_good";
    if (total < 0) return "mail_bad";
    return "mail_weird";
  }

  if (type === "deal") {
    if (total >= 0) return "deal_good";
    return "deal_bad";
  }

  return "tile_land";
}

function playCard(player, room, card, type, title, explicitSound = null) {
  const hasAction = !!card.action;

  let resolved;
  if (hasAction) {
    resolved = resolveCardEffect(card, player, room);
  } else {
    applyCardAmount(player, room, card.amount);
    resolved = {
      text: card.text,
      amount: Number(card.amount || 0)
    };
  }

  const sound = getCardSound(type, resolved.amount, explicitSound);

  return {
    title,
    text: personalizeText(resolved.text, player.name),
    amount: resolved.amount,
    type,
    sound
  };
}

function drawSpecificCards(player, room, cardList, type, title, soundCue = null) {
  const cards = [];
  let total = 0;

  for (const card of cardList) {
    const playedCard = playCard(player, room, card, type, title, soundCue);
    total += playedCard.amount;
    cards.push(playedCard);
  }

  return { cards, total, soundCue };
}

function drawMailCards(player, room, count) {
  ensureRoomDecks(room);

  const cards = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const card = drawFromRoomDeck(room, "mail");
    const playedCard = playCard(player, room, card, "mail", "MAIL");

    total += playedCard.amount;
    cards.push(playedCard);
  }

  let soundCue = "mail_weird";
  if (total > 0) soundCue = "mail_good";
  if (total < 0) soundCue = "mail_bad";

  return { cards, total, soundCue };
}

function drawDealCard(player, room) {
  ensureRoomDecks(room);

  const card = drawFromRoomDeck(room, "deal");
  const playedCard = playCard(player, room, card, "deal", "DEAL");
  const soundCue = playedCard.amount >= 0 ? "deal_good" : "deal_bad";

  return {
    cards: [playedCard],
    total: playedCard.amount,
    soundCue
  };
}

function maybeFindItemOnDealTile(player) {
  if (!chance(36)) {
    return null;
  }

  const item = createRandomItem();
  addItem(player, item);
  return item;
}

function handleBuyerTile(room, player) {
  const item = getRandomInventoryItem(player);

  if (!item) {
    if (chance(32)) {
      const foundItem = createRandomItem();
      addItem(player, foundItem);

      return {
        title: "FOUND SOME JUNK",
        message: `${player.name} had nothing to sell, but found a ${foundItem.name} worth about ${formatMoney(foundItem.value)} in the house. Classic.`,
        cards: [],
        soundCue: "buyer_tile"
      };
    }

    return {
      title: "NO BUYERS TODAY",
      message: `${player.name} found a buyer but had absolutely nothing worth selling. Embarrassing.`,
      cards: [],
      soundCue: "buyer_tile"
    };
  }

  const soldItem = removeInventoryItemById(player, item.id);
  addMoney(player, room, soldItem.value);

  return {
    title: "SOLD YOUR STUFF",
    message: `${player.name} sold ${soldItem.name} for ${formatMoney(soldItem.value)}.`,
    cards: [],
    soundCue: "cash_win"
  };
}

function getRevealDuration(cards) {
  if (!cards || !cards.length) return 4200;
  return cards.length * 9000 + 1000;
}

function handleTile(room, player, roll) {
  const tile = getTileAtPosition(player.position);
  ensurePlayerInventory(player);
  ensureRoomDecks(room);
  ensureRoomPot(room);

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
      const doForcedSequence = shouldTriggerForcedDoubleMail(forcedKey);

      if (doForcedSequence) {
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

      if (doForcedSequence && forcedKey === "alayna") {
        message = `${player.name} got approved for a credit card and immediately ruined their life.`;
      } else if (doForcedSequence && forcedKey === "lori") {
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

      const foundItem = maybeFindItemOnDealTile(player);

      if (result.total >= 0) {
        message = `${player.name} made ${formatMoney(result.total)} from a deal.`;
      } else {
        message = `${player.name} lost ${formatMoney(Math.abs(result.total))} on a deal.`;
      }

      if (foundItem) {
        message += ` They also picked up ${foundItem.name} that might sell later for around ${formatMoney(foundItem.value)}.`;
      }

      break;
    }

    case "sweepstakes":
      addMoney(player, room, tile.amount);
      message = `${player.name} won ${formatMoney(tile.amount)} in Sweepstakes!`;
      soundCue = "cash_win";
      break;

    case "lottery": {
      const win = chance(18) ? 900 : 500;
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

    case "buyer": {
      const result = handleBuyerTile(room, player);
      title = result.title;
      message = result.message;
      cards = result.cards;
      soundCue = result.soundCue;
      break;
    }

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

    case "ski": {
      removeMoney(player, room, tile.cost);
      addToPot(room, tile.cost);
      message = `${player.name} paid ${formatMoney(tile.cost)} for Top Golf. That money went into the pot.`;
      soundCue = "money_loss";
      break;
    }

    case "charity": {
      removeMoney(player, room, tile.cost);
      addToPot(room, tile.cost);
      message = `${player.name} donated ${formatMoney(tile.cost)} to charity. Very noble. Very broke. That money went into the pot.`;
      soundCue = "money_loss";
      break;
    }

    case "yardsale": {
      const cost = roll * 100;
      removeMoney(player, room, cost);

      if (chance(52)) {
        const item = createRandomItem();
        addItem(player, item);
        message = `${player.name} spent ${formatMoney(cost)} at a yard sale after rolling a ${roll}, but at least came home with ${item.name} worth about ${formatMoney(item.value)}.`;
      } else {
        message = `${player.name} spent ${formatMoney(cost)} at a yard sale after rolling a ${roll}.`;
      }

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
          addToPot(room, amount);
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