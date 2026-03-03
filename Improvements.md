# Rummy2go & Scored! — Bugs, Enhancements & History

## Rummy2go Web Game

### Bugs Fixed

- **Multi-card lay off rejected on existing meld**
  Selecting 2 cards to lay down on an opponent's meld (e.g., 2 and 3 of spades onto a J-Q-K-A spades run) was incorrectly rejected. The lay-off logic only supported single cards. Players had to work around it by laying off one card at a time. Now 1 or more cards can be laid off together in a single action.
  _Reported by Mark. Fixed 2026-02-23._

### Small Enhancements Completed

- **Game creator deals first round**
  When a new game is created, the creator is now the dealer for round 1, so the opponent (joiner) plays first. Previously the creator went first. Subsequent rounds continue to alternate dealer as before.
  _Requested by Mark. Completed 2026-02-23._

- **Sort by suit alternates colors**
  When sorting by suit, suit groups now alternate by color: Clubs (black), Diamonds (red), Spades (black), Hearts (red). This avoids same-colored suits being adjacent, making it easier to visually distinguish groups.
  _Requested by Adeline. Completed 2026-02-23._

- **Turn notification sound**
  A short "bing" tone plays when it becomes your turn (i.e., after the opponent discards). Uses the Web Audio API — no external sound files needed. The browser's audio is unlocked on the first user interaction with the page.
  _Requested by Mark & Adeline. Completed 2026-02-23._

### Major Enhancements Completed

- **Drag-to-reorder cards in hand**
  Players can now press and drag cards left/right to rearrange their hand in any order. A tap still selects for play/discard; dragging past a small threshold picks up the card as a floating ghost with a gold drop indicator showing the target position. Works on both mouse and touch, tested with up to 23 cards.
  _Requested by Mark. Completed 2026-02-23._

- **Auto-save web game scores to Scored! app (Phase 1)**
  At the end of a Rummy2go web game round, a "Save to Scored!" button appears on the scoreboard if both player names match "Mark" and "Adeline" (either slot order). Writes to `/scoring/rounds/` with `source: "web-game"`, `webGameId`, and `webRound`. Duplicate prevention via `/games/{id}/savedToScoring/`. Button greys out after saving.
  _Requested by Mark. Completed 2026-02-25._

### In Progress

- **Card draw animation** _(work in progress — paused 2026-02-23, code pushed to GitHub 2026-02-25)_
  Animate cards when drawn from the deck so both players see the card move rather than just appear.

  **Current state:** First working draft is live on GitHub. Basic functionality works:
  - Drawing player sees card fly from deck to center, flip to reveal the card face, then fly to their hand. Uses the existing `animateDrawnCard()` function in `app.js` and the `#drawn-card-overlay` element + CSS in `style.css`.
  - Opponent sees a face-down card fly from the deck to the opponent's hand area. Uses `animateOpponentDraw()` function. Detection is in the Firebase listener — triggers when `lastAction` contains "drew from the deck" and it's the opponent's action (comparing `lastActionTime`).

  **Still to do / iterate on:**
  - Tune animation timing, speed, and feel (Mark said "good first try" — needs refinement).
  - Discard pile draw animation (not started — only deck draw is animated so far).
  - Consider edge cases: reshuffle draw animation, animation during rapid play.

  _Requested by Mark._

### Queued

- **Show Scored! history in web game (Phase 2)**
  Show the Scored! app's full history in the Rummy2go web game's History view, replacing or supplementing the per-game scoreHistory. This unifies the scoring view across both apps.
  _Requested by Mark. Queued 2026-02-25._

### Deferred

- **Change player name mid-game**
  Allow a player to change their display name after the game has already started. For now, "The soon to be winne" was manually renamed to "Adeline" directly in Firebase (game 7STARM, 2026-02-23). A user-facing rename feature is deferred until needed.
  _Requested by Adeline._

---

## Scored! PWA (IRL Score Tracker)

### Overview

Standalone Progressive Web App for tracking Rummy scores when playing in person with physical cards. Built for Mark and Adeline, installable on iPhone via Safari "Add to Home Screen." Uses the same Firebase backend (`rummy2go`) as the web game.

**Live URL:** https://wmtownsley.github.io/rummy-project/scoring-app/

### Built & Shipped (2026-02-25)

- **Core scoring** — Tap player card to enter score, Save button records to Firebase. Dead simple UX optimized for one-handed iPhone use.
- **Running totals** — Shows cumulative scores for both players with leader and delta.
- **Round history** — Most recent at top, with player name column headers. Winner in green, loser in red. Date shown per entry.
- **Shared Firebase backend** — Single source of truth at `/scoring/rounds/`. No local state for scores; everything reads/writes from Firebase.
- **Historical data import** — 108 rounds of historical scores (from Notes file) imported with `source: "historical"` and placeholder timestamps (display as "---").
- **PWA installable** — Service worker for offline caching, manifest.json, proper Apple meta tags. Launches full-screen from Home Screen.
- **Custom icon** — Card-table green with heart/spade playing cards and a gold tally-five mark. Generated and resized to 192x192 and 512x512. Icon background flood-filled green to eliminate white border on iOS.

### Iterations & Refinements (2026-02-25)

