import * as ex from 'excalibur';
import type { Screen, SceneActivationData } from '../types.js';
import type { StateMachine } from '../game/StateMachine.js';
import type { AudioEngine } from '../audio/AudioEngine.js';
import type { AudioSynth } from '../audio/AudioSynth.js';
import type { Renderer } from '../rendering/Renderer.js';

export interface SceneDeps {
  sm: StateMachine;
  audio: AudioEngine;
  synth: AudioSynth;
  renderer: Renderer;
}

// Maps every Screen value to a registered scene name.
// ROOM_CLEAR shares 'battle' — BattleScene handles both.
export const SCREEN_TO_SCENE: Record<Screen, string> = {
  TITLE:       'title',
  DUNGEON_MAP: 'dungeon_map',
  BATTLE:      'battle',
  ROOM_CLEAR:  'battle',
  FLOOR_CLEAR: 'floor_clear',
  SHOP:        'shop',
  PRACTICE:    'practice',
  GAME_OVER:   'game_over',
  VICTORY:     'victory',
  SETTINGS:    'settings',
};

/**
 * Abstract base for all game screens.
 *
 * Responsibilities:
 *  - Creates a full-screen `ex.Canvas` actor that routes to `renderFrame()` each draw tick
 *  - Runs `audio.tick()` + `sm.tick()` in `onPreUpdate`, then triggers `engine.goToScene`
 *    when the state machine has transitioned away from this scene's screens
 *  - Registers / removes the canvas click listener in `onActivate` / `onDeactivate`
 */
export abstract class GameScene<TData = SceneActivationData> extends ex.Scene<TData> {
  protected sm: StateMachine;
  protected audio: AudioEngine;
  protected synth: AudioSynth;
  protected renderer: Renderer;

  /** Screen names this scene is responsible for. */
  abstract readonly screens: Screen[];

  private _boundPointerUp?: (e: ex.PointerEvent) => void;

  constructor(deps: SceneDeps) {
    super();
    this.sm       = deps.sm;
    this.audio    = deps.audio;
    this.synth    = deps.synth;
    this.renderer = deps.renderer;
  }

  override onInitialize(_engine: ex.Engine): void {
    const legacyCanvas = new ex.Canvas({
      width: 1280,
      height: 720,
      cache: false,
      draw: (ctx) => {
        this.renderer.ctx = ctx;
        this.renderFrame();
      },
    });
    const actor = new ex.Actor({ x: 0, y: 0, anchor: ex.Vector.Zero });
    actor.graphics.use(legacyCanvas);
    this.add(actor);
  }

  override onActivate(_ctx: ex.SceneActivationContext<TData>): void {
    this._boundPointerUp = (e: ex.PointerEvent) => { void this.handleClick({ x: e.screenPos.x, y: e.screenPos.y }); };
    this.engine.input.pointers.primary.on('up', this._boundPointerUp);
    this.sm.setTransitionCallback((screen, data) => {
      if (!this.screens.includes(screen)) {
        void this.engine.goToScene(SCREEN_TO_SCENE[screen], { sceneActivationData: data });
      }
    });
  }

  override onDeactivate(_ctx: ex.SceneActivationContext<never>): void {
    if (this._boundPointerUp) {
      this.engine.input.pointers.primary.off('up', this._boundPointerUp);
    }
    this.sm.clearTransitionCallback();
  }

  override onPreUpdate(_engine: ex.Engine, elapsed: number): void {
    this.audio.tick();
    this.sm.tick(elapsed);
  }

  /** Called each frame; subclasses render their screen here. */
  abstract renderFrame(): void;

  /** Called on canvas click with logical 1280×720 coordinates. */
  abstract handleClick(pos: { x: number; y: number }): void | Promise<void>;

  protected _hit(
    pos: { x: number; y: number },
    r: { x: number; y: number; w: number; h: number },
  ): boolean {
    return pos.x >= r.x && pos.x <= r.x + r.w
        && pos.y >= r.y && pos.y <= r.y + r.h;
  }
}
