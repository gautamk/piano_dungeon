import type { GameState, Challenge, Enemy, PlayerState } from '../types.js';
import { COLORS, GAME_CONFIG, PIANO_LAYOUT, CHALLENGE_TYPE_COLORS } from '../config.js';
import { NOTE_NAMES } from '../data/music.js';
import { renderPianoStrip } from './PianoRenderer.js';
import type { Renderer } from './Renderer.js';

export { PIANO_LAYOUT } from '../config.js';

const W = GAME_CONFIG.canvas.width;
const H = GAME_CONFIG.canvas.height;

/**
 * Renders the battle screen: enemy, challenge description, timer, piano strip.
 */
export function renderBattleScreen(renderer: Renderer, state: GameState): void {
  const { battle, player, audio } = state;
  const { enemy, challenge, phase, timerMs, lastResult, failTooltip,
          lastWrongSemitone, lastCorrectSemitone } = battle;

  if (!enemy) return;

  // ── Background
  renderer.rect(0, 0, W, H, COLORS.bg);

  // ── Enemy panel (top-left)
  renderEnemyPanel(renderer, enemy, player.combo);

  // ── Player panel (top-right)
  renderPlayerPanel(renderer, player);

  // ── Challenge area (center)
  renderChallengeArea(renderer, challenge, phase, timerMs, lastResult, failTooltip);

  // ── Melody roll strip (between challenge area and piano, only for MELODY challenges)
  if (challenge?.type === 'MELODY') {
    renderMelodyRoll(renderer, challenge);
  }

  // ── Piano strip (bottom)
  renderPianoStrip(renderer, {
    audioNote: audio.note,
    virtualNote: audio.virtualNote ?? null,
    challenge,
    x: PIANO_LAYOUT.x,
    y: PIANO_LAYOUT.y,
    width: PIANO_LAYOUT.w,
    height: PIANO_LAYOUT.h,
    inputMode: audio.inputMode ?? 'none',
    showLabels: state.settings.showPianoLabels,
    wrongSemitone: lastWrongSemitone,
    correctSemitone: lastCorrectSemitone,
  });

  // ── Floor indicator
  renderer.text(`Floor ${player.floor}`, W / 2, 18, {
    size: 14, color: COLORS.textDim, align: 'center',
  });
}

function renderEnemyPanel(renderer: Renderer, enemy: Enemy, combo: number): void {
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

function renderPlayerPanel(renderer: Renderer, player: PlayerState): void {
  const w = 220, h = 120;
  const x = W - w - 40, y = 40;

  renderer.rect(x, y, w, h, COLORS.surface, 8);
  renderer.rectStroke(x, y, w, h, COLORS.border, 1, 8);

  renderer.text('YOU', x + 16, y + 22, { size: 13, color: COLORS.textDim });

  // HP hearts
  const hp = player.hp;
  const maxHp = player.maxHp;
  const ctx = renderer.ctx;
  ctx.font = '18px monospace';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < maxHp; i++) {
    ctx.fillStyle = i < hp ? COLORS.hp : COLORS.border;
    ctx.fillText('♥', x + 16 + i * 22, y + 50);
  }

  // Score
  renderer.text(`Score: ${player.score}`, x + 16, y + 78, { size: 13, color: COLORS.accent });
}

