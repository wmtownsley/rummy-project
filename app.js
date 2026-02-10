// ============================================================
// app.js — Rummy2go main application
// Firebase sync, UI rendering, game flow
// ============================================================

// === Firebase Setup ===
firebase.initializeApp({
  apiKey: "AIzaSyChJDXt0LDQUJsVDeCicKp6HUDXm37feto",
  authDomain: "rummy2go.firebaseapp.com",
  databaseURL: "https://rummy2go-default-rtdb.firebaseio.com",
  projectId: "rummy2go",
  storageBucket: "rummy2go.firebasestorage.app",
  messagingSenderId: "851431541175",
  appId: "1:851431541175:web:c7a1645e15917a17e78032"
});

var db = firebase.database();

// === App State ===
var app = {
  gameId: null,
  playerSlot: null,    // 'player1' or 'player2'
  playerToken: null,
  game: null,           // full game state from Firebase
  selectedCards: [],     // card IDs selected in player hand
  discardPickupIdx: -1,  // index in discard pile user tapped (-1 = none)
  mustPlayCard: null,    // card ID that must be played this turn (from multi-pickup)
  sortMode: 'suit',     // current sort mode: 'suit', 'rank', or 'points'
  listener: null         // Firebase listener reference
};

// === DOM References ===
var dom = {};
function cacheDom() {
  dom.lobbyScreen = document.getElementById('lobby-screen');
  dom.gameScreen = document.getElementById('game-screen');
  dom.createName = document.getElementById('create-name');
  dom.createBtn = document.getElementById('create-btn');
  dom.joinCode = document.getElementById('join-code');
  dom.joinName = document.getElementById('join-name');
  dom.joinBtn = document.getElementById('join-btn');
  dom.joinSection = document.getElementById('join-section');
  dom.createSection = document.getElementById('create-section');
  dom.waitingSection = document.getElementById('waiting-section');
  dom.resumeSection = document.getElementById('resume-section');
  dom.resumeList = document.getElementById('resume-list');
  dom.showGameCode = document.getElementById('show-game-code');
  dom.showJoinLink = document.getElementById('show-join-link');
  dom.copyLinkBtn = document.getElementById('copy-link-btn');
  dom.opponentDot = document.getElementById('opponent-dot');
  dom.opponentNameDisplay = document.getElementById('opponent-name-display');
  dom.scoresDisplay = document.getElementById('scores-display');
  dom.opponentHand = document.getElementById('opponent-hand');
  dom.opponentMelds = document.getElementById('opponent-melds');
  dom.opponentMeldLabel = document.getElementById('opponent-meld-label');
  dom.drawStack = document.getElementById('draw-stack');
  dom.deckCount = document.getElementById('deck-count');
  dom.discardCascade = document.getElementById('discard-cascade');
  dom.discardPile = document.getElementById('discard-pile');
  dom.playerMelds = document.getElementById('player-melds');
  dom.playerMeldLabel = document.getElementById('player-meld-label');
  dom.actionBar = document.getElementById('action-bar');
  dom.playerHand = document.getElementById('player-hand');
  dom.turnText = document.getElementById('turn-text');
  dom.lastAction = document.getElementById('last-action');
  dom.pickupConfirm = document.getElementById('pickup-confirm');
  dom.scoreboardOverlay = document.getElementById('scoreboard-overlay');
  dom.scoreboardContent = document.getElementById('scoreboard-content');
  dom.scoreboardActions = document.getElementById('scoreboard-actions');
  dom.toast = document.getElementById('toast');
}

// === Session & Local Storage ===
// sessionStorage is PER-TAB — prevents identity crossover between tabs
function setSessionIdentity(gameId, playerSlot, token) {
  sessionStorage.setItem('rummy_gameId', gameId);
  sessionStorage.setItem('rummy_playerSlot', playerSlot);
  sessionStorage.setItem('rummy_token', token);
  console.log('[Rummy] Session identity SET: ' + playerSlot + ' for game ' + gameId);
}

function getSessionIdentity() {
  var gameId = sessionStorage.getItem('rummy_gameId');
  var playerSlot = sessionStorage.getItem('rummy_playerSlot');
  var token = sessionStorage.getItem('rummy_token');
  if (gameId && playerSlot && token) {
    return { gameId: gameId, playerSlot: playerSlot, token: token };
  }
  return null;
}

function saveGameLocally(gameId, playerSlot, token) {
  // Save to both sessionStorage (per-tab) and localStorage (for resume across sessions)
  setSessionIdentity(gameId, playerSlot, token);
  var games = JSON.parse(localStorage.getItem('rummy2go_games') || '{}');
  // Key by gameId AND playerSlot to prevent overwrites
  var key = gameId + ':' + playerSlot;
  games[key] = { gameId: gameId, playerSlot: playerSlot, token: token, lastPlayed: Date.now() };
  localStorage.setItem('rummy2go_games', JSON.stringify(games));
}

function getSavedGames() {
  return JSON.parse(localStorage.getItem('rummy2go_games') || '{}');
}

function getSavedGame(gameId) {
  // First check sessionStorage (per-tab, most reliable)
  var session = getSessionIdentity();
  if (session && session.gameId === gameId) {
    return session;
  }
  // Fall back to localStorage
  var games = getSavedGames();
  // Try both player slots
  return games[gameId + ':player1'] || games[gameId + ':player2'] || games[gameId] || null;
}

