import { COLORS, GAME_CONFIG } from '../config.js';

const W = GAME_CONFIG.canvas.width;
const H = GAME_CONFIG.canvas.height;

/**
 * Renders the title / mic setup screen.
 * onStart(deviceId) is called when user clicks Start.
 */
export function renderTitleScreen(renderer, state) {
  renderer.rect(0, 0, W, H, COLORS.bg);

  // Title
  renderer.centeredText('PIANO', H / 2 - 130, {
    size: 72, color: COLORS.accent, weight: 'bold', font: 'monospace',
  });
  renderer.centeredText('DUNGEON', H / 2 - 52, {
    size: 72, color: COLORS.text, weight: 'bold', font: 'monospace',
  });

  // Subtitle
  renderer.centeredText('A Roguelike Piano Teacher', H / 2 + 20, {
    size: 18, color: COLORS.textDim,
  });

  // Instructions
  renderer.centeredText('• Play notes on your piano to defeat enemies', H / 2 + 70, {
    size: 14, color: COLORS.textDim,
  });
  renderer.centeredText('• Progress through dungeon floors', H / 2 + 94, {
    size: 14, color: COLORS.textDim,
  });
  renderer.centeredText('• Die and start over — roguelike permadeath', H / 2 + 118, {
    size: 14, color: COLORS.textDim,
  });

  // Error
  if (state.micError) {
    renderer.centeredText(`⚠ ${state.micError}`, H / 2 + 160, {
      size: 14, color: COLORS.danger,
    });
  }

  // Start button area (drawn as a box for click detection)
  const btnW = 260, btnH = 50;
  const btnX = W / 2 - btnW / 2;
  const btnY = H / 2 + 190;
  renderer.rect(btnX, btnY, btnW, btnH, COLORS.accent, 8);
  renderer.text('Press  ENTER  or  Click  to  Start', W / 2, btnY + btnH / 2, {
    size: 15, color: '#000', align: 'center', weight: 'bold',
  });

  // Footer
  renderer.centeredText('Connect your piano via USB-C mic before starting', H - 30, {
    size: 12, color: COLORS.textDim,
  });
}

/** Returns the start button hit region. */
export function getStartButtonRegion() {
  const btnW = 260, btnH = 50;
  return {
    x: W / 2 - btnW / 2,
    y: GAME_CONFIG.canvas.height / 2 + 190,
    w: btnW,
    h: btnH,
  };
}
