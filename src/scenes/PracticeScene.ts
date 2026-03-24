import type { Screen } from '../types.js';
import { renderPracticeScreen, getPracticeHitRegions } from '../rendering/OverlayScreens.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class PracticeScene extends GameScene {
  readonly screens: Screen[] = ['PRACTICE'];

  constructor(deps: SceneDeps) { super(deps); }

  renderFrame(): void {
    renderPracticeScreen(this.renderer, this.sm.state);
  }

  handleClick(pos: { x: number; y: number }): void {
    const songs = this.sm.state.practice?.songs ?? [];
    for (const r of getPracticeHitRegions(songs)) {
      if (this._hit(pos, r)) {
        this.sm.onSelectPracticeSong(r.songId);
        return;
      }
    }
  }
}