// === Delete Games ===
async function deleteGame(gameId, localKey) {
  // Remove from Firebase
  try {
    await db.ref('games/' + gameId).remove();
    console.log('[Rummy] Deleted game ' + gameId + ' from Firebase');
  } catch (e) {
    console.warn('[Rummy] Could not delete from Firebase:', e.message);
  }

  // Remove from localStorage
  var games = JSON.parse(localStorage.getItem('rummy2go_games') || '{}');
  delete games[localKey];
  // Also try other key formats
  delete games[gameId];
  delete games[gameId + ':player1'];
  delete games[gameId + ':player2'];
  localStorage.setItem('rummy2go_games', JSON.stringify(games));

  // Clear sessionStorage if it matches
  if (sessionStorage.getItem('rummy_gameId') === gameId) {
    sessionStorage.removeItem('rummy_gameId');
    sessionStorage.removeItem('rummy_playerSlot');
    sessionStorage.removeItem('rummy_token');
  }

  // Detach listener if this is the current game
  if (app.gameId === gameId) {
    if (app.listener) app.listener.off();
    app.gameId = null;
    app.playerSlot = null;
    app.playerToken = null;
    app.game = null;
    app.selectedCards = [];
    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);
  }

  showToast('Game ' + gameId + ' deleted');
  showLobby();
}

async function deleteAllGames(entries) {
  for (var i = 0; i < entries.length; i++) {
    try {
      await db.ref('games/' + entries[i].gameId).remove();
    } catch (e) { /* best effort */ }
  }

  // Clear all localStorage game data
  localStorage.removeItem('rummy2go_games');

  // Clear sessionStorage
  sessionStorage.removeItem('rummy_gameId');
  sessionStorage.removeItem('rummy_playerSlot');
  sessionStorage.removeItem('rummy_token');

  // Reset app state
  if (app.listener) app.listener.off();
  app.gameId = null;
  app.playerSlot = null;
  app.playerToken = null;
  app.game = null;
  app.selectedCards = [];
  window.history.replaceState({}, '', window.location.pathname);

  showToast('All games deleted');
  showLobby();
}

// === Toast ===
var toastTimer = null;
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    dom.toast.classList.remove('show');
  }, 2500);
}

// === URL Handling ===
function getUrlParams() {
  var params = {};
  var search = window.location.search.substring(1);
  if (search) {
    search.split('&').forEach(function(part) {
      var kv = part.split('=');
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
  }
  return params;
}

function setUrlParam(key, value) {
  var url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState({}, '', url.toString());
}

function getShareLink(gameId) {
  var url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('g', gameId);
  return url.toString();
}

// === Screen Management ===
function showLobby() {
  dom.lobbyScreen.style.display = '';
  dom.gameScreen.classList.remove('active');
  dom.createSection.style.display = '';
  dom.joinSection.style.display = '';
  dom.waitingSection.style.display = 'none';
  showResumeSection();
}

function showWaiting(gameId) {
  dom.createSection.style.display = 'none';
  dom.joinSection.style.display = 'none';
  dom.resumeSection.style.display = 'none';
  dom.waitingSection.style.display = '';
  dom.showGameCode.textContent = gameId;
  dom.showJoinLink.textContent = getShareLink(gameId);
}

function showGame() {
  dom.lobbyScreen.style.display = 'none';
  dom.gameScreen.classList.add('active');
}

function showResumeSection() {
  var games = getSavedGames();
  var entries = Object.keys(games).map(function(key) {
    var g = games[key];
    g._key = key;
    return g;
  }).filter(function(g) {
    return g.gameId && g.playerSlot && g.token;
  }).sort(function(a, b) {
    return (b.lastPlayed || 0) - (a.lastPlayed || 0);
  });
  if (entries.length === 0) {
    dom.resumeSection.style.display = 'none';
    return;
  }
  dom.resumeSection.style.display = '';
  dom.resumeList.innerHTML = '';
  entries.slice(0, 5).forEach(function(entry) {
    var item = document.createElement('div');
    item.className = 'resume-item';

    var label = document.createElement('span');
    label.textContent = 'Game ' + entry.gameId + ' (' + entry.playerSlot.replace('player', 'Player ') + ')';
    item.appendChild(label);

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-delete';
    delBtn.textContent = '\u00D7'; // × symbol
    delBtn.title = 'Delete this game';
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteGame(entry.gameId, entry._key);
    });
    item.appendChild(delBtn);

    item.addEventListener('click', function() {
      resumeGameWithToken(entry.gameId, entry.token);
    });
    dom.resumeList.appendChild(item);
  });

  // "Delete all" link
  if (entries.length > 1) {
    var deleteAllBtn = document.createElement('button');
    deleteAllBtn.className = 'btn btn-secondary btn-small';
    deleteAllBtn.style.marginTop = '10px';
    deleteAllBtn.textContent = 'Delete All Saved Games';
    deleteAllBtn.addEventListener('click', function() {
      deleteAllGames(entries);
    });
    dom.resumeList.appendChild(deleteAllBtn);
  }
}

// === Firebase: Create Game ===
async function createGame() {
  var name = dom.createName.value.trim();
  if (!name) { showToast('Enter your name'); return; }

  dom.createBtn.disabled = true;
  var gameId = generateGameCode();
  var token = generateToken();

  try {
    await db.ref('games/' + gameId).set({
      status: 'waiting',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      players: {
        player1: {
          name: name,
          token: token,
          hand: [],
          melds: [],
          score: 0
        }
      }
    });

    app.gameId = gameId;
    app.playerSlot = 'player1';
    app.playerToken = token;
    console.log('[Rummy] Created game. I am player1 (' + name + '), gameId=' + gameId);
    saveGameLocally(gameId, 'player1', token);
    setUrlParam('g', gameId);
    setUrlParam('t', token);

    showWaiting(gameId);
    listenToGame(gameId);
  } catch (e) {
    showToast('Error creating game: ' + e.message);
    dom.createBtn.disabled = false;
  }
}

