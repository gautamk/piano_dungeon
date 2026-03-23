# src/audio/ — Audio Input & Output

## Files
| File | Role |
|---|---|
| `AudioEngine.js` | Mic input: owns the input `AudioContext`, `MediaStream`, and pitch detection pipeline |
| `AudioSynth.js` | Audio output: Tone.js piano synth for note playback and challenge previews |
| `PitchDetector.js` | Wraps `pitchy` (McLeod Pitch Method) with note-stability logic |
| `NoteMapper.js` | Pure functions — Hz ↔ MIDI ↔ note name conversions |

---

## AudioEngine

**Owns:** the browser input `AudioContext`, the `MediaStream` from `getUserMedia`, the `AnalyserNode`.

**Lifecycle:**
1. `new AudioEngine()` — no browser API calls yet
2. `await audio.start(deviceId?)` — must be called inside a user gesture handler
   - Returns `true` if mic access granted, `false` if denied/unavailable
   - Always creates `this.ctx` (even on failure) so the analyser can still be reused
3. `audio.tick()` — called every animation frame; updates `this.currentNote` and `this.rawFrequency`
4. `audio.stop()` — tears down stream and context

**What `tick()` exposes:**
- `audio.currentNote` — `{ semitone, octave, name, midi, frequency, cents }` or `null` when silent
- `audio.rawFrequency` — raw Hz value before stability gating, or `null`

**Rules:**
- Do not create a second `AudioContext` for input — ever
- Do not call `tick()` from anywhere other than the game loop in `main.js`
- `inputMode` is `'mic'` when the stream is live, `'none'` otherwise — renderers read this from state
- Device preference is persisted in `localStorage` under `pianoMicDeviceId`

---

## AudioSynth

**Owns:** Tone.js and its output `AudioContext` (separate from the mic input context).

**Lifecycle:**
1. `new AudioSynth()` — no audio initialised yet
2. `await synth.start()` — must be called inside a user gesture handler (same call site as `AudioEngine.start()`)
   - Idempotent: safe to call more than once
3. Use `playNote(semitone, octave)` and `previewChallenge(challenge)` freely afterwards

**Two synths:**
- `_synth` — main piano voice (`triangle8` oscillator, `volume: -4 dB`). Used for virtual piano key presses.
- `_previewSynth` — quiet hint voice (`sine` oscillator, `volume: -14 dB`). Used for challenge previews only.

Both route through a shared `Tone.Reverb` (`decay: 1.5s, wet: 0.2`).

**`previewChallenge(challenge)`** plays the challenge sequence as a teaching prompt:
- NOTE: plays the single target note
- INTERVAL/SCALE: plays notes in sequence at 0.32s intervals
- CHORD: plays notes as a quick arpeggio at 0.12s intervals
- Uses `challenge.targets[i].octave` when available, otherwise defaults to octave 4

**Rules:**
- Do not call `playNote` or `previewChallenge` from renderers — only from `StateMachine`
- Do not mix Tone.js with `AudioEngine`'s `AudioContext` — they are intentionally separate
- Polyphony overflow is silently absorbed (`try/catch` around `triggerAttackRelease`)

---

## PitchDetector

Wraps `pitchy`'s `PitchDetector.forFloat32Array(fftSize)` with a stability buffer.

**`detect()` — called once per animation frame:**
1. Reads `Float32Array` from the `AnalyserNode`
2. Calls `pitchy` to get `[frequency, clarity]`
3. Rejects results below `GAME_CONFIG.audio.confidenceThreshold`
4. Requires `stabilityFrames` consecutive frames on the same MIDI note before returning `stable: true`

**Returns:** `{ frequency, confidence, stable, midi }` or `{ frequency: null, confidence: 0, stable: false }`

**Tuning (adjust `config.js` first, not this file):**
- `confidenceThreshold` (default `0.88`) — raise to reject weak/noisy signals, lower if detection misses notes
- `stabilityFrames` (default `3`, ~50ms) — raise to reduce false triggers, lower if response feels laggy

**Do not:**
- Replace `pitchy` with an FFT-based approach without profiling — the McLeod method outperforms raw FFT for monophonic piano
- Allocate new `Float32Array` instances in `detect()` — reuse `this.buf`

---

## NoteMapper

Pure functions only. No side effects, no imports other than `music.js` constants.

| Function | Input | Output |
|---|---|---|
| `freqToMidi(freq)` | Hz | MIDI number (rounded) or `null` |
| `midiToNote(midi)` | MIDI int | `{ midi, semitone, octave, name }` |
| `freqToNote(freq)` | Hz | note object or `null` |
| `noteToFreq(semitone, octave)` | semitone + octave | Hz |
| `freqToCents(freq, targetMidi)` | Hz + MIDI | cents offset (+ = sharp, − = flat) |
| `semitoneMatches(detected, target)` | two semitones | `boolean` (handles mod-12 wrap) |
| `noteFullName(semitone, octave)` | semitone + octave | `"C4"`, `"F#3"` etc. |

**Tests live in** `src/__tests__/NoteMapper.test.js` — run `bun test` after any changes here.
