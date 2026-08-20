import { TAU } from './balance.js';

// Same xorshift32 PRNG as nextRandom() in logic.js. Each pool owns its own
// rngState so particle spawns are deterministic and independent of the
// game's own RNG stream.
function nextParticleRandom(pool) {
  let x = pool.rngState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  pool.rngState = x >>> 0;
  return pool.rngState / 4294967296;
}

export function allocateParticles(b, seed = 0x9e3779b9) {
  const pool = {
    rngState: seed >>> 0,
    liveCount: 0,
    deadCount: b.maxParticles,

    x: new Float32Array(b.maxParticles),
    y: new Float32Array(b.maxParticles),
    vx: new Float32Array(b.maxParticles),
    vy: new Float32Array(b.maxParticles),
    life: new Float32Array(b.maxParticles),
    lifeMax: new Float32Array(b.maxParticles),
    size: new Float32Array(b.maxParticles),
    owner: new Uint8Array(b.maxParticles),

    live: new Uint8Array(b.maxParticles),
    dead: new Uint8Array(b.maxParticles),
  };

  for (let i = 0; i < b.maxParticles; i++) pool.dead[i] = i;
  return pool;
}

export function spawnParticleBurst(pool, b, x, y, owner, count, speedMin, speedRange) {
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    if (pool.deadCount === 0) break;
    const slot = pool.dead[--pool.deadCount];
    pool.live[pool.liveCount++] = slot;

    const angle = nextParticleRandom(pool) * TAU;
    const speed = speedMin + nextParticleRandom(pool) * speedRange;
    pool.x[slot] = x;
    pool.y[slot] = y;
    pool.vx[slot] = Math.cos(angle) * speed;
    pool.vy[slot] = Math.sin(angle) * speed;

    const life = b.particleLifeMin + nextParticleRandom(pool) * b.particleLifeRange;
    pool.life[slot] = life;
    pool.lifeMax[slot] = life;
    pool.size[slot] = b.particleSizeMin + nextParticleRandom(pool) * b.particleSizeRange;
    pool.owner[slot] = owner;

    spawned++;
  }
  return spawned;
}

export function updateParticles(pool, b, dt) {
  const damping = Math.exp(-b.particleDrag * dt);

  for (let liveIndex = pool.liveCount - 1; liveIndex >= 0; liveIndex--) {
    const slot = pool.live[liveIndex];

    pool.vy[slot] += b.particleGravity * dt;
    pool.vx[slot] *= damping;
    pool.vy[slot] *= damping;
    pool.x[slot] += pool.vx[slot] * dt;
    pool.y[slot] += pool.vy[slot] * dt;
    pool.life[slot] -= dt;

    if (pool.life[slot] <= 0) {
      pool.dead[pool.deadCount++] = slot;
      pool.liveCount--;
      pool.live[liveIndex] = pool.live[pool.liveCount];
    }
  }
}

export function resetParticles(pool, b) {
  pool.liveCount = 0;
  pool.deadCount = b.maxParticles;
  for (let i = 0; i < b.maxParticles; i++) pool.dead[i] = i;
}
