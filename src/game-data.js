import { PHASE } from './balance.js';

export function allocateGameData(b, seed = 0x71c9a31d) {
  const gd = {
    phase: PHASE.COUNTDOWN,
    winner: -1,
    mode: 0,
    time: 0,
    accumulator: 0,
    countdown: b.countdownTime,
    roundId: 0,
    rngState: seed >>> 0,
    bulletCount: 0,
    bulletDeadCount: b.maxBullets,
    shotEventMask: 0,
    hitEventMask: 0,
    reloadEventMask: 0,
    wallEventCount: 0,
    shake: 0,
    localPlayer: 0,
    snapshotClock: 0,

    gunX: new Float32Array(b.gunCount),
    gunY: new Float32Array(b.gunCount),
    gunVX: new Float32Array(b.gunCount),
    gunVY: new Float32Array(b.gunCount),
    gunAngle: new Float32Array(b.gunCount),
    gunHits: new Uint8Array(b.gunCount),
    gunAmmo: new Uint8Array(b.gunCount),
    gunReload: new Float32Array(b.gunCount),
    gunCooldown: new Float32Array(b.gunCount),
    gunInvulnerable: new Float32Array(b.gunCount),
    gunMuzzleFlash: new Float32Array(b.gunCount),
    gunHitFlash: new Float32Array(b.gunCount),
    gunShotSequence: new Uint16Array(b.gunCount),
    gunHitSequence: new Uint16Array(b.gunCount),
    fireIntent: new Uint8Array(b.gunCount),
    botThink: new Float32Array(b.gunCount),
    rematchReady: new Uint8Array(b.gunCount),

    bulletX: new Float32Array(b.maxBullets),
    bulletY: new Float32Array(b.maxBullets),
    bulletVX: new Float32Array(b.maxBullets),
    bulletVY: new Float32Array(b.maxBullets),
    bulletLife: new Float32Array(b.maxBullets),
    bulletOwner: new Uint8Array(b.maxBullets),
    bulletLive: new Uint8Array(b.maxBullets),
    bulletDead: new Uint8Array(b.maxBullets),

    replicaTargetX: new Float32Array(b.gunCount),
    replicaTargetY: new Float32Array(b.gunCount),
    replicaTargetVX: new Float32Array(b.gunCount),
    replicaTargetVY: new Float32Array(b.gunCount),
    replicaTargetAngle: new Float32Array(b.gunCount),
    replicaSeenShotSequence: new Uint16Array(b.gunCount),
    replicaSeenHitSequence: new Uint16Array(b.gunCount),
  };

  for (let i = 0; i < b.maxBullets; i++) gd.bulletDead[i] = i;
  return gd;
}
