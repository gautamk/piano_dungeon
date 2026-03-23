import { AudioEngine } from './audio/AudioEngine.js';
import { StateMachine } from './game/StateMachine.js';
import { Renderer } from './rendering/Renderer.js';
import { renderTitleScreen, getStartButtonRegion } from './rendering/TitleScreen.js';
import { renderDungeonScreen, getRoomHitRegions } from './rendering/DungeonScreen.js';
import { renderBattleScreen } from './rendering/BattleScreen.js';
import {
  renderRoomClearScreen,
  renderFloorClearScreen,
  renderShopScreen,
  renderGameOverScreen,
  renderVictoryScreen,
  getShopHitRegions,
  getRestartButtonRegion,
  getFloorClearButtonRegion,
} from './rendering/OverlayScreens.js';

// ─── Init ─────────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game');
const audio = new AudioEngine();
const sm = new StateMachine(audio);
const renderer = new Renderer(canvas);

// Scale canvas to window while preserving aspect ratio
function resizeCanvas() {
  const scaleX = window.innerWidth / 1280;
  const scaleY = window.innerHeight / 720;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.transform = `scale(${scale})`;
  canvas.style.transformOrigin = 'top left';
  canvas.style.position = 'absolute';
  canvas.style.left = `${(window.innerWidth - 1280 * scale) / 2}px`;
  canvas.style.top = `${(window.innerHeight - 720 * scale) / 2}px`;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── Input ────────────────────────────────────────────────────────────────────

/** Convert a mouse/touch event to logical canvas coordinates. */
function toLogicalCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = 1280 / rect.width;
  const scaleY = 720 / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function hitTest(pos, region) {
  return (
    pos.x >= region.x &&
    pos.x <= region.x + region.w &&
    pos.y >= region.y &&
    pos.y <= region.y + region.h
  );
}

async function handleTitleStart() {
  sm.state.micError = null;
  try {
    await audio.start();
    sm.state.micDevices = audio.devices;
    sm.onStartGame();
  } catch (err) {
    sm.state.micError = 'Mic access denied. Please allow microphone access and try again.';
    console.error('Mic error:', err);
  }
}

canvas.addEventListener('click', async (e) => {
  const pos = toLogicalCoords(e);
  const screen = sm.state.screen;

  if (screen === 'TITLE') {
    if (hitTest(pos, getStartButtonRegion())) await handleTitleStart();
    return;
  }

  if (screen === 'DUNGEON_MAP') {
    const regions = getRoomHitRegions(sm.state.dungeon.rooms);
    for (const r of regions) {
      if (hitTest(pos, r) && r.room.reachable && !r.room.cleared) {
        sm.onEnterRoom(r.index);
        return;
      }
    }
    return;
  }

  if (screen === 'ROOM_CLEAR') {
    sm.onContinueAfterRoomClear();
    return;
  }

  if (screen === 'FLOOR_CLEAR') {
    if (hitTest(pos, getFloorClearButtonRegion())) sm.onNextFloor();
    return;
  }

  if (screen === 'SHOP') {
    const { buyHp, leave } = getShopHitRegions();
    if (hitTest(pos, buyHp)) sm.onBuyHp();
    if (hitTest(pos, leave)) sm.onLeaveShop();
    return;
  }

  if (screen === 'GAME_OVER' || screen === 'VICTORY') {
    if (hitTest(pos, getRestartButtonRegion())) sm.onRestartGame();
    return;
  }
});

document.addEventListener('keydown', async (e) => {
  const screen = sm.state.screen;

  if (e.key === 'Enter') {
    if (screen === 'TITLE') { await handleTitleStart(); return; }
    if (screen === 'ROOM_CLEAR') { sm.onContinueAfterRoomClear(); return; }
    if (screen === 'FLOOR_CLEAR') { sm.onNextFloor(); return; }
    if (screen === 'GAME_OVER' || screen === 'VICTORY') { sm.onRestartGame(); return; }
  }

  if (e.key === 'Escape' && screen === 'SHOP') {
    sm.onLeaveShop();
    return;
  }
});

// ─── Render ───────────────────────────────────────────────────────────────────

function render(state) {
  const { screen } = state;

  if (screen === 'TITLE') {
    renderTitleScreen(renderer, state);
  } else if (screen === 'DUNGEON_MAP') {
    renderDungeonScreen(renderer, state);
    renderer.renderFeedback(state.feedback);
  } else if (screen === 'BATTLE') {
    renderBattleScreen(renderer, state);
    renderer.renderFeedback(state.feedback);
  } else if (screen === 'ROOM_CLEAR') {
    renderBattleScreen(renderer, state);
    renderRoomClearScreen(renderer, state);
  } else if (screen === 'FLOOR_CLEAR') {
    renderFloorClearScreen(renderer, state);
  } else if (screen === 'SHOP') {
    renderShopScreen(renderer, state);
    renderer.renderFeedback(state.feedback);
  } else if (screen === 'GAME_OVER') {
    renderGameOverScreen(renderer, state);
  } else if (screen === 'VICTORY') {
    renderVictoryScreen(renderer, state);
  }
}

// ─── Game Loop ────────────────────────────────────────────────────────────────

let lastTime = 0;

function loop(now) {
  const delta = Math.min(now - lastTime, 100); // cap at 100ms to handle tab blur
  lastTime = now;

  audio.tick();
  sm.tick(delta);
  render(sm.state);

  requestAnimationFrame(loop);
}

requestAnimationFrame((now) => {
  lastTime = now;
  requestAnimationFrame(loop);
});
