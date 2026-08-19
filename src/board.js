import { difficulty, DIFFICULTY, MODE, PHASE, TAU } from './balance.js';

export const SCREEN = Object.freeze({ MENU: 0, DIFFICULTY: 1, MATCH: 2 });

const COLOR = Object.freeze({
  ink: '#10171d', ink2: '#17242c', paper: '#f2eadb', paperDark: '#d6c7ad',
  blue: '#28b8d6', blueDark: '#087a98', coral: '#ff5e53', coralDark: '#b82f36',
  gold: '#ffc857', white: '#fffdf5', muted: '#8fa2aa', black: '#071014',
});

const PLAYER_COLOR = [COLOR.blue, COLOR.coral];
const PLAYER_DARK = [COLOR.blueDark, COLOR.coralDark];
const LOCAL_WIN_TEXT = ['P1 WINS!', 'P2 WINS!'];

export function createBoard(canvas, b, actions) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const board = {
    canvas, ctx, actions, screen: SCREEN.MENU, localPlayer: 0, mode: MODE.BOT,
    difficulty: DIFFICULTY.NORMAL,
    rect: canvas.getBoundingClientRect(), scaleX: 1, scaleY: 1,
    toast: '', toastTime: 0, audio: null, wallSoundClock: 0,
    cachedAmmo: [-1, -1], cachedHits: [-1, -1],
    ammoText: ['', ''], scoreText: ['', ''],
    titleText: ['', ''], cachedTitleMode: -1, cachedTitleLocalPlayer: -1, cachedTitleDifficulty: -1,
    menuGradient: ctx.createLinearGradient(0, 0, 1080, 1920),
    arenaGradient: ctx.createLinearGradient(70, 430, 1010, 1370),
    fireGradient: ctx.createRadialGradient(500, 1580, 10, 540, 1640, 180),
  };
  board.menuGradient.addColorStop(0, '#1d3038');
  board.menuGradient.addColorStop(0.55, '#101b22');
  board.menuGradient.addColorStop(1, '#091116');
  board.arenaGradient.addColorStop(0, '#f5eddf');
  board.arenaGradient.addColorStop(1, '#d8cbb5');
  board.fireGradient.addColorStop(0, '#ff8a65');
  board.fireGradient.addColorStop(0.72, COLOR.coral);
  board.fireGradient.addColorStop(1, COLOR.coralDark);

  function resizeRect() {
    board.rect = canvas.getBoundingClientRect();
    board.scaleX = b.gameWidth / board.rect.width;
    board.scaleY = b.gameHeight / board.rect.height;
  }
  resizeRect();
  window.addEventListener('resize', resizeRect, { passive: true });

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    ensureAudio(board);
    const x = (event.clientX - board.rect.left) * board.scaleX;
    const y = (event.clientY - board.rect.top) * board.scaleY;
    if (board.screen === SCREEN.MENU) {
      if (x >= 125 && x <= 955 && y >= 1170 && y <= 1305) actions.openDifficulty();
      else if (x >= 125 && x <= 955 && y >= 1330 && y <= 1465) actions.startLocal();
      else if (x >= 125 && x <= 955 && y >= 1490 && y <= 1625) actions.startOnline();
    } else if (board.screen === SCREEN.DIFFICULTY) {
      if (x < 190 && y < 190) actions.exitToMenu();
      else if (x >= 125 && x <= 955 && y >= 1170 && y <= 1305) actions.startBot(0);
      else if (x >= 125 && x <= 955 && y >= 1330 && y <= 1465) actions.startBot(1);
      else if (x >= 125 && x <= 955 && y >= 1490 && y <= 1625) actions.startBot(2);
    } else if (x < 190 && y < 190) {
      actions.exitMatch();
    } else if (actions.isGameOver()) {
      if (x >= 155 && x <= 925 && y >= 1510 && y <= 1655) actions.rematch();
      else if (x >= 155 && x <= 925 && y >= 1680 && y <= 1815) actions.exitMatch();
    } else {
      actions.fire(board.mode === MODE.LOCAL ? playerForTapY(y, b) : board.localPlayer);
    }
  });
  return board;
}

export function playerForTapY(y, b) {
  return y < b.gameHeight * 0.5 ? 1 : 0;
}

export function setBoardScreen(board, screen, mode = board.mode, localPlayer = board.localPlayer) {
  board.screen = screen;
  board.mode = mode;
  board.localPlayer = localPlayer;
  board.cachedTitleMode = -1;
}

