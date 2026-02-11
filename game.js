// ============================================================
// game.js — Pure game logic for Rummy2go (no side effects)
// ============================================================

const SUITS = ['C', 'D', 'H', 'S'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_NAMES = { C: 'Clubs', D: 'Diamonds', H: 'Hearts', S: 'Spades' };
const SUIT_SYMBOLS = { C: '\u2663', D: '\u2666', H: '\u2665', S: '\u2660' };

// --- Card helpers ---

function cardRank(cardId) {
  return cardId.slice(0, -1);
}

function cardSuit(cardId) {
  return cardId.slice(-1);
}

function rankIndex(rank) {
  return RANKS.indexOf(rank);
}

function cardPoints(cardId) {
  const rank = cardRank(cardId);
  if (rank === 'A') return 15;
  if (['10', 'J', 'Q', 'K'].includes(rank)) return 10;
  return 5; // 2-9
}

function cardDisplayName(cardId) {
  const rank = cardRank(cardId);
  const suit = cardSuit(cardId);
  return rank + SUIT_SYMBOLS[suit];
}

function cardImagePath(cardId) {
  const suitMap = { C: 'club', D: 'diamond', H: 'heart', S: 'spade' };
  const rank = cardRank(cardId);
  const suit = cardSuit(cardId);
  let rankStr;
  if (rank === 'A') rankStr = '1';
  else if (rank === 'J') rankStr = 'jack';
  else if (rank === 'Q') rankStr = 'queen';
  else if (rank === 'K') rankStr = 'king';
  else rankStr = rank;
  return 'cards/' + suitMap[suit] + '_' + rankStr + '.png';
}

// --- Deck ---

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = d[i];
    d[i] = d[j];
    d[j] = tmp;
  }
  return d;
}

// --- Hand sorting ---

var SORT_MODES = ['suit', 'rank', 'points'];
var SORT_LABELS = { suit: 'Sort: by Suit', rank: 'Sort: by Rank', points: 'Sort: by Points' };

function sortHand(cards, mode) {
  var suitOrder = { C: 0, D: 1, H: 2, S: 3 };
  return cards.slice().sort(function(a, b) {
    if (mode === 'rank') {
      // Primary: rank, secondary: suit
      var ra = rankIndex(cardRank(a));
      var rb = rankIndex(cardRank(b));
      if (ra !== rb) return ra - rb;
      return suitOrder[cardSuit(a)] - suitOrder[cardSuit(b)];
    } else if (mode === 'points') {
      // Primary: point value (5, 10, 15), secondary: rank, tertiary: suit
      var pa = cardPoints(a);
      var pb = cardPoints(b);
      if (pa !== pb) return pa - pb;
      var ra = rankIndex(cardRank(a));
      var rb = rankIndex(cardRank(b));
      if (ra !== rb) return ra - rb;
      return suitOrder[cardSuit(a)] - suitOrder[cardSuit(b)];
    } else {
      // Default 'suit': primary suit, secondary rank
      var sa = suitOrder[cardSuit(a)];
      var sb = suitOrder[cardSuit(b)];
      if (sa !== sb) return sa - sb;
      return rankIndex(cardRank(a)) - rankIndex(cardRank(b));
    }
  });
}

// --- Meld validation ---

function isValidSet(cards) {
  if (cards.length < 3 || cards.length > 4) return false;
  const rank = cardRank(cards[0]);
  const suits = new Set();
  for (var i = 0; i < cards.length; i++) {
    if (cardRank(cards[i]) !== rank) return false;
    suits.add(cardSuit(cards[i]));
  }
  return suits.size === cards.length;
}

function isValidRun(cards) {
  if (cards.length < 3) return false;
  // All same suit?
  var suit = cardSuit(cards[0]);
  for (var i = 1; i < cards.length; i++) {
    if (cardSuit(cards[i]) !== suit) return false;
  }
  // Get rank indices (0-12, A=0 ... K=12)
  var indices = cards.map(function(c) { return rankIndex(cardRank(c)); });
  // Check for duplicates
  var seen = new Set(indices);
  if (seen.size !== indices.length) return false;

  var sorted = indices.slice().sort(function(a, b) { return a - b; });
  var n = sorted.length;

  // Try each element as the conceptual "start" of the run
  for (var s = 0; s < n; s++) {
    var valid = true;
    for (var j = 1; j < n; j++) {
      var prev = sorted[(s + j - 1) % n];
      var curr = sorted[(s + j) % n];
      if ((curr - prev + 13) % 13 !== 1) {
        valid = false;
        break;
      }
    }
    if (valid) return true;
  }
  return false;
}

