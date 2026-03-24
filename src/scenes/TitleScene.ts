import * as ex from 'excalibur';
import type { Screen, TitleActivationData } from '../types.js';
import { renderTitleScreen, getStartButtonRegion, getSettingsButtonRegion, getContinueButtonRegion } from '../rendering/TitleScreen.js';
import { createGameState, clearSavedRun } from '../game/GameState.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class TitleScene extends GameScene<TitleActivationData> {
  readonly screens: Screen[] = ['TITLE'];

  constructor(deps: SceneDeps) { super(deps); }

  override onActivate(ctx: ex.SceneActivationContext<TitleActivationData>): void {
    super.onActivate(ctx);
    if (ctx.data?.resetState) {
      this.sm.state = createGameState();
    }
    // Always sync device lists and input mode from AudioEngine into state
    this.sm.state.micDevices = this.audio.devices;
    this.sm.state.outputDevices = this.audio.outputDevices;
    this.sm.state.audio.inputMode = this.audio.inputMode;

    // Request MIDI access and auto-connect to saved device preference
    void this.midi.requestAccess().then((ok) => {
      if (!ok) return;
      this.sm.state.midiDevices = this.midi.devices;
      const { midiDeviceId } = this.sm.state.settings;
      if (midiDeviceId) {
        this.midi.start(midiDeviceId);
      } else if (this.midi.devices.length > 0) {
        // Auto-connect to the first available MIDI device
        this.midi.start();
        this.sm.state.settings.midiDeviceId = this.midi.devices[0]?.id ?? null;
      }
      this.sm.state.midiConnected = this.midi.connected;
    });
  }

  renderFrame(): void {
    renderTitleScreen(this.renderer, this.sm.state);
  }

  async handleClick(pos: { x: number; y: number }): Promise<void> {
    // Settings button
    if (this._hit(pos, getSettingsButtonRegion())) {
      this.sm.onOpenSettings();
      return;
    }

    // Continue Run button
    if (this.sm.state.savedRun && this._hit(pos, getContinueButtonRegion())) {
      this.sm.onContinueRun();
      return;
    }

    // Start game — guard against double-click during loading
    if (this._hit(pos, getStartButtonRegion())) {
      if (this.sm.state.loadingProgress !== null) return;

      // Explicit new game clears any saved run
      clearSavedRun();
      this.sm.state.savedRun = null;

      this.sm.state.micError = null;
      this.sm.state.loadingProgress = 0;
      const { settings } = this.sm.state;

      if (settings.micEnabled) {
        const ok = await this.audio.start(settings.micDeviceId ?? undefined);
        this.sm.state.audio.inputMode = this.audio.inputMode;
        this.sm.state.micDevices = this.audio.devices;
        this.sm.state.outputDevices = this.audio.outputDevices;
        this.sm.state.loadingProgress = 50;
        if (!ok) {
          this.sm.state.micError = 'Mic not available — using virtual piano. Click keys or use A-S-D-F-G-H-J.';
        } else if (settings.micRebroadcast) {
          await this.audio.setRebroadcast(true, settings.outputDeviceId);
        }
      } else {
        this.sm.state.audio.inputMode = 'none';
        this.sm.state.loadingProgress = 50;
      }

      await this.synth.start();
      if (settings.outputDeviceId) {
        await this.synth.setOutputDevice(settings.outputDeviceId);
      }
      this.sm.state.loadingProgress = 100;

      this.sm.onStartGame();
    }
  }
}
