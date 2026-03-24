import type { Screen } from '../types.js';
import { renderFloorClearScreen, getFloorClearButtonRegion } from '../rendering/OverlayScreens.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class FloorClearScene extends GameScene {
  readonly screens: Screen[] = ['FLOOR_CLEAR'];

  constructor(deps: SceneDeps) { super(deps); }

  renderFrame(): void {
    renderFloorClearScreen(this.renderer, this.sm.state);
  }

  handleClick(pos: { x: number; y: number }): void {
    if (this._hit(pos, getFloorClearButtonRegion())) this.sm.onNextFloor();
  }
}
