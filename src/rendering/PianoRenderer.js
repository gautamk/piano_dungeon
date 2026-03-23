import { COLORS } from '../config.js';
import { NOTE_NAMES } from '../data/music.js';

// Which semitones are black keys
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

// White key order within an octave (semitone indices)
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

/**
 * Renders a 2-octave piano strip (C3 to B4) at the bottom of the screen.
 * Highlights target keys in gold and the currently playing key in green.
 */
export function renderPianoStrip(renderer, { audioNote, challenge, x, y, width, height }) {
  const ctx = renderer.ctx;

  const startOctave = 3;
  const numOctaves = 2;
  const numWhiteKeys = numOctaves * 7;
  const whiteW = Math.floor(width / numWhiteKeys);
  const blackW = Math.floor(whiteW * 0.6);
  const blackH = Math.floor(height * 0.6);

  // Collect highlight semitones from challenge
  const highlightSemitones = getHighlightSemitones(challenge);
  const playingSemitone = audioNote?.semitone ?? null;
  const playingOctave = audioNote?.octave ?? null;

  // Draw white keys
  let keyX = x;
  for (let oct = startOctave; oct < startOctave + numOctaves; oct++) {
    for (const semitone of WHITE_SEMITONES) {
      const isHighlight = highlightSemitones.has(semitone);
      const isPlaying = playingSemitone === semitone && playingOctave === oct;

      let color = COLORS.keys.white;
      if (isPlaying) color = COLORS.keys.playing;
      else if (isHighlight) color = COLORS.keys.highlight;

      ctx.fillStyle = color;
      ctx.fillRect(keyX, y, whiteW - 1, height);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(keyX, y, whiteW - 1, height);

      // Note name label on highlight keys
      if (isHighlight || isPlaying) {
        ctx.fillStyle = isPlaying ? '#000' : '#333';
        ctx.font = `bold ${Math.floor(whiteW * 0.4)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(NOTE_NAMES[semitone], keyX + whiteW / 2, y + height - 4);
      }

      keyX += whiteW;
    }
  }

  // Draw black keys on top
  keyX = x;
  for (let oct = startOctave; oct < startOctave + numOctaves; oct++) {
    let whiteIdx = 0;
    for (const semitone of WHITE_SEMITONES) {
      const nextSemitone = (semitone + 1) % 12;
      if (BLACK_KEYS.has(nextSemitone) && whiteIdx < WHITE_SEMITONES.length - 1) {
        const bx = keyX + whiteW - blackW / 2;
        const isHighlight = highlightSemitones.has(nextSemitone);
        const isPlaying = playingSemitone === nextSemitone && playingOctave === oct;

        let color = COLORS.keys.black;
        if (isPlaying) color = COLORS.keys.playing;
        else if (isHighlight) color = COLORS.keys.highlight;

        ctx.fillStyle = color;
        ctx.fillRect(bx, y, blackW, blackH);
      }
      keyX += whiteW;
      whiteIdx++;
    }
  }

  // Pitch indicator - live frequency display
  if (audioNote) {
    const label = `♪ ${audioNote.name}${audioNote.octave}  ${audioNote.cents >= 0 ? '+' : ''}${Math.round(audioNote.cents)}¢`;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = COLORS.success;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y - 18);
  } else {
    ctx.font = '12px monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Listening...', x, y - 18);
  }
}

/** Returns Set of semitones to highlight based on active challenge. */
function getHighlightSemitones(challenge) {
  const set = new Set();
  if (!challenge) return set;

  if (challenge.type === 'NOTE') {
    set.add(challenge.sequence[0]);
  } else if (challenge.type === 'INTERVAL' || challenge.type === 'SCALE') {
    // Highlight next in sequence
    const next = challenge.sequence[challenge.progress];
    if (next !== undefined) set.add(next);
  } else if (challenge.type === 'CHORD') {
    // Highlight unplayed chord tones
    for (const s of challenge.required) {
      if (!challenge.played.has(s)) set.add(s);
    }
  }
  return set;
}
