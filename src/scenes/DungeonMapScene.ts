import type { Screen } from '../types.js';
import { renderDungeonScreen, getRoomHitRegions } from '../rendering/DungeonScreen.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class DungeonMapScene extends GameScene {
  readonly screens: Screen[] = ['DUNGEON_MAP'];

  constructor(deps: SceneDeps) { super(deps); }

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
