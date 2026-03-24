import type { KeyRegion, Challenge, DetectedNote, VirtualNote, InputMode } from '../types.js';
import { COLORS, PIANO_LAYOUT } from '../config.js';
import { NOTE_NAMES } from '../data/music.js';
import type { Renderer } from './Renderer.js';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

// Re-exported for backward compatibility — prefer PIANO_LAYOUT.startOctave / numOctaves
export const PIANO_START_OCTAVE = PIANO_LAYOUT.startOctave;
export const PIANO_NUM_OCTAVES = PIANO_LAYOUT.numOctaves;

// Reused Set to avoid per-frame allocation in getHighlightSemitones
const _highlightSet = new Set<number>();

/**
 * Compute piano key layout without drawing.
 * Returns array of { semitone, octave, isBlack, x, y, w, h } for hit testing.
 */
export function getPianoKeyRegions(x: number, y: number, width: number, height: number): KeyRegion[] {
  const numWhiteKeys = PIANO_NUM_OCTAVES * 7;
  const whiteW = Math.floor(width / numWhiteKeys);
  const blackW = Math.floor(whiteW * 0.6);
  const blackH = Math.floor(height * 0.6);

  const whiteKeys: KeyRegion[] = [];
  const blackKeys: KeyRegion[] = [];

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
 * inputMode: 'mic' | 'none'
 */
export function renderPianoStrip(
  renderer: Renderer,
  {
    audioNote,
    virtualNote,
    challenge,
    x,
    y,
    width,
    height,
    inputMode,
    showLabels = true,
    wrongSemitone = null,
    correctSemitone = null,
    depressedKey = null,
  }: {
    audioNote: DetectedNote | null;
    virtualNote: VirtualNote | null;
    challenge: Challenge | null;
    x: number;
    y: number;
    width: number;
    height: number;
    inputMode: InputMode;
    showLabels?: boolean;
    /** Semitone the player played on FAIL — shown in red. */
    wrongSemitone?: number | null;
    /** Semitone the player should have played on FAIL — shown in green. */
    correctSemitone?: number | null;
    /** Most recently pressed key — rendered with a depress offset for tactile feedback. */
    depressedKey?: { semitone: number; octave: number; ttl: number } | null;
  }
): void {
  const ctx = renderer.ctx;
  const numWhiteKeys = PIANO_NUM_OCTAVES * 7;
  const whiteW = Math.floor(width / numWhiteKeys);
  const blackW = Math.floor(whiteW * 0.6);
  const blackH = Math.floor(height * 0.6);

  // Active note: prefer real mic if available, fall back to virtual
  const activeNote = audioNote ?? virtualNote;
  const highlightSemitones = getHighlightSemitones(challenge);

  const isFailMode = wrongSemitone !== null || correctSemitone !== null;

  // Draw white keys
  let keyX = x;
  for (let oct = PIANO_START_OCTAVE; oct < PIANO_START_OCTAVE + PIANO_NUM_OCTAVES; oct++) {
    for (const semitone of WHITE_SEMITONES) {
      const isHighlight = highlightSemitones.has(semitone);
      const isActive = activeNote?.semitone === semitone && activeNote?.octave === oct;
      const isVirtual = isActive && !audioNote && virtualNote;
      const isWrong = isFailMode && semitone === wrongSemitone;
      const isCorrect = isFailMode && semitone === correctSemitone;

      const isDepressed = depressedKey?.semitone === semitone && depressedKey?.octave === oct;
      const depressInset = isDepressed ? 2 : 0;

      let color = COLORS.keys.white;
      if (isActive) color = isVirtual ? '#a3e635' : COLORS.keys.playing; // lime for virtual, green for mic
      else if (isDepressed) color = '#d0d0d0';           // slightly grey when depressed
      else if (isWrong) color = COLORS.danger + 'cc';    // red tint for wrong key
      else if (isCorrect) color = COLORS.success + 'cc'; // green tint for correct key
      else if (isHighlight && !isFailMode) color = COLORS.keys.highlight;

      ctx.fillStyle = color;
      ctx.fillRect(keyX, y + depressInset, whiteW - 1, height - depressInset);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(keyX, y + depressInset, whiteW - 1, height - depressInset);

      // Labels: when showLabels=true show all white keys; otherwise only C anchor + active + highlighted
      const showLabel = showLabels || isHighlight || isActive || semitone === 0;
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
        const isWrong = isFailMode && nextSemitone === wrongSemitone;
        const isCorrect = isFailMode && nextSemitone === correctSemitone;

        const isDepressedBlack = depressedKey?.semitone === nextSemitone && depressedKey?.octave === oct;
        const depressInsetB = isDepressedBlack ? 2 : 0;

        let color = COLORS.keys.black;
        if (isActive) color = isVirtual ? '#65a30d' : COLORS.keys.playing;
        else if (isDepressedBlack) color = '#444';
        else if (isWrong) color = '#b91c1c';
        else if (isCorrect) color = '#15803d';
        else if (isHighlight && !isFailMode) color = '#c8a000';

        ctx.fillStyle = color;
        ctx.fillRect(bx, y + depressInsetB, blackW, blackH - depressInsetB);
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

function getHighlightSemitones(challenge: Challenge | null): Set<number> {
  _highlightSet.clear();
  if (!challenge) return _highlightSet;
  if (challenge.type === 'NOTE') {
    _highlightSet.add(challenge.sequence[0]);
  } else if (challenge.type === 'INTERVAL' || challenge.type === 'SCALE') {
    const next = challenge.sequence[challenge.progress];
    if (next !== undefined) _highlightSet.add(next);
  } else if (challenge.type === 'CHORD') {
    for (const s of challenge.required) {
      if (!challenge.played?.has(s)) _highlightSet.add(s);
    }
  }
  return _highlightSet;
}
