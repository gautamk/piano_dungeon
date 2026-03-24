import * as ex from 'excalibur';
import type { Screen, PracticeActivationData } from '../types.js';
import { renderPracticeScreen, getPracticeHitRegions } from '../rendering/OverlayScreens.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class PracticeScene extends GameScene<PracticeActivationData> {
  readonly screens: Screen[] = ['PRACTICE'];

  constructor(deps: SceneDeps) { super(deps); }

  override onActivate(ctx: ex.SceneActivationContext<PracticeActivationData>): void {
    super.onActivate(ctx);
    if (ctx.data?.songs) this.sm.state.practice.songs = ctx.data.songs;
  }

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