// === Firebase: Join Game ===
async function joinGame(gameId, name) {
  if (!name) { showToast('Enter your name'); return; }
  gameId = gameId.toUpperCase().trim();
  if (!gameId) { showToast('Enter a game code'); return; }

  dom.joinBtn.disabled = true;

  try {
    var snap = await db.ref('games/' + gameId).once('value');
    var gameData = snap.val();
    if (!gameData) { showToast('Game not found'); dom.joinBtn.disabled = false; return; }
    if (gameData.status !== 'waiting') {
      // Game already started — try to reconnect by matching name
      var reconnectSlot = null;
      if (gameData.players) {
        if (gameData.players.player1 && gameData.players.player1.name.toLowerCase() === name.toLowerCase()) {
          reconnectSlot = 'player1';
        } else if (gameData.players.player2 && gameData.players.player2.name.toLowerCase() === name.toLowerCase()) {
          reconnectSlot = 'player2';
        }
      }
      if (reconnectSlot) {
        // Reconnect this player
        var reconnectToken = gameData.players[reconnectSlot].token;
        app.gameId = gameId;
        app.playerSlot = reconnectSlot;
        app.playerToken = reconnectToken;
        saveGameLocally(gameId, reconnectSlot, reconnectToken);
        setUrlParam('g', gameId);
        setUrlParam('t', reconnectToken);
        showGame();
        listenToGame(gameId);
        showToast('Reconnected as ' + name + '!');
        return;
      }
      showToast('Game already started');
      dom.joinBtn.disabled = false;
      return;
    }

    var token = generateToken();

    // Deal cards
    var deck = shuffleDeck(createDeck());
    var hand1 = deck.splice(0, 7);
    var hand2 = deck.splice(0, 7);
    var firstDiscard = [deck.splice(0, 1)[0]];

    var updates = {};
    updates['status'] = 'playing';
    updates['deck'] = deck;
    updates['discard'] = firstDiscard;
    updates['currentTurn'] = 'player1';
    updates['dealer'] = 'player2';
    updates['phase'] = 'draw';
    updates['roundNumber'] = 1;
    updates['lastAction'] = name + ' joined! Cards dealt. ' + gameData.players.player1.name + ' goes first.';
    updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;
    updates['players/player1/hand'] = hand1;
    updates['players/player2'] = {
      name: name,
      token: token,
      hand: hand2,
      melds: [],
      score: 0
    };
    updates['scoreHistory'] = [];

    await db.ref('games/' + gameId).update(updates);

    app.gameId = gameId;
    app.playerSlot = 'player2';
    app.playerToken = token;
    saveGameLocally(gameId, 'player2', token);
    setUrlParam('g', gameId);
    setUrlParam('t', token);

    showGame();
    listenToGame(gameId);
  } catch (e) {
    showToast('Error joining: ' + e.message);
    dom.joinBtn.disabled = false;
  }
}

// === Firebase: Resume Game (from localStorage) ===
async function resumeGame(gameId) {
  var saved = getSavedGame(gameId);
  if (!saved) { showToast('No saved game data'); return; }
  return resumeGameWithToken(gameId, saved.token);
}

// === Firebase: Resume Game (with token) ===
async function resumeGameWithToken(gameId, token) {
  try {
    var snap = await db.ref('games/' + gameId).once('value');
    var gameData = snap.val();
    if (!gameData) { showToast('Game no longer exists'); showLobby(); return; }

    // Find which player has this token
    var playerSlot = null;
    if (gameData.players) {
      if (gameData.players.player1 && gameData.players.player1.token === token) {
        playerSlot = 'player1';
      } else if (gameData.players.player2 && gameData.players.player2.token === token) {
        playerSlot = 'player2';
      }
    }
    if (!playerSlot) {
      showToast('Cannot resume — invalid token');
      showLobby();
      return;
    }

    app.gameId = gameId;
    app.playerSlot = playerSlot;
    app.playerToken = token;
    console.log('[Rummy] Resumed game. I am ' + playerSlot + ', gameId=' + gameId);
    saveGameLocally(gameId, playerSlot, token);
    setUrlParam('g', gameId);
    setUrlParam('t', token);

    if (gameData.status === 'waiting') {
      showWaiting(gameId);
    } else {
      showGame();
    }
    listenToGame(gameId);
  } catch (e) {
    showToast('Error resuming: ' + e.message);
    showLobby();
  }
}

// === Firebase: Listen to Game State ===
function listenToGame(gameId) {
  if (app.listener) app.listener.off();
  app.listener = db.ref('games/' + gameId);
  app.listener.on('value', function(snap) {
    var data = snap.val();
    if (!data) return;
    app.game = data;

    // Reset discard pickup when not in draw phase
    if (data.phase !== 'draw') {
      app.discardPickupIdx = -1;
      dom.pickupConfirm.classList.remove('active');
    }

    // If waiting and now playing, switch to game screen
    if (data.status === 'playing' || data.status === 'roundOver') {
      showGame();
    }
    renderGame();
  });

  // Set up presence separately (not inside the listener — that causes infinite loops)
  setupPresence();
}

// === Firebase: Presence (set up once, not inside the game listener) ===
function setupPresence() {
  if (!app.gameId || !app.playerSlot) return;
  var presRef = db.ref('games/' + app.gameId + '/players/' + app.playerSlot + '/online');
  var seenRef = db.ref('games/' + app.gameId + '/players/' + app.playerSlot + '/lastSeen');

  // Use Firebase's built-in connection detection
  db.ref('.info/connected').on('value', function(snap) {
    if (snap.val() === true) {
      presRef.set(true);
      presRef.onDisconnect().set(false);
      seenRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
    }
  });
}

// === Helpers ===
function isMyTurn() {
  return app.game && app.game.currentTurn === app.playerSlot;
}

function myPlayer() {
  return app.game && app.game.players && app.game.players[app.playerSlot];
}

function oppPlayer() {
  var oppSlot = otherPlayer(app.playerSlot);
  return app.game && app.game.players && app.game.players[oppSlot];
}

// Firebase can return arrays as objects — normalize everywhere
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val);
}

function myHand() {
  var p = myPlayer();
  return p ? toArray(p.hand) : [];
}

function myMelds() {
  var p = myPlayer();
  if (!p || !p.melds) return [];
  // Melds is an array of arrays — normalize both levels
  var melds = toArray(p.melds);
  return melds.map(function(m) { return toArray(m); });
}

