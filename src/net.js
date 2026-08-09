export function createSnapshotPacket(b) {
  return {
    t: 'state', roundId: 0, phase: 0, winner: -1, countdown: 0, shake: 0, bc: 0,
    gx: new Array(b.gunCount).fill(0), gy: new Array(b.gunCount).fill(0),
    gvx: new Array(b.gunCount).fill(0), gvy: new Array(b.gunCount).fill(0),
    ga: new Array(b.gunCount).fill(0), gh: new Array(b.gunCount).fill(0),
    gm: new Array(b.gunCount).fill(0), gr: new Array(b.gunCount).fill(0),
    ss: new Array(b.gunCount).fill(0), hs: new Array(b.gunCount).fill(0),
    bx: new Array(b.maxBullets).fill(0), by: new Array(b.maxBullets).fill(0),
    bvx: new Array(b.maxBullets).fill(0), bvy: new Array(b.maxBullets).fill(0),
    bo: new Array(b.maxBullets).fill(0),
  };
}

export function fillSnapshotPacket(packet, gd, b) {
  packet.roundId = gd.roundId;
  packet.phase = gd.phase;
  packet.winner = gd.winner;
  packet.countdown = gd.countdown;
  packet.shake = gd.shake;
  packet.bc = gd.bulletCount;
  for (let i = 0; i < b.gunCount; i++) {
    packet.gx[i] = gd.gunX[i]; packet.gy[i] = gd.gunY[i];
    packet.gvx[i] = gd.gunVX[i]; packet.gvy[i] = gd.gunVY[i];
    packet.ga[i] = gd.gunAngle[i]; packet.gh[i] = gd.gunHits[i];
    packet.gm[i] = gd.gunAmmo[i]; packet.gr[i] = gd.gunReload[i];
    packet.ss[i] = gd.gunShotSequence[i]; packet.hs[i] = gd.gunHitSequence[i];
  }
  for (let i = 0; i < gd.bulletCount; i++) {
    const slot = gd.bulletLive[i];
    packet.bx[i] = gd.bulletX[slot]; packet.by[i] = gd.bulletY[slot];
    packet.bvx[i] = gd.bulletVX[slot]; packet.bvy[i] = gd.bulletVY[slot];
    packet.bo[i] = gd.bulletOwner[slot];
  }
}

export function createNetAdapter({ room, on }) {
  const firePacket = { t: 'fire', sequence: 0 };
  const rematchPacket = { t: 'rematch' };
  const exitPacket = { t: 'exit' };
  const handlers = { fire: null, state: null, rematch: null, exit: null };

  function receive(_fromUserId, payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.t === 'fire' && handlers.fire) handlers.fire(payload.sequence);
    else if (payload.t === 'state' && handlers.state) handlers.state(payload);
    else if (payload.t === 'rematch' && handlers.rematch) handlers.rematch();
    else if (payload.t === 'exit' && handlers.exit) handlers.exit();
  }
  on('game', receive);

  return {
    room, handlers,
    sendFire() { firePacket.sequence++; room.send(firePacket); },
    sendState(packet) { room.send(packet); },
    sendRematch() { room.send(rematchPacket); },
    sendExit() { room.send(exitPacket); },
    leave() { room.leave(); },
  };
}

export function attachPlatformNet() {
  const SDK = window.PlaySDK;
  if (!SDK?.multiplayer) throw new Error('PlaySDK multiplayer is unavailable');
  const room = SDK.multiplayer.getRoom();
  if (!room) throw new Error('No multiplayer room');
  return createNetAdapter({ room, on: (event, callback) => SDK.multiplayer.on(event, callback) });
}
