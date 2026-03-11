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
  scores: [null, null],
  online: navigator.onLine
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



// === Save Round ===
function saveRound() {
  for (var i = 0; i < PLAYERS.length; i++) {
    if (state.scores[i] === null) return;
  }
  var roundData = {
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    scores: {},
    source: 'manual'
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

function renderTotals() {
  var rounds = state.rounds;
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

  var rounds = state.rounds;

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
    if (r.timestamp && typeof r.timestamp === 'number' && r.timestamp > 1000000000000) {
      var d = new Date(r.timestamp);
      meta.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      meta.textContent = '---';
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
      var pmBtn = document.getElementById('plus-minus-' + idx);

      card.addEventListener('click', function(e) {
        if (card.classList.contains('editing')) return;
        card.classList.add('editing', 'active');
        input.value = state.scores[idx] !== null ? Math.abs(state.scores[idx]) : '';
        input.focus();
        input.select();
      });

      pmBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (state.scores[idx] !== null) {
          state.scores[idx] = -state.scores[idx];
          input.value = Math.abs(state.scores[idx]);
          display.textContent = state.scores[idx];
          display.className = 'score-display';
        } else {
          var val = parseInt(input.value, 10);
          if (!isNaN(val)) {
            state.scores[idx] = -val;
            input.value = Math.abs(val);
            display.textContent = state.scores[idx];
            display.className = 'score-display';
          }
        }
        updateSaveButton();
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
            var isNeg = state.scores[idx] !== null && state.scores[idx] < 0;
            state.scores[idx] = isNeg ? -Math.abs(num) : Math.abs(num);
            display.textContent = state.scores[idx];
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

}

// === Init ===
function init() {
  updateConnectionStatus();
  setupEvents();
  listenToRounds();
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function(err) {
    console.warn('SW registration failed:', err);
  });
}
