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

var HAND = '\u270B';

var state = {
  rounds: [],
  scores: [null, null],
  online: navigator.onLine,
  dealer: PLAYERS[0].id,
  dealerDirty: false
};

function otherPlayer(id) {
  return PLAYERS[0].id === id ? PLAYERS[1].id : PLAYERS[0].id;
}

/** Next dealer = opposite of whoever dealt the latest round that records a dealer. */
function computeDefaultDealer(rounds) {
  for (var i = rounds.length - 1; i >= 0; i--) {
    var d = rounds[i].dealer;
    if (d === PLAYERS[0].id || d === PLAYERS[1].id) {
      return otherPlayer(d);
    }
  }
  return PLAYERS[0].id;
}

function dealerInitial(id) {
  if (id === PLAYERS[0].id) return 'A';
  if (id === PLAYERS[1].id) return 'M';
  return '';
}

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
  var dealerSaved = state.dealer;
  var roundData = {
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    scores: {},
    source: 'manual',
    dealer: dealerSaved
  };

  for (var i = 0; i < PLAYERS.length; i++) {
    roundData.scores[PLAYERS[i].id] = state.scores[i];
  }

  db.ref('scoring/rounds').push(roundData).then(function() {
    state.dealerDirty = false;
    state.dealer = otherPlayer(dealerSaved);
    state.scores = PLAYERS.map(function() { return null; });
    clearInputs();
    showToast('Saved');
    renderDealer();
    renderDealerHint();
  }).catch(function(err) {
    console.error(err);
    showToast('Save failed — try again');
  });
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
    if (!state.dealerDirty) {
      state.dealer = computeDefaultDealer(state.rounds);
    }
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
  renderDealer();
  renderDealerHint();
}

function renderDealer() {
  for (var i = 0; i < PLAYERS.length; i++) {
    var badge = document.getElementById('dealer-badge-' + i);
    if (!badge) continue;
    if (PLAYERS[i].id === state.dealer) {
      badge.classList.add('active');
    } else {
      badge.classList.remove('active');
    }
  }
}

function renderDealerHint() {
  var el = document.getElementById('dealer-hint');
  if (!el) return;
  if (localStorage.getItem('scored_dealer_hint_dismissed')) {
    el.classList.add('is-hidden');
  } else {
    el.classList.remove('is-hidden');
  }
}

function dismissDealerHintOnce() {
  if (!localStorage.getItem('scored_dealer_hint_dismissed')) {
    localStorage.setItem('scored_dealer_hint_dismissed', '1');
    renderDealerHint();
  }
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
    var dateSpan = document.createElement('span');
    dateSpan.className = 'round-meta-date';
    if (r.timestamp && typeof r.timestamp === 'number' && r.timestamp > 1000000000000) {
      var d = new Date(r.timestamp);
      dateSpan.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      dateSpan.textContent = '---';
    }
    meta.appendChild(dateSpan);
    if (r.dealer === PLAYERS[0].id || r.dealer === PLAYERS[1].id) {
      var dealerEl = document.createElement('span');
      dealerEl.className = 'round-dealer';
      dealerEl.textContent = dealerInitial(r.dealer);
      dealerEl.title = 'Dealer';
      dealerEl.setAttribute('aria-label', 'Dealer');
      meta.appendChild(dealerEl);
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
        if (e.target.closest('.dealer-badge')) return;
        if (card.classList.contains('editing')) return;
        dismissDealerHintOnce();
        card.classList.add('editing', 'active');
        input.value = state.scores[idx] !== null ? state.scores[idx] : '';
        input.focus();
        input.select();
      });

      function toggleSign() {
        var val = parseInt(input.value, 10);
        if (isNaN(val) || val === 0) return;
        var flipped = -val;
        state.scores[idx] = flipped;
        input.value = flipped;
        display.textContent = flipped;
        display.className = 'score-display';
        input.focus();
        updateSaveButton();
      }
      pmBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSign();
      });
      pmBtn.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSign();
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
}

function setupDealerBadges() {
  function swapDealerFromBadge(idx) {
    if (PLAYERS[idx].id !== state.dealer) return;
    state.dealer = otherPlayer(state.dealer);
    state.dealerDirty = true;
    renderDealer();
  }

  for (var i = 0; i < PLAYERS.length; i++) {
    (function(idx) {
      var badge = document.getElementById('dealer-badge-' + idx);
      if (!badge) return;

      badge.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        swapDealerFromBadge(idx);
      });

      badge.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          swapDealerFromBadge(idx);
        }
      });
    })(i);
  }
}

// === Init ===
function init() {
  updateConnectionStatus();
  setupEvents();
  setupDealerBadges();
  renderDealer();
  renderDealerHint();
  listenToRounds();
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(function(reg) {
    reg.update();
    reg.addEventListener('updatefound', function() {
      var newWorker = reg.installing;
      newWorker.addEventListener('statechange', function() {
        if (newWorker.state === 'activated') {
          window.location.reload();
        }
      });
    });
  }).catch(function(err) {
    console.warn('SW registration failed:', err);
  });
}
