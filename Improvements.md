# Rummy2go — Bugs & Enhancements

## Bugs

### Fixed

- **Multi-card lay off rejected on existing meld**
  Selecting 2 cards to lay down on an opponent's meld (e.g., 2 and 3 of spades onto a J-Q-K-A spades run) was incorrectly rejected. The lay-off logic only supported single cards. Players had to work around it by laying off one card at a time. Now 1 or more cards can be laid off together in a single action.
  _Reported by Mark. Fixed 2026-02-23._

### Open

_(none)_

## Small Enhancements

### Completed

- **Game creator deals first round**
  When a new game is created, the creator is now the dealer for round 1, so the opponent (joiner) plays first. Previously the creator went first. Subsequent rounds continue to alternate dealer as before.
  _Requested by Mark. Completed 2026-02-23._

- **Sort by suit alternates colors**
  When sorting by suit, suit groups now alternate by color: Clubs (black), Diamonds (red), Spades (black), Hearts (red). This avoids same-colored suits being adjacent, making it easier to visually distinguish groups.
  _Requested by Adeline. Completed 2026-02-23._

- **Turn notification sound**
  A short "bing" tone plays when it becomes your turn (i.e., after the opponent discards). Uses the Web Audio API — no external sound files needed. The browser's audio is unlocked on the first user interaction with the page.
  _Requested by Mark & Adeline. Completed 2026-02-23._

### Deferred

- **Change player name mid-game**
  Allow a player to change their display name after the game has already started. For now, "The soon to be winne" was manually renamed to "Adeline" directly in Firebase (game 7STARM, 2026-02-23). A user-facing rename feature is deferred until needed.
  _Requested by Adeline._

## Major Enhancements

### Completed

- **Drag-to-reorder cards in hand**
  Players can now press and drag cards left/right to rearrange their hand in any order. A tap still selects for play/discard; dragging past a small threshold picks up the card as a floating ghost with a gold drop indicator showing the target position. Works on both mouse and touch, tested with up to 23 cards.
  _Requested by Mark. Completed 2026-02-23._

### In Progress

- **Card draw animation** _(work in progress — paused 2026-02-23)_
  Animate cards when drawn from the deck so both players see the card move rather than just appear.

  **Current state:** First working draft is in local code (not yet pushed to GitHub). Basic functionality works:
  - Drawing player sees card fly from deck to center, flip to reveal the card face, then fly to their hand. Uses the existing `animateDrawnCard()` function in `app.js` (was already built but unwired) and the `#drawn-card-overlay` element + CSS in `style.css`.
  - Opponent sees a face-down card fly from the deck to the opponent's hand area. Uses new `animateOpponentDraw()` function. Detection is in the Firebase listener — triggers when `lastAction` contains "drew from the deck" and it's the opponent's action (comparing `lastActionTime` to detect new events).

  **Test game pattern:** Push a game state to Firebase with `phase: "draw"` and `currentTurn: "player1"` so Mark can click the deck. Use `TEST04` game ID with tokens `testplayer1token12345` / `testplayer2token12345`. Open two browser tabs to see both player perspectives.

  **Still to do / iterate on:**
  - Tune animation timing, speed, and feel (Mark said "good first try" — needs refinement).
  - Discard pile draw animation (not started — only deck draw is animated so far).
  - Consider edge cases: reshuffle draw animation, animation during rapid play.
  - Push to GitHub once polished.

  _Requested by Mark._

## Roadmap

Ideas for the future — not scheduled for development yet.

- **More card animations** — Extend animation to discard pile pickups, laying down melds, discarding, etc.
- **Memory Aide mode** — Cards that have appeared in the discard pile and been picked up are shown to both players as a memory aid. _From Mark._

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
    ".read": false,
    ".write": false
  }
}
```

This scopes access to only the `games/` path and blocks arbitrary top-level reads/writes. A more thorough lockdown (validating player tokens, protecting hand data from opponents) would require app-level changes and is not needed for now.

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

Local dev server: `python3 -m http.server 8080` from the project directory.

### Firebase direct edits
Player names and other fields can be patched directly:
```
curl -s -X PUT 'https://rummy2go-default-rtdb.firebaseio.com/games/GAMEID/players/player2/name.json' \
  -H 'Content-Type: application/json' -d '"NewName"'
```