- Removed session/game concept — flat round list, no friction for declaring new sessions
- Removed "Reset Scores" UI — Firebase is the sole source of truth; database edits done via CLI when needed
- Removed geolocation tracking — unnecessary complexity
- Removed "recorded by" tracking — unnecessary friction
- Removed setup screen — players hardcoded as Adeline and Mark for simplicity
- Removed empty state text ("No rounds yet...")
- Simplified language: "Save" not "Save Round", no "Round"/"Game" terminology
- Winner/loser coloring (green/red) instead of positive/negative coloring
- Show "Loading..." instead of "0 Tied 0" while Firebase data loads
- **Performance optimizations:**
  - Cache-first service worker (was network-first, causing launch delay)
  - Firebase SDK cached for offline availability
  - Inline critical CSS to prevent white flash on launch
  - Deferred script loading so app shell paints before JS executes
  - Preload hints for CSS and JS assets
- Service worker cache versioning (`v1` → `v2` → `v3`) to force updates on all devices when changes are made

### Architecture Notes

- All scores stored flat at `/scoring/rounds/{pushId}` with `timestamp`, `scores: {adeline, mark}`, and `source` ("manual", "web-game", or "historical")
- Web game integration writes to the same path with `source: "web-game"` and `webGameId`/`webRound` for traceability
- No local state for score data — Firebase is always the source of truth
- PWA installed on iPhone via Safari → Share → Add to Home Screen

---

## Roadmap

Ideas for the future — not scheduled for development yet.

- **More card animations** — Extend animation to discard pile pickups, laying down melds, discarding, etc.
- **Memory Aide mode** — Cards that have appeared in the discard pile and been picked up are shown to both players as a memory aid. _From Mark._

---

## Security

### Action Required (not yet done)

On 2026-02-23, Google Cloud Platform sent a "Suspicious Activity Alert" flagging the Firebase API key (`AIzaSyChJDXt0LDQUJsVDeCicKp6HUDXm37feto`) as publicly visible on GitHub. This is expected for Firebase web apps — the API key is a client-side identifier, not a secret. Firebase security is controlled by Security Rules on the database, not by hiding the key. However, two actions are recommended:

**1. Restrict the API key (Google Cloud Console)**

Go to: https://console.cloud.google.com/apis/credentials?project=rummy2go

- Click the API key.
- **Application restrictions**: Set to "HTTP referrers" and add allowed domains (`localhost`, `localhost:8080`, and any production hosting domain).
- **API restrictions**: Select "Restrict key" and allow only: Identity Toolkit API, Firebase Realtime Database.

This prevents misuse of the key for other Google APIs or from unauthorized domains.

**2. Tighten Firebase Realtime Database Security Rules**

Go to: https://console.firebase.google.com/project/rummy2go/database/rules

Current state: the database is in default test mode (`{".read": true, ".write": true}`), meaning anyone with the database URL can read all game data (including player hands and tokens) and write anything anywhere. A probe on 2026-02-23 confirmed: reading all games, reading full game data, and writing to arbitrary paths all succeed unauthenticated.

Replace the current rules with:

```json
{
  "rules": {
    "games": {
      "$gameId": {
        ".read": true,
        ".write": true
      }
    },
    "scoring": {
      ".read": true,
      ".write": true
    },
    ".read": false,
    ".write": false
  }
}
```

This scopes access to only the `games/` and `scoring/` paths and blocks arbitrary top-level reads/writes. A more thorough lockdown (validating player tokens, protecting hand data from opponents) would require app-level changes and is not needed for now.

---

## Development Notes

### Testing workflow
Push pre-built game states directly to Firebase for rapid testing without playing through rounds:
```
curl -s -X PUT 'https://rummy2go-default-rtdb.firebaseio.com/games/TESTXX.json' \
  -H 'Content-Type: application/json' -d '{ ... }'
```
Open two browser tabs with tokens in the URL:
- `http://localhost:8080?g=TESTXX&t=testplayer1token12345` (Mark / player1)
- `http://localhost:8080?g=TESTXX&t=testplayer2token12345` (Adeline / player2)

Clean up test games when done:
```
curl -s -X DELETE 'https://rummy2go-default-rtdb.firebaseio.com/games/TESTXX.json'
```

Local dev servers:
- Rummy2go: `python3 -m http.server 8080` from the project root
- Scored!: `python3 -m http.server 8081` from `scoring-app/`

### Firebase direct edits
Player names and other fields can be patched directly:
```
curl -s -X PUT 'https://rummy2go-default-rtdb.firebaseio.com/games/GAMEID/players/player2/name.json' \
  -H 'Content-Type: application/json' -d '"NewName"'
```

Scoring data can be managed directly:
```
# List non-historical scoring entries
curl -s 'https://rummy2go-default-rtdb.firebaseio.com/scoring/rounds.json' | python3 -c "
import sys, json
data = json.load(sys.stdin)
for k,v in data.items():
    if not k.startswith('hist_'):
        print(f'{k}: {v}')
"

# Delete a specific scoring entry
curl -s -X DELETE 'https://rummy2go-default-rtdb.firebaseio.com/scoring/rounds/ENTRY_KEY.json'
```

### PWA cache busting
When changes to the Scored! app need to reach iPhones, bump the `CACHE_NAME` version in `scoring-app/sw.js` (e.g., `v3` → `v4`). The service worker file itself is always fetched fresh by the browser, so changing the cache name triggers a full re-cache. Users may need to open the app twice (first visit fetches new SW, second visit uses new cache) or delete and re-add the Home Screen bookmark.