function oppMelds() {
  var p = oppPlayer();
  if (!p || !p.melds) return [];
  var melds = toArray(p.melds);
  return melds.map(function(m) { return toArray(m); });
}

function gameDeck() {
  return app.game ? toArray(app.game.deck) : [];
}

function gameDiscard() {
  return app.game ? toArray(app.game.discard) : [];
}

// === Game Actions ===

async function drawFromDeck() {
  if (!isMyTurn() || app.game.phase !== 'draw') return;
  try {
  var deck = gameDeck();
  // Firebase may return arrays as objects — normalize
  if (deck && !Array.isArray(deck)) deck = Object.values(deck);
  if (deck.length === 0) {
    // Reshuffle discard pile
    var discard = gameDiscard();
    if (discard.length <= 1) { showToast('No cards to draw!'); return; }
    var topDiscard = discard[discard.length - 1];
    var toShuffle = discard.slice(0, -1);
    deck = shuffleDeck(toShuffle);
    var card = deck.splice(0, 1)[0];
    var hand = myHand().concat([card]);
    var updates = {};
    updates['deck'] = deck;
    updates['discard'] = [topDiscard];
    updates['phase'] = 'play';
    updates['players/' + app.playerSlot + '/hand'] = hand;
    updates['lastAction'] = myPlayer().name + ' drew from the deck (reshuffled)';
    updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;
    await db.ref('games/' + app.gameId).update(updates);
    return;
  }
  var card = deck[0];
  var newDeck = deck.slice(1);
  var hand = myHand().concat([card]);

  var updates = {};
  updates['deck'] = newDeck;
  updates['phase'] = 'play';
  updates['players/' + app.playerSlot + '/hand'] = hand;
  updates['lastAction'] = myPlayer().name + ' drew from the deck';
  updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;

  app.mustPlayCard = null;
  await db.ref('games/' + app.gameId).update(updates);
  } catch (e) {
    console.error('drawFromDeck error:', e);
    showToast('Error drawing: ' + e.message);
  }
}

async function drawFromDiscard(pickupIndex) {
  if (!isMyTurn() || app.game.phase !== 'draw') return;
  try {
  var discard = gameDiscard();
  if (pickupIndex < 0 || pickupIndex >= discard.length) return;

  // Cards to pick up: from pickupIndex to end (pickupIndex is the deepest card taken)
  var pickedUp = discard.slice(pickupIndex);
  var remaining = discard.slice(0, pickupIndex);
  var hand = myHand().concat(pickedUp);

  // The deepest card (first in pickedUp) must be played
  var mustPlay = pickedUp.length > 1 ? pickedUp[0] : null;
  app.mustPlayCard = mustPlay;

  var count = pickedUp.length;
  var updates = {};
  updates['discard'] = remaining.length > 0 ? remaining : [];
  updates['phase'] = 'play';
  updates['players/' + app.playerSlot + '/hand'] = hand;
  if (count === 1) {
    updates['lastAction'] = myPlayer().name + ' picked up ' + cardDisplayName(pickedUp[0]) + ' from discard';
  } else {
    updates['lastAction'] = myPlayer().name + ' picked up ' + count + ' cards from discard';
  }
  updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;

  app.discardPickupIdx = -1;
  await db.ref('games/' + app.gameId).update(updates);

  if (mustPlay) {
    // Auto-select the must-play card
    app.selectedCards = [mustPlay];
    showToast('Must lay down ' + cardDisplayName(mustPlay) + ' before you can discard');
  }
  } catch (e) {
    console.error('drawFromDiscard error:', e);
    showToast('Error picking up: ' + e.message);
  }
}

async function layDownMeld(cardIds) {
  if (!isMyTurn() || app.game.phase !== 'play') return;
  if (!isValidMeld(cardIds)) {
    showToast('Not a valid meld!');
    return;
  }

  var hand = myHand().slice();
  var meldCards = [];
  for (var i = 0; i < cardIds.length; i++) {
    var idx = hand.indexOf(cardIds[i]);
    if (idx === -1) { showToast('Card not in hand'); return; }
    hand.splice(idx, 1);
    meldCards.push(cardIds[i]);
  }

  var melds = myMelds().slice();
  melds.push(meldCards);

  // Check if must-play card was included
  if (app.mustPlayCard && cardIds.indexOf(app.mustPlayCard) !== -1) {
    app.mustPlayCard = null;
  }

  var updates = {};
  updates['players/' + app.playerSlot + '/hand'] = hand;
  updates['players/' + app.playerSlot + '/melds'] = melds;
  updates['lastAction'] = myPlayer().name + ' laid down a meld: ' + meldCards.map(cardDisplayName).join(' ');
  updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;

  // Check if going out (hand empty)
  if (hand.length === 0) {
    updates['lastAction'] = myPlayer().name + ' went out!';
    app.selectedCards = [];
    await db.ref('games/' + app.gameId).update(updates);
    await endRound();
    return;
  }

  app.selectedCards = [];
  await db.ref('games/' + app.gameId).update(updates);
}

async function layOffCard(cardId, targetPlayerSlot, meldIndex) {
  if (!isMyTurn() || app.game.phase !== 'play') return;

  var targetMelds = toArray(app.game.players[targetPlayerSlot].melds);
  if (meldIndex < 0 || meldIndex >= targetMelds.length) return;

  var meld = toArray(targetMelds[meldIndex]).slice();
  var layResult = validateLayOff(cardId, meld);
  if (!layResult.valid) {
    showToast(layResult.reason);
    return;
  }

  meld.push(cardId);
  var hand = myHand().slice();
  var idx = hand.indexOf(cardId);
  if (idx === -1) return;
  hand.splice(idx, 1);

  // Check if must-play card was used
  if (app.mustPlayCard && cardId === app.mustPlayCard) {
    app.mustPlayCard = null;
  }

  var updates = {};
  updates['players/' + app.playerSlot + '/hand'] = hand;
  updates['players/' + targetPlayerSlot + '/melds/' + meldIndex] = meld;
  updates['lastAction'] = myPlayer().name + ' laid off ' + cardDisplayName(cardId);
  updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;

  // Check if going out
  if (hand.length === 0) {
    updates['lastAction'] = myPlayer().name + ' went out!';
    app.selectedCards = [];
    await db.ref('games/' + app.gameId).update(updates);
    await endRound();
    return;
  }

  app.selectedCards = [];
  await db.ref('games/' + app.gameId).update(updates);
}

