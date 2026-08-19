import test from 'node:test';
import assert from 'node:assert/strict';
import { balance, difficulty, DIFFICULTY, MODE, PHASE } from '../src/balance.js';
import { allocateGameData } from '../src/game-data.js';
import * as Logic from '../src/logic.js';
import { createSnapshotPacket, fillSnapshotPacket } from '../src/net.js';
import { playerForTapY } from '../src/board.js';

function makePlaying(mode = MODE.BOT) {
  const gd = allocateGameData(balance, 12345);
  Logic.startMatch(gd, balance, mode, 1);
  gd.phase = PHASE.PLAYING;
  return gd;
}

test('allocates hot game state as fixed-size typed arrays', () => {
  const gd = allocateGameData(balance);
  assert.ok(gd.gunX instanceof Float32Array);
  assert.ok(gd.gunAmmo instanceof Uint8Array);
  assert.ok(gd.bulletLive instanceof Uint8Array);
  assert.equal(gd.bulletX.length, balance.maxBullets);
  assert.equal(gd.bulletDeadCount, balance.maxBullets);
});

test('a shot consumes ammo, spawns one pooled bullet, and applies recoil', () => {
  const gd = makePlaying();
  gd.gunAngle[0] = 0;
  Logic.queueFire(gd, 0);
  Logic.tick(gd, balance, 1 / 60);
  assert.equal(gd.gunAmmo[0], balance.magazineSize - 1);
  assert.equal(gd.bulletCount, 1);
  assert.ok(gd.gunVX[0] < 0);
  assert.equal(gd.shotEventMask & 1, 1);
});

test('an empty magazine automatically reloads after the configured delay', () => {
  const gd = makePlaying();
  for (let shot = 0; shot < balance.magazineSize; shot++) {
    gd.gunCooldown[0] = 0;
    Logic.queueFire(gd, 0);
    Logic.tick(gd, balance, 1 / 60);
  }
  assert.equal(gd.gunAmmo[0], 0);
  assert.ok(gd.gunReload[0] > 0);
  for (let i = 0; i < 110; i++) Logic.tick(gd, balance, 1 / 60);
  assert.equal(gd.gunAmmo[0], balance.magazineSize);
  assert.equal(gd.gunReload[0], 0);
});

test('gun velocity reflects at the arena wall', () => {
  const gd = makePlaying();
  gd.gunX[0] = balance.arenaLeft + balance.gunRadius + 1;
  gd.gunVX[0] = -500;
  Logic.tick(gd, balance, 1 / 60);
  assert.ok(gd.gunX[0] >= balance.arenaLeft + balance.gunRadius);
  assert.ok(gd.gunVX[0] > 0);
});

test('three bullet hits end the match for the shooter', () => {
  const gd = makePlaying(MODE.ONLINE_HOST);
  for (let hit = 0; hit < balance.hitsToWin; hit++) {
    gd.gunX[0] = 300; gd.gunY[0] = 800; gd.gunVX[0] = 0; gd.gunVY[0] = 0;
    gd.gunX[1] = 600; gd.gunY[1] = 800; gd.gunVX[1] = 0; gd.gunVY[1] = 0;
    gd.gunAngle[0] = 0; gd.gunCooldown[0] = 0; gd.gunInvulnerable[1] = 0;
    if (gd.gunAmmo[0] === 0) gd.gunAmmo[0] = balance.magazineSize;
    Logic.queueFire(gd, 0);
    for (let frame = 0; frame < 30 && gd.gunHits[1] === hit; frame++) Logic.tick(gd, balance, 1 / 120);
  }
  assert.equal(gd.gunHits[1], balance.hitsToWin);
  assert.equal(gd.phase, PHASE.OVER);
  assert.equal(gd.winner, 0);
});

test('bot fires when its rotating barrel lines up with the player', () => {
  const gd = makePlaying(MODE.BOT);
  gd.gunX[0] = 300; gd.gunY[0] = 700;
  gd.gunX[1] = 700; gd.gunY[1] = 700;
  gd.gunAngle[1] = Math.PI;
  gd.botThink[1] = 0;
  Logic.tick(gd, balance, 1 / 60);
  assert.equal(gd.gunAmmo[1], balance.magazineSize - 1);
  assert.equal(gd.bulletCount, 1);
});

