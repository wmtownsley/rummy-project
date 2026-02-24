// Scored! — PWA
// Flat round storage, Firebase sync, offline support

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

var PLAYERS = [
  { id: 'adeline', name: 'Adeline' },
  { id: 'mark', name: 'Mark' }
];

var state = {
  rounds: [],
  gameStartedAt: 0,
  scores: [null, null],
  online: navigator.onLine,
  myName: localStorage.getItem('rummy_scoring_myName') || null
};

// === Toast ===
var toastTimer = null;
function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove('show'); }, 2200);
}

// === Connection Status ===
function updateConnectionStatus() {
  var el = document.getElementById('connection-status');
  if (navigator.onLine) {
    el.className = 'status-online';
    el.title = 'Online';
    state.online = true;
  } else {
    el.className = 'status-offline';
    el.title = 'Offline — changes will sync later';
    state.online = false;
  }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// === Identity ===
function ensureIdentity() {
  if (state.myName) return;
  var name = prompt('Who is recording scores?', 'Mark');
  if (name) {
    name = name.trim();
    state.myName = name;
    localStorage.setItem('rummy_scoring_myName', name);
  }
}

// === Game Boundary ===
function getGameStartedAt() {
  return state.gameStartedAt || 0;
}

function startNewGame() {
  var now = Date.now();
  state.gameStartedAt = now;
  localStorage.setItem('rummy_scoring_gameStartedAt', String(now));
  db.ref('scoring/gameMarkers').push({ timestamp: firebase.database.ServerValue.TIMESTAMP });
  state.scores = PLAYERS.map(function() { return null; });
  clearInputs();
  renderAll();
  showToast('Scores reset');
}

// === Save Round ===
function saveRound() {
  for (var i = 0; i < PLAYERS.length; i++) {
    if (state.scores[i] === null) return;
  }
  ensureIdentity();

  var roundData = {
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    scores: {},
    source: 'manual',
    recordedBy: state.myName || 'unknown'
  };

  for (var i = 0; i < PLAYERS.length; i++) {
    roundData.scores[PLAYERS[i].id] = state.scores[i];
  }

  db.ref('scoring/rounds').push(roundData);

  state.scores = PLAYERS.map(function() { return null; });
  clearInputs();
  showToast('Saved');
}

// === Listen to Rounds ===
function listenToRounds() {
  db.ref('scoring/rounds').orderByChild('timestamp').on('value', function(snap) {
    state.rounds = [];
    snap.forEach(function(child) {
      var r = child.val();
      r._id = child.key;
      state.rounds.push(r);
    });
    renderAll();
  });
}

// === UI Helpers ===
function clearInputs() {
  for (var i = 0; i < PLAYERS.length; i++) {
    var input = document.getElementById('score-input-' + i);
    var display = document.getElementById('score-display-' + i);
    var card = document.getElementById('player-card-' + i);
    if (input) input.value = '';
    if (display) { display.textContent = '\u2014'; display.className = 'score-display'; }
    if (card) card.classList.remove('editing', 'active');
  }
  document.getElementById('save-btn').disabled = true;
}

function updateSaveButton() {
  var allSet = true;
  for (var i = 0; i < PLAYERS.length; i++) {
    if (state.scores[i] === null) { allSet = false; break; }
  }
  document.getElementById('save-btn').disabled = !allSet;
}

// === Rendering ===
function renderAll() {
  renderTotals();
  renderRounds();
}

function currentGameRounds() {
  var start = getGameStartedAt();
  return state.rounds.filter(function(r) {
    return r.timestamp && r.timestamp >= start;
  });
}

function renderTotals() {
  var rounds = currentGameRounds();
  var totals = {};
  for (var i = 0; i < PLAYERS.length; i++) totals[PLAYERS[i].id] = 0;

  for (var r = 0; r < rounds.length; r++) {
    for (var i = 0; i < PLAYERS.length; i++) {
      var pid = PLAYERS[i].id;
      totals[pid] += (rounds[r].scores && rounds[r].scores[pid]) || 0;
    }
  }

  for (var i = 0; i < PLAYERS.length; i++) {
    var el = document.getElementById('total-value-' + i);
    if (el) el.textContent = totals[PLAYERS[i].id];
  }

  var t0 = totals[PLAYERS[0].id] || 0;
  var t1 = totals[PLAYERS[1].id] || 0;
  var delta = t0 - t1;
  var deltaEl = document.getElementById('total-delta');
  if (delta === 0) {
    deltaEl.textContent = rounds.length === 0 ? '' : 'Tied';
  } else {
    var leader = delta > 0 ? PLAYERS[0].name : PLAYERS[1].name;
    deltaEl.textContent = leader + ' +' + Math.abs(delta);
  }
}

function renderRounds() {
  var list = document.getElementById('rounds-list');
  list.innerHTML = '';

  var rounds = currentGameRounds();

  if (rounds.length === 0) return;

  var header = document.createElement('div');
  header.className = 'round-row round-header';
  var headerHtml = '<div class="round-scores">';
  for (var p = 0; p < PLAYERS.length; p++) {
    headerHtml += '<span class="round-score-label">' + PLAYERS[p].name + '</span>';
  }
  headerHtml += '</div><span class="round-meta"></span>';
  header.innerHTML = headerHtml;
  list.appendChild(header);

  for (var i = rounds.length - 1; i >= 0; i--) {
    var r = rounds[i];
    var row = document.createElement('div');
    row.className = 'round-row';

    var vals = [];
    for (var p = 0; p < PLAYERS.length; p++) {
      vals.push((r.scores && r.scores[PLAYERS[p].id]) || 0);
    }
    var maxVal = Math.max.apply(null, vals);
    var allSame = vals.every(function(v) { return v === vals[0]; });

    var scoresEl = document.createElement('div');
    scoresEl.className = 'round-scores';
    for (var p = 0; p < PLAYERS.length; p++) {
      var s = document.createElement('span');
      var isWinner = vals[p] === maxVal && !allSame;
      s.className = 'round-score ' + (allSame ? '' : (isWinner ? 'winner' : 'loser'));
      s.textContent = vals[p];
      scoresEl.appendChild(s);
    }
    row.appendChild(scoresEl);

    var meta = document.createElement('span');
    meta.className = 'round-meta';
    if (r.timestamp && typeof r.timestamp === 'number') {
      var d = new Date(r.timestamp);
      meta.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    row.appendChild(meta);

    list.appendChild(row);
  }
}

// === Event Handlers ===
function setupEvents() {
  for (var i = 0; i < PLAYERS.length; i++) {
    (function(idx) {
      var card = document.getElementById('player-card-' + idx);
      var input = document.getElementById('score-input-' + idx);
      var display = document.getElementById('score-display-' + idx);

      card.addEventListener('click', function() {
        if (card.classList.contains('editing')) return;
        card.classList.add('editing', 'active');
        input.value = state.scores[idx] !== null ? state.scores[idx] : '';
        input.focus();
        input.select();
      });

      input.addEventListener('input', function() {
        var val = input.value.trim();
        if (val === '' || val === '-') {
          state.scores[idx] = null;
          display.textContent = '\u2014';
          display.className = 'score-display';
        } else {
          var num = parseInt(val, 10);
          if (!isNaN(num)) {
            state.scores[idx] = num;
            display.textContent = num;
            display.className = 'score-display';
          }
        }
        updateSaveButton();
      });

      input.addEventListener('blur', function() {
        card.classList.remove('editing', 'active');
        if (state.scores[idx] !== null) {
          display.textContent = state.scores[idx];
          display.className = 'score-display';
        }
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          input.blur();
          var nextIdx = (idx + 1) % PLAYERS.length;
          if (state.scores[nextIdx] === null) {
            setTimeout(function() {
              document.getElementById('player-card-' + nextIdx).click();
            }, 50);
          }
        }
      });
    })(i);
  }

  document.getElementById('save-btn').addEventListener('click', saveRound);

  document.getElementById('settings-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('settings-menu').classList.toggle('open');
  });

  document.addEventListener('click', function() {
    document.getElementById('settings-menu').classList.remove('open');
  });

  document.getElementById('reset-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    var rounds = currentGameRounds();
    if (rounds.length > 0) {
      if (!confirm('Reset running scores?')) return;
    }
    document.getElementById('settings-menu').classList.remove('open');
    startNewGame();
  });
}

// === Init ===
function init() {
  updateConnectionStatus();
  setupEvents();

  var saved = localStorage.getItem('rummy_scoring_gameStartedAt');
  state.gameStartedAt = saved ? parseInt(saved, 10) : 0;
  if (state.gameStartedAt === 0) startNewGame();

  listenToRounds();
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function(err) {
    console.warn('SW registration failed:', err);
  });
}
