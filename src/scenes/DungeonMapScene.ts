import * as ex from 'excalibur';
import type { Screen, DungeonMapActivationData } from '../types.js';
import { renderDungeonScreen, getRoomHitRegions } from '../rendering/DungeonScreen.js';
import { generateFloor } from '../game/DungeonGenerator.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class DungeonMapScene extends GameScene<DungeonMapActivationData> {
  readonly screens: Screen[] = ['DUNGEON_MAP'];

  constructor(deps: SceneDeps) { super(deps); }

  override onActivate(ctx: ex.SceneActivationContext<DungeonMapActivationData>): void {
    super.onActivate(ctx);
    if (ctx.data?.generateFloor) {
      const s = this.sm.state;
      s.dungeon.rooms = generateFloor(s.player.floor, s.dungeon.runSeed);
      s.dungeon.currentIndex = -1;
      if (s.dungeon.rooms.length > 0) s.dungeon.rooms[0].reachable = true;
    }
  }

  renderFrame(): void {
    renderDungeonScreen(this.renderer, this.sm.state);
    this.renderer.renderFeedback(this.sm.state.feedback);
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
