import { MODE, PHASE, TAU } from './balance.js';

const EPSILON = 0.0001;

export function startMatch(gd, b, mode, roundId = gd.roundId + 1) {
  gd.phase = PHASE.COUNTDOWN;
  gd.winner = -1;
  gd.mode = mode;
  gd.time = 0;
  gd.accumulator = 0;
  gd.countdown = b.countdownTime;
  gd.roundId = roundId;
  gd.bulletCount = 0;
  gd.bulletDeadCount = b.maxBullets;
  gd.shotEventMask = 0;
  gd.hitEventMask = 0;
  gd.reloadEventMask = 0;
  gd.wallEventCount = 0;
  gd.shake = 0;
  gd.snapshotClock = 0;

  for (let i = 0; i < b.maxBullets; i++) gd.bulletDead[i] = i;

  const cy = b.arenaTop + b.arenaSize * 0.5;
  if (mode === MODE.LOCAL) {
    gd.gunX[0] = b.arenaLeft + b.arenaSize * 0.38;
    gd.gunY[0] = cy + b.arenaSize * 0.22;
    gd.gunX[1] = b.arenaLeft + b.arenaSize * 0.62;
    gd.gunY[1] = cy - b.arenaSize * 0.22;
    gd.gunAngle[0] = -Math.PI * 0.5;
    gd.gunAngle[1] = Math.PI * 0.5;
  } else {
    gd.gunX[0] = b.arenaLeft + b.arenaSize * 0.27;
    gd.gunY[0] = cy - 100;
    gd.gunX[1] = b.arenaLeft + b.arenaSize * 0.73;
    gd.gunY[1] = cy + 100;
    gd.gunAngle[0] = 0;
    gd.gunAngle[1] = Math.PI;
  }

  for (let i = 0; i < b.gunCount; i++) {
    gd.gunVX[i] = 0;
    gd.gunVY[i] = 0;
    gd.gunHits[i] = 0;
    gd.gunAmmo[i] = b.magazineSize;
    gd.gunReload[i] = 0;
    gd.gunCooldown[i] = 0;
    gd.gunInvulnerable[i] = 0;
    gd.gunMuzzleFlash[i] = 0;
    gd.gunHitFlash[i] = 0;
    gd.gunShotSequence[i] = 0;
    gd.gunHitSequence[i] = 0;
    gd.fireIntent[i] = 0;
    gd.botThink[i] = i === 1 ? 0.45 : 0;
    gd.rematchReady[i] = 0;
    gd.replicaTargetX[i] = gd.gunX[i];
    gd.replicaTargetY[i] = gd.gunY[i];
    gd.replicaTargetVX[i] = 0;
    gd.replicaTargetVY[i] = 0;
    gd.replicaTargetAngle[i] = gd.gunAngle[i];
  }
}

export function queueFire(gd, playerIndex) {
  gd.fireIntent[playerIndex] = 1;
}

export function setRematchReady(gd, playerIndex) {
  gd.rematchReady[playerIndex] = 1;
}

function nextRandom(gd) {
  let x = gd.rngState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  gd.rngState = x >>> 0;
  return gd.rngState / 4294967296;
}

function wrapAngle(angle) {
  let a = angle % TAU;
  if (a < 0) a += TAU;
  return a;
}

