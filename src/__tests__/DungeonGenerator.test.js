import { describe, it, expect } from 'vitest';
import { generateFloor, unlockNextRoom, ROOM_TYPE } from '../game/DungeonGenerator.js';
import { floorTheme } from '../rendering/DungeonScreen.js';
import { GAME_CONFIG } from '../config.js';

describe('generateFloor', () => {
  it('is deterministic for the same seed', () => {
    const a = generateFloor(1, 12345);
    const b = generateFloor(1, 12345);
    expect(a.map(r => r.type)).toEqual(b.map(r => r.type));
    expect(a.map(r => r.enemy?.name ?? null)).toEqual(b.map(r => r.enemy?.name ?? null));
  });

  it('produces different floors for different seeds', () => {
    const a = generateFloor(1, 1);
    const b = generateFloor(1, 99999);
    // Statistically virtually impossible to be identical
    const typesA = a.map(r => r.type).join(',');
    const typesB = b.map(r => r.type).join(',');
    expect(typesA).not.toBe(typesB);
  });

  it('always ends with a BOSS room', () => {
    for (const seed of [1, 42, 999, 77777]) {
      const rooms = generateFloor(1, seed);
      expect(rooms[rooms.length - 1].type).toBe(ROOM_TYPE.BOSS);
    }
  });

  it('room count is within expected range (minRooms to maxRooms + boss)', () => {
    const { minRooms, maxRooms } = GAME_CONFIG.dungeon;
    for (const seed of [1, 42, 999, 12345, 77777]) {
      const rooms = generateFloor(1, seed);
      // +1 for the boss appended at the end
      expect(rooms.length).toBeGreaterThanOrEqual(minRooms + 1);
      expect(rooms.length).toBeLessThanOrEqual(maxRooms + 1);
    }
  });

  it('first room is always reachable', () => {
    const rooms = generateFloor(1, 42);
    expect(rooms[0].reachable).toBe(true);
  });

  it('non-first rooms start unreachable', () => {
    const rooms = generateFloor(1, 42);
    for (let i = 1; i < rooms.length; i++) {
      expect(rooms[i].reachable).toBe(false);
    }
  });

  it('combat/elite rooms always have an enemy', () => {
    const rooms = generateFloor(1, 42);
    for (const room of rooms) {
      if (room.type === ROOM_TYPE.COMBAT || room.type === ROOM_TYPE.ELITE || room.type === ROOM_TYPE.BOSS) {
        expect(room.enemy).not.toBeNull();
        expect(room.enemy.currentHp).toBeGreaterThan(0);
      }
    }
  });

  it('enemies scale HP with floor', () => {
    const floor1 = generateFloor(1, 42);
    const floor5 = generateFloor(5, 42);
    const boss1 = floor1.find(r => r.type === ROOM_TYPE.BOSS);
    const boss5 = floor5.find(r => r.type === ROOM_TYPE.BOSS);
    expect(boss5.enemy.currentHp).toBeGreaterThan(boss1.enemy.currentHp);
  });

  it('first room is always COMBAT type', () => {
    for (const seed of [1, 42, 999, 12345]) {
      const rooms = generateFloor(1, seed);
      expect(rooms[0].type).toBe(ROOM_TYPE.COMBAT);
    }
  });

  it('all room types are valid ROOM_TYPE values', () => {
    const valid = new Set(Object.values(ROOM_TYPE));
    const rooms = generateFloor(3, 9999);
    for (const room of rooms) {
      expect(valid.has(room.type)).toBe(true);
    }
  });

  it('non-combat rooms (SHOP, REST, PRACTICE) have no enemy', () => {
    // Generate many seeds to catch non-combat rooms
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const rooms = generateFloor(3, seed);
      for (const room of rooms) {
        if ([ROOM_TYPE.SHOP, ROOM_TYPE.REST, ROOM_TYPE.PRACTICE].includes(room.type)) {
          expect(room.enemy).toBeNull();
        }
      }
    }
  });
});

describe('unlockNextRoom', () => {
  it('sets reachable=true on the room after the cleared index', () => {
    const rooms = generateFloor(1, 42);
    unlockNextRoom(rooms, 0);
    expect(rooms[1].reachable).toBe(true);
  });

  it('is a no-op when clearedIndex is the last room (no out-of-bounds error)', () => {
    const rooms = generateFloor(1, 42);
    const lastIndex = rooms.length - 1;
    expect(() => unlockNextRoom(rooms, lastIndex)).not.toThrow();
    // No room beyond the last — nothing changes
  });

  it('does not affect rooms before or further ahead than next', () => {
    const rooms = generateFloor(1, 42);
    // Mark rooms[0] cleared, unlock next
    unlockNextRoom(rooms, 0);
    // Room at index 2 should still be unreachable
    expect(rooms[2].reachable).toBe(false);
  });
});

describe('floorTheme', () => {
  it('returns a string for every floor 1–10', () => {
    for (let floor = 1; floor <= 10; floor++) {
      expect(typeof floorTheme(floor)).toBe('string');
      expect(floorTheme(floor).length).toBeGreaterThan(0);
    }
  });

  it('does not return undefined for floors beyond 10 (catch-all branch)', () => {
    expect(floorTheme(11)).toBeDefined();
    expect(floorTheme(50)).toBeDefined();
    expect(typeof floorTheme(11)).toBe('string');
  });

  it('maps floors to correct theme names', () => {
    expect(floorTheme(1)).toBe('The Cellar');
    expect(floorTheme(2)).toBe('The Cellar');
    expect(floorTheme(3)).toBe('The Catacombs');
    expect(floorTheme(5)).toBe('The Tower');
    expect(floorTheme(7)).toBe('The Sanctum');
    expect(floorTheme(9)).toBe('The Final Chamber');
    expect(floorTheme(10)).toBe('The Final Chamber');
  });
});
