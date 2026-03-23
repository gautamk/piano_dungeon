// Enemy archetypes per floor theme
// challengeWeights: relative probability of each challenge type
// Weights: { NOTE, INTERVAL, SCALE, CHORD }

export const ENEMY_ARCHETYPES = [
  // Floor 1-2: The Cellar
  {
    id: 'tone_deaf_ghost',
    name: 'Tone-Deaf Ghost',
    sprite: '👻',
    emoji: '👻',
    floorRange: [1, 2],
    maxHp: 40,
    attackPower: 8,
    challengeWeights: { NOTE: 10, INTERVAL: 0, SCALE: 0, CHORD: 0 },
    lore: 'Wanders the cellar humming the wrong notes forever.',
  },
  {
    id: 'flat_bat',
    name: 'Flat Bat',
    sprite: '🦇',
    emoji: '🦇',
    floorRange: [1, 3],
    maxHp: 30,
    attackPower: 6,
    challengeWeights: { NOTE: 10, INTERVAL: 0, SCALE: 0, CHORD: 0 },
    lore: 'Always a half-step flat. Annoying but harmless.',
  },

  // Floor 3-4: The Catacombs
  {
    id: 'interval_imp',
    name: 'Interval Imp',
    sprite: '😈',
    emoji: '😈',
    floorRange: [3, 5],
    maxHp: 55,
    attackPower: 10,
    challengeWeights: { NOTE: 6, INTERVAL: 4, SCALE: 0, CHORD: 0 },
    lore: 'Loves leaping between notes unexpectedly.',
  },
  {
    id: 'minor_mummy',
    name: 'Minor Mummy',
    sprite: '🧟',
    emoji: '🧟',
    floorRange: [3, 5],
    maxHp: 60,
    attackPower: 12,
    challengeWeights: { NOTE: 5, INTERVAL: 5, SCALE: 0, CHORD: 0 },
    lore: 'Wrapped in a minor key. Smells like diminished chords.',
  },

  // Floor 5-7: The Tower
  {
    id: 'scale_serpent',
    name: 'Scale Serpent',
    sprite: '🐍',
    emoji: '🐍',
    floorRange: [5, 7],
    maxHp: 75,
    attackPower: 14,
    challengeWeights: { NOTE: 3, INTERVAL: 4, SCALE: 3, CHORD: 0 },
    lore: 'Hisses in pentatonic. Each scale a coil around its prey.',
  },
  {
    id: 'arpeggio_wraith',
    name: 'Arpeggio Wraith',
    sprite: '💀',
    emoji: '💀',
    floorRange: [6, 8],
    maxHp: 80,
    attackPower: 15,
    challengeWeights: { NOTE: 2, INTERVAL: 3, SCALE: 3, CHORD: 2 },
    lore: 'Dissolves into an arpeggio when struck. Reforms on the next beat.',
  },

  // Floor 8-9: The Sanctum Approach
  {
    id: 'chord_golem',
    name: 'Chord Golem',
    sprite: '🗿',
    emoji: '🗿',
    floorRange: [8, 9],
    maxHp: 100,
    attackPower: 18,
    challengeWeights: { NOTE: 1, INTERVAL: 2, SCALE: 3, CHORD: 4 },
    lore: 'Animated by stacked harmonic overtones. Absorbs wrong notes.',
  },
  {
    id: 'dissonance_demon',
    name: 'Dissonance Demon',
    sprite: '😱',
    emoji: '😱',
    floorRange: [8, 10],
    maxHp: 90,
    attackPower: 20,
    challengeWeights: { NOTE: 1, INTERVAL: 3, SCALE: 3, CHORD: 3 },
    lore: 'Born from every wrong note ever played. Feed it right ones.',
  },

  // Elite variants
  {
    id: 'chromatic_count',
    name: 'Chromatic Count',
    sprite: '🧛',
    emoji: '🧛',
    floorRange: [3, 10],
    elite: true,
    maxHp: 90,
    attackPower: 16,
    challengeWeights: { NOTE: 4, INTERVAL: 4, SCALE: 2, CHORD: 0 },
    lore: 'One... two... TWELVE semitones! He loves to count them.',
  },
];

// Boss per floor cluster
export const BOSSES = [
  {
    id: 'flat_king',
    name: 'King of Flats',
    sprite: '👑',
    emoji: '👑',
    floor: 3,
    maxHp: 150,
    attackPower: 20,
    challengeWeights: { NOTE: 5, INTERVAL: 5, SCALE: 0, CHORD: 0 },
    phases: 2,
    lore: 'Rules the cellar with an iron fist — and no sense of pitch.',
  },
  {
    id: 'scale_queen',
    name: 'Scale Queen',
    sprite: '👸',
    emoji: '👸',
    floor: 6,
    maxHp: 200,
    attackPower: 25,
    challengeWeights: { NOTE: 2, INTERVAL: 4, SCALE: 4, CHORD: 0 },
    phases: 2,
    lore: 'Commands every scale ever written. Descending runs are her favorite.',
  },
  {
    id: 'the_maestro',
    name: 'The Maestro',
    sprite: '🎭',
    emoji: '🎭',
    floor: 10,
    maxHp: 300,
    attackPower: 30,
    challengeWeights: { NOTE: 2, INTERVAL: 2, SCALE: 3, CHORD: 3 },
    phases: 3,
    lore: 'Ancient conductor of the void. To defeat him is to master music itself.',
  },
];

export function getEnemiesForFloor(floor) {
  return ENEMY_ARCHETYPES.filter(
    e => !e.elite && e.floorRange[0] <= floor && e.floorRange[1] >= floor
  );
}

export function getEliteEnemiesForFloor(floor) {
  return ENEMY_ARCHETYPES.filter(
    e => e.elite && e.floorRange[0] <= floor && e.floorRange[1] >= floor
  );
}

export function getBossForFloor(floor) {
  // Find the boss at or before this floor
  return BOSSES.filter(b => b.floor <= floor).at(-1) ?? BOSSES[0];
}
