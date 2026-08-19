# Plan: Bot difficulty modes (Recoil Duel)

## Context

Recoil Duel is a DOD-style HTML5 canvas game. Layers: `src/balance.js` (frozen
constants), `src/game-data.js` (typed-array state allocation), `src/logic.js`
(pure simulation), `src/board.js` (render + input), `src/main.js` (wiring).
Tests: `node --test tests/*.test.js` via `npm test`.

Today the bot is a single fixed behaviour driven by four scalars in `balance`:
`botAimTolerance` (0.105), `botThinkMin` (0.22), `botThinkRange` (0.32),
`botLeadTime` (0.12). We are adding three selectable difficulty levels behind a
new menu screen.

## Global Constraints

- **DOD style is mandatory.** No per-frame allocation, no dictionaries in the
  hot path, parallel typed arrays over arrays-of-objects. Difficulty parameters
  are stored as parallel `Float32Array`s indexed by difficulty, not as an array
  of per-level objects.
- **NORMAL must reproduce today's bot exactly.** Its four values are
  `aimTolerance 0.105`, `thinkMin 0.22`, `thinkRange 0.32`, `leadTime 0.12`.
- Difficulty affects `MODE.BOT` only. `MODE.LOCAL`, `MODE.ONLINE_HOST`, and
  `MODE.ONLINE_GUEST` behaviour must be unchanged.
- Follow the existing code's idiom exactly: `Object.freeze` for constant
  tables, `Float32Array.of(...)` for numeric rows, no semicolon/style drift,
  no new dependencies, no build step, ES modules only.
- Never widen scope. No refactors beyond what these two tasks require.
- All work must keep `npm test` green.

## Task 1: Difficulty data + logic

**Files:** `src/balance.js`, `src/game-data.js`, `src/logic.js`,
`tests/logic.test.js`

1. In `src/balance.js` add, next to the existing `MODE` freeze:

```js
export const DIFFICULTY = Object.freeze({ EASY: 0, NORMAL: 1, HARD: 2 });

export const difficulty = Object.freeze({
  count: 3,
  name: ['EASY', 'NORMAL', 'HARD'],
  blurb: [
    'Sloppy aim • ignores your drift',
    'A fair duel • leads your shots',
    'Tight aim • fires the instant it can',
  ],
  aimTolerance: Float32Array.of(0.26, 0.105, 0.05),
  thinkMin: Float32Array.of(0.55, 0.22, 0.1),
  thinkRange: Float32Array.of(0.55, 0.32, 0.14),
  leadTime: Float32Array.of(0, 0.12, 0.2),
  openingThink: Float32Array.of(1.1, 0.45, 0.2),
});
```

   Use these numbers verbatim. `openingThink` replaces the hardcoded `0.45`
   first-shot delay in `startMatch`.

2. Delete `botAimTolerance`, `botThinkMin`, `botThinkRange`, and `botLeadTime`
   from the `balance` object — nothing else in the repo reads them (verify with
   grep before deleting).

3. Extend `validateBalance(b)` with a check that `difficulty.name`,
   `difficulty.blurb`, `difficulty.aimTolerance`, `difficulty.thinkMin`,
   `difficulty.thinkRange`, `difficulty.leadTime`, and `difficulty.openingThink`
   each have length `difficulty.count`; push a clear error otherwise. Keep the
   existing error-collection style.

4. In `src/game-data.js`, add a scalar field `difficulty: DIFFICULTY.NORMAL` to
   the allocated `gd` object (import `DIFFICULTY` from `./balance.js`). Place it
   with the other scalars, near `mode`.

5. In `src/logic.js`:
   - Change the signature to
     `startMatch(gd, b, mode, roundId = gd.roundId + 1, diff = gd.difficulty)`
     and set `gd.difficulty = diff` inside. The existing default keeps rematch
     and all current call sites working unchanged.
   - Replace the hardcoded opening think value: `gd.botThink[i] = i === 1 ?
     difficulty.openingThink[gd.difficulty] : 0;`
   - In `updateBot`, read `difficulty.leadTime[gd.difficulty]`,
     `difficulty.aimTolerance[gd.difficulty]`, `difficulty.thinkMin[...]`, and
     `difficulty.thinkRange[...]` in place of the four deleted `b.*` scalars.
     Hoist each into a local const once per call; do not index the arrays
     repeatedly inside a branch.
   - Import `difficulty` (and `DIFFICULTY` if needed) from `./balance.js`.

