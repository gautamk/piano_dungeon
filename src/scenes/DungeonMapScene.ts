import * as ex from 'excalibur';
import type { Screen, DungeonMapActivationData, FeedbackMessage, Room } from '../types.js';
import { renderDungeonScreen, getRoomHitRegions, roomLayout } from '../rendering/DungeonScreen.js';
import { generateFloor } from '../game/DungeonGenerator.js';
import { GameScene, type SceneDeps } from './GameScene.js';
import { COLORS, GAME_CONFIG } from '../config.js';
import { ROOM_TYPE } from '../game/DungeonGenerator.js';

const MAX_ROOMS = GAME_CONFIG.dungeon.maxRooms;

const ROOM_ICONS: Record<string, string> = {
  [ROOM_TYPE.COMBAT]: '⚔',
  [ROOM_TYPE.ELITE]: '☆',
  [ROOM_TYPE.SHOP]: '$',
  [ROOM_TYPE.REST]: '+',
  [ROOM_TYPE.BOSS]: '☠',
  [ROOM_TYPE.PRACTICE]: '♪',
};

const ROOM_LABELS: Record<string, string> = {
  [ROOM_TYPE.COMBAT]: 'Combat',
  [ROOM_TYPE.ELITE]: 'Elite',
  [ROOM_TYPE.SHOP]: 'Shop',
  [ROOM_TYPE.REST]: 'Rest',
  [ROOM_TYPE.BOSS]: 'BOSS',
  [ROOM_TYPE.PRACTICE]: 'Practice',
};

interface RoomActorSet {
  bg: ex.Actor;
  icon: ex.Label;
  name: ex.Label;
  enemyName: ex.Label;
}

export class DungeonMapScene extends GameScene<DungeonMapActivationData> {
  readonly screens: Screen[] = ['DUNGEON_MAP'];

  private _roomPool: RoomActorSet[] = [];

  constructor(deps: SceneDeps) { super(deps); }

  override onInitialize(engine: ex.Engine): void {
    super.onInitialize(engine);
    this._buildRoomPool();
  }

  private _buildRoomPool(): void {
    for (let i = 0; i < MAX_ROOMS; i++) {
      const bg = new ex.Actor({ anchor: ex.Vector.Zero, z: 1 });
      bg.graphics.use(new ex.Rectangle({ width: 90, height: 90, color: ex.Color.fromHex(COLORS.surface) }));
      this.add(bg);

      const icon = new ex.Label({
        text: '',
        font: new ex.Font({
          size: 28,
          unit: ex.FontUnit.Px,
          family: 'serif',
          textAlign: ex.TextAlign.Center,
          baseAlign: ex.BaseAlign.Middle,
        }),
        z: 2,
      });
      this.add(icon);

      const name = new ex.Label({
        text: '',
        font: new ex.Font({
          size: 11,
          unit: ex.FontUnit.Px,
          bold: true,
          family: 'monospace',
          textAlign: ex.TextAlign.Center,
          baseAlign: ex.BaseAlign.Middle,
        }),
        z: 2,
      });
      this.add(name);

      const enemyName = new ex.Label({
        text: '',
        font: new ex.Font({
          size: 9,
          unit: ex.FontUnit.Px,
          family: 'monospace',
          textAlign: ex.TextAlign.Center,
          baseAlign: ex.BaseAlign.Middle,
        }),
        z: 2,
      });
      this.add(enemyName);

      this._roomPool.push({ bg, icon, name, enemyName });
    }
  }

