# Plan: Hearts + death explosion (Recoil Duel)

## Context

Recoil Duel is a DOD-style HTML5 canvas game. Layers: `src/balance.js` (frozen
constants), `src/game-data.js` (typed-array state allocation), `src/logic.js`
(pure simulation, no DOM/canvas/audio/timers/network), `src/board.js` (render +
input + audio), `src/main.js` (wiring), `src/net.js` (snapshot transport).
Tests: `npm test` → `node --test tests/*.test.js`.

Today each player's damage shows as three pips in the HUD box that FILL gold as
damage accrues (`src/board.js`, `drawPlayerHud`: `hit < gd.gunHits[index] ? gold
: faint`, circles at `x + 250 + hit * 44, y 244, r 15`), with a label reading
`N / 3 DAMAGE` built in `updateHudCache` into `board.scoreText[i]`.

The player reports it is hard to follow what is happening. Two changes:
(1) replace the damage-up pips with lives-down hearts, shown BOTH in the HUD and
floating above each gun in the arena; (2) explode a gun into particles when it
dies, with smaller spark bursts on non-fatal hits.

## Global Constraints

- **DOD style is mandatory.** Fixed-size preallocated parallel `Float32Array`s,
  live/dead index pools, integer indices for identity. **No per-frame
  allocation anywhere on the render or simulation path** — no array/object
  literals, no template literals, no `.map`/`.filter` inside anything reachable
  from `renderBoard` or the tick. Constant tables go at module scope next to
  `PLAYER_COLOR` / `PLAYER_DARK` / `LOCAL_WIN_TEXT`. This constraint has already
  been violated twice in this codebase's history — treat it as the primary
  review target.
- **Particles are presentation-only.** They must NOT enter `gd`, `src/logic.js`,
  `src/game-data.js`, or `src/net.js`. Adding them to the networked snapshot for
  a purely cosmetic effect is explicitly out of bounds.
- **`src/logic.js`, `src/game-data.js`, and `src/net.js` are not to be modified
  by this plan at all.** The existing 15 tests must stay green untouched.
- Online determinism must not change: no alteration to the fixed-step tick, the
  phase machine, or snapshot contents. The end-card delay is a board-local
  timer only.
- Follow existing idiom exactly: `Object.freeze` constant tables,
  `Float32Array.of(...)` numeric rows, existing quote/semicolon style, no new
  dependencies, no build step, ES modules only.
- Never widen scope. No refactors beyond what these tasks require.

## Task 1: Particle module + tests

**Files:** `src/particles.js` (new), `src/balance.js`, `tests/particles.test.js`
(new). Do NOT touch `src/board.js` — that is Task 2.

1. Add to `src/balance.js`, inside the existing frozen `balance` object:

```js
  maxParticles: 128,
  deathParticleCount: 40,
  hitParticleCount: 8,
  particleLifeMin: 0.45,
  particleLifeRange: 0.55,
  deathParticleSpeedMin: 180,
  deathParticleSpeedRange: 520,
  hitParticleSpeedMin: 90,
  hitParticleSpeedRange: 260,
  particleDrag: 1.9,
  particleSizeMin: 3,
  particleSizeRange: 7,
  particleGravity: 220,
  endCardDelay: 0.7,
```

   Use these values verbatim.

2. Extend `validateBalance(b)` in the existing push-to-`errors` style with:
   `maxParticles` must be >= `deathParticleCount * 2` (both guns can die in the
   same frame in a mutual-kill edge case); `deathParticleCount` and
   `hitParticleCount` must be positive; `particleLifeMin` must be positive.

3. Create `src/particles.js` — pure data + transforms, NO canvas/DOM/timer
   access, importable in node. Mirror the bullet-pool idiom in
   `src/game-data.js` and `src/logic.js` exactly (live/dead index pools,
   `array + count`, swap-remove).

   Exports:

   - `allocateParticles(b, seed = 0x9e3779b9)` → pool object holding:
     `x, y, vx, vy, life, lifeMax, size` as `Float32Array(b.maxParticles)`;
     `owner` as `Uint8Array(b.maxParticles)` (0 or 1, selects the draw colour);
     `live` / `dead` as `Uint8Array(b.maxParticles)` index pools;
     `liveCount` (0), `deadCount` (`b.maxParticles`), and `rngState` (seed).
     Fill `dead[i] = i` ascending, exactly as `allocateGameData` does.
   - `spawnParticleBurst(pool, b, x, y, owner, count, speedMin, speedRange)` →
     spawns up to `count` particles at `(x, y)`. Each gets a random direction
     over the full circle, a random speed in
     `[speedMin, speedMin + speedRange)`, life in
     `[particleLifeMin, particleLifeMin + particleLifeRange)` (also stored to
     `lifeMax` for fade), and size in
     `[particleSizeMin, particleSizeMin + particleSizeRange)`. If the dead pool
     empties, stop spawning — never overflow, never grow an array. Returns the
     number actually spawned.
   - `updateParticles(pool, b, dt)` → integrates position, applies
     `particleGravity` to `vy`, applies exponential drag
     (`v *= 1 / (1 + particleDrag * dt)`, matching the damping shape used for
     guns in `logic.js` — read `moveGuns` and follow whatever form it actually
     uses), decrements `life`, and swap-removes expired particles back to the
     dead pool. Iterate the live pool backwards so swap-removal is safe.
   - `resetParticles(pool, b)` → returns every particle to the dead pool
     (`liveCount = 0`, `deadCount = maxParticles`, refill `dead`). Used on match
     start so debris never survives into the next round.

   Randomness: the pool owns its own `rngState` and uses the SAME PRNG as
   `nextRandom` in `src/logic.js` (read it and copy the algorithm, do not invent
   a different one, and do not use `Math.random` — tests must be deterministic).

