# src/data/ — Static Game Data

## Files
| File | Role |
|---|---|
| `music.js` | Music theory data: note names, scales, chords, intervals, challenge roots |
| `enemies.js` | Enemy archetypes and boss definitions |

All exports are plain data (arrays, objects, pure functions). No side effects.

---

## music.js

### Constants
| Export | Description |
|---|---|
| `NOTE_NAMES` | 12-element array `['C','C#','D',…,'B']` — index = semitone |
| `A4_MIDI` | `69` |
| `A4_FREQ` | `440.0` Hz |
| `CHALLENGE_ROOTS` | Comfortable piano roots used in challenge generation (C3–B4 range) |
| `SCALES` | Map of scale definitions |
| `CHORDS` | Map of chord definitions |
| `INTERVALS` | All 13 intervals (P1–P8) with `semitones` and display names |

### Scale / Chord shape
```js
{
  name: 'Major',
  intervals: [0, 2, 4, 5, 7, 9, 11, 12], // semitone offsets from root
  unlockFloor: 1,                          // floor at which this becomes available
  description: '...',
}
```

### `getAvailableIntervals(floor)`
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

## enemies.js

### `ENEMY_ARCHETYPES`
Array of regular enemy objects, keyed by a `tier` that maps to floor ranges.

### `ELITE_ARCHETYPES`
Harder enemies that appear at 15% chance from floor 2+.

### `BOSS_ARCHETYPES`
One boss per floor group. `getBossForFloor(floor)` selects the appropriate boss.

### Enemy shape
```js
{
  name: 'Tone-Deaf Ghost',
  emoji: '👻',
  lore: 'Short flavour text shown in battle panel...',
  maxHp: 40,
  attackPower: 8,          // damage dealt to player on wrong note / timeout
  tier: 1,                 // which floors this enemy appears on
  challengeWeights: {      // relative frequency of each challenge type
    NOTE: 10,
    INTERVAL: 0,
    SCALE: 0,
    CHORD: 0,
  },
}
```

**Adding a new enemy:**
1. Add to `ENEMY_ARCHETYPES` with an appropriate `tier`
2. Set `challengeWeights` to reflect the enemy's musical theme:
   - Early enemies: high `NOTE`, zero others
   - Mid enemies: mix `NOTE` + `INTERVAL`
   - Late enemies: include `SCALE` and `CHORD`
3. Keep `attackPower` roughly proportional to tier (tier 1 ≈ 6–10, tier 3 ≈ 18–25)
4. `maxHp` is the base value — `DungeonGenerator` scales it up per floor via `scaleHp()`

**Adding a new boss:**
1. Add to `BOSS_ARCHETYPES` with a `floor` property matching the target floor
2. Bosses should have `challengeWeights` that test the skills introduced on that floor
3. Boss `maxHp` should be roughly 2–3× the regular enemy HP for that tier

**Do not:**
- Hardcode floor-specific HP scaling here — that lives in `DungeonGenerator.scaleHp()`
- Add challenge logic to enemy data — `ChallengeEngine.js` handles all evaluation