async function discardCard(cardId) {
  if (!isMyTurn() || app.game.phase !== 'play') return;

  // Block discard if must-play card hasn't been laid down
  if (app.mustPlayCard) {
    showToast('Must lay down ' + cardDisplayName(app.mustPlayCard) + ' before discarding');
    return;
  }

  var hand = myHand().slice();
  var idx = hand.indexOf(cardId);
  if (idx === -1) return;
  hand.splice(idx, 1);

  var discard = gameDiscard().slice();
  discard.push(cardId);

  var oppSlot = otherPlayer(app.playerSlot);
  var updates = {};
  updates['players/' + app.playerSlot + '/hand'] = hand;
  updates['discard'] = discard;
  updates['currentTurn'] = oppSlot;
  updates['phase'] = 'draw';
  updates['lastAction'] = myPlayer().name + ' discarded ' + cardDisplayName(cardId);
  updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;

  app.selectedCards = [];
  app.mustPlayCard = null;

  // Check if going out (hand now empty after discard)
  if (hand.length === 0) {
    updates['lastAction'] = myPlayer().name + ' went out!';
    // Don't switch turn, end round
    delete updates['currentTurn'];
    delete updates['phase'];
    await db.ref('games/' + app.gameId).update(updates);
    await endRound();
    return;
  }

  await db.ref('games/' + app.gameId).update(updates);
}

async function goOut() {
  // Player goes out without discarding (hand is empty)
  if (!isMyTurn()) return;
  if (myHand().length > 0) return;

  var updates = {};
  updates['lastAction'] = myPlayer().name + ' went out!';
  updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;
  await db.ref('games/' + app.gameId).update(updates);
  await endRound();
}

async function endRound() {
  // Read everything fresh from Firebase to avoid stale state
  var snap = await db.ref('games/' + app.gameId + '/players').once('value');
  var players = snap.val();
  var p1Melds = players.player1.melds || [];
  var p2Melds = players.player2.melds || [];
  var p1Hand = players.player1.hand || [];
  var p2Hand = players.player2.hand || [];

  var p1Score = calculateRoundScore(p1Melds, p1Hand);
  var p2Score = calculateRoundScore(p2Melds, p2Hand);

  var history = app.game.scoreHistory || [];
  history.push({
    round: app.game.roundNumber || 1,
    player1: p1Score,
    player2: p2Score
  });

  var p1Total = (players.player1.score || 0) + p1Score;
  var p2Total = (players.player2.score || 0) + p2Score;

  var updates = {};
  updates['status'] = 'roundOver';
  updates['scoreHistory'] = history;
  updates['players/player1/score'] = p1Total;
  updates['players/player2/score'] = p2Total;

  await db.ref('games/' + app.gameId).update(updates);
}

async function startNewRound() {
  var deck = shuffleDeck(createDeck());
  var hand1 = deck.splice(0, 7);
  var hand2 = deck.splice(0, 7);
  var firstDiscard = [deck.splice(0, 1)[0]];

  // Alternate dealer
  var prevDealer = app.game.dealer || 'player2';
  var newDealer = otherPlayer(prevDealer);
  var firstTurn = otherPlayer(newDealer); // non-dealer goes first
  var roundNum = (app.game.roundNumber || 1) + 1;

  var updates = {};
  updates['status'] = 'playing';
  updates['deck'] = deck;
  updates['discard'] = firstDiscard;
  updates['currentTurn'] = firstTurn;
  updates['dealer'] = newDealer;
  updates['phase'] = 'draw';
  updates['roundNumber'] = roundNum;
  updates['players/player1/hand'] = hand1;
  updates['players/player1/melds'] = [];
  updates['players/player2/hand'] = hand2;
  updates['players/player2/melds'] = [];
  updates['lastAction'] = 'Round ' + roundNum + ' — Cards dealt!';
  updates['lastActionTime'] = firebase.database.ServerValue.TIMESTAMP;

  app.selectedCards = [];
  app.mustPlayCard = null;
  app.discardPickupIdx = -1;

  await db.ref('games/' + app.gameId).update(updates);
}

// === UI Rendering ===

function renderGame() {
  if (!app.game || !app.game.players) return;

  var opp = oppPlayer();
  var me = myPlayer();
  if (!me) return;

  // --- Top bar ---
  dom.opponentNameDisplay.textContent = opp ? opp.name : 'Waiting...';
  if (opp) {
    dom.opponentDot.className = 'online-dot ' + (opp.online ? 'online' : 'offline');
  }
  renderScoresHeader();

  // --- Opponent hand ---
  renderOpponentHand(opp);

  // --- Opponent melds ---
  renderMelds(dom.opponentMelds, dom.opponentMeldLabel, opp, otherPlayer(app.playerSlot), false);

  // --- Draw pile ---
  var deck = gameDeck();
  dom.deckCount.textContent = deck.length + ' cards';
  if (isMyTurn() && app.game.phase === 'draw' && deck.length > 0) {
    dom.drawStack.classList.add('active');
  } else {
    dom.drawStack.classList.remove('active');
  }

  // --- Discard pile ---
  renderDiscardPile();

  // --- Player melds ---
  renderMelds(dom.playerMelds, dom.playerMeldLabel, me, app.playerSlot, true);

  // --- Action bar ---
  renderActionBar();

  // --- Player hand ---
  renderPlayerHand();

  // --- Status bar ---
  renderStatusBar();

  // --- Scoreboard (round over) ---
  if (app.game.status === 'roundOver') {
    showScoreboard();
  } else {
    dom.scoreboardOverlay.classList.remove('active');
  }
}