export function setBoardDifficulty(board, diff) {
  board.difficulty = diff;
  board.cachedTitleMode = -1;
}

export function showToast(board, message, seconds = 2.4) {
  board.toast = message;
  board.toastTime = seconds;
}

export function updateBoard(board, dt) {
  if (board.toastTime > 0) {
    board.toastTime -= dt;
    if (board.toastTime <= 0) board.toast = '';
  }
  if (board.wallSoundClock > 0) board.wallSoundClock -= dt;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBackground(board, b) {
  const ctx = board.ctx;
  ctx.fillStyle = board.menuGradient;
  ctx.fillRect(0, 0, b.gameWidth, b.gameHeight);
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = COLOR.white;
  ctx.lineWidth = 2;
  for (let y = 0; y < b.gameHeight; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(b.gameWidth, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBrand(ctx) {
  ctx.fillStyle = COLOR.gold;
  ctx.font = '800 25px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NITZAN.GAMES  •  ONE-TAP SHOWDOWN', 540, 112);
}

function drawGun(ctx, x, y, angle, color, dark, flash, hitFlash, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(0,0,0,.34)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;

  // Tapered pistol grip, angled back from the receiver.
  ctx.fillStyle = COLOR.black;
  ctx.beginPath();
  ctx.moveTo(-24, 24);
  ctx.lineTo(14, 31);
  ctx.lineTo(-3, 102);
  ctx.quadraticCurveTo(-8, 116, -22, 112);
  ctx.lineTo(-57, 97);
  ctx.quadraticCurveTo(-67, 92, -60, 80);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 4;
  for (let gripLine = 0; gripLine < 3; gripLine++) {
    ctx.beginPath();
    ctx.moveTo(-45 + gripLine * 7, 78 + gripLine * 8);
    ctx.lineTo(-13 + gripLine * 2, 91 + gripLine * 7);
    ctx.stroke();
  }

  // Long, unmistakable barrel with a dark muzzle and front sight.
  ctx.fillStyle = COLOR.black;
  roundedRect(ctx, 8, -25, 126, 50, 12);
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  roundedRect(ctx, 103, -20, 36, 40, 8);
  ctx.fill();
  ctx.fillStyle = dark;
  roundedRect(ctx, 16, -18, 105, 36, 8);
  ctx.fill();
  ctx.fillStyle = color;
  roundedRect(ctx, 29, -12, 78, 24, 5);
  ctx.fill();
  ctx.fillStyle = COLOR.black;
  ctx.beginPath(); ctx.arc(131, 0, 10, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5e747d';
  ctx.beginPath(); ctx.arc(131, 0, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = COLOR.gold;
  roundedRect(ctx, 106, -29, 10, 10, 3); ctx.fill();

  // Compact receiver and revolver cylinder.
  ctx.fillStyle = color;
  roundedRect(ctx, -45, -38, 87, 76, 19);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(-5, 0, 29, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLOR.black;
  for (let chamber = 0; chamber < 5; chamber++) {
    const chamberAngle = chamber * TAU / 5;
    ctx.beginPath();
    ctx.arc(-5 + Math.cos(chamberAngle) * 17, Math.sin(chamberAngle) * 17, 4, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-31, -26); ctx.lineTo(21, -26); ctx.stroke();

  ctx.shadowColor = 'transparent';
  if (hitFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    roundedRect(ctx, -52, -45, 104, 90, 23); ctx.fill();
  }
  if (flash > 0) {
    ctx.fillStyle = COLOR.gold;
    ctx.beginPath();
    ctx.moveTo(138, 0); ctx.lineTo(181, -29); ctx.lineTo(166, 0); ctx.lineTo(184, 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLOR.white;
    ctx.beginPath(); ctx.arc(141, 0, 12, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawButton(ctx, x, y, w, h, fill, label, sublabel = '') {
  ctx.shadowColor = 'rgba(0,0,0,.32)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 9;
  ctx.fillStyle = fill;
  roundedRect(ctx, x, y, w, h, 34);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = COLOR.white;
  ctx.font = '900 43px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 - (sublabel ? 15 : 0));
  if (sublabel) {
    ctx.globalAlpha = 0.72;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(sublabel, x + w / 2, y + h / 2 + 31);
    ctx.globalAlpha = 1;
  }
}

function drawMenu(board, b) {
  const ctx = board.ctx;
  drawBackground(board, b);
  drawBrand(ctx);

  ctx.fillStyle = COLOR.white;
  ctx.font = '1000 112px Impact, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RECOIL', 540, 300);
  ctx.fillStyle = COLOR.gold;
  ctx.fillText('DUEL', 540, 406);
  ctx.fillStyle = COLOR.muted;
  ctx.font = '800 27px system-ui, sans-serif';
  ctx.fillText('AIM WITH TIME. MOVE WITH FIRE.', 540, 488);

  ctx.save();
  ctx.translate(540, 785);
  ctx.rotate(-0.08);
  ctx.fillStyle = 'rgba(255,200,87,.08)';
  ctx.beginPath(); ctx.arc(0, 0, 300, 0, TAU); ctx.fill();
  ctx.restore();
  drawGun(ctx, 330, 760, 0.3, COLOR.blue, COLOR.blueDark, 0.08, 0, 1.45);
  drawGun(ctx, 750, 825, Math.PI + 0.3, COLOR.coral, COLOR.coralDark, 0.08, 0, 1.45);

  ctx.fillStyle = COLOR.paper;
  roundedRect(ctx, 200, 1030, 680, 98, 49);
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.font = '900 28px system-ui, sans-serif';
  ctx.fillText('3 HITS  •  5 SHOTS  •  1 WINNER', 540, 1081);

  drawButton(ctx, 125, 1170, 830, 135, COLOR.blueDark, 'PLAY VS BOT', 'Instant match • works offline');
  drawButton(ctx, 125, 1330, 830, 135, '#7b4bb7', '2 PLAYERS — SAME SCREEN', 'P2 taps top • P1 taps bottom');
  drawButton(ctx, 125, 1490, 830, 135, COLOR.coralDark, 'ONLINE DUEL', 'Create, join, or quick match');

  ctx.fillStyle = COLOR.muted;
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText('Your gun spins constantly. Tap to fire.', 540, 1715);
  ctx.fillText('Every shot kicks you backward — use the recoil.', 540, 1755);
  ctx.globalAlpha = 0.45;
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText('v0.2', 540, 1850);
  ctx.globalAlpha = 1;
  drawToast(board);
}

function drawDifficulty(board, b) {
  const ctx = board.ctx;
  drawBackground(board, b);
  drawBrand(ctx);
  drawBack(ctx);

  ctx.fillStyle = COLOR.gold;
  ctx.font = '1000 70px Impact, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHOOSE YOUR RIVAL', 540, 340);
  ctx.fillStyle = COLOR.muted;
  ctx.font = '800 27px system-ui, sans-serif';
  ctx.fillText('PICK A BOT SKILL LEVEL', 540, 420);

  const fill = [COLOR.blueDark, '#7b4bb7', COLOR.coralDark];
  const tops = [1170, 1330, 1490];
  for (let i = 0; i < difficulty.count; i++) {
    drawButton(ctx, 125, tops[i], 830, 135, fill[i], difficulty.name[i], difficulty.blurb[i]);
    if (board.difficulty === i) {
      ctx.strokeStyle = COLOR.gold;
      ctx.lineWidth = 6;
      roundedRect(ctx, 125, tops[i], 830, 135, 34);
      ctx.stroke();
    }
  }

  ctx.fillStyle = COLOR.muted;
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText('Tap a level to jump straight into the duel.', 540, 1715);
  ctx.fillText('Your pick is remembered for next time.', 540, 1755);
  drawToast(board);
}

function playerTitle(board, index, full = true) {
  if (board.mode === MODE.LOCAL) return index === 0 ? 'P1' : 'P2';
  if (index === board.localPlayer) return 'YOU';
  if (board.mode === MODE.BOT) return full ? `BOT • ${difficulty.name[board.difficulty]}` : 'BOT';
  return 'RIVAL';
}

function updateHudCache(board, gd, b) {
  if (board.mode !== board.cachedTitleMode || board.localPlayer !== board.cachedTitleLocalPlayer || board.difficulty !== board.cachedTitleDifficulty) {
    board.cachedTitleMode = board.mode;
    board.cachedTitleLocalPlayer = board.localPlayer;
    board.cachedTitleDifficulty = board.difficulty;
    board.titleText[0] = playerTitle(board, 0);
    board.titleText[1] = playerTitle(board, 1);
  }
  for (let i = 0; i < b.gunCount; i++) {
    if (board.cachedAmmo[i] !== gd.gunAmmo[i]) {
      board.cachedAmmo[i] = gd.gunAmmo[i];
      board.ammoText[i] = gd.gunAmmo[i] === 0 ? 'RELOADING' : `${gd.gunAmmo[i]} / ${b.magazineSize}`;
    }
    if (board.cachedHits[i] !== gd.gunHits[i]) {
      board.cachedHits[i] = gd.gunHits[i];
      board.scoreText[i] = `${gd.gunHits[i]} / ${b.hitsToWin} DAMAGE`;
    }
  }
}

function drawPlayerHud(board, gd, b, index, x) {
  const ctx = board.ctx;
  const color = PLAYER_COLOR[index];
  const dark = PLAYER_DARK[index];
  ctx.fillStyle = board.mode === MODE.LOCAL || index === board.localPlayer ? color : COLOR.ink2;
  roundedRect(ctx, x, 190, 390, 165, 35);
  ctx.fill();
  if (board.mode !== MODE.LOCAL && index !== board.localPlayer) {
    ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke();
  }
  ctx.fillStyle = COLOR.white;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '900 31px system-ui, sans-serif';
  ctx.fillText(board.titleText[index], x + 25, 232);
  ctx.globalAlpha = 0.72;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText(board.scoreText[index], x + 25, 270);
  ctx.globalAlpha = 1;

  for (let hit = 0; hit < b.hitsToWin; hit++) {
    ctx.fillStyle = hit < gd.gunHits[index] ? COLOR.gold : 'rgba(255,255,255,.2)';
    ctx.beginPath(); ctx.arc(x + 250 + hit * 44, 244, 15, 0, TAU); ctx.fill();
  }
  for (let ammo = 0; ammo < b.magazineSize; ammo++) {
    ctx.fillStyle = ammo < gd.gunAmmo[index] ? COLOR.white : 'rgba(255,255,255,.18)';
    roundedRect(ctx, x + 25 + ammo * 34, 305, 23, 10, 5); ctx.fill();
  }
  ctx.fillStyle = COLOR.white;
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(board.ammoText[index], x + 365, 309);
  if (gd.gunAmmo[index] === 0) {
    const progress = 1 - gd.gunReload[index] / b.reloadTime;
    ctx.fillStyle = dark; roundedRect(ctx, x + 25, 330, 340, 8, 4); ctx.fill();
    ctx.fillStyle = COLOR.gold; roundedRect(ctx, x + 25, 330, 340 * progress, 8, 4); ctx.fill();
  }
}

function drawArena(board, gd, b) {
  const ctx = board.ctx;
  const shakeX = gd.shake * Math.sin(gd.time * 91) * 10;
  const shakeY = gd.shake * Math.cos(gd.time * 77) * 8;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 18;
  ctx.fillStyle = COLOR.black;
  roundedRect(ctx, b.arenaLeft - 18, b.arenaTop - 18, b.arenaSize + 36, b.arenaSize + 36, 35); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = board.arenaGradient;
  roundedRect(ctx, b.arenaLeft, b.arenaTop, b.arenaSize, b.arenaSize, 18); ctx.fill();

  ctx.strokeStyle = 'rgba(16,23,29,.08)'; ctx.lineWidth = 3;
  for (let v = 1; v < 6; v++) {
    const p = b.arenaLeft + v * b.arenaSize / 6;
    ctx.beginPath(); ctx.moveTo(p, b.arenaTop); ctx.lineTo(p, b.arenaTop + b.arenaSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.arenaLeft, b.arenaTop + v * b.arenaSize / 6); ctx.lineTo(b.arenaLeft + b.arenaSize, b.arenaTop + v * b.arenaSize / 6); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(16,23,29,.18)'; ctx.lineWidth = 4; ctx.setLineDash([16, 18]);
  ctx.beginPath(); ctx.moveTo(540, b.arenaTop + 30); ctx.lineTo(540, b.arenaTop + b.arenaSize - 30); ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < gd.bulletCount; i++) {
    const slot = gd.bulletLive[i];
    const owner = gd.bulletOwner[slot];
    ctx.shadowColor = PLAYER_COLOR[owner]; ctx.shadowBlur = 16;
    ctx.fillStyle = COLOR.white;
    ctx.beginPath(); ctx.arc(gd.bulletX[slot], gd.bulletY[slot], b.bulletRadius, 0, TAU); ctx.fill();
    ctx.shadowColor = 'transparent';
  }

  for (let i = 0; i < b.gunCount; i++) {
    drawGun(ctx, gd.gunX[i], gd.gunY[i], gd.gunAngle[i], PLAYER_COLOR[i], PLAYER_DARK[i], gd.gunMuzzleFlash[i], gd.gunHitFlash[i]);
    ctx.fillStyle = COLOR.ink;
    roundedRect(ctx, gd.gunX[i] - 50, gd.gunY[i] + 73, 100, 30, 15); ctx.fill();
    ctx.fillStyle = COLOR.white;
    ctx.font = '900 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(playerTitle(board, i, false), gd.gunX[i], gd.gunY[i] + 88);
  }
  ctx.restore();
}

function drawCountdown(ctx, gd) {
  if (gd.phase !== PHASE.COUNTDOWN) return;
  let label = 'DUEL!';
  if (gd.countdown > 1.8) label = '3';
  else if (gd.countdown > 0.9) label = '2';
  else if (gd.countdown > 0.18) label = '1';
  ctx.fillStyle = 'rgba(7,16,20,.34)'; ctx.fillRect(70, 430, 940, 940);
  ctx.fillStyle = COLOR.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = label === 'DUEL!' ? '1000 128px Impact, system-ui, sans-serif' : '1000 210px Impact, system-ui, sans-serif';
  ctx.fillText(label, 540, 900);
}

function drawFireControl(board, gd, b) {
  const ctx = board.ctx;
  const local = board.localPlayer;
  const reloading = gd.gunAmmo[local] === 0;
  ctx.fillStyle = reloading ? COLOR.ink2 : board.fireGradient;
  ctx.shadowColor = reloading ? 'transparent' : 'rgba(255,94,83,.38)';
  ctx.shadowBlur = 35; ctx.shadowOffsetY = 12;
  ctx.beginPath(); ctx.arc(540, 1615, 145, 0, TAU); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = reloading ? COLOR.muted : COLOR.gold; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(540, 1615, 163, -Math.PI * 0.82, Math.PI * 0.82); ctx.stroke();
  ctx.fillStyle = COLOR.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '1000 60px Impact, system-ui, sans-serif';
  ctx.fillText(reloading ? 'WAIT' : 'FIRE', 540, 1602);
  ctx.globalAlpha = 0.7; ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText(reloading ? 'RELOADING' : 'TAP ANYWHERE', 540, 1658); ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.muted; ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('SHOT DIRECTION FOLLOWS THE SPIN', 540, 1820);
}

function drawLocalControls(board, gd, b) {
  const ctx = board.ctx;
  const topReloading = gd.gunAmmo[1] === 0;
  const bottomReloading = gd.gunAmmo[0] === 0;

  // Edge rails make the top/bottom ownership readable without covering the arena.
  ctx.fillStyle = 'rgba(255,94,83,.62)';
  ctx.fillRect(0, 170, 12, 790); ctx.fillRect(1068, 170, 12, 790);
  ctx.fillStyle = 'rgba(40,184,214,.62)';
  ctx.fillRect(0, 960, 12, 950); ctx.fillRect(1068, 960, 12, 950);

  ctx.save();
  ctx.translate(540, 389);
  ctx.rotate(Math.PI);
  ctx.fillStyle = topReloading ? COLOR.ink2 : COLOR.coralDark;
  roundedRect(ctx, -265, -31, 530, 62, 30); ctx.fill();
  ctx.fillStyle = COLOR.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 25px system-ui, sans-serif';
  ctx.fillText(topReloading ? 'P2 • RELOADING' : 'P2 • TAP TOP HALF TO FIRE', 0, 1);
  ctx.restore();

  ctx.fillStyle = bottomReloading ? COLOR.ink2 : COLOR.blueDark;
  roundedRect(ctx, 275, 1430, 530, 72, 34); ctx.fill();
  ctx.fillStyle = COLOR.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 25px system-ui, sans-serif';
  ctx.fillText(bottomReloading ? 'P1 • RELOADING' : 'P1 • TAP BOTTOM HALF TO FIRE', 540, 1467);

  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 4; ctx.setLineDash([12, 14]);
  ctx.beginPath(); ctx.moveTo(24, b.gameHeight * 0.5); ctx.lineTo(1056, b.gameHeight * 0.5); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLOR.muted; ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('MULTI-TOUCH ENABLED • FIRST TO 3 HITS', 540, 1760);
  ctx.fillText('SHOT DIRECTION FOLLOWS THE SPIN', 540, 1810);
}

function drawBack(ctx) {
  ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); ctx.arc(104, 104, 55, 0, TAU); ctx.fill();
  ctx.strokeStyle = COLOR.white; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(119, 76); ctx.lineTo(88, 104); ctx.lineTo(119, 132); ctx.stroke();
}

function drawEnd(board, gd) {
  const ctx = board.ctx;
  const won = gd.winner === board.localPlayer;
  ctx.fillStyle = 'rgba(7,16,20,.82)'; ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = won ? COLOR.gold : COLOR.white;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '1000 128px Impact, system-ui, sans-serif';
  ctx.fillText(board.mode === MODE.LOCAL ? LOCAL_WIN_TEXT[gd.winner] : (won ? 'YOU WIN!' : 'RIVAL WINS'), 540, 730);
  ctx.fillStyle = COLOR.muted; ctx.font = '800 28px system-ui, sans-serif';
  ctx.fillText(board.mode === MODE.LOCAL ? 'Three clean hits. Pass the rematch.' : (won ? 'Three clean hits. Nice shooting.' : 'Recoil, reload, run it back.'), 540, 835);
  drawGun(ctx, 540, 1080, gd.gunAngle[gd.winner], PLAYER_COLOR[gd.winner], PLAYER_DARK[gd.winner], 0.08, 0, 1.45);

  drawButton(ctx, 155, 1510, 770, 145, COLOR.coralDark, 'REMATCH', board.mode === MODE.BOT || board.mode === MODE.LOCAL ? 'Instant restart' : 'Waiting for both players');
  drawButton(ctx, 155, 1680, 770, 135, COLOR.ink2, 'EXIT', 'Back to mode select');
}

function drawMatch(board, gd, b) {
  const ctx = board.ctx;
  drawBackground(board, b);
  drawBack(ctx);
  ctx.fillStyle = COLOR.gold; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 24px system-ui, sans-serif';
  ctx.fillText(board.mode === MODE.BOT ? 'BOT DUEL' : (board.mode === MODE.LOCAL ? 'LOCAL DUEL' : 'ONLINE DUEL'), 540, 74);
  ctx.fillStyle = COLOR.muted; ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText('FIRST TO 3 HITS', 540, 108);
  updateHudCache(board, gd, b);
  drawPlayerHud(board, gd, b, 0, 70);
  drawPlayerHud(board, gd, b, 1, 620);
  drawArena(board, gd, b);
  drawCountdown(ctx, gd);
  if (board.mode === MODE.LOCAL) drawLocalControls(board, gd, b);
  else drawFireControl(board, gd, b);
  if (gd.phase === PHASE.OVER) drawEnd(board, gd);
  drawToast(board);
}

function drawToast(board) {
  if (!board.toast) return;
  const ctx = board.ctx;
  ctx.fillStyle = 'rgba(7,16,20,.94)'; roundedRect(ctx, 155, 1140, 770, 90, 28); ctx.fill();
  ctx.strokeStyle = COLOR.gold; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = COLOR.white; ctx.font = '800 25px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(board.toast, 540, 1185);
}

export function renderBoard(board, gd, b) {
  if (board.screen === SCREEN.MENU) drawMenu(board, b);
  else if (board.screen === SCREEN.DIFFICULTY) drawDifficulty(board, b);
  else drawMatch(board, gd, b);
}

function ensureAudio(board) {
  if (!board.audio) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) board.audio = new AudioContextClass();
  }
  if (board.audio?.state === 'suspended') board.audio.resume();
}

function tone(board, frequency, endFrequency, duration, volume, wave) {
  const audio = board.audio;
  if (!audio) return;
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.start(now); oscillator.stop(now + duration);
}

export function playFeedback(board, gd) {
  if (gd.shotEventMask) {
    tone(board, 170, 58, 0.13, 0.22, 'sawtooth');
    window.PlaySDK?.haptic?.('medium');
  }
  if (gd.hitEventMask) {
    tone(board, 92, 35, 0.28, 0.35, 'square');
    tone(board, 520, 120, 0.18, 0.11, 'sawtooth');
    window.PlaySDK?.haptic?.('heavy');
  }
  if (gd.reloadEventMask) tone(board, 520, 880, 0.11, 0.08, 'sine');
  if (gd.wallEventCount && board.wallSoundClock <= 0) {
    tone(board, 72, 45, 0.07, 0.06, 'triangle');
    board.wallSoundClock = 0.1;
  }
}

export function suspendBoardAudio(board) { board.audio?.suspend(); }
export function resumeBoardAudio(board) { board.audio?.resume(); }
