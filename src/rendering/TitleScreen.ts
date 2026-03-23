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

  // Error (soft warning, not blocking)
  if (state.micError) {
    renderer.centeredText(`ℹ ${state.micError}`, H / 2 + 198, { size: 12, color: COLORS.warning });
  }

  // Start button
  const btnW = 280, btnH = 50;
  const btnX = W / 2 - btnW / 2;
  const btnY = H / 2 + 218;
  renderer.rect(btnX, btnY, btnW, btnH, COLORS.accent, 8);
  renderer.text('▶  Start Game', W / 2, btnY + btnH / 2, {
    size: 18, color: '#000', align: 'center', weight: 'bold',
  });

  renderer.centeredText('Press  ENTER  or  click  to  start', H - 22, {
    size: 12, color: COLORS.textDim,
  });
}

export function getStartButtonRegion(): HitRegion {
  const btnW = 280, btnH = 50;
  return { x: W / 2 - btnW / 2, y: H / 2 + 218, w: btnW, h: btnH };
}
