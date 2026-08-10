export const TAU = Math.PI * 2;

export const PHASE = Object.freeze({
  COUNTDOWN: 0,
  PLAYING: 1,
  OVER: 2,
});

export const MODE = Object.freeze({
  BOT: 0,
  ONLINE_HOST: 1,
  ONLINE_GUEST: 2,
  LOCAL: 3,
});

export const balance = Object.freeze({
  gameWidth: 1080,
  gameHeight: 1920,
  arenaLeft: 70,
  arenaTop: 430,
  arenaSize: 940,
  gunCount: 2,
  gunRadius: 55,
  gunBarrelLength: 92,
  gunBarrelWidth: 28,
  gunRotationSpeed: TAU / 2.5,
  gunLinearDrag: 0.7,
  gunWallRestitution: 0.82,
  gunCollisionRestitution: 0.9,
  gunMaxSpeed: 660,
  recoilSpeed: 360,
  bulletSpeed: 1080,
  bulletRadius: 10,
  bulletLife: 1.35,
  maxBullets: 16,
  hitKnockback: 300,
  hitInvulnerability: 0.16,
  hitsToWin: 3,
  magazineSize: 5,
  reloadTime: 1.65,
  fireCooldown: 0.14,
  muzzleFlashTime: 0.09,
  hitFlashTime: 0.22,
  countdownTime: 2.7,
  fixedStep: 1 / 120,
  maxSubSteps: 5,
  botAimTolerance: 0.105,
  botThinkMin: 0.22,
  botThinkRange: 0.32,
  botLeadTime: 0.12,
  snapshotInterval: 1 / 24,
});

export function validateBalance(b) {
  const errors = [];
  if (b.gunCount !== 2) errors.push('gunCount must be 2');
  if (b.magazineSize < 1) errors.push('magazineSize must be positive');
  if (b.hitsToWin < 1) errors.push('hitsToWin must be positive');
  if (b.maxBullets < b.magazineSize * 2) errors.push('maxBullets is too small');
  if (b.arenaSize <= b.gunRadius * 4) errors.push('arena is too small');
  if (errors.length) throw new Error(`Invalid balance:\n${errors.join('\n')}`);
}
