import type { Screen } from '../types.js';
import { renderGameOverScreen, getRestartButtonRegion } from '../rendering/OverlayScreens.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class GameOverScene extends GameScene {
  readonly screens: Screen[] = ['GAME_OVER'];

  constructor(deps: SceneDeps) { super(deps); }

  renderFrame(): void {
    renderGameOverScreen(this.renderer, this.sm.state);
  }

  handleClick(pos: { x: number; y: number }): void {
    if (this._hit(pos, getRestartButtonRegion())) this.sm.onRestartGame();
  }
}
