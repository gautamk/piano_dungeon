import type { GameState, HitRegion } from '../types.js';
import { COLORS, GAME_CONFIG } from '../config.js';
import type { Renderer } from './Renderer.js';

const W = GAME_CONFIG.canvas.width;
const H = GAME_CONFIG.canvas.height;

export function renderTitleScreen(renderer: Renderer, state: GameState): void {
  renderer.rect(0, 0, W, H, COLORS.bg);

  // Title
  renderer.centeredText('PIANO', H / 2 - 130, {
    size: 72, color: COLORS.accent, weight: 'bold', font: 'monospace',
  });
  renderer.centeredText('DUNGEON', H / 2 - 52, {
    size: 72, color: COLORS.text, weight: 'bold', font: 'monospace',
  });

  renderer.centeredText('A Roguelike Piano Teacher', H / 2 + 20, {
    size: 18, color: COLORS.textDim,
  });

  // How to play
  const lines = [
    '⚔  Defeat enemies by playing the correct notes',
    '🎹  Click the piano keys  or  use keyboard shortcuts  (A S D F G H J)',
    '🎤  Or connect a real piano via USB-C mic for full experience',
    '💀  Permadeath — master all 10 floors to win',
  ];
  lines.forEach((line, i) => {
    renderer.centeredText(line, H / 2 + 72 + i * 24, { size: 14, color: COLORS.textDim });
  });

  // Input mode badge
  const modeLabel = state.audio?.inputMode === 'mic'
    ? '🎤 Mic connected'
    : '🎹 Virtual piano (no mic)';
  const modeColor = state.audio?.inputMode === 'mic' ? COLORS.success : COLORS.accent;
  renderer.centeredText(modeLabel, H / 2 + 175, { size: 13, color: modeColor });

  // MIDI badge (shown when a MIDI device is connected)
  if (state.midiConnected && state.midiDevices.length > 0) {
    const midiName = state.midiDevices.find(d => d.id === state.settings.midiDeviceId)?.name
      ?? state.midiDevices[0]?.name ?? 'MIDI device';
    renderer.centeredText(`🎵 MIDI: ${midiName}`, H / 2 + 193, { size: 12, color: COLORS.success });
  }

  // Error (soft warning, not blocking)
  if (state.micError) {
    renderer.centeredText(`ℹ ${state.micError}`, H / 2 + 198, { size: 12, color: COLORS.warning });
  }

  // Continue Run button (shown when a saved run exists)
  if (state.savedRun) {
    const { x: cx, y: cy, w: cw, h: ch } = getContinueButtonRegion();
    const saved = state.savedRun;
    renderer.rect(cx, cy, cw, ch, COLORS.success + '33', 8);
    renderer.rectStroke(cx, cy, cw, ch, COLORS.success, 1, 8);
    renderer.text('↩  Continue Run', W / 2, cy + ch / 2 - 8, {
      size: 15, color: COLORS.success, align: 'center', weight: 'bold',
    });
    renderer.text(`Floor ${saved.floor}  •  HP ${saved.hp}  •  Score ${saved.score}`, W / 2, cy + ch / 2 + 10, {
      size: 11, color: COLORS.textDim, align: 'center',
    });
  }

  // Start button
  const btnW = 280, btnH = 50;
  const btnX = W / 2 - btnW / 2;
  const btnY = H / 2 + 218;
  const isLoading = state.loadingProgress !== null;
  renderer.rect(btnX, btnY, btnW, btnH, isLoading ? COLORS.border : COLORS.accent, 8);
  renderer.text(isLoading ? 'Initializing...' : '▶  Start Game', W / 2, btnY + btnH / 2, {
    size: 18, color: isLoading ? COLORS.textDim : '#000', align: 'center', weight: 'bold',
  });

  // Loading progress bar (below Start button)
  if (isLoading) {
    const progress = state.loadingProgress ?? 0;
    renderer.bar(btnX, btnY + btnH + 6, btnW, 6, progress, 100, COLORS.accent, COLORS.surface, 3);
  }

  renderer.centeredText('Press  ENTER  or  click  to  start', H - 22, {
    size: 12, color: COLORS.textDim,
  });

  // Settings button (top-right)
  const { x: sx, y: sy, w: sw, h: sh } = getSettingsButtonRegion();
  renderer.rect(sx, sy, sw, sh, COLORS.surface, 6);
  renderer.rectStroke(sx, sy, sw, sh, COLORS.border, 1, 6);
  renderer.text('⚙  Settings', sx + sw / 2, sy + sh / 2, {
    size: 13, color: COLORS.text, align: 'center',
  });
}

export function getStartButtonRegion(): HitRegion {
  const btnW = 280, btnH = 50;
  return { x: W / 2 - btnW / 2, y: H / 2 + 218, w: btnW, h: btnH };
}

export function getContinueButtonRegion(): HitRegion {
  const btnW = 280, btnH = 48;
  return { x: W / 2 - btnW / 2, y: H / 2 + 160, w: btnW, h: btnH };
}

export function getSettingsButtonRegion(): HitRegion {
  return { x: W - 160, y: 20, w: 130, h: 36 };
}