function signedAngleDifference(a, b) {
  let d = a - b;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function updateTimers(gd, b, dt) {
  for (let i = 0; i < b.gunCount; i++) {
    if (gd.gunCooldown[i] > 0) gd.gunCooldown[i] -= dt;
    if (gd.gunInvulnerable[i] > 0) gd.gunInvulnerable[i] -= dt;
    if (gd.gunMuzzleFlash[i] > 0) gd.gunMuzzleFlash[i] -= dt;
    if (gd.gunHitFlash[i] > 0) gd.gunHitFlash[i] -= dt;

    if (gd.gunAmmo[i] === 0) {
      gd.gunReload[i] -= dt;
      if (gd.gunReload[i] <= 0) {
        gd.gunReload[i] = 0;
        gd.gunAmmo[i] = b.magazineSize;
        gd.reloadEventMask |= 1 << i;
      }
    }
  }
  if (gd.shake > 0) {
    gd.shake -= dt * 2.9;
    if (gd.shake < 0) gd.shake = 0;
  }
}

function updateBot(gd, b, dt) {
  const bot = 1;
  gd.botThink[bot] -= dt;
  if (gd.botThink[bot] <= 0 && gd.gunAmmo[bot] > 0) {
    const targetX = gd.gunX[0] + gd.gunVX[0] * b.botLeadTime;
    const targetY = gd.gunY[0] + gd.gunVY[0] * b.botLeadTime;
    const desired = Math.atan2(targetY - gd.gunY[bot], targetX - gd.gunX[bot]);
    const delta = signedAngleDifference(gd.gunAngle[bot], desired);
    if (Math.abs(delta) <= b.botAimTolerance) {
      gd.fireIntent[bot] = 1;
      gd.botThink[bot] = b.botThinkMin + nextRandom(gd) * b.botThinkRange;
    }
  }
}

function spawnBullet(gd, b, owner) {
  if (gd.bulletDeadCount === 0) return;
  const slot = gd.bulletDead[--gd.bulletDeadCount];
  gd.bulletLive[gd.bulletCount++] = slot;
  const angle = gd.gunAngle[owner];
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const muzzle = b.gunBarrelLength + b.bulletRadius + 5;
  gd.bulletX[slot] = gd.gunX[owner] + dx * muzzle;
  gd.bulletY[slot] = gd.gunY[owner] + dy * muzzle;
  gd.bulletVX[slot] = dx * b.bulletSpeed + gd.gunVX[owner] * 0.2;
  gd.bulletVY[slot] = dy * b.bulletSpeed + gd.gunVY[owner] * 0.2;
  gd.bulletLife[slot] = b.bulletLife;
  gd.bulletOwner[slot] = owner;

  gd.gunVX[owner] -= dx * b.recoilSpeed;
  gd.gunVY[owner] -= dy * b.recoilSpeed;
  gd.gunAmmo[owner]--;
  gd.gunCooldown[owner] = b.fireCooldown;
  gd.gunMuzzleFlash[owner] = b.muzzleFlashTime;
  gd.gunShotSequence[owner]++;
  gd.shotEventMask |= 1 << owner;
  if (gd.gunAmmo[owner] === 0) gd.gunReload[owner] = b.reloadTime;
}

function consumeFireIntents(gd, b) {
  for (let i = 0; i < b.gunCount; i++) {
    if (gd.fireIntent[i] !== 0 && gd.gunCooldown[i] <= 0 && gd.gunAmmo[i] > 0) {
      spawnBullet(gd, b, i);
    }
    gd.fireIntent[i] = 0;
  }
}

function clampSpeed(gd, b, i) {
  const speedSq = gd.gunVX[i] * gd.gunVX[i] + gd.gunVY[i] * gd.gunVY[i];
  const maxSq = b.gunMaxSpeed * b.gunMaxSpeed;
  if (speedSq > maxSq) {
    const scale = b.gunMaxSpeed / Math.sqrt(speedSq);
    gd.gunVX[i] *= scale;
    gd.gunVY[i] *= scale;
  }
}

function moveGuns(gd, b, dt) {
  const minX = b.arenaLeft + b.gunRadius;
  const maxX = b.arenaLeft + b.arenaSize - b.gunRadius;
  const minY = b.arenaTop + b.gunRadius;
  const maxY = b.arenaTop + b.arenaSize - b.gunRadius;
  const damping = Math.exp(-b.gunLinearDrag * dt);

  for (let i = 0; i < b.gunCount; i++) {
    gd.gunAngle[i] = wrapAngle(gd.gunAngle[i] + b.gunRotationSpeed * dt);
    gd.gunVX[i] *= damping;
    gd.gunVY[i] *= damping;
    clampSpeed(gd, b, i);
    gd.gunX[i] += gd.gunVX[i] * dt;
    gd.gunY[i] += gd.gunVY[i] * dt;

    if (gd.gunX[i] < minX) {
      gd.gunX[i] = minX;
      gd.gunVX[i] = Math.abs(gd.gunVX[i]) * b.gunWallRestitution;
      gd.wallEventCount++;
    } else if (gd.gunX[i] > maxX) {
      gd.gunX[i] = maxX;
      gd.gunVX[i] = -Math.abs(gd.gunVX[i]) * b.gunWallRestitution;
      gd.wallEventCount++;
    }
    if (gd.gunY[i] < minY) {
      gd.gunY[i] = minY;
      gd.gunVY[i] = Math.abs(gd.gunVY[i]) * b.gunWallRestitution;
      gd.wallEventCount++;
    } else if (gd.gunY[i] > maxY) {
      gd.gunY[i] = maxY;
      gd.gunVY[i] = -Math.abs(gd.gunVY[i]) * b.gunWallRestitution;
      gd.wallEventCount++;
    }
  }
}

function collideGuns(gd, b) {
  let dx = gd.gunX[1] - gd.gunX[0];
  let dy = gd.gunY[1] - gd.gunY[0];
  let distSq = dx * dx + dy * dy;
  const diameter = b.gunRadius * 2;
  if (distSq < diameter * diameter) {
    if (distSq < EPSILON) {
      dx = 1;
      dy = 0;
      distSq = 1;
    }
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = diameter - dist;
    gd.gunX[0] -= nx * overlap * 0.5;
    gd.gunY[0] -= ny * overlap * 0.5;
    gd.gunX[1] += nx * overlap * 0.5;
    gd.gunY[1] += ny * overlap * 0.5;

    const relative = (gd.gunVX[1] - gd.gunVX[0]) * nx + (gd.gunVY[1] - gd.gunVY[0]) * ny;
    if (relative < 0) {
      const impulse = -(1 + b.gunCollisionRestitution) * relative * 0.5;
      gd.gunVX[0] -= impulse * nx;
      gd.gunVY[0] -= impulse * ny;
      gd.gunVX[1] += impulse * nx;
      gd.gunVY[1] += impulse * ny;
      gd.wallEventCount++;
    }
  }
}

function removeBulletAtLiveIndex(gd, liveIndex) {
  const slot = gd.bulletLive[liveIndex];
  gd.bulletDead[gd.bulletDeadCount++] = slot;
  gd.bulletCount--;
  gd.bulletLive[liveIndex] = gd.bulletLive[gd.bulletCount];
}

function moveBulletsAndHit(gd, b, dt) {
  const minX = b.arenaLeft + b.bulletRadius;
  const maxX = b.arenaLeft + b.arenaSize - b.bulletRadius;
  const minY = b.arenaTop + b.bulletRadius;
  const maxY = b.arenaTop + b.arenaSize - b.bulletRadius;
  const hitRadius = b.gunRadius + b.bulletRadius;
  const hitRadiusSq = hitRadius * hitRadius;

  let liveIndex = 0;
  while (liveIndex < gd.bulletCount) {
    const slot = gd.bulletLive[liveIndex];
    gd.bulletX[slot] += gd.bulletVX[slot] * dt;
    gd.bulletY[slot] += gd.bulletVY[slot] * dt;
    gd.bulletLife[slot] -= dt;

    let remove = gd.bulletLife[slot] <= 0;
    if (!remove && (gd.bulletX[slot] < minX || gd.bulletX[slot] > maxX || gd.bulletY[slot] < minY || gd.bulletY[slot] > maxY)) {
      remove = true;
      gd.wallEventCount++;
    }

    const target = gd.bulletOwner[slot] ^ 1;
    if (!remove && gd.phase === PHASE.PLAYING && gd.gunInvulnerable[target] <= 0) {
      const dx = gd.bulletX[slot] - gd.gunX[target];
      const dy = gd.bulletY[slot] - gd.gunY[target];
      if (dx * dx + dy * dy <= hitRadiusSq) {
        remove = true;
        gd.gunHits[target]++;
        gd.gunInvulnerable[target] = b.hitInvulnerability;
        gd.gunHitFlash[target] = b.hitFlashTime;
        gd.gunHitSequence[target]++;
        gd.gunVX[target] += gd.bulletVX[slot] / b.bulletSpeed * b.hitKnockback;
        gd.gunVY[target] += gd.bulletVY[slot] / b.bulletSpeed * b.hitKnockback;
        gd.hitEventMask |= 1 << target;
        gd.shake = 1;
        if (gd.gunHits[target] >= b.hitsToWin) {
          gd.phase = PHASE.OVER;
          gd.winner = gd.bulletOwner[slot];
        }
      }
    }

    if (remove) removeBulletAtLiveIndex(gd, liveIndex);
    else liveIndex++;
  }
}

function fixedStep(gd, b, dt) {
  updateTimers(gd, b, dt);
  if (gd.mode === MODE.BOT) updateBot(gd, b, dt);
  consumeFireIntents(gd, b);
  moveGuns(gd, b, dt);
  collideGuns(gd, b);
  moveBulletsAndHit(gd, b, dt);
}

export function tick(gd, b, dt) {
  gd.shotEventMask = 0;
  gd.hitEventMask = 0;
  gd.reloadEventMask = 0;
  gd.wallEventCount = 0;
  gd.time += dt;

  if (gd.phase === PHASE.COUNTDOWN) {
    gd.countdown -= dt;
    for (let i = 0; i < b.gunCount; i++) {
      gd.gunAngle[i] = wrapAngle(gd.gunAngle[i] + b.gunRotationSpeed * dt);
      gd.fireIntent[i] = 0;
    }
    if (gd.countdown <= 0) {
      gd.countdown = 0;
      gd.phase = PHASE.PLAYING;
    }
  } else if (gd.phase === PHASE.PLAYING) {
    gd.accumulator += dt;
    let steps = 0;
    while (gd.accumulator >= b.fixedStep && steps < b.maxSubSteps && gd.phase === PHASE.PLAYING) {
      fixedStep(gd, b, b.fixedStep);
      gd.accumulator -= b.fixedStep;
      steps++;
    }
    if (steps === b.maxSubSteps) gd.accumulator = 0;
  } else {
    updateTimers(gd, b, dt);
    for (let i = 0; i < b.gunCount; i++) gd.fireIntent[i] = 0;
  }
}

export function tickReplica(gd, b, dt) {
  gd.time += dt;
  gd.shotEventMask = 0;
  gd.hitEventMask = 0;
  gd.reloadEventMask = 0;
  gd.wallEventCount = 0;
  const blend = 1 - Math.exp(-18 * dt);
  for (let i = 0; i < b.gunCount; i++) {
    gd.gunX[i] += (gd.replicaTargetX[i] - gd.gunX[i]) * blend;
    gd.gunY[i] += (gd.replicaTargetY[i] - gd.gunY[i]) * blend;
    gd.gunVX[i] = gd.replicaTargetVX[i];
    gd.gunVY[i] = gd.replicaTargetVY[i];
    const delta = signedAngleDifference(gd.replicaTargetAngle[i], gd.gunAngle[i]);
    gd.gunAngle[i] = wrapAngle(gd.gunAngle[i] + delta * blend);
    if (gd.gunMuzzleFlash[i] > 0) gd.gunMuzzleFlash[i] -= dt;
    if (gd.gunHitFlash[i] > 0) gd.gunHitFlash[i] -= dt;
  }
  for (let i = 0; i < gd.bulletCount; i++) {
    const slot = gd.bulletLive[i];
    gd.bulletX[slot] += gd.bulletVX[slot] * dt;
    gd.bulletY[slot] += gd.bulletVY[slot] * dt;
  }
  if (gd.shake > 0) {
    gd.shake -= dt * 2.9;
    if (gd.shake < 0) gd.shake = 0;
  }
}

export function applyReplicaShotFeedback(gd, playerIndex, b) {
  gd.gunMuzzleFlash[playerIndex] = b.muzzleFlashTime;
}

export function applySnapshot(gd, b, packet) {
  const isNewRound = packet.roundId !== gd.roundId;
  if (isNewRound) {
    gd.roundId = packet.roundId;
    gd.accumulator = 0;
    gd.rematchReady[0] = 0;
    gd.rematchReady[1] = 0;
  }
  gd.phase = packet.phase;
  gd.winner = packet.winner;
  gd.countdown = packet.countdown;
  gd.shake = packet.shake;
  gd.shotEventMask = 0;
  gd.hitEventMask = 0;
  gd.reloadEventMask = 0;

  for (let i = 0; i < b.gunCount; i++) {
    gd.replicaTargetX[i] = packet.gx[i];
    gd.replicaTargetY[i] = packet.gy[i];
    gd.replicaTargetVX[i] = packet.gvx[i];
    gd.replicaTargetVY[i] = packet.gvy[i];
    gd.replicaTargetAngle[i] = packet.ga[i];
    if (isNewRound) {
      gd.gunX[i] = packet.gx[i];
      gd.gunY[i] = packet.gy[i];
      gd.gunAngle[i] = packet.ga[i];
    }
    gd.gunHits[i] = packet.gh[i];
    gd.gunAmmo[i] = packet.gm[i];
    gd.gunReload[i] = packet.gr[i];
    if (isNewRound) {
      gd.replicaSeenShotSequence[i] = packet.ss[i];
      gd.replicaSeenHitSequence[i] = packet.hs[i];
    } else if (packet.ss[i] !== gd.replicaSeenShotSequence[i]) {
      gd.replicaSeenShotSequence[i] = packet.ss[i];
      gd.gunMuzzleFlash[i] = b.muzzleFlashTime;
      gd.shotEventMask |= 1 << i;
    }
    if (!isNewRound && packet.hs[i] !== gd.replicaSeenHitSequence[i]) {
      gd.replicaSeenHitSequence[i] = packet.hs[i];
      gd.gunHitFlash[i] = b.hitFlashTime;
      gd.hitEventMask |= 1 << i;
    }
  }

  gd.bulletCount = packet.bc;
  gd.bulletDeadCount = b.maxBullets - packet.bc;
  for (let i = 0; i < packet.bc; i++) {
    gd.bulletLive[i] = i;
    gd.bulletX[i] = packet.bx[i];
    gd.bulletY[i] = packet.by[i];
    gd.bulletVX[i] = packet.bvx[i];
    gd.bulletVY[i] = packet.bvy[i];
    gd.bulletOwner[i] = packet.bo[i];
  }
  for (let i = packet.bc; i < b.maxBullets; i++) gd.bulletDead[i - packet.bc] = i;
}