4. Tests in `tests/particles.test.js`, `node:test` + `node:assert/strict`,
   matching the style of `tests/logic.test.js`:
   - allocation produces the right typed-array kinds/lengths and a full dead
     pool
   - a burst moves exactly `count` indices from dead to live, and `liveCount +
     deadCount === maxParticles` still holds
   - requesting more than the pool can hold spawns only what is available,
     returns the real count, and leaves the invariant intact (no overflow)
   - `updateParticles` moves particles, and after `particleLifeMin +
     particleLifeRange` seconds every particle has been recycled to the dead
     pool
   - repeated spawn/expire cycles (run at least 50 rounds) keep
     `liveCount + deadCount === maxParticles` and never repeat a live index
   - `resetParticles` empties the live pool
   - determinism: two pools with the same seed and the same calls produce
     identical `x`/`vx` arrays

5. `npm test` must pass — the 15 existing tests plus yours.

## Task 2: Hearts + explosion rendering

**Files:** `src/board.js`, `src/main.js` (only if wiring genuinely requires it).
`src/particles.js` is complete from Task 1 — consume it, do not modify it.

1. **Heart helper.** Add `drawHeart(ctx, x, y, size, filled, color)` near the
   other draw primitives. Draw the heart as a path (two arcs plus a point, or
   two beziers) centred on `(x, y)` and `size` wide — no image assets. `filled`
   true paints solid `color`; false paints a dim outline
   (`rgba(255,255,255,.22)` stroke, no fill) so the total pip count stays
   readable. Build the path with direct `ctx` calls; do not allocate a `Path2D`
   or any array per call.

2. **HUD hearts.** In `drawPlayerHud`, replace the pip loop with hearts at the
   same anchor (`x + 250 + i * 44`, y `244`), sized to read clearly at that
   spacing (~30px wide). Fill count is `b.hitsToWin - gd.gunHits[index]` —
   lives remaining, filled left to right — the INVERSE of today's damage-up
   pips. Use `PLAYER_COLOR[index]` for filled hearts.

3. **Lives label.** In `updateHudCache`, change `board.scoreText[i]` from
   `` `${gd.gunHits[i]} / ${b.hitsToWin} DAMAGE` `` to a lives-remaining string:
   `LAST LIFE` when exactly 1 life remains, `ELIMINATED` at 0, otherwise
   `` `${lives} LIVES` ``. Keep it inside the existing `cachedHits` guard so it
   still only rebuilds when the value changes — do not move string building onto
   the per-frame path.

4. **Arena hearts.** In `drawArena`, after the guns are drawn and BEFORE bullets
   are drawn, draw a row of smaller hearts (~20px wide, ~26px spacing, centred
   horizontally on the gun) at `gd.gunY[i] - 85` so they float above each gun and
   track it. Same fill logic as the HUD. Skip the row entirely for a gun that is
   already dead (see 5). Clamp the row's Y so it never renders above the arena's
   top edge (`b.arenaTop`) when a gun is pinned to the top wall.

5. **Dead gun vanishes.** In `drawArena`, skip drawing a gun when
   `gd.gunHits[i] >= b.hitsToWin`. Verify this reads correctly in every mode —
   `gunHits` is present in the network snapshot, so online guests get it too.

6. **Particle wiring in `board.js`:**
   - Allocate one pool in `createBoard` via `allocateParticles(b)` and store it
     on `board`. Allocate exactly once — never per frame, never per match.
   - Call `updateParticles(board.particles, b, dt)` from `updateBoard`, which
     already receives `dt`.
   - Draw live particles in `drawArena` (after the guns, with the hearts) as
     filled circles or small squares, coloured by `PLAYER_COLOR[owner]`, with
     alpha faded by `life / lifeMax`. Restore `ctx.globalAlpha` to 1 afterwards
     — a leaked alpha is the classic bug here.
   - **Triggers in `playFeedback`**, which already fires audio/haptics off
     `gd.hitEventMask` (read it before writing this — follow its existing
     event-detection pattern rather than inventing a parallel one):
     on a non-fatal hit, spawn `b.hitParticleCount` at the hit gun's position
     with the hit-speed constants; when a gun reaches `b.hitsToWin`, spawn
     `b.deathParticleCount` with the death-speed constants. Each gun's death
     must fire EXACTLY ONCE — add a board-local latch (e.g.
     `board.deathBurstDone[2]`), reset on match start. Do not rely on
     `gd.phase === PHASE.OVER` alone, which is true on every subsequent frame.
   - Call `resetParticles` on match start so debris never bleeds into the next
     round. `resetHudCache` in `src/main.js` runs on every match start and is
     the natural place, or `setBoardScreen` — pick one, and make sure the death
     latches reset on the same path.

7. **End-card delay.** Hold `drawEnd` back by `b.endCardDelay` seconds after the
   phase flips to `PHASE.OVER`, using a board-local timer ticked in
   `updateBoard`, so the explosion is visible before the card covers it. The
   arena keeps rendering during the delay. This is presentation only — do NOT
   touch the phase machine, the tick, or anything in `logic.js`. Make sure input
   during the delay cannot fire the rematch/exit hit zones before the card that
   describes them is on screen.

8. **Verify:** `npm test` green; `node --input-type=module -e
   "import('./src/board.js').then(()=>console.log('board ok'))"`; and grep the
   render path to confirm no literal/template allocation was introduced.