function renderChallengeArea(
  renderer: Renderer,
  challenge: Challenge | null,
  phase: string,
  timerMs: number,
  lastResult: string | null,
  failTooltip: string | null = null,
): void {
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
  renderer.rect(cx - 50, areaY - 14, 100, 26, CHALLENGE_TYPE_COLORS[challenge.type] || COLORS.accent, 13);
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
  const timerFrac = Math.max(0, timerMs / challenge.timeMs);
  const timerColor = timerFrac > 0.5 ? COLORS.success : timerFrac > 0.25 ? COLORS.warning : COLORS.danger;
  renderer.bar(cx - timerBarW / 2, areaY + areaH - 36, timerBarW, 14, timerMs, challenge.timeMs, timerColor, COLORS.bgLight, 7);
  renderer.text(`${(timerMs / 1000).toFixed(1)}s`, cx, areaY + areaH - 20, {
    size: 11, color: COLORS.textDim, align: 'center',
  });

  // Result text
  if (lastResult) {
    const resultTexts: Record<string, [string, string]> = {
      SUCCESS: ['✓ CORRECT!', COLORS.success],
      FAIL: ['✗ WRONG', COLORS.danger],
      NEAR_MISS: ['≈ CLOSE...', COLORS.warning],
    };
    const entry = resultTexts[lastResult];
    if (entry) {
      const [txt, col] = entry;
      renderer.text(txt, cx, areaY + 185, { size: 26, color: col, align: 'center', weight: 'bold' });
    }

    // Theory tooltip on FAIL — teaching card below the result text
    if (lastResult === 'FAIL' && failTooltip) {
      const ctx = renderer.ctx;
      const tipY = areaY + areaH + 10;
      const tipW = 580;
      renderer.rect(cx - tipW / 2, tipY, tipW, 38, COLORS.surface, 6);
      renderer.rectStroke(cx - tipW / 2, tipY, tipW, 38, COLORS.danger + '66', 1, 6);
      ctx.save();
      ctx.font = '12px monospace';
      ctx.fillStyle = COLORS.textDim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Truncate tooltip to fit in one line within the box
      let tip = failTooltip;
      const maxW = tipW - 24;
      while (ctx.measureText(tip).width > maxW && tip.length > 8) {
        tip = tip.slice(0, -4) + '…';
      }
      ctx.fillText(tip, cx, tipY + 19);
      ctx.restore();
    }
  }
}

/**
 * Horizontal piano-roll strip showing all notes in a MELODY challenge.
 * Sits in the gap between the challenge area and the piano keyboard strip.
 */
function renderMelodyRoll(renderer: Renderer, challenge: Challenge): void {
  if (challenge.type !== 'MELODY') return;
  const { sequence, octaves, progress } = challenge;
  if (!sequence || sequence.length === 0) return;

  const rollX = 60, rollY = 544, rollW = W - 120, rollH = 48;
  const padding = 8;
  const maxVisible = Math.min(sequence.length, 16);
  const blockW = Math.min(90, (rollW - 2 * padding - (maxVisible - 1) * 4) / maxVisible);
  const blockH = rollH - 14;
  const blockY = rollY + 7;

  renderer.rect(rollX, rollY, rollW, rollH, COLORS.bgLight, 6);
  renderer.rectStroke(rollX, rollY, rollW, rollH, COLORS.border, 1, 6);

  // Show a window of notes centered near current progress
  const startNote = Math.max(0, Math.min(progress - 2, sequence.length - maxVisible));
  const endNote = Math.min(sequence.length, startNote + maxVisible);

  let bx = rollX + padding;
  for (let i = startNote; i < endNote; i++) {
    const isDone = i < progress;
    const isCurrent = i === progress;
    const noteName = NOTE_NAMES[sequence[i]] + (octaves?.[i] ?? '');

    const fillColor = isCurrent ? COLORS.accent : isDone ? COLORS.bgLight : COLORS.surface;
    const strokeColor = isCurrent ? COLORS.accent : isDone ? COLORS.success : COLORS.border;
    const textColor = isCurrent ? '#000' : isDone ? COLORS.textDim : COLORS.text;

    renderer.rect(bx, blockY, blockW, blockH, fillColor, 4);
    renderer.rectStroke(bx, blockY, blockW, blockH, strokeColor, isCurrent ? 2 : 1, 4);
    renderer.text(noteName, bx + blockW / 2, blockY + blockH / 2, {
      size: 12, color: textColor, align: 'center', weight: isCurrent ? 'bold' : 'normal',
    });

    bx += blockW + 4;
  }

  // Progress counter in bottom-right
  renderer.text(`${progress}/${sequence.length}`, rollX + rollW - padding, rollY + rollH - 6, {
    size: 10, color: COLORS.textDim, align: 'right',
  });
}

function renderSequenceProgress(renderer: Renderer, challenge: Challenge, cx: number, y: number): void {
  const seq = challenge.sequence;
  const progress = challenge.progress ?? 0;
  const dotR = 10;
  const gap = 30;
  const totalW = seq.length * (dotR * 2 + gap) - gap;
  let px = cx - totalW / 2 + dotR;

  for (let i = 0; i < seq.length; i++) {
    const done = challenge.type === 'CHORD'
      ? (challenge as { played?: Set<number> }).played?.has(seq[i])
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

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
