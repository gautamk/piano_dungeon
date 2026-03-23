import { COLORS } from '../config.js';
import { NOTE_NAMES } from '../data/music.js';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

export const PIANO_START_OCTAVE = 3;
export const PIANO_NUM_OCTAVES = 2;

/**
 * Compute piano key layout without drawing.
 * Returns array of { semitone, octave, isBlack, x, y, w, h } for hit testing.
 */
export function getPianoKeyRegions(x, y, width, height) {
  const numWhiteKeys = PIANO_NUM_OCTAVES * 7;
  const whiteW = Math.floor(width / numWhiteKeys);
  const blackW = Math.floor(whiteW * 0.6);
  const blackH = Math.floor(height * 0.6);

  const whiteKeys = [];
  const blackKeys = [];

  let keyX = x;
  for (let oct = PIANO_START_OCTAVE; oct < PIANO_START_OCTAVE + PIANO_NUM_OCTAVES; oct++) {
    for (let wi = 0; wi < WHITE_SEMITONES.length; wi++) {
      const semitone = WHITE_SEMITONES[wi];
      whiteKeys.push({ semitone, octave: oct, isBlack: false, x: keyX, y, w: whiteW - 1, h: height });

      // Black key to the right of this white key?
      const nextSemitone = (semitone + 1) % 12;
      if (BLACK_KEYS.has(nextSemitone) && wi < WHITE_SEMITONES.length - 1) {
        const bx = keyX + whiteW - blackW / 2;
        blackKeys.push({ semitone: nextSemitone, octave: oct, isBlack: true, x: bx, y, w: blackW, h: blackH });
      }

      keyX += whiteW;
    }
  }

  // Black keys must be hit-tested first (they sit on top visually)
  return [...blackKeys, ...whiteKeys];
}

/**
 * Renders a 2-octave piano strip (C3–B4) at the given position.
 * audioNote: real mic detected note (or null)
 * virtualNote: last virtual key pressed (or null)
 * challenge: active challenge for highlighting target keys
 * inputMode: 'mic' | 'virtual' | 'none'
 */
export function renderPianoStrip(renderer, { audioNote, virtualNote, challenge, x, y, width, height, inputMode }) {
  const ctx = renderer.ctx;
  const numWhiteKeys = PIANO_NUM_OCTAVES * 7;
  const whiteW = Math.floor(width / numWhiteKeys);
  const blackW = Math.floor(whiteW * 0.6);
  const blackH = Math.floor(height * 0.6);

  // Active note: prefer real mic if available, fall back to virtual
  const activeNote = audioNote ?? virtualNote;
  const highlightSemitones = getHighlightSemitones(challenge);

  // Draw white keys
  let keyX = x;
  for (let oct = PIANO_START_OCTAVE; oct < PIANO_START_OCTAVE + PIANO_NUM_OCTAVES; oct++) {
    for (const semitone of WHITE_SEMITONES) {
      const isHighlight = highlightSemitones.has(semitone);
      const isActive = activeNote?.semitone === semitone && activeNote?.octave === oct;
      const isVirtual = isActive && !audioNote && virtualNote;

      let color = COLORS.keys.white;
      if (isActive) color = isVirtual ? '#a3e635' : COLORS.keys.playing; // lime for virtual, green for mic
      else if (isHighlight) color = COLORS.keys.highlight;

      ctx.fillStyle = color;
      ctx.fillRect(keyX, y, whiteW - 1, height);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(keyX, y, whiteW - 1, height);

      // Label: always show on highlighted and active keys; show C on all C keys as anchor
      const showLabel = isHighlight || isActive || semitone === 0;
      if (showLabel) {
        ctx.fillStyle = isActive ? '#000' : isHighlight ? '#222' : '#777';
        ctx.font = `bold ${Math.floor(whiteW * 0.38)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(NOTE_NAMES[semitone] + oct, keyX + whiteW / 2, y + height - 3);
      }

      keyX += whiteW;
    }
  }

  // Draw black keys on top
  keyX = x;
  for (let oct = PIANO_START_OCTAVE; oct < PIANO_START_OCTAVE + PIANO_NUM_OCTAVES; oct++) {
    for (let wi = 0; wi < WHITE_SEMITONES.length; wi++) {
      const semitone = WHITE_SEMITONES[wi];
      const nextSemitone = (semitone + 1) % 12;
      if (BLACK_KEYS.has(nextSemitone) && wi < WHITE_SEMITONES.length - 1) {
        const bx = keyX + whiteW - blackW / 2;
        const isHighlight = highlightSemitones.has(nextSemitone);
        const isActive = activeNote?.semitone === nextSemitone && activeNote?.octave === oct;
        const isVirtual = isActive && !audioNote && virtualNote;

        let color = COLORS.keys.black;
        if (isActive) color = isVirtual ? '#65a30d' : COLORS.keys.playing;
        else if (isHighlight) color = '#c8a000';

        ctx.fillStyle = color;
        ctx.fillRect(bx, y, blackW, blackH);
      }
      keyX += whiteW;
    }
  }

  // Status line above piano
  const statusY = y - 20;
  if (audioNote) {
    const label = `🎤 ${audioNote.name}${audioNote.octave}  ${audioNote.cents >= 0 ? '+' : ''}${Math.round(audioNote.cents)}¢`;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = COLORS.success;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, statusY);
  } else if (virtualNote) {
    const label = `🎹 ${virtualNote.name}${virtualNote.octave}`;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#a3e635';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, statusY);
  } else if (inputMode === 'mic') {
    ctx.font = '12px monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎤 Listening...', x, statusY);
  }

  // Click hint on the right
  ctx.font = '11px monospace';
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('Click keys  or  use  A-S-D-F-G-H-J  /  W-E-T-Y-U', x + width, statusY);
}

function getHighlightSemitones(challenge) {
  const set = new Set();
  if (!challenge) return set;
  if (challenge.type === 'NOTE') {
    set.add(challenge.sequence[0]);
  } else if (challenge.type === 'INTERVAL' || challenge.type === 'SCALE') {
    const next = challenge.sequence[challenge.progress];
    if (next !== undefined) set.add(next);
  } else if (challenge.type === 'CHORD') {
    for (const s of challenge.required) {
      if (!challenge.played?.has(s)) set.add(s);
    }
  }
  return set;
}
