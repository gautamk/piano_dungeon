import { COLORS, GAME_CONFIG } from '../config.js';
import { NOTE_NAMES } from '../data/music.js';
import { renderPianoStrip } from './PianoRenderer.js';

const W = GAME_CONFIG.canvas.width;
const H = GAME_CONFIG.canvas.height;

/**
 * Renders the battle screen: enemy, challenge description, timer, piano strip.
 */
export function renderBattleScreen(renderer, state) {
  const { battle, player, audio } = state;
  const { enemy, challenge, phase, timerMs, lastResult } = battle;

  if (!enemy) return;

  // ── Background
  renderer.rect(0, 0, W, H, COLORS.bg);

  // ── Enemy panel (top-left)
  renderEnemyPanel(renderer, enemy, player.combo);

  // ── Player panel (top-right)
  renderPlayerPanel(renderer, player);

  // ── Challenge area (center)
  renderChallengeArea(renderer, challenge, phase, timerMs, lastResult);

  // ── Piano strip (bottom)
  const pianoY = H - 120;
  const pianoH = 90;
  const pianoX = 60;
  const pianoW = W - 120;
  renderPianoStrip(renderer, {
    audioNote: audio.note,
    challenge,
    x: pianoX,
    y: pianoY,
    width: pianoW,
    height: pianoH,
  });

  // ── Floor indicator
  renderer.text(`Floor ${player.floor}`, W / 2, 18, {
    size: 14, color: COLORS.textDim, align: 'center',
  });
}

function renderEnemyPanel(renderer, enemy, combo) {
  const x = 40, y = 40, w = 320, h = 200;

  // Panel background
  renderer.rect(x, y, w, h, COLORS.surface, 8);
  renderer.rectStroke(x, y, w, h, COLORS.border, 1, 8);

  // Enemy emoji/sprite
  const ctx = renderer.ctx;
  ctx.font = '64px serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(enemy.emoji || '👾', x + 16, y + 16);

  // Enemy name
  renderer.text(enemy.name, x + 100, y + 30, { size: 18, color: COLORS.text, weight: 'bold' });

  // Enemy HP bar
  renderer.text('HP', x + 100, y + 58, { size: 12, color: COLORS.textDim });
  renderer.bar(x + 100, y + 70, w - 120, 16, enemy.currentHp, enemy.maxHp, COLORS.hp);
  renderer.text(`${enemy.currentHp} / ${enemy.maxHp}`, x + 100, y + 95, { size: 11, color: COLORS.textDim });

  // Combo indicator
  if (combo >= 3) {
    const comboColor = combo >= 5 ? COLORS.accent : COLORS.warning;
    renderer.text(`COMBO x${combo}`, x + 100, y + 120, { size: 14, color: comboColor, weight: 'bold' });
  }

  // Lore text
  renderer.text(truncate(enemy.lore || '', 38), x + 16, y + 170, {
    size: 11, color: COLORS.textDim,
  });
}

function renderPlayerPanel(renderer, player) {
  const w = 220, h = 120;
  const x = W - w - 40, y = 40;

  renderer.rect(x, y, w, h, COLORS.surface, 8);
  renderer.rectStroke(x, y, w, h, COLORS.border, 1, 8);

  renderer.text('YOU', x + 16, y + 22, { size: 13, color: COLORS.textDim });

  // HP hearts
  const hp = player.hp;
  const maxHp = player.maxHp;
  let hearts = '';
  for (let i = 0; i < maxHp; i++) hearts += i < hp ? '♥ ' : '♡ ';
  renderer.text(hearts.trim(), x + 16, y + 50, {
    size: 16, color: i => i < hp ? COLORS.hp : COLORS.textDim,
  });

  // Draw hearts manually for color control
  const ctx = renderer.ctx;
  ctx.font = '16px monospace';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < maxHp; i++) {
    ctx.fillStyle = i < hp ? COLORS.hp : COLORS.border;
    ctx.fillText('♥', x + 16 + i * 22, y + 50);
  }

  // Score
  renderer.text(`Score: ${player.score}`, x + 16, y + 78, { size: 13, color: COLORS.accent });
}