6. Tests in `tests/logic.test.js`, matching the existing `node:test` style:
   - `startMatch` defaults `gd.difficulty` to `DIFFICULTY.NORMAL`, and an
     explicit `diff` argument is stored.
   - NORMAL reproduces the pre-change constants: assert
     `difficulty.aimTolerance[DIFFICULTY.NORMAL] === 0.105` and friends via
     `assert.ok(Math.abs(x - expected) < 1e-6)` (Float32Array rounds).
   - Behavioural: place gun 1 with an aim error between HARD's tolerance and
     EASY's (e.g. ~0.18 rad), zero `botThink`, tick once in `MODE.BOT`, and
     assert the bot fires on EASY but not on HARD. Drive it through
     `Logic.tick` the way the existing tests do; keep the arena positions the
     tests already rely on.
   - A rematch (`startMatch(gd, balance, MODE.BOT)` with no `diff`) preserves
     the previously selected difficulty.

7. `npm test` must pass.

## Task 2: Difficulty screen + wiring

**Files:** `src/board.js`, `src/main.js`

1. In `src/board.js` extend the screen enum to
   `SCREEN = Object.freeze({ MENU: 0, DIFFICULTY: 1, MATCH: 2 })`. Verify every
   `SCREEN.*` comparison still reads correctly after the renumber (`board.js`
   and `main.js`); no code may depend on the old numeric values.

2. Add `board.difficulty` (default `DIFFICULTY.NORMAL`) to the `createBoard`
   state object, and an exported `setBoardDifficulty(board, diff)` setter.

3. Pointer handling in `createBoard`:
   - On `SCREEN.MENU`, the PLAY VS BOT rect (x 125–955, y 1170–1305) now calls
     `actions.openDifficulty()` instead of `actions.startBot()`. The other two
     menu buttons are unchanged.
   - Add a `SCREEN.DIFFICULTY` branch **before** the existing back-arrow /
     match branches so the difficulty screen gets its own hit testing:
     - back arrow zone (`x < 190 && y < 190`) → `actions.exitToMenu()`
     - three button rects, same geometry as the menu's three buttons
       (x 125–955, heights 135, tops 1170, 1330, 1490) → `actions.startBot(i)`
       for i = 0,1,2.

4. Add `drawDifficulty(board, b)` following `drawMenu`'s structure and visual
   language — reuse `drawBackground`, `drawBrand`, `drawButton`, `drawBack`,
   `drawToast` rather than writing new primitives. Title reads
   `CHOOSE YOUR RIVAL`. Each button uses `difficulty.name[i]` as its label and
   `difficulty.blurb[i]` as its sublabel. Give the three buttons distinct fills
   from the existing `COLOR` table (easy→blue, normal→purple `#7b4bb7`,
   hard→coralDark is a reasonable ramp). Draw a gold (`COLOR.gold`) rounded
   outline around the button matching `board.difficulty` so the current
   selection is visible. Route it from `renderBoard`.

5. In-match label: where the bot player's title is produced (`playerTitle`),
   return `` `BOT • ${difficulty.name[gd.difficulty]}` `` for index 1 when
   `board.mode === MODE.BOT`. If `playerTitle` has no access to `gd`, thread the
   difficulty through `board.difficulty` instead — do not change unrelated call
   signatures more than necessary. Verify the label still fits its HUD box at
   the existing font size; shrink the font for this label only if it does not.

6. In `src/main.js`:
   - Load the remembered difficulty at startup and persist on change, keyed
     `recoilDuelDifficulty`. Wrap both `localStorage` calls in try/catch — the
     Play SDK sandbox may block storage — and clamp the parsed value to
     `0..difficulty.count - 1`, falling back to `DIFFICULTY.NORMAL`.
   - `startBot(diff = <remembered>)` stores + persists the difficulty, passes it
     to `Logic.startMatch`, and calls `setBoardScreen(board, SCREEN.MATCH, ...)`
     as it does today.
   - Add `openDifficulty()` → `setBoardScreen(board, SCREEN.DIFFICULTY)` and
     `exitToMenu()` → `setBoardScreen(board, SCREEN.MENU)`; register both in the
     `actions` object.
   - Apply the remembered difficulty to the initial `Logic.startMatch` call and
     to `board.difficulty` at boot.
   - `SDK?.screenshotMode` still calls `startBot()` — confirm it goes straight
     into a match, not to the difficulty screen.

7. `npm test` must pass. Also verify the module graph loads without error
   (e.g. `node --input-type=module -e "import('./src/board.js')"`).
