# Rummy Scoring App — Design Document

## Overview

A lightweight scoring app for tracking Rummy game scores when playing in-person ("IRL") with physical cards. Designed for Mark and Adeline, with architecture that supports expanding to additional family members later.

## Requirements

### Core
- Record scores quickly and easily at the end of each round from an iPhone
- Works offline (no internet required during a game)
- Syncs to the cloud immediately when connected
- Works on both Mark's and Adeline's iPhones, with shared data
- Minimal friction to install and use

### Data
- Track per-round scores for each player
- Track cumulative totals across rounds within a session (one sitting of multiple rounds)
- Record timestamps for every entry
- Record location (lat/lon, city) when available, for nostalgia and debugging
- Distinguish manually-entered scores from those auto-synced from the Rummy2go web game
- Store enough metadata to reconstruct the full history later

### Future (architectural consideration, not exposed yet)
- Additional players beyond two
- Auto-sync scores from the Rummy2go web game at end of round (with user prompt)
- Full history view in the Rummy2go web app, pulling from the shared scoring database

## Technical Approach: Progressive Web App (PWA)

### Why PWA over native iOS?

| Option | Friction | Offline | Cost | Maintenance |
|--------|----------|---------|------|-------------|
| **PWA** | Open URL → Add to Home Screen | Service Worker | Free | Same web tech |
| Native iOS (Swift) | Xcode + Apple Dev License + TestFlight | Built-in | $99/year | Swift + separate codebase |
| React Native / Capacitor | Build toolchain + Apple Dev License | Possible | $99/year | JS but native wrapper |

**PWA wins** for this use case:
- No Apple Developer license needed
- No app store review or TestFlight distribution
- Same tech stack as the existing Rummy2go web app (HTML/CSS/JS + Firebase)
- "Add to Home Screen" on iPhone gives a full-screen app experience with an icon
- Service Worker provides offline caching of the app shell
- Firebase Realtime Database has built-in offline persistence (reads/writes work offline, sync when back online)
- Both users just visit the same URL and add to home screen

### Limitations of PWA on iOS
- No push notifications (iOS PWAs have limited notification support)
- No background sync (sync happens when app is open and online)
- These limitations are acceptable for a manual scoring app

## Architecture

### Shared Firebase Backend

Uses the existing Firebase project (`rummy2go`) with a new top-level path:

```
/scoring/
  sessions/
    {sessionId}/
      ...session data...
```

This is separate from `/games/` (the web game) but in the same Firebase project, enabling future cross-referencing.

### Data Schema

#### Session

A "session" is one sitting — one or more rounds of Rummy played together.

```
/scoring/sessions/{sessionId}
  createdAt: timestamp
  updatedAt: timestamp
  source: "manual" | "web-game"         // how this session was created
  webGameId: string | null               // if source is "web-game", the game ID
  location: {
    lat: number,
    lon: number,
    city: string,                        // reverse-geocoded if possible
    raw: string                          // raw position string for debugging
  } | null
  players: {
    {playerId}: {
      name: string,
      order: number                      // seating/display order
    }
  }
  rounds: [
    {
      round: number,
      timestamp: timestamp,
      scores: {
        {playerId}: number               // net score for this round
      },
      location: { ... } | null           // per-round location if it changed
      source: "manual" | "web-game"
    }
  ]
  totals: {
    {playerId}: number                   // running total (sum of all rounds)
  }
```

#### Player Registry (future-proofing)

```
/scoring/players/{playerId}
  name: string
  createdAt: timestamp
```

For now, just two players with well-known IDs (e.g., `mark`, `adeline`). The registry allows adding family members later without changing the session schema.

### Compatibility with Rummy2go Web Game

The existing web game stores scores as:
```
/games/{gameId}/scoreHistory: [{ round, player1, player2 }]
/games/{gameId}/players/player1/score: total
```

The scoring app uses a richer schema under `/scoring/sessions/`. To bridge:
- When the web game ends a round (future enhancement), it can prompt "Save to scoring history?" and write a corresponding entry under `/scoring/sessions/`.
- The `source` field distinguishes manual vs. web-game entries.
- The `webGameId` field links back to the original game for reference.

## App Structure

```
scoring-app/
  index.html          — single-page app shell
  app.js              — app logic, Firebase sync, offline handling
  style.css           — mobile-first UI styling
  sw.js               — service worker for offline caching
  manifest.json       — PWA manifest (name, icon, theme)
  design.md           — this file
```

## UI Design

### Screens

1. **Score Entry** (primary screen)
   - Shows current session (or prompts to start one)
   - Large, thumb-friendly score input for each player
   - "Save Round" button
   - Running totals visible at all times

2. **Session History**
   - List of past sessions with date, location, final scores
   - Tap to expand and see round-by-round detail

3. **New Session**
   - Select players (Mark + Adeline pre-selected)
   - Confirms and starts tracking

### UX Priorities
- Optimized for one-handed iPhone use
- Large tap targets, minimal typing (numeric keypad for scores)
- One tap to start a new session, two taps to record a round score
- Offline indicator when disconnected
- Sync indicator when data is being pushed

## Installation Flow

### For Mark
1. Host the PWA (GitHub Pages, Firebase Hosting, or any static host)
2. Open the URL in Safari on iPhone
3. Tap Share → "Add to Home Screen"
4. App appears as an icon, launches full-screen

### For Adeline
Same steps. Both see the same shared data via Firebase.

## Offline Strategy

1. **Service Worker**: Caches all app files (HTML, CSS, JS, icons) for offline launch
2. **Firebase Offline Persistence**: `firebase.database().ref().keepSynced(true)` — Firebase SDK caches data locally and queues writes when offline, syncing automatically when connectivity returns
3. **No special conflict resolution needed**: rounds are append-only, and only one person enters scores at a time in practice

## Geolocation

- Request location permission on session start (not on every round)
- Use `navigator.geolocation.getCurrentPosition()` with a timeout
- Optionally reverse-geocode to a city name using a free API (or store raw lat/lon and resolve later)
- Gracefully degrade if permission denied — location is nice-to-have, not required
- Store on the session and optionally per-round if location changes

## Open Questions

- Hosting: GitHub Pages (free, simple) vs. Firebase Hosting (custom domain, HTTPS built-in)?
- Icon: reuse the card back image from rummy-project, or create something distinct?
- Do we want a "quick score" mode where you just enter two numbers and tap save, vs. a more structured flow?
