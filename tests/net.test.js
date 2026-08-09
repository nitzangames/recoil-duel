import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetAdapter } from '../src/net.js';

test('network adapter reuses compact fire packets and routes incoming intents', () => {
  const sent = [];
  let receiver = null;
  const room = { send: (packet) => sent.push({ ...packet }), leave() {} };
  const adapter = createNetAdapter({ room, on: (_event, callback) => { receiver = callback; } });
  let sequence = 0;
  adapter.handlers.fire = (value) => { sequence = value; };
  adapter.sendFire();
  adapter.sendFire();
  receiver('rival', { t: 'fire', sequence: 9 });
  assert.deepEqual(sent, [{ t: 'fire', sequence: 1 }, { t: 'fire', sequence: 2 }]);
  assert.equal(sequence, 9);
});

test('network adapter routes state and rematch messages independently', () => {
  let receiver = null;
  const adapter = createNetAdapter({
    room: { send() {}, leave() {} },
    on: (_event, callback) => { receiver = callback; },
  });
  let stateRound = 0;
  let rematches = 0;
  adapter.handlers.state = (packet) => { stateRound = packet.roundId; };
  adapter.handlers.rematch = () => { rematches++; };
  receiver('rival', { t: 'state', roundId: 4 });
  receiver('rival', { t: 'rematch' });
  assert.equal(stateRound, 4);
  assert.equal(rematches, 1);
});
