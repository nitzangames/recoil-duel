import { balance, difficulty, DIFFICULTY, MODE, PHASE, validateBalance } from './balance.js';
import { allocateGameData } from './game-data.js';
import * as Logic from './logic.js';
import {
  createBoard, playFeedback, renderBoard, resumeBoardAudio, SCREEN,
  setBoardDifficulty, setBoardScreen, showToast, suspendBoardAudio, updateBoard,
} from './board.js';
import { attachPlatformNet, createSnapshotPacket, fillSnapshotPacket } from './net.js';

const DIFFICULTY_KEY = 'recoilDuelDifficulty';

function loadDifficulty() {
  try {
    const parsed = Number.parseInt(localStorage.getItem(DIFFICULTY_KEY), 10);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < difficulty.count) return parsed;
  } catch (_error) {
    // Play SDK sandbox may block storage access.
  }
  return DIFFICULTY.NORMAL;
}

function saveDifficulty(diff) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, String(diff));
  } catch (_error) {
    // Play SDK sandbox may block storage access.
  }
}

let currentDifficulty = loadDifficulty();

validateBalance(balance);
const gd = allocateGameData(balance);
Logic.startMatch(gd, balance, MODE.BOT, 0, currentDifficulty);

let board;
let net = null;
let snapshotPacket = null;
let rafId = 0;
let lastTime = performance.now();

function resetHudCache() {
  board.cachedAmmo[0] = -1;
  board.cachedAmmo[1] = -1;
  board.cachedHits[0] = -1;
  board.cachedHits[1] = -1;
  board.cachedTitleMode = -1;
}

function startBot(diff = currentDifficulty) {
  currentDifficulty = diff;
  saveDifficulty(diff);
  leaveNetwork(false);
  gd.localPlayer = 0;
  Logic.startMatch(gd, balance, MODE.BOT, undefined, diff);
  resetHudCache();
  setBoardDifficulty(board, diff);
  setBoardScreen(board, SCREEN.MATCH, MODE.BOT, 0);
}

function openDifficulty() {
  setBoardScreen(board, SCREEN.DIFFICULTY);
}

function exitToMenu() {
  setBoardScreen(board, SCREEN.MENU);
}

function startLocal() {
  leaveNetwork(false);
  gd.localPlayer = 0;
  Logic.startMatch(gd, balance, MODE.LOCAL);
  resetHudCache();
  setBoardScreen(board, SCREEN.MATCH, MODE.LOCAL, 0);
}

function attachOnlineGame() {
  try {
    net = attachPlatformNet();
    const isHost = !!net.room.isHost;
    const mode = isHost ? MODE.ONLINE_HOST : MODE.ONLINE_GUEST;
    const localPlayer = isHost ? 0 : 1;
    gd.localPlayer = localPlayer;
    Logic.startMatch(gd, balance, mode, isHost ? 1 : 0);
    resetHudCache();
    setBoardScreen(board, SCREEN.MATCH, mode, localPlayer);
    snapshotPacket = isHost ? createSnapshotPacket(balance) : null;

    const activeNet = net;
    activeNet.handlers.fire = () => {
      if (net === activeNet && gd.mode === MODE.ONLINE_HOST && gd.phase === PHASE.PLAYING) Logic.queueFire(gd, 1);
    };
    activeNet.handlers.state = (packet) => {
      if (net === activeNet && gd.mode === MODE.ONLINE_GUEST) {
        Logic.applySnapshot(gd, balance, packet);
        playFeedback(board, gd);
      }
    };
    activeNet.handlers.rematch = () => {
      if (net !== activeNet) return;
      const remote = gd.localPlayer ^ 1;
      Logic.setRematchReady(gd, remote);
      tryStartOnlineRematch();
    };
    activeNet.handlers.exit = () => {
      if (net !== activeNet) return;
      leaveNetwork(false);
      setBoardScreen(board, SCREEN.MENU);
      showToast(board, 'Your rival left the room');
    };
  } catch (_error) {
    setBoardScreen(board, SCREEN.MENU);
    showToast(board, 'Could not join the duel. Try again.');
  }
}

