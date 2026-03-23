import { COLORS, GAME_CONFIG } from '../config.js';

const W = GAME_CONFIG.canvas.width;
const H = GAME_CONFIG.canvas.height;

/** Room cleared screen with score breakdown. */
export function renderRoomClearScreen(renderer, state) {
  renderer.rect(0, 0, W, H, 'rgba(10,10,15,0.85)');

  renderer.centeredText('ROOM CLEARED', H / 2 - 60, {
    size: 40, color: COLORS.success, weight: 'bold',
  });

  const room = state.dungeon.rooms[state.dungeon.currentIndex];
  if (room?.enemy) {
    renderer.centeredText(`${room.enemy.emoji} ${room.enemy.name} defeated!`, H / 2, {
      size: 20, color: COLORS.text,
    });
  }

  renderer.centeredText(`Score: ${state.player.score}`, H / 2 + 50, {
    size: 18, color: COLORS.accent,
  });

  renderer.centeredText('Click or press ENTER to continue', H / 2 + 110, {
    size: 14, color: COLORS.textDim,
  });
}

/** Floor complete screen. */
export function renderFloorClearScreen(renderer, state) {
  renderer.rect(0, 0, W, H, COLORS.bg);

  renderer.centeredText(`FLOOR ${state.player.floor} COMPLETE`, H / 2 - 80, {
    size: 38, color: COLORS.accent, weight: 'bold',
  });

  renderer.centeredText('You descend deeper into the dungeon...', H / 2 - 20, {
    size: 18, color: COLORS.text,
  });

  renderHpRow(renderer, state.player, H / 2 + 40);

  renderer.centeredText(`Score: ${state.player.score}`, H / 2 + 90, {
    size: 18, color: COLORS.accent,
  });

  // Continue button
  const btnW = 220, btnH = 46;
  renderer.rect(W / 2 - btnW / 2, H / 2 + 140, btnW, btnH, COLORS.accent, 8);
  renderer.text('Next Floor →', W / 2, H / 2 + 163, {
    size: 16, color: '#000', align: 'center', weight: 'bold',
  });
}

/** Shop screen. */
export function renderShopScreen(renderer, state) {
  renderer.rect(0, 0, W, H, COLORS.bg);

  renderer.centeredText('SHOP', H / 2 - 140, { size: 36, color: COLORS.accent, weight: 'bold' });
  renderer.centeredText('Spend your score here', H / 2 - 96, { size: 14, color: COLORS.textDim });

  renderer.text(`Your Score: ${state.player.score}`, W / 2, H / 2 - 54, {
    size: 18, color: COLORS.accent, align: 'center',
  });

  // HP buy
  const canAfford = state.player.score >= 50 && state.player.hp < state.player.maxHp;
  const btnColor = canAfford ? COLORS.success : COLORS.border;
  renderer.rect(W / 2 - 140, H / 2, 280, 52, btnColor, 8);
  renderer.text('Buy +2 HP  (50 pts)', W / 2, H / 2 + 26, {
    size: 16, color: canAfford ? '#000' : COLORS.textDim, align: 'center', weight: 'bold',
  });

  renderHpRow(renderer, state.player, H / 2 + 90);

  // Leave button
  renderer.rect(W / 2 - 100, H / 2 + 150, 200, 44, COLORS.surface, 8);
  renderer.rectStroke(W / 2 - 100, H / 2 + 150, 200, 44, COLORS.border, 1, 8);
  renderer.text('Leave Shop', W / 2, H / 2 + 172, {
    size: 15, color: COLORS.text, align: 'center',
  });
}

/** Game over screen. */
export function renderGameOverScreen(renderer, state) {
  renderer.rect(0, 0, W, H, COLORS.bg);

  renderer.centeredText('YOU DIED', H / 2 - 100, {
    size: 64, color: COLORS.danger, weight: 'bold',
  });

  renderer.centeredText(`Reached Floor ${state.player.floor}`, H / 2 - 16, {
    size: 22, color: COLORS.text,
  });

  renderer.centeredText(`Final Score: ${state.player.score}`, H / 2 + 26, {
    size: 20, color: COLORS.accent,
  });

  renderer.centeredText('The Maestro remains undefeated...', H / 2 + 74, {
    size: 15, color: COLORS.textDim,
  });

  // Restart button
  const btnW = 220, btnH = 50;
  renderer.rect(W / 2 - btnW / 2, H / 2 + 130, btnW, btnH, COLORS.danger, 8);
  renderer.text('Try Again', W / 2, H / 2 + 155, {
    size: 18, color: '#fff', align: 'center', weight: 'bold',
  });
}

/** Victory screen. */
export function renderVictoryScreen(renderer, state) {
  renderer.rect(0, 0, W, H, COLORS.bg);

  renderer.centeredText('VICTORY!', H / 2 - 120, {
    size: 64, color: COLORS.success, weight: 'bold',
  });

  renderer.centeredText('The Maestro has been silenced.', H / 2 - 40, {
    size: 22, color: COLORS.text,
  });

  renderer.centeredText(`Final Score: ${state.player.score}`, H / 2 + 10, {
    size: 24, color: COLORS.accent,
  });

  renderer.centeredText('You are now a true Piano Dungeon Master.', H / 2 + 60, {
    size: 15, color: COLORS.textDim,
  });

  const btnW = 220, btnH = 50;
  renderer.rect(W / 2 - btnW / 2, H / 2 + 120, btnW, btnH, COLORS.success, 8);
  renderer.text('Play Again', W / 2, H / 2 + 145, {
    size: 18, color: '#000', align: 'center', weight: 'bold',
  });
}

function renderHpRow(renderer, player, y) {
  renderer.hpHearts(player, W / 2, y, 22);
}

/** Hit regions for shop buttons. */
export function getShopHitRegions() {
  const cx = W / 2;
  return {
    buyHp: { x: cx - 140, y: H / 2, w: 280, h: 52 },
    leave: { x: cx - 100, y: H / 2 + 150, w: 200, h: 44 },
  };
}

/** Hit regions for game over / victory restart button. */
export function getRestartButtonRegion() {
  return { x: W / 2 - 110, y: H / 2 + 130, w: 220, h: 50 };
}

/** Hit region for floor clear continue button. */
export function getFloorClearButtonRegion() {
  return { x: W / 2 - 110, y: H / 2 + 140, w: 220, h: 46 };
}
