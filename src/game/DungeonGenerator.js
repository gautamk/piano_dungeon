import { GAME_CONFIG } from '../config.js';
import { getEnemiesForFloor, getEliteEnemiesForFloor, getBossForFloor } from '../data/enemies.js';

// Seeded PRNG (mulberry32)
function createRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0xffffffff;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Room types:
 *   COMBAT  - fight an enemy with a musical challenge
 *   ELITE   - harder enemy, better score reward
 *   SHOP    - spend score to gain max HP (score acting as currency)
 *   REST    - heal 2 HP
 *   BOSS    - floor boss, multi-step challenge
 */
export const ROOM_TYPE = {
  COMBAT: 'COMBAT',
  ELITE: 'ELITE',
  SHOP: 'SHOP',
  REST: 'REST',
  BOSS: 'BOSS',
};

export function createRoom(type, index, enemy = null) {
  return {
    type,
    index,
    enemy,      // enemy archetype data (from enemies.js)
    enemyHp: enemy ? scaleHp(enemy, 1) : 0, // set properly in generateFloor
    cleared: false,
    reachable: index === 0, // only first room reachable at start
  };
}

function scaleHp(enemy, floor) {
  return Math.round(enemy.maxHp * (1 + (floor - 1) * 0.15));
}

function scaleAttack(enemy, floor) {
  return Math.round(enemy.attackPower * (1 + (floor - 1) * 0.1));
}

/**
 * Generate rooms for a floor.
 * Returns an array of room objects. Index 0 = first room, last = boss.
 */
export function generateFloor(floor, runSeed) {
  const rng = createRng(floor * 31337 + runSeed);
  const enemies = getEnemiesForFloor(floor);
  const elites = getEliteEnemiesForFloor(floor);

  const { minRooms, maxRooms } = GAME_CONFIG.dungeon;
  const roomCount = minRooms + Math.floor(rng() * (maxRooms - minRooms + 1));

  const rooms = [];

  for (let i = 0; i < roomCount; i++) {
    const roll = rng();
    let type, enemy;

    if (i === 0) {
      // First room is always a plain combat encounter
      type = ROOM_TYPE.COMBAT;
    } else if (roll < 0.55) {
      type = ROOM_TYPE.COMBAT;
    } else if (roll < 0.70 && elites.length > 0) {
      type = ROOM_TYPE.ELITE;
    } else if (roll < 0.80) {
      type = ROOM_TYPE.SHOP;
    } else {
      type = ROOM_TYPE.REST;
    }

    if (type === ROOM_TYPE.COMBAT) {
      const arch = pick(rng, enemies);
      enemy = {
        ...arch,
        currentHp: scaleHp(arch, floor),
        maxHp: scaleHp(arch, floor),
        attackPower: scaleAttack(arch, floor),
      };
    } else if (type === ROOM_TYPE.ELITE) {
      const arch = pick(rng, elites.length > 0 ? elites : enemies);
      enemy = {
        ...arch,
        currentHp: scaleHp(arch, floor),
        maxHp: scaleHp(arch, floor),
        attackPower: scaleAttack(arch, floor),
      };
    }

    rooms.push(createRoom(type, i, enemy ?? null));
  }

  // Always cap with a boss room
  const bossArch = getBossForFloor(floor);
  const boss = {
    ...bossArch,
    currentHp: scaleHp(bossArch, floor),
    maxHp: scaleHp(bossArch, floor),
    attackPower: scaleAttack(bossArch, floor),
  };
  rooms.push(createRoom(ROOM_TYPE.BOSS, rooms.length, boss));

  // First room is reachable; subsequent rooms unlock as prior ones are cleared
  rooms[0].reachable = true;

  return rooms;
}

/** Unlock the next room after a room is cleared. */
export function unlockNextRoom(rooms, clearedIndex) {
  const next = clearedIndex + 1;
  if (next < rooms.length) {
    rooms[next].reachable = true;
  }
}