function startOnline() {
  const SDK = window.PlaySDK;
  if (!SDK?.multiplayer?.showLobby) {
    showToast(board, 'Online play opens inside nitzan.games');
    return;
  }
  SDK.multiplayer.showLobby({
    maxPlayers: 2,
    onStart: attachOnlineGame,
    onCancel: () => setBoardScreen(board, SCREEN.MENU),
  });
}

function fire(playerIndex = gd.localPlayer) {
  if (gd.phase !== PHASE.PLAYING) return;
  if (gd.mode === MODE.ONLINE_GUEST) {
    Logic.applyReplicaShotFeedback(gd, gd.localPlayer, balance);
    gd.shotEventMask = 1 << gd.localPlayer;
    playFeedback(board, gd);
    net?.sendFire();
  } else {
    Logic.queueFire(gd, playerIndex);
  }
}

function tryStartOnlineRematch() {
  if (gd.mode !== MODE.ONLINE_HOST) return;
  if (gd.rematchReady[0] && gd.rematchReady[1]) {
    Logic.startMatch(gd, balance, MODE.ONLINE_HOST);
    resetHudCache();
    fillSnapshotPacket(snapshotPacket, gd, balance);
    net?.sendState(snapshotPacket);
  }
}

function rematch() {
  if (gd.phase !== PHASE.OVER) return;
  if (gd.mode === MODE.BOT || gd.mode === MODE.LOCAL) {
    Logic.startMatch(gd, balance, gd.mode);
    resetHudCache();
  } else {
    Logic.setRematchReady(gd, gd.localPlayer);
    net?.sendRematch();
    showToast(board, 'Rematch requested');
    tryStartOnlineRematch();
  }
}

function leaveNetwork(notify = true) {
  if (!net) return;
  const oldNet = net;
  net = null;
  if (notify) oldNet.sendExit();
  oldNet.leave();
  snapshotPacket = null;
}

function exitMatch() {
  leaveNetwork(true);
  setBoardScreen(board, SCREEN.MENU);
}

const actions = {
  startBot,
  startLocal,
  startOnline,
  openDifficulty,
  exitToMenu,
  fire,
  rematch,
  exitMatch,
  isGameOver: () => gd.phase === PHASE.OVER,
};

board = createBoard(document.getElementById('game'), balance, actions);
setBoardDifficulty(board, currentDifficulty);

const SDK = window.PlaySDK;
SDK?.multiplayer?.on?.('disconnected', () => {
  if (!net) return;
  net = null;
  snapshotPacket = null;
  setBoardScreen(board, SCREEN.MENU);
  showToast(board, 'Connection lost');
});
SDK?.multiplayer?.on?.('playerLeft', () => {
  if (!net) return;
  leaveNetwork(false);
  setBoardScreen(board, SCREEN.MENU);
  showToast(board, 'Your rival left the room');
});

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;
  updateBoard(board, dt);

  if (board.screen === SCREEN.MATCH) {
    if (gd.mode === MODE.ONLINE_GUEST) Logic.tickReplica(gd, balance, dt);
    else Logic.tick(gd, balance, dt);
    playFeedback(board, gd);

    if (gd.mode === MODE.ONLINE_HOST && net) {
      gd.snapshotClock += dt;
      if (gd.snapshotClock >= balance.snapshotInterval) {
        gd.snapshotClock -= balance.snapshotInterval;
        fillSnapshotPacket(snapshotPacket, gd, balance);
        net.sendState(snapshotPacket);
      }
    }
  }
  renderBoard(board, gd, balance);
  rafId = requestAnimationFrame(frame);
}

function pause() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  suspendBoardAudio(board);
}

function resume() {
  resumeBoardAudio(board);
  if (!rafId) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }
}

SDK?.onPause?.(pause);
SDK?.onResume?.(resume);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else resume();
});

if (SDK?.screenshotMode) startBot();

window.__RECOIL_DUEL__ = { gd, balance, actions, board };
renderBoard(board, gd, balance);
rafId = requestAnimationFrame(frame);
