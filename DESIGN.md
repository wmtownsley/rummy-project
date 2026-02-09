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

### Players
- 2 players only (no need to architect for more)

### Core Mechanics
- Standard 52-card deck
- Random shuffling
- Deal 7 cards to each player at start of each hand
- **Private hands** — each player sees only their own cards
- **Shared discard pile** — both players can see
- **Draw pile** — face down, shared
- Players can lay down cards (melds) during their turn → positive points
- Cards remaining in hand when someone goes out → negative points

### Turn Structure
- Clear indication of whose turn it is
- On your turn: draw a card (from deck or discard pile), optionally lay down melds, discard one card
- Turn passes to the other player
- If opponent is offline, your move is stored and they see the updated board when they return

### Design Philosophy
- **Don't over-automate** — this is a virtual card table, not a rule engine
- Players decide among themselves when the game is over
- Keep the experience focused on the feel of playing cards together
- Rules will be provided later by Mark for any specific enforcement needed

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
- Discard pile (center, face up, top card visible)
- Laid-down melds area (visible to both players)
- Score display
- Turn indicator (whose turn + what phase: draw/play/discard)
- Online/offline presence indicator for opponent
- Last action description ("Mark drew from the discard pile")

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
- [ ] Mark to provide specific Rummy rules they play by
- [ ] Build the app
- [ ] Enable GitHub Pages
- [ ] Test on iPhone and Mac
