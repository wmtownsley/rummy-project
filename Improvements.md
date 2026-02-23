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

### Open

- **Change player name mid-game**
  Allow a player to change their display name after the game has already started.
  _Requested by Adeline._

## Major Enhancements

### Completed

- **Drag-to-reorder cards in hand**
  Players can now press and drag cards left/right to rearrange their hand in any order. A tap still selects for play/discard; dragging past a small threshold picks up the card as a floating ghost with a gold drop indicator showing the target position. Works on both mouse and touch, tested with up to 23 cards.
  _Requested by Mark. Completed 2026-02-23._

### Open

_(none)_

## Roadmap

Ideas for the future — not scheduled for development yet.

- **Card animation** — When drawing, animate the card flying into the player's hand (visible to both players) instead of it just appearing.
- **Memory Aide mode** — Cards that have appeared in the discard pile and been picked up are shown to both players as a memory aid. _From Mark._
