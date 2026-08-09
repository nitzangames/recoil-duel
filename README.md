# Recoil Duel

A one-tap, two-player arena game for nitzan.games. Each gun rotates continuously;
firing launches a bullet and kicks the gun backward. Five shots trigger a timed
reload, and the first player to land three hits wins.

## Run locally

```bash
npm start
```

Open `http://localhost:4173`. Online rooms require the nitzan.games PlaySDK; bot
matches work entirely offline.

```bash
npm test
```

## Architecture

The simulation follows data-oriented design:

- `src/balance.js` contains immutable tuning data.
- `src/game-data.js` allocates all mutable gameplay state in fixed-size parallel
  TypedArrays. Guns and bullets are integer indices; bullet slots use live/dead
  index pools.
- `src/logic.js` is the only gameplay-state mutation layer. Its fixed-step tick
  has no DOM, canvas, audio, timers, or network access.
- `src/board.js` owns canvas presentation, input, audio, and haptic feedback.
- `src/main.js` owns the single animation loop and scene/platform lifecycle.
- `src/net.js` adapts PlaySDK rooms and reuses preallocated snapshot packets.

Online matches are host-authoritative. The host simulates both players and sends
24 Hz snapshots; the guest interpolates replica state and sends compact fire
intents. Rematches begin once both players opt in.

`thumbnail-options.html` presents four visual directions. Option D is exported as
the current 512×512 `thumbnail.png`.