function renderScoresHeader() {
  var me = myPlayer();
  var opp = oppPlayer();
  if (!me || !opp) { dom.scoresDisplay.textContent = ''; return; }
  var myScore = me.score || 0;
  var oppScore = opp.score || 0;
  var delta = myScore - oppScore;
  var deltaStr = delta > 0 ? '+' + delta : '' + delta;
  dom.scoresDisplay.textContent = 'You: ' + myScore + ' | ' + opp.name + ': ' + oppScore + ' (' + deltaStr + ')';
}

function renderOpponentHand(opp) {
  dom.opponentHand.innerHTML = '';
  var count = opp && opp.hand ? opp.hand.length : 0;
  for (var i = 0; i < count; i++) {
    var card = document.createElement('div');
    card.className = 'card card-back';
    card.innerHTML = '<img src="cards/back.png" alt="card">';
    dom.opponentHand.appendChild(card);
  }
}

function renderDiscardPile() {
  var discard = gameDiscard();
  dom.discardCascade.innerHTML = '';

  if (discard.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'empty-pile';
    empty.textContent = 'Empty';
    dom.discardCascade.appendChild(empty);
    dom.discardCascade.style.height = 'var(--card-height)';
    return;
  }

  var isDrawPhase = isMyTurn() && app.game.phase === 'draw';
  // Dynamic offset: shrink as pile grows
  var baseOffset = 28;
  if (discard.length > 10) baseOffset = 22;
  if (discard.length > 15) baseOffset = 18;

  var totalHeight = (discard.length - 1) * baseOffset + parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-height'));
  dom.discardCascade.style.height = totalHeight + 'px';

  for (var i = 0; i < discard.length; i++) {
    var cardEl = document.createElement('div');
    cardEl.className = 'discard-card card';
    cardEl.style.top = (i * baseOffset) + 'px';
    cardEl.style.zIndex = i + 1;
    cardEl.innerHTML = '<img src="' + cardImagePath(discard[i]) + '" alt="' + cardDisplayName(discard[i]) + '">';

    if (isDrawPhase) {
      cardEl.classList.add('pickable');
      (function(idx) {
        cardEl.addEventListener('click', function() {
          selectDiscardPickup(idx);
        });
      })(i);
    }

    // Highlight if selected for pickup
    if (app.discardPickupIdx >= 0 && i >= app.discardPickupIdx) {
      cardEl.classList.add('highlighted');
      if (i === app.discardPickupIdx) {
        cardEl.classList.add('must-play');
      }
    }

    dom.discardCascade.appendChild(cardEl);
  }

  // Auto-scroll to bottom (most recent cards)
  dom.discardPile.scrollTop = dom.discardPile.scrollHeight;
}

function renderMelds(container, label, player, playerSlot, isOwn) {
  // Keep the label, clear the rest
  var existingLabel = label;
  container.innerHTML = '';
  container.appendChild(existingLabel);

  var melds = (player && player.melds) ? player.melds : [];
  if (melds.length === 0) {
    existingLabel.textContent = '';
    return;
  }
  existingLabel.textContent = (isOwn ? 'Your' : (player.name + "'s")) + ' melds:';

  for (var m = 0; m < melds.length; m++) {
    var meldGroup = document.createElement('div');
    meldGroup.className = 'meld-group';

    // Melds are always tappable during play phase — player tries to lay off, we validate
    if (isMyTurn() && app.game.phase === 'play') {
      meldGroup.style.cursor = 'pointer';
      (function(ps, mi) {
        meldGroup.addEventListener('click', function() {
          if (app.selectedCards.length !== 1) {
            showToast('Select exactly 1 card to lay off');
            return;
          }
          layOffCard(app.selectedCards[0], ps, mi);
        });
      })(playerSlot, m);
    }

    var meld = melds[m];
    for (var c = 0; c < meld.length; c++) {
      var cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.innerHTML = '<img src="' + cardImagePath(meld[c]) + '" alt="' + cardDisplayName(meld[c]) + '">';
      meldGroup.appendChild(cardEl);
    }
    container.appendChild(meldGroup);
  }
}

function shakeButton(btn) {
  btn.classList.add('error-shake');
  setTimeout(function() { btn.classList.remove('error-shake'); }, 500);
}

