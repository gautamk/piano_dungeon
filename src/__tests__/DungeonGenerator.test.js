import { describe, it, expect } from 'vitest';
import { generateFloor, ROOM_TYPE } from '../game/DungeonGenerator.js';
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
});
