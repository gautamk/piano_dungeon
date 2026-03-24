import type { Screen, ShopActivationData } from '../types.js';
import { renderShopScreen, getShopHitRegions } from '../rendering/OverlayScreens.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class ShopScene extends GameScene<ShopActivationData> {
  readonly screens: Screen[] = ['SHOP'];

  constructor(deps: SceneDeps) { super(deps); }

  renderFrame(): void {
    renderShopScreen(this.renderer, this.sm.state);
    this.renderer.renderFeedback(this.sm.state.feedback);
  }

  handleClick(pos: { x: number; y: number }): void {
    const { buyHp, leave } = getShopHitRegions();
    if (this._hit(pos, buyHp)) this.sm.onBuyHp();
    if (this._hit(pos, leave)) this.sm.onLeaveShop();
  }
}