  override onActivate(ctx: ex.SceneActivationContext<DungeonMapActivationData>): void {
    super.onActivate(ctx);
    if (ctx.data?.generateFloor) {
      const s = this.sm.state;
      s.dungeon.rooms = generateFloor(s.player.floor, s.dungeon.runSeed);
      s.dungeon.currentIndex = -1;
      if (s.dungeon.rooms.length > 0) s.dungeon.rooms[0].reachable = true;
    }
    this._syncRoomActors();
  }

  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    this._drainFeedback();
  }

  private _syncRoomActors(): void {
    const rooms = this.sm.state.dungeon.rooms;
    if (!rooms.length) return;

    const { roomW, roomH, gap, startX, centerY } = roomLayout(rooms);

    for (let i = 0; i < MAX_ROOMS; i++) {
      const set = this._roomPool[i];
      if (i >= rooms.length) {
        set.bg.graphics.visible = false;
        set.icon.graphics.visible = false;
        set.name.graphics.visible = false;
        set.enemyName.graphics.visible = false;
        continue;
      }

      const room = rooms[i];
      const rx = startX + i * (roomW + gap);
      const ry = centerY - roomH / 2;

      // Position background
      set.bg.pos = new ex.Vector(rx, ry);
      set.bg.graphics.visible = true;
      set.bg.graphics.opacity = _roomOpacity(room);

      // Update rectangle color
      set.bg.graphics.use(
        new ex.Rectangle({ width: roomW, height: roomH, color: ex.Color.fromHex(_roomBgColor(room)), }),
      );

      // Room icon
      set.icon.pos = new ex.Vector(rx + roomW / 2, ry + roomH / 2 - 10);
      set.icon.text = room.cleared ? '✓' : (ROOM_ICONS[room.type] ?? '?');
      set.icon.color = ex.Color.fromHex(room.cleared ? COLORS.textDim : COLORS.text);
      set.icon.graphics.visible = true;
      set.icon.graphics.opacity = _roomOpacity(room);

      // Room name
      set.name.pos = new ex.Vector(rx + roomW / 2, ry + roomH / 2 + 22);
      set.name.text = room.cleared ? 'Cleared' : ROOM_LABELS[room.type];
      set.name.color = ex.Color.fromHex(room.cleared ? COLORS.textDim : COLORS.text);
      set.name.graphics.visible = true;
      set.name.graphics.opacity = _roomOpacity(room);

      // Enemy name label (boss/elite only)
      const showEnemyName = !room.cleared && room.reachable && room.enemy &&
        [ROOM_TYPE.BOSS, ROOM_TYPE.ELITE].includes(room.type);
      set.enemyName.pos = new ex.Vector(rx + roomW / 2, ry + roomH + 14);
      set.enemyName.text = showEnemyName ? (room.enemy!.name.slice(0, 14)) : '';
      set.enemyName.color = ex.Color.fromHex(COLORS.textDim);
      set.enemyName.graphics.visible = showEnemyName ?? false;
    }
  }

  private _drainFeedback(): void {
    const { feedback } = this.sm.state;
    if (feedback.length === 0) return;
    for (const f of feedback) {
      this._spawnFeedbackLabel(f);
    }
    feedback.splice(0);
  }

  private _spawnFeedbackLabel(f: FeedbackMessage): void {
    const label = new ex.Label({
      text: f.text,
      x: f.x,
      y: f.y,
      color: ex.Color.fromHex(f.color),
      font: new ex.Font({
        size: 22,
        unit: ex.FontUnit.Px,
        bold: true,
        textAlign: ex.TextAlign.Center,
      }),
      z: 10,
    });
    label.actions.moveBy(0, -80, 60).fade(0, 600).die();
    this.add(label);
  }

  renderFrame(): void {
    renderDungeonScreen(this.renderer, this.sm.state);
  }

  handleClick(pos: { x: number; y: number }): void {
    const regions = getRoomHitRegions(this.sm.state.dungeon.rooms);
    for (const r of regions) {
      if (this._hit(pos, r) && r.room.reachable && !r.room.cleared) {
        this.sm.onEnterRoom(r.index);
        return;
      }
    }
  }
}

function _roomBgColor(room: Room): string {
  if (room.cleared) return COLORS.rooms.CLEARED;
  if (!room.reachable) return COLORS.rooms.LOCKED;
  return COLORS.rooms[room.type as keyof typeof COLORS.rooms] ?? COLORS.surface;
}

function _roomOpacity(room: Room): number {
  if (room.cleared) return 0.5;
  if (!room.reachable) return 0.4;
  return 1;
}