function renderActionBar() {
  dom.actionBar.innerHTML = '';

  // Show status hint when not your turn or in draw phase
  if (!isMyTurn()) {
    if (app.game.status !== 'roundOver') {
      var hint = document.createElement('div');
      hint.className = 'action-hint';
      hint.textContent = 'Waiting for ' + (oppPlayer() ? oppPlayer().name : 'opponent') + '...';
      dom.actionBar.appendChild(hint);
    }
    // Still show sort button even when waiting
    if (myHand().length > 0) {
      var sortBtn2 = document.createElement('button');
      sortBtn2.className = 'btn btn-secondary btn-small';
      sortBtn2.textContent = SORT_LABELS[app.sortMode || 'suit'];
      sortBtn2.addEventListener('click', async function() {
        var currentIdx = SORT_MODES.indexOf(app.sortMode || 'suit');
        var nextIdx = (currentIdx + 1) % SORT_MODES.length;
        app.sortMode = SORT_MODES[nextIdx];
        var sorted = sortHand(myHand(), app.sortMode);
        await db.ref('games/' + app.gameId + '/players/' + app.playerSlot + '/hand').set(sorted);
        app.selectedCards = [];
      });
      dom.actionBar.appendChild(sortBtn2);
    }
    return;
  }

  if (app.game.phase === 'draw') {
    // No hints — draw pile and discard pile are clickable
    return;
  }

  if (app.game.phase === 'play') {
    var hand = myHand();

    // If hand is empty, only show Go Out
    if (hand.length === 0) {
      var goOutBtn = document.createElement('button');
      goOutBtn.className = 'btn btn-primary btn-small';
      goOutBtn.textContent = 'Go Out!';
      goOutBtn.addEventListener('click', goOut);
      dom.actionBar.appendChild(goOutBtn);
      return;
    }

    // "Lay Down" button — always visible
    var layBtn = document.createElement('button');
    layBtn.className = 'btn btn-primary btn-small';
    layBtn.textContent = 'Lay Down';
    layBtn.addEventListener('click', function() {
      if (!isMyTurn()) { showToast('Not your turn'); return; }
      if (app.game.phase !== 'play') { showToast('Draw a card first'); return; }
      var sel = app.selectedCards.slice();
      if (sel.length === 0) {
        showToast('Select cards first');
        shakeButton(layBtn);
        return;
      }
      if (sel.length < 3) {
        showToast('Need at least 3 cards to lay down');
        shakeButton(layBtn);
        return;
      }
      var result = validateMeld(sel);
      if (!result.valid) {
        showToast(result.reason);
        shakeButton(layBtn);
        return;
      }
      layDownMeld(sel);
    });
    dom.actionBar.appendChild(layBtn);

    // "Discard" button — greyed out if must-play card hasn't been played yet
    var discardBtn = document.createElement('button');
    discardBtn.className = 'btn btn-secondary btn-small';
    discardBtn.textContent = 'Discard';
    if (app.mustPlayCard) {
      discardBtn.disabled = true;
      discardBtn.title = 'Must play ' + cardDisplayName(app.mustPlayCard) + ' first';
    }
    discardBtn.addEventListener('click', function() {
      if (!isMyTurn()) { showToast('Not your turn'); return; }
      if (app.game.phase !== 'play') { showToast('Draw a card first'); return; }
      if (app.mustPlayCard) {
        showToast('Must lay down ' + cardDisplayName(app.mustPlayCard) + ' before discarding');
        return;
      }
      if (app.selectedCards.length !== 1) {
        showToast('Select exactly 1 card to discard');
        shakeButton(discardBtn);
        return;
      }
      discardCard(app.selectedCards[0]);
    });
    dom.actionBar.appendChild(discardBtn);

    // Sort hand button — cycles through sort modes
    var sortBtn = document.createElement('button');
    sortBtn.className = 'btn btn-secondary btn-small';
    sortBtn.textContent = SORT_LABELS[app.sortMode || 'suit'];
    sortBtn.addEventListener('click', async function() {
      var currentIdx = SORT_MODES.indexOf(app.sortMode || 'suit');
      var nextIdx = (currentIdx + 1) % SORT_MODES.length;
      app.sortMode = SORT_MODES[nextIdx];
      var sorted = sortHand(myHand(), app.sortMode);
      await db.ref('games/' + app.gameId + '/players/' + app.playerSlot + '/hand').set(sorted);
      app.selectedCards = [];
    });
    dom.actionBar.appendChild(sortBtn);
  }
}

function renderPlayerHand() {
  dom.playerHand.innerHTML = '';
  var hand = myHand();

  // Calculate overlap for fitting cards
  var containerWidth = dom.playerHand.clientWidth - 24;
  var cardWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-width'));
  var overlap = cardWidth; // no overlap if few cards
  if (hand.length > 1) {
    var needed = cardWidth * hand.length;
    if (needed > containerWidth) {
      overlap = (containerWidth - cardWidth) / (hand.length - 1);
      overlap = Math.max(overlap, 20); // minimum visible area
    }
  }

  for (var i = 0; i < hand.length; i++) {
    var cardId = hand[i];
    var cardEl = document.createElement('div');
    cardEl.className = 'card';
    if (app.selectedCards.indexOf(cardId) !== -1) {
      cardEl.classList.add('selected');
    }
    if (app.mustPlayCard && cardId === app.mustPlayCard) {
      cardEl.classList.add('must-play-card');
    }
    cardEl.innerHTML = '<img src="' + cardImagePath(cardId) + '" alt="' + cardDisplayName(cardId) + '">';

    if (hand.length > 1 && overlap < cardWidth) {
      cardEl.style.marginLeft = (i === 0 ? '0' : (-(cardWidth - overlap)) + 'px');
    }

    cardEl.setAttribute('data-card', cardId);
    cardEl.onclick = (function(cid) {
      return function(e) {
        e.stopPropagation();
        toggleCardSelection(cid);
      };
    })(cardId);

    dom.playerHand.appendChild(cardEl);
  }
}

function renderStatusBar() {
  if (!app.game) return;
  var me = myPlayer();
  var myName = me ? me.name : '?';
  var opp = oppPlayer();
  var oppName = opp ? opp.name : 'Opponent';

  // Always show who you are
  document.getElementById('my-identity').textContent = 'You: ' + myName;

  if (isMyTurn()) {
    dom.turnText.textContent = 'Your turn — ' + (app.game.phase === 'draw' ? 'Draw' : 'Play / Discard');
    dom.turnText.className = 'turn-text your-turn';
  } else {
    dom.turnText.textContent = oppName + "'s turn";
    dom.turnText.className = 'turn-text opponent-turn';
  }

  dom.lastAction.textContent = app.game.lastAction || '';
}

