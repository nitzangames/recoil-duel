import test from 'node:test';
import assert from 'node:assert/strict';
import { balance } from '../src/balance.js';
import { allocateParticles, spawnParticleBurst, updateParticles, resetParticles } from '../src/particles.js';

test('allocation produces fixed-size typed arrays and a full dead pool', () => {
  const pool = allocateParticles(balance);
  assert.ok(pool.x instanceof Float32Array);
  assert.ok(pool.y instanceof Float32Array);
  assert.ok(pool.vx instanceof Float32Array);
  assert.ok(pool.vy instanceof Float32Array);
  assert.ok(pool.life instanceof Float32Array);
  assert.ok(pool.lifeMax instanceof Float32Array);
  assert.ok(pool.size instanceof Float32Array);
  assert.ok(pool.owner instanceof Uint8Array);
  assert.ok(pool.live instanceof Uint8Array);
  assert.ok(pool.dead instanceof Uint8Array);

  for (const key of ['x', 'y', 'vx', 'vy', 'life', 'lifeMax', 'size', 'owner', 'live', 'dead']) {
    assert.equal(pool[key].length, balance.maxParticles);
  }

  assert.equal(pool.liveCount, 0);
  assert.equal(pool.deadCount, balance.maxParticles);
  for (let i = 0; i < balance.maxParticles; i++) assert.equal(pool.dead[i], i);
});

test('a burst moves exactly count indices from dead to live', () => {
  const pool = allocateParticles(balance);
  const spawned = spawnParticleBurst(pool, balance, 100, 200, 0, 10, 50, 100);
  assert.equal(spawned, 10);
  assert.equal(pool.liveCount, 10);
  assert.equal(pool.deadCount, balance.maxParticles - 10);
  assert.equal(pool.liveCount + pool.deadCount, balance.maxParticles);
});

test('requesting more than the pool can hold spawns only what is available', () => {
  const pool = allocateParticles(balance);
  const spawned = spawnParticleBurst(pool, balance, 0, 0, 1, balance.maxParticles + 50, 10, 10);
  assert.equal(spawned, balance.maxParticles);
  assert.equal(pool.liveCount, balance.maxParticles);
  assert.equal(pool.deadCount, 0);

  const overflow = spawnParticleBurst(pool, balance, 0, 0, 1, 5, 10, 10);
  assert.equal(overflow, 0);
  assert.equal(pool.liveCount, balance.maxParticles);
  assert.equal(pool.deadCount, 0);
  assert.equal(pool.liveCount + pool.deadCount, balance.maxParticles);
});

test('updateParticles moves particles and recycles them once their life expires', () => {
  const pool = allocateParticles(balance);
  spawnParticleBurst(pool, balance, 500, 500, 0, balance.deathParticleCount, balance.deathParticleSpeedMin, balance.deathParticleSpeedRange);
  const startX = pool.x[pool.live[0]];
  const startY = pool.y[pool.live[0]];

  updateParticles(pool, balance, 1 / 60);
  const slotAfterOneStep = pool.live[0];
  assert.ok(pool.x[slotAfterOneStep] !== startX || pool.y[slotAfterOneStep] !== startY);

  const maxLife = balance.particleLifeMin + balance.particleLifeRange;
  const dt = 1 / 60;
  let elapsed = dt; // already stepped once above
  while (elapsed < maxLife + dt) {
    updateParticles(pool, balance, dt);
    elapsed += dt;
  }

  assert.equal(pool.liveCount, 0);
  assert.equal(pool.deadCount, balance.maxParticles);
});

test('repeated spawn/expire cycles keep the pool invariant and never duplicate a live index', () => {
  const pool = allocateParticles(balance);
  const dt = 1 / 30;

  for (let round = 0; round < 50; round++) {
    spawnParticleBurst(pool, balance, round, -round, round % 2, balance.hitParticleCount, balance.hitParticleSpeedMin, balance.hitParticleSpeedRange);

    const seen = new Set();
    for (let i = 0; i < pool.liveCount; i++) {
      const slot = pool.live[i];
      assert.ok(!seen.has(slot), `live index ${slot} repeated within live pool`);
      seen.add(slot);
    }
    assert.equal(pool.liveCount + pool.deadCount, balance.maxParticles);

    updateParticles(pool, balance, dt);
    assert.equal(pool.liveCount + pool.deadCount, balance.maxParticles);
  }
});

test('resetParticles empties the live pool', () => {
  const pool = allocateParticles(balance);
  spawnParticleBurst(pool, balance, 1, 1, 0, balance.deathParticleCount, balance.deathParticleSpeedMin, balance.deathParticleSpeedRange);
  assert.ok(pool.liveCount > 0);

  resetParticles(pool, balance);
  assert.equal(pool.liveCount, 0);
  assert.equal(pool.deadCount, balance.maxParticles);
  for (let i = 0; i < balance.maxParticles; i++) assert.equal(pool.dead[i], i);
});

test('two pools with the same seed and the same calls are deterministic', () => {
  const poolA = allocateParticles(balance, 42);
  const poolB = allocateParticles(balance, 42);

  spawnParticleBurst(poolA, balance, 10, 20, 0, balance.deathParticleCount, balance.deathParticleSpeedMin, balance.deathParticleSpeedRange);
  spawnParticleBurst(poolB, balance, 10, 20, 0, balance.deathParticleCount, balance.deathParticleSpeedMin, balance.deathParticleSpeedRange);

  updateParticles(poolA, balance, 1 / 60);
  updateParticles(poolB, balance, 1 / 60);

  assert.deepEqual(Array.from(poolA.x), Array.from(poolB.x));
  assert.deepEqual(Array.from(poolA.vx), Array.from(poolB.vx));
});
