module.exports = [
  { number: 0, type: "start", label: "🚩 START" },

  // ===== EARLY GAME (build chaos slowly) =====
  { number: 1, type: "mail", count: 1, label: "📬 MAIL" },
  { number: 2, type: "mail", count: 2, label: "📬📬 DOUBLE MAIL" },
  { number: 3, type: "deal", label: "💰 DEAL" },
  { number: 4, type: "buyer", label: "🧍 BUYER" },
  { number: 5, type: "mail", count: 1, label: "📬 MAIL" },
  { number: 6, type: "lottery", label: "🎰 LUCKY BS" },
  { number: 7, type: "mail", count: 1, label: "📬 MAIL" },

  // ===== MID GAME START =====
  { number: 8, type: "radio", amount: 1000, label: "📻 RADIO FLEX" },
  { number: 9, type: "buyer", label: "🛒 SOME DUMMY BUYS IT" },
  { number: 10, type: "mail", count: 2, label: "📬📬 DOUBLE MAIL" },
  { number: 11, type: "deal", label: "💰 SKETCHY DEAL" },
  { number: 12, type: "birthday", amountPerPlayer: 100, label: "🎂 BIRTHDAY TAX" },
  { number: 13, type: "mail", count: 1, label: "📬 MAIL" },
  { number: 14, type: "lottery", label: "🎰 LUCKY BS" },
  { number: 15, type: "buyer", label: "🧍 RANDOM BUYER" },

  // ===== CHAOS ZONE =====
  { number: 16, type: "mail", count: 3, label: "📬📬📬 TRIPLE MAIL HELL" },
  { number: 17, type: "deal", label: "🤡 DUMB DEAL" },
  { number: 18, type: "mail", count: 1, label: "📬 MAIL" },
  { number: 19, type: "buyer", label: "📦 FB MARKETPLACE" },
  { number: 20, type: "lottery", label: "🎰 LUCKY BS" },
  { number: 21, type: "ski", cost: 500, label: "🏌️ TOP GOLF" },
  { number: 22, type: "mail", count: 2, label: "📬📬 DOUBLE MAIL" },
  { number: 23, type: "deal", label: "💸 SIDE HUSTLE" },

  // ===== LATE GAME (more brutal) =====
  { number: 24, type: "mail", count: 1, label: "📬 MAIL" },
  { number: 25, type: "charity", cost: 1000, label: "💸 FORCED CHARITY" },
  { number: 26, type: "lottery", label: "🎰 LUCKY BS" },
  { number: 27, type: "deal", label: "💀 BAD INVESTMENT" },
  { number: 28, type: "buyer", label: "🪑 PLEASE BUY THIS" },
  { number: 29, type: "yardsale", label: "🪑 YARD SALE NONSENSE" },
  { number: 30, type: "walk", label: "🚶 WALK OF SUFFERING" },
  { number: 31, type: "payday", salary: 3500, label: "💰💰 BIG PAYDAY" }
];