test('startMatch defaults difficulty to NORMAL and stores an explicit diff', () => {
  const gd = allocateGameData(balance, 1);
  Logic.startMatch(gd, balance, MODE.BOT, 1);
  assert.equal(gd.difficulty, DIFFICULTY.NORMAL);
  Logic.startMatch(gd, balance, MODE.BOT, 2, DIFFICULTY.HARD);
  assert.equal(gd.difficulty, DIFFICULTY.HARD);
});

test('NORMAL difficulty reproduces the pre-change bot tuning constants', () => {
  assert.ok(Math.abs(difficulty.aimTolerance[DIFFICULTY.NORMAL] - 0.105) < 1e-6);
  assert.ok(Math.abs(difficulty.thinkMin[DIFFICULTY.NORMAL] - 0.22) < 1e-6);
  assert.ok(Math.abs(difficulty.thinkRange[DIFFICULTY.NORMAL] - 0.32) < 1e-6);
  assert.ok(Math.abs(difficulty.leadTime[DIFFICULTY.NORMAL] - 0.12) < 1e-6);
  assert.ok(Math.abs(difficulty.openingThink[DIFFICULTY.NORMAL] - 0.45) < 1e-6);
});

test('a rematch without an explicit diff preserves the previously selected difficulty', () => {
  const gd = allocateGameData(balance, 1);
  Logic.startMatch(gd, balance, MODE.BOT, 1, DIFFICULTY.EASY);
  assert.equal(gd.difficulty, DIFFICULTY.EASY);
  Logic.startMatch(gd, balance, MODE.BOT);
  assert.equal(gd.difficulty, DIFFICULTY.EASY);
});

test('bot difficulty controls whether a borderline aim error results in a shot', () => {
  const aimError = 0.18;
  for (const [diff, shouldFire] of [[DIFFICULTY.EASY, true], [DIFFICULTY.HARD, false]]) {
    const gd = allocateGameData(balance, 12345);
    Logic.startMatch(gd, balance, MODE.BOT, 1, diff);
    gd.phase = PHASE.PLAYING;
    gd.gunX[0] = 300; gd.gunY[0] = 700; gd.gunVX[0] = 0; gd.gunVY[0] = 0;
    gd.gunX[1] = 700; gd.gunY[1] = 700; gd.gunVX[1] = 0; gd.gunVY[1] = 0;
    gd.gunAngle[1] = Math.PI - aimError;
    gd.botThink[1] = 0;
    const ammoBefore = gd.gunAmmo[1];
    Logic.tick(gd, balance, balance.fixedStep);
    if (shouldFire) {
      assert.equal(gd.gunAmmo[1], ammoBefore - 1);
      assert.equal(gd.bulletCount, 1);
    } else {
      assert.equal(gd.gunAmmo[1], ammoBefore);
      assert.equal(gd.bulletCount, 0);
    }
  }
});

test('local mode accepts simultaneous fire intents from both players', () => {
  const gd = makePlaying(MODE.LOCAL);
  assert.ok(gd.gunY[1] < gd.gunY[0], 'P2 starts at the top and P1 at the bottom');
  Logic.queueFire(gd, 0);
  Logic.queueFire(gd, 1);
  Logic.tick(gd, balance, 1 / 60);
  assert.equal(gd.gunAmmo[0], balance.magazineSize - 1);
  assert.equal(gd.gunAmmo[1], balance.magazineSize - 1);
  assert.equal(gd.bulletCount, 2);
});

test('same-screen input maps top to P2 and bottom to P1', () => {
  assert.equal(playerForTapY(0, balance), 1);
  assert.equal(playerForTapY(balance.gameHeight / 2 - 1, balance), 1);
  assert.equal(playerForTapY(balance.gameHeight / 2, balance), 0);
  assert.equal(playerForTapY(balance.gameHeight - 1, balance), 0);
});

test('snapshot transport copies host state into replica targets and bullet pools', () => {
  const host = makePlaying(MODE.ONLINE_HOST);
  host.gunX[0] = 456; host.gunHits[1] = 2;
  Logic.queueFire(host, 0);
  Logic.tick(host, balance, 1 / 60);
  const packet = createSnapshotPacket(balance);
  fillSnapshotPacket(packet, host, balance);

  const guest = makePlaying(MODE.ONLINE_GUEST);
  guest.roundId = 0;
  Logic.applySnapshot(guest, balance, packet);
  assert.equal(guest.replicaTargetX[0], host.gunX[0]);
  assert.equal(guest.gunHits[1], 2);
  assert.equal(guest.bulletCount, host.bulletCount);
  assert.equal(guest.phase, host.phase);
});
