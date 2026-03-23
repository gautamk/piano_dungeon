#!/usr/bin/env bun
/**
 * midi-to-songs.js — Convert a MIDI file into Piano Dungeon song data.
 *
 * USAGE:
 *   bun scripts/midi-to-songs.js <file.mid> [options]
 *
 * OPTIONS:
 *   --track N      Force a specific MIDI track index (0-based). Default: auto (highest avg pitch).
 *   --gap N        Minimum rest gap in ms to split into a new phrase. Default: 500.
 *   --id <id>      Song identifier (JS object key). Default: filename stem in camelCase.
 *   --title <t>    Display title. Default: filename stem.
 *   --composer <c> Composer name. Default: "Unknown".
 *   --difficulty N Difficulty 1-10. Default: 5.
 *
 * OUTPUT:
 *   Prints a JS snippet to stdout. Redirect into src/data/songs.js or generated-songs.js.
 *
 * EXAMPLE:
 *   bun scripts/midi-to-songs.js assets/midi/fur_elise.mid --id furElise --title "Für Elise" --composer Beethoven
 *   bun scripts/midi-to-songs.js song.mid >> src/data/generated-songs.js
 *
 * WORKFLOW:
 *   1. Export any sheet music to MIDI from MuseScore (free), Sibelius, or Finale.
 *      Or download public-domain MIDI from mutopiaproject.org.
 *   2. Run this script to get a snippet.
 *   3. Paste the snippet into src/data/songs.js inside the SONGS export.
 *   4. Optionally assign the song to a boss in src/data/enemies.js via song: 'yourSongId'.
 */

import { readFileSync } from 'fs';
import { Midi } from '@tonejs/midi';
import { basename, extname } from 'path';

// ─── Parse CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: bun scripts/midi-to-songs.js <file.mid> [--track N] [--gap N] [--id id] [--title "T"] [--composer "C"] [--difficulty N]`);
  process.exit(0);
}

const midiPath = args[0];

function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaultVal;
}

const gapMs  = Number(getArg('--gap', '500'));
const forceTrack = args.includes('--track') ? Number(getArg('--track', '-1')) : -1;
const stem   = basename(midiPath, extname(midiPath));
const songId = getArg('--id', toCamelCase(stem));
const title  = getArg('--title', stem);
const composer = getArg('--composer', 'Unknown');
const difficulty = Number(getArg('--difficulty', '5'));

// ─── Load and parse MIDI ─────────────────────────────────────────────────────

let midi;
try {
  const buf = readFileSync(midiPath);
  midi = new Midi(buf);
} catch (err) {
  console.error(`Error reading MIDI file: ${err.message}`);
  process.exit(1);
}

if (midi.tracks.length === 0) {
  console.error('No tracks found in MIDI file.');
  process.exit(1);
}

// ─── Select melody track ─────────────────────────────────────────────────────

function avgPitch(track) {
  if (track.notes.length === 0) return -1;
  return track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length;
}

let trackIndex = forceTrack;
if (trackIndex < 0) {
  // Pick the track with the highest average pitch (right-hand melody heuristic)
  let bestAvg = -1;
  midi.tracks.forEach((t, i) => {
    const avg = avgPitch(t);
    if (avg > bestAvg) { bestAvg = avg; trackIndex = i; }
  });
}
trackIndex = Math.max(0, Math.min(trackIndex, midi.tracks.length - 1));
const track = midi.tracks[trackIndex];

if (!track || track.notes.length === 0) {
  console.error(`Track ${trackIndex} has no notes. Try --track N to pick a different track.`);
  console.error(`Available tracks (${midi.tracks.length}):`);
  midi.tracks.forEach((t, i) => {
    console.error(`  [${i}] ${t.name || '(unnamed)'} — ${t.notes.length} notes, avg pitch ${avgPitch(t).toFixed(1)}`);
  });
  process.exit(1);
}

// ─── Convert notes and split into phrases ────────────────────────────────────

// Sort notes by time (some MIDI files have out-of-order notes)
const notes = [...track.notes].sort((a, b) => a.time - b.time);

const phrases = [];
let currentPhrase = [];

for (let i = 0; i < notes.length; i++) {
  const note = notes[i];
  const nextNote = notes[i + 1];
  const durationMs = Math.max(100, Math.round(note.duration * 1000));
  const semitone = note.midi % 12;
  const octave = Math.floor(note.midi / 12) - 1;

  currentPhrase.push({ semitone, octave, durationMs });

  // Check for a rest gap to the next note
  if (nextNote) {
    const gapBetween = (nextNote.time - (note.time + note.duration)) * 1000;
    if (gapBetween >= gapMs && currentPhrase.length > 0) {
      phrases.push(currentPhrase);
      currentPhrase = [];
    }
  }
}

if (currentPhrase.length > 0) phrases.push(currentPhrase);

if (phrases.length === 0) {
  console.error('No phrases extracted. Try lowering --gap.');
  process.exit(1);
}

// ─── Emit JS snippet ─────────────────────────────────────────────────────────

const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function noteLabel(semitone, octave) {
  return `${noteNames[semitone]}${octave}`;
}

const phrasesJs = phrases.map((phrase, pi) => {
  const lines = phrase.map(n =>
    `    { semitone: ${n.semitone}, octave: ${n.octave}, durationMs: ${n.durationMs} },` +
    `  // ${noteLabel(n.semitone, n.octave)}`
  ).join('\n');
  return `  // Phrase ${pi + 1} (${phrase.length} notes)\n  [\n${lines}\n  ]`;
}).join(',\n');

const snippet = `
  // Auto-converted from: ${basename(midiPath)}
  // Track: [${trackIndex}] ${track.name || '(unnamed)'}  |  ${phrases.length} phrases  |  ${notes.length} notes total
  ${songId}: {
    id: '${songId}',
    title: '${title}',
    composer: '${composer}',
    difficulty: ${difficulty},
    phrases: [
${phrasesJs}
    ],
  },`;

console.log(snippet);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.error(`\n✓ Converted "${basename(midiPath)}" — ${phrases.length} phrases, ${notes.length} total notes`);
console.error(`  Track [${trackIndex}]: ${track.name || '(unnamed)'}, avg pitch ${avgPitch(track).toFixed(1)}`);
console.error(`  Gap threshold: ${gapMs}ms`);
if (midi.tracks.length > 1) {
  console.error(`\n  Other tracks:`);
  midi.tracks.forEach((t, i) => {
    if (i !== trackIndex) {
      console.error(`    [${i}] ${t.name || '(unnamed)'} — ${t.notes.length} notes, avg pitch ${avgPitch(t).toFixed(1)}`);
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/[-_ ](.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
}
