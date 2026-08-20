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

export const DIFFICULTY = Object.freeze({ EASY: 0, NORMAL: 1, HARD: 2 });

export const difficulty = Object.freeze({
  count: 3,
  name: ['EASY', 'NORMAL', 'HARD'],
  blurb: [
    'Sloppy aim • ignores your drift',
    'A fair duel • leads your shots',
    'Tight aim • fires the instant it can',
  ],
  aimTolerance: Float32Array.of(0.17, 0.105, 0.05),
  thinkMin: Float32Array.of(0.55, 0.22, 0.1),
  thinkRange: Float32Array.of(0.55, 0.32, 0.14),
  leadTime: Float32Array.of(0, 0.12, 0.2),
  openingThink: Float32Array.of(1.1, 0.45, 0.2),
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
  snapshotInterval: 1 / 24,
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
});

export function validateBalance(b) {
  const errors = [];
  if (b.gunCount !== 2) errors.push('gunCount must be 2');
  if (b.magazineSize < 1) errors.push('magazineSize must be positive');
  if (b.hitsToWin < 1) errors.push('hitsToWin must be positive');
  if (b.maxBullets < b.magazineSize * 2) errors.push('maxBullets is too small');
  if (b.arenaSize <= b.gunRadius * 4) errors.push('arena is too small');
  for (const key of ['name', 'blurb', 'aimTolerance', 'thinkMin', 'thinkRange', 'leadTime', 'openingThink']) {
    if (difficulty[key].length !== difficulty.count) errors.push(`difficulty.${key} must have length difficulty.count`);
  }
  if (b.maxParticles < b.deathParticleCount * 2) errors.push('maxParticles is too small');
  if (b.deathParticleCount < 1) errors.push('deathParticleCount must be positive');
  if (b.hitParticleCount < 1) errors.push('hitParticleCount must be positive');
  if (b.particleLifeMin <= 0) errors.push('particleLifeMin must be positive');
  if (errors.length) throw new Error(`Invalid balance:\n${errors.join('\n')}`);
}
