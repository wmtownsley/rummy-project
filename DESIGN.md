# Rummy Card Game — Design Notes

## Overview

A two-player Rummy card game for Mark and his wife to play while he's traveling.
Playable on iPhones and Mac computers via web browser.

## Decision: Option A — Web App + PeerJS (WebRTC Peer-to-Peer)

### Why This Approach
- **No server required** for gameplay — direct peer-to-peer connection
- Works on iPhone Safari and Mac browsers immediately
- Can be hosted for free as a static site (no backend to maintain)
- Fallback to Firebase (Option B) is easy if WebRTC proves flaky

### How It Works
- Single-page web app (HTML + CSS + JS), no build step
- Uses [PeerJS](https://peerjs.com/) for WebRTC peer-to-peer communication
- PeerJS provides a free signaling server (used only for initial connection, not gameplay)
- One player creates a game → gets a short code
- Other player enters the code → direct P2P connection established
- All game state communicated directly between the two browsers

### Fallback: Option B — Firebase Realtime Database
- If WebRTC connectivity is problematic on certain networks
- Firebase free tier (Spark): 1 GB storage, 10 GB/month transfer — more than enough
- Same game logic, just swap the transport layer (~30 min refactor)

## Distribution Plan

- **Host on GitHub Pages** (free)
- Push static files to a GitHub repo, enable GitHub Pages in settings
- Accessible at `https://<username>.github.io/rummy-project/`
- On iPhones: open in Safari → "Add to Home Screen" → looks/feels like a native app (PWA)
- On Macs: open in any browser (can also install as PWA in Chrome/Edge)
- Updates: just push to GitHub, next visit picks up changes

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

### Design Philosophy
- **Don't over-automate** — this is a virtual card table, not a rule engine
- Players decide among themselves when the game is over
- Keep the experience focused on the feel of playing cards together
- Rules will be provided later by Mark for any specific enforcement needed

## Architecture (Planned)

```
Single Page App
├── index.html          — Main page, PWA manifest
├── style.css           — Card visuals, layout, responsive design
├── game.js             — Game logic (deck, shuffle, deal, discard, melds, scoring)
├── network.js          — PeerJS networking layer (easy to swap for Firebase)
├── ui.js               — DOM manipulation, card interactions, animations
└── assets/             — Card images or CSS-drawn cards, icons
```

### Key UI Elements
- Your hand (private, bottom of screen)
- Opponent's hand (face-down cards, top of screen)
- Draw pile (center, face down)
- Discard pile (center, face up, top card visible)
- Laid-down melds area (visible to both players)
- Score display
- Connection UI (create game / join game with code)

### Networking Model
- Thin message-passing layer over PeerJS data channel
- Messages like: `{ type: "draw", source: "deck" }`, `{ type: "discard", card: "7H" }`, `{ type: "meld", cards: ["7H","7D","7S"] }`
- Game state reconciled between peers (host is source of truth for deck order)

## Status

- [x] Chose approach (Option A: PeerJS/WebRTC)
- [x] Chose distribution method (GitHub Pages + PWA)
- [ ] Mark to provide specific Rummy rules they play by
- [ ] Build the app
- [ ] Set up GitHub repo and Pages
- [ ] Test on iPhone and Mac