function renderChallengeArea(renderer, challenge, phase, timerMs, lastResult) {
  if (!challenge) return;

  const cx = W / 2;
  const areaY = 260;
  const areaH = 280;

  // Challenge box
  renderer.rect(cx - 300, areaY, 600, areaH, COLORS.surface, 10);
  renderer.rectStroke(cx - 300, areaY, 600, areaH, COLORS.border, 1, 10);

  // Result overlay
  if (lastResult === 'SUCCESS') {
    renderer.rect(cx - 300, areaY, 600, areaH, 'rgba(74,222,128,0.15)', 10);
  } else if (lastResult === 'FAIL') {
    renderer.rect(cx - 300, areaY, 600, areaH, 'rgba(248,113,113,0.15)', 10);
  } else if (lastResult === 'NEAR_MISS') {
    renderer.rect(cx - 300, areaY, 600, areaH, 'rgba(251,146,60,0.15)', 10);
  }

  // Challenge type badge
  const typeColor = { NOTE: '#6366f1', INTERVAL: '#8b5cf6', SCALE: '#0ea5e9', CHORD: '#f59e0b' };
  renderer.rect(cx - 50, areaY - 14, 100, 26, typeColor[challenge.type] || COLORS.accent, 13);
  renderer.text(challenge.type, cx, areaY, { size: 12, color: '#fff', align: 'center', weight: 'bold' });

  // Main label (the challenge description)
  renderer.text(challenge.label, cx, areaY + 55, {
    size: 28, color: COLORS.text, align: 'center', weight: 'bold',
  });

  // Hint / note sequence
  if (challenge.hint) {
    renderer.text(challenge.hint, cx, areaY + 100, {
      size: 15, color: COLORS.textDim, align: 'center',
    });
  }

  // Sequence progress dots
  if (challenge.sequence && challenge.sequence.length > 1) {
    renderSequenceProgress(renderer, challenge, cx, areaY + 140);
  }

  // Timer bar
  const timerBarW = 500;
  const elapsed = challenge.timeMs - timerMs;
  const timerFrac = Math.max(0, timerMs / challenge.timeMs);
  const timerColor = timerFrac > 0.5 ? COLORS.success : timerFrac > 0.25 ? COLORS.warning : COLORS.danger;
  renderer.bar(cx - timerBarW / 2, areaY + areaH - 36, timerBarW, 14, timerMs, challenge.timeMs, timerColor, COLORS.bgLight, 7);
  renderer.text(`${(timerMs / 1000).toFixed(1)}s`, cx, areaY + areaH - 20, {
    size: 11, color: COLORS.textDim, align: 'center',
  });

  // Result text
  if (lastResult) {
    const resultTexts = {
      SUCCESS: ['✓ CORRECT!', COLORS.success],
      FAIL: ['✗ WRONG', COLORS.danger],
      NEAR_MISS: ['≈ CLOSE...', COLORS.warning],
    };
    const [txt, col] = resultTexts[lastResult] || ['', COLORS.text];
    renderer.text(txt, cx, areaY + 185, { size: 26, color: col, align: 'center', weight: 'bold' });
  }
}

function renderSequenceProgress(renderer, challenge, cx, y) {
  const seq = challenge.sequence;
  const progress = challenge.progress ?? 0;
  const dotR = 10;
  const gap = 30;
  const totalW = seq.length * (dotR * 2 + gap) - gap;
  let px = cx - totalW / 2 + dotR;

  for (let i = 0; i < seq.length; i++) {
    const done = challenge.type === 'CHORD'
      ? challenge.played?.has(seq[i])
      : i < progress;
    const isCurrent = challenge.type !== 'CHORD' && i === progress;

    const color = done ? COLORS.success : isCurrent ? COLORS.accent : COLORS.border;
    const ctx = renderer.ctx;
    ctx.beginPath();
    ctx.arc(px, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Note name
    renderer.text(NOTE_NAMES[seq[i]], px, y, {
      size: 10, color: done || isCurrent ? '#000' : COLORS.textDim, align: 'center',
    });

    px += dotR * 2 + gap;
  }
}

function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
