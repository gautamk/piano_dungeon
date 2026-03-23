# src/data/ — Static Game Data

## Files
| File | Role |
|---|---|
| `music.ts` | Music theory data: note names, scales, chords, intervals, challenge roots |
| `songs.ts` | Song definitions (`SONGS` record and `SONGS_LIST` array) |
| `enemies.ts` | Enemy archetypes and boss definitions |

All exports are plain data (arrays, objects, pure functions). No side effects. Types are imported from `src/types.ts`.

---

## music.ts

### Constants
| Export | Description |
|---|---|
| `NOTE_NAMES` | 12-element `string[]` `['C','C#','D',…,'B']` — index = semitone |
| `A4_MIDI` | `69` |
| `A4_FREQ` | `440.0` Hz |
| `CHALLENGE_ROOTS` | `NoteReference[]` — comfortable piano roots used in challenge generation (C3–B4 range) |
| `SCALES` | `Record<string, Scale>` — map of scale definitions |
| `CHORDS` | `Record<string, Chord>` — map of chord definitions |
| `INTERVALS` | `Interval[]` — all 13 intervals (P1–P8) with `semitones` and display names |

### Scale / Chord shape
See `Scale` and `Chord` interfaces in `src/types.ts`.

### `getAvailableIntervals(floor)` → `Interval[]`
Returns the subset of `INTERVALS` unlocked at the given floor:
- Floor < 3: none
- Floor 3–4: P5, P8 only
- Floor 5–6: + P4
- Floor 7+: full set (3rds, 4th, 5th, 6th, octave)

**Adding a new scale or chord:**
- Add to `SCALES` or `CHORDS` with an `unlockFloor` appropriate to its difficulty
- Intervals are always relative semitone offsets from the root (not absolute pitches)
- Scale intervals should include the octave (`12`) as the final step for a satisfying resolution

**Adding new roots:**
- Add to `CHALLENGE_ROOTS` with `{ semitone, octave, name }` — keep to C3–C5 range for playability

**Do not:**
- Store octave-specific note data in `INTERVALS` — intervals are pitch-class relationships
- Add non-Western tuning systems without a new config flag — current code assumes 12-TET

---

## songs.ts

Exports `SONGS: Record<string, Song>` and `SONGS_LIST: Song[]`. Songs are used by MELODY challenges and practice mode.

See `Song` and `SongNote` interfaces in `src/types.ts`. Songs are generated from MIDI files via `bun scripts/midi-to-songs.js`.

---

## enemies.ts

### `ENEMY_ARCHETYPES: EnemyArchetype[]`
Regular enemies keyed by `floorRange: [min, max]`.

### `BOSSES: BossArchetype[]`
One boss per floor group, keyed by `floor`.

### Lookup functions
| Function | Returns |
|---|---|
| `getEnemiesForFloor(floor)` | Regular enemy archetypes available on that floor |
| `getEliteEnemiesForFloor(floor)` | Elite archetypes available on that floor |
| `getBossForFloor(floor)` | The boss archetype for that floor |

Enemy shapes are defined by `EnemyArchetype` / `BossArchetype` / `Enemy` in `src/types.ts`. `DungeonGenerator.ts` converts archetypes to live `Enemy` instances with scaled HP/attack.

**Adding a new enemy:**
1. Add to `ENEMY_ARCHETYPES` with an appropriate `floorRange`
2. Set `challengeWeights` to reflect the enemy's musical theme
3. Keep `attackPower` roughly proportional to tier (tier 1 ≈ 6–10, tier 3 ≈ 18–25)
4. `maxHp` is the base value — `DungeonGenerator` scales it per floor via `scaleHp()`

**Adding a new boss:**
1. Add to `BOSSES` with a `floor` property matching the target floor
2. Bosses should have `challengeWeights` that test the skills introduced on that floor
3. Boss `maxHp` should be roughly 2–3× the regular enemy HP for that tier

**Do not:**
- Hardcode floor-specific HP scaling here — that lives in `DungeonGenerator.ts`
- Add challenge logic to enemy data — `ChallengeEngine.ts` handles all evaluation