function showScoreboard() {
  dom.scoreboardOverlay.classList.add('active');
  var history = app.game.scoreHistory || [];
  var p1Name = app.game.players.player1.name;
  var p2Name = app.game.players.player2.name;

  var html = '<table>';
  html += '<tr><th>Round</th><th>' + p1Name + '</th><th>' + p2Name + '</th></tr>';

  var p1Total = 0, p2Total = 0;
  for (var i = 0; i < history.length; i++) {
    var r = history[i];
    p1Total += r.player1;
    p2Total += r.player2;
    html += '<tr>';
    html += '<td>' + r.round + '</td>';
    html += '<td class="' + (r.player1 >= 0 ? 'score-positive' : 'score-negative') + '">' + (r.player1 >= 0 ? '+' : '') + r.player1 + '</td>';
    html += '<td class="' + (r.player2 >= 0 ? 'score-positive' : 'score-negative') + '">' + (r.player2 >= 0 ? '+' : '') + r.player2 + '</td>';
    html += '</tr>';
  }

  html += '<tr class="score-total"><td>Total</td>';
  html += '<td>' + p1Total + '</td>';
  html += '<td>' + p2Total + '</td></tr>';

  var delta = p1Total - p2Total;
  var leader = delta > 0 ? p1Name : (delta < 0 ? p2Name : 'Tied');
  html += '<tr class="delta-row"><td>Lead</td>';
  html += '<td colspan="2">' + leader + (delta !== 0 ? ' by ' + Math.abs(delta) : '') + '</td></tr>';
  html += '</table>';

  dom.scoreboardContent.innerHTML = html;

  dom.scoreboardActions.innerHTML = '';
  var newRoundBtn = document.createElement('button');
  newRoundBtn.className = 'btn btn-primary btn-small';
  newRoundBtn.textContent = 'New Round';
  newRoundBtn.addEventListener('click', function() {
    startNewRound();
  });
  dom.scoreboardActions.appendChild(newRoundBtn);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-secondary btn-small';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', function() {
    dom.scoreboardOverlay.classList.remove('active');
  });
  dom.scoreboardActions.appendChild(closeBtn);
}

// === Card Selection ===

function toggleCardSelection(cardId) {
  // Always allow selection — it's just UI state. Validation happens on action.
  var idx = app.selectedCards.indexOf(cardId);
  if (idx === -1) {
    app.selectedCards.push(cardId);
  } else {
    app.selectedCards.splice(idx, 1);
  }
  renderGame();
}

function selectDiscardPickup(index) {
  if (!isMyTurn() || app.game.phase !== 'draw') return;
  if (app.discardPickupIdx === index) {
    // Deselect
    app.discardPickupIdx = -1;
    dom.pickupConfirm.classList.remove('active');
  } else {
    app.discardPickupIdx = index;
    var count = gameDiscard().length - index;
    dom.pickupConfirm.textContent = 'Pick Up ' + count + (count === 1 ? ' Card' : ' Cards');
    dom.pickupConfirm.classList.add('active');
  }
  renderGame();
}

// === Event Listeners ===

function setupEventListeners() {
  // Lobby
  dom.createBtn.addEventListener('click', createGame);
  dom.joinBtn.addEventListener('click', function() {
    joinGame(dom.joinCode.value, dom.joinName.value.trim());
  });
  dom.copyLinkBtn.addEventListener('click', function() {
    var link = dom.showJoinLink.textContent;
    navigator.clipboard.writeText(link).then(function() {
      showToast('Link copied!');
    }).catch(function() {
      showToast('Copy failed — select and copy manually');
    });
  });

  // Draw pile — click on the entire draw-pile area
  document.getElementById('draw-pile').addEventListener('click', function() {
    console.log('Draw pile clicked. isMyTurn:', isMyTurn(), 'phase:', app.game ? app.game.phase : 'no game', 'playerSlot:', app.playerSlot, 'currentTurn:', app.game ? app.game.currentTurn : 'n/a');
    if (!app.game) { showToast('Game not loaded yet'); return; }
    if (!isMyTurn()) { showToast('Not your turn — it\'s ' + (oppPlayer() ? oppPlayer().name + '\'s' : 'opponent\'s') + ' turn'); return; }
    if (app.game.phase !== 'draw') { showToast('You already drew — play or discard'); return; }
    drawFromDeck();
  });

  // Pickup confirm
  dom.pickupConfirm.addEventListener('click', function() {
    if (app.discardPickupIdx >= 0) {
      drawFromDiscard(app.discardPickupIdx);
      dom.pickupConfirm.classList.remove('active');
    }
  });

  // Scoreboard toggle
  dom.scoresDisplay.addEventListener('click', function() {
    if (app.game && app.game.scoreHistory && app.game.scoreHistory.length > 0) {
      showScoreboard();
    }
  });

  // Close scoreboard on overlay click
  dom.scoreboardOverlay.addEventListener('click', function(e) {
    if (e.target === dom.scoreboardOverlay) {
      dom.scoreboardOverlay.classList.remove('active');
    }
  });

  // Enter key in lobby inputs
  dom.createName.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') createGame();
  });
  dom.joinCode.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') dom.joinName.focus();
  });
  dom.joinName.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') dom.joinBtn.click();
  });
}

// === Initialization ===

function init() {
  cacheDom();
  setupEventListeners();

  // Priority 1: sessionStorage (per-tab, most reliable for identity)
  var session = getSessionIdentity();
  var params = getUrlParams();

  if (session && params.g && session.gameId === params.g.toUpperCase()) {
    // Resume from session — this tab knows who it is
    console.log('[Rummy] Init: resuming from sessionStorage as ' + session.playerSlot);
    resumeGameWithToken(session.gameId, session.token);
  } else if (params.g && params.t) {
    // Resume with token from URL
    console.log('[Rummy] Init: resuming from URL params');
    resumeGameWithToken(params.g.toUpperCase(), params.t);
  } else if (params.g) {
    var gameId = params.g.toUpperCase();
    var saved = getSavedGame(gameId);
    if (saved && saved.token) {
      console.log('[Rummy] Init: resuming from localStorage as ' + saved.playerSlot);
      resumeGameWithToken(saved.gameId || gameId, saved.token);
    } else {
      // Join flow — pre-fill code
      dom.joinCode.value = gameId;
      dom.joinName.focus();
    }
  } else {
    showLobby();
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