function isValidMeld(cards) {
  return isValidSet(cards) || isValidRun(cards);
}

// Returns { valid: true } or { valid: false, reason: "..." }
function validateMeld(cards) {
  if (!cards || cards.length < 3) {
    return { valid: false, reason: 'Need at least 3 cards to lay down' };
  }
  if (isValidSet(cards) || isValidRun(cards)) {
    return { valid: true };
  }
  // Explain why it failed
  var ranks = cards.map(function(c) { return cardRank(c); });
  var suits = cards.map(function(c) { return cardSuit(c); });
  var uniqueRanks = new Set(ranks);
  var uniqueSuits = new Set(suits);

  if (uniqueRanks.size === 1) {
    // All same rank but wrong count or duplicate suits
    if (cards.length > 4) {
      return { valid: false, reason: 'A set can have at most 4 cards (one per suit)' };
    }
    return { valid: false, reason: 'Duplicate suits in set — need different suits for ' + ranks[0] };
  }
  if (uniqueSuits.size === 1) {
    // All same suit but not in sequence
    return { valid: false, reason: 'Same suit (' + SUIT_NAMES[suits[0]] + ') but not in sequence' };
  }
  if (uniqueRanks.size > 1 && uniqueSuits.size > 1) {
    return { valid: false, reason: 'Mixed ranks and suits — need all same rank (set) or all same suit in order (run)' };
  }
  return { valid: false, reason: 'Not a valid meld' };
}

// For lay off: returns { valid: true } or { valid: false, reason: "..." }
function validateLayOff(card, meld) {
  var extended = meld.concat([card]);
  if (isValidMeld(extended)) {
    return { valid: true };
  }
  return { valid: false, reason: cardDisplayName(card) + ' doesn\'t extend this meld' };
}

function canLayOff(card, meld) {
  var extended = meld.concat([card]);
  return isValidMeld(extended);
}

// Sort cards for display within a meld (runs sorted by rank order, sets by suit)
function sortMeldForDisplay(cards) {
  if (cards.length <= 1) return cards.slice();
  var sorted = cards.slice();

  // Check if it's a set (all same rank) or run (all same suit)
  var suits = new Set(sorted.map(function(c) { return cardSuit(c); }));
  var ranks = new Set(sorted.map(function(c) { return cardRank(c); }));

  if (ranks.size === 1) {
    // Set — sort by suit
    var suitOrder = { C: 0, D: 1, H: 2, S: 3 };
    sorted.sort(function(a, b) {
      return suitOrder[cardSuit(a)] - suitOrder[cardSuit(b)];
    });
  } else {
    // Run or partial run — sort by rank, handling wrapping
    // Find the best starting position for the circular sort
    var indices = sorted.map(function(c) { return rankIndex(cardRank(c)); });
    
    // Find the largest gap to determine where the run "starts"
    var withCards = indices.map(function(ri, i) { return { ri: ri, card: sorted[i] }; });
    withCards.sort(function(a, b) { return a.ri - b.ri; });
    
    // Find largest gap between consecutive sorted indices (mod 13)
    var bestStart = 0;
    var maxGap = 0;
    for (var i = 0; i < withCards.length; i++) {
      var next = (i + 1) % withCards.length;
      var gap = (withCards[next].ri - withCards[i].ri + 13) % 13;
      if (gap > maxGap) {
        maxGap = gap;
        bestStart = next;
      }
    }
    
    // Reorder starting from after the largest gap
    var result = [];
    for (var i = 0; i < withCards.length; i++) {
      result.push(withCards[(bestStart + i) % withCards.length].card);
    }
    sorted = result;
  }
  return sorted;
}

// --- Scoring ---

function sumPoints(cards) {
  var total = 0;
  for (var i = 0; i < cards.length; i++) {
    total += cardPoints(cards[i]);
  }
  return total;
}

function calculateRoundScore(melds, hand) {
  var meldPoints = 0;
  for (var i = 0; i < melds.length; i++) {
    meldPoints += sumPoints(melds[i]);
  }
  var handPoints = sumPoints(hand);
  return meldPoints - handPoints;
}

// --- Utility ---

function generateGameCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateToken() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < 20; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function otherPlayer(slot) {
  return slot === 'player1' ? 'player2' : 'player1';
}
