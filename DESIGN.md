# Rummy Card Game — Design Notes

## Overview

A two-player Rummy card game for Mark and his wife to play while he's traveling.
Playable on iPhones and Mac computers via web browser.

## Key Requirement: Asynchronous + Real-Time Play

- Players do NOT need to be online at the same time
- If both are online, gameplay feels real-time with low latency
- If one player is offline, moves are queued and visible when they return
- Always clear whose turn it is

## Decision: Web App + Firebase Realtime Database

### Why Firebase (changed from original PeerJS plan)
- **Async play requires persistence** — PeerJS/WebRTC can't store moves when the peer is offline
- Firebase Realtime Database handles both modes natively:
  - Both online → updates in milliseconds, feels real-time
  - One offline → state persists, visible when they open the app
- Firebase free tier (Spark): 1 GB stored, 10 GB/month transfer — free forever for a card game
- Simpler code than PeerJS (just read/write JSON, Firebase handles sync)
- No server to maintain — it's a managed service

### What's Needed
- A Google account (free)
- Create a Firebase project (5 minutes, one-time setup)
- Firebase JS SDK loaded from CDN (no build step needed)

## Distribution Plan

- **Host on GitHub Pages** (free)
- Push static files to GitHub repo, enable GitHub Pages in settings
- Accessible at `https://wmtownsley.github.io/rummy-project/`
- On iPhones: open in Safari → "Add to Home Screen" → looks/feels like a native app (PWA)
- On Macs: open in any browser (can also install as PWA in Chrome/Edge)
- Updates: just push to GitHub, next visit picks up changes
- **Repo is private** until ready to share

## Game Requirements

See `rummy_rules.md` for full rules. Key points for game design:

### Players
- 2 players only (no need to architect for more)

### Core Mechanics
- Standard 52-card deck (no jokers)
- Aces are high AND low — wrap-around runs valid (e.g., Q-K-A-2-3)
- Deal 7 cards to each player at start of each hand
- **Private hands** — each player sees only their own cards
- **Shared discard pile** — both players can see ALL cards (critical, see UI below)
- **Draw pile** — face down, shared

### Point Values
- Ace = 15 points
- 2–9 = 5 points each
- 10, J, Q, K = 10 points each

### Turn Structure
- Clear indication of whose turn it is
- **Draw phase:** Draw from deck (1 card) OR from discard pile (1 or more cards)
  - Multi-card discard pickup: take from top down to any card in the pile
  - The deepest card taken MUST be played in a meld/lay off that turn
- **Play phase:** Optionally lay down melds, optionally lay off on any table meld
- **Discard phase:** Discard one card to end turn (optional ONLY when going out)
- If opponent is offline, your move is stored and they see the updated board when they return

### Going Out
- A player goes out when they have no cards left
- Discarding is optional when going out
- Ends the round

### Scoring
- Cards in melds = positive points for that player
- Cards left in hand = negative points
- Running tally across rounds: per-player +/- scores, running total, delta

### Design Philosophy
- **Don't over-automate** — this is a virtual card table, not a rule engine
- Players decide among themselves when the game is over
- Keep the experience focused on the feel of playing cards together

## Architecture (Planned)

```
Single Page App (no build step)
├── index.html          — Main page, PWA manifest, Firebase config
├── style.css           — Card visuals, layout, responsive design
├── game.js             — Game logic (deck, shuffle, deal, discard, melds, scoring)
├── firebase-sync.js    — Firebase Realtime DB: read/write game state, presence
├── ui.js               — DOM manipulation, card interactions, animations
└── manifest.json       — PWA manifest for "Add to Home Screen"
```

### Firebase Data Model

```json
{
  "games": {
    "<gameId>": {
      "deck": ["3H", "KS", ...],           // remaining draw pile (encrypted/hidden)
      "discard": ["7H", "5D", ...],         // discard pile (visible to both)
      "players": {
        "player1": {
          "name": "Mark",
          "hand": ["AS", "KH", ...],        // private — only shown to this player
          "melds": [["7H","7D","7S"], ...],  // laid down cards (visible to both)
          "score": 0
        },
        "player2": {
          "name": "Wife",
          "hand": [...],
          "melds": [...],
          "score": 0
        }
      },
      "currentTurn": "player1",
      "phase": "draw",                      // "draw", "play", "discard"
      "lastAction": "Mark drew from deck",
      "lastActionTime": 1707350000000,
      "presence": {
        "player1": { "online": true, "lastSeen": 1707350000000 },
        "player2": { "online": false, "lastSeen": 1707340000000 }
      }
    }
  }
}
```

### Security Note
- Firebase Security Rules will ensure each player can only read their own hand
- Deck order is stored server-side, not visible to either player until drawn
- No cheating possible — you can't see the other player's hand or the deck order

### Key UI Elements
- Your hand (private, bottom of screen)
- Opponent's hand (face-down cards, top of screen)
- Draw pile (center, face down) with card count
- **Discard pile (cascaded fan — see below)**
- Laid-down melds area (visible to both players)
- Score display / running tally
- Turn indicator (whose turn + what phase: draw/play/discard)
- Online/offline presence indicator for opponent
- Last action description ("Mark drew from the discard pile")

### Discard Pile — Critical UI Design
The discard pile must show ALL cards, not just the top card, because players
can pick up multiple cards down to any depth.

**Design: Vertical cascaded fan**
- Cards overlap vertically, each offset ~25px to show rank + suit in corner
- Most recent discard on top, oldest at bottom
- When pile gets deep (15-20 cards), the area becomes scrollable
- During draw phase, tapping any card in the discard pile picks up that card
  and everything above it
- Visual highlight on hover/tap to show which cards you'd be picking up
- The deepest card in the selection is highlighted differently (must be played)

### Card Images
- Using SVG-cards by David Bellot / htdebeer (LGPL-2.1)
- 2x retina PNG files for crisp display on iPhone
- 52 cards + red card back in `cards/` directory
- Naming: `{suit}_{rank}.png` — e.g., `heart_1.png`, `spade_queen.png`

## Firebase Setup (Completed)

- **Project name:** Rummy2go
- **Plan:** Spark (free)
- **Realtime Database URL:** https://rummy2go-default-rtdb.firebaseio.com
- **Web app registered:** rummy-web
- **Config saved to:** `firebase-config.js`
- **GitHub account:** wmtownsley
- **GitHub repo:** wmtownsley/rummy-project (private)

## Status

- [x] Chose approach (Firebase Realtime Database — supports async + real-time)
- [x] Chose distribution method (GitHub Pages + PWA)
- [x] Created private GitHub repo (wmtownsley/rummy-project)
- [x] Set up Firebase project (Rummy2go, Spark plan)
- [x] Created Realtime Database (us-central1)
- [x] Registered web app and saved config
- [x] Rummy rules defined (see rummy_rules.md)
- [x] Card images added (SVG-cards 2x PNGs, LGPL-2.1)
- [x] Built the app (v1 — full game loop)
  - Lobby: create game, join with code, resume saved games
  - Game: draw, meld, lay off, discard, go out, scoring
  - Discard pile: cascaded fan, multi-card pickup
  - Scoreboard: round-by-round tally, running totals, delta
  - Two-tab testing: token-in-URL player identity
  - PWA: manifest + meta tags for Add to Home Screen
- [ ] Enable GitHub Pages
- [ ] Test on iPhone and Mac
- [ ] Add Firebase security rules (hands/deck privacy)
