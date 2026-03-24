import type { Screen, SettingsActivationData } from '../types.js';
import { saveSettings } from '../game/GameState.js';
import { renderSettingsScreen, getSettingsHitRegions } from '../rendering/SettingsScreen.js';
import { GameScene, type SceneDeps } from './GameScene.js';

export class SettingsScene extends GameScene<SettingsActivationData> {
  readonly screens: Screen[] = ['SETTINGS'];

  constructor(deps: SceneDeps) { super(deps); }

  override renderFrame(): void {
    renderSettingsScreen(this.renderer, this.sm.state);
  }

  override async handleClick(pos: { x: number; y: number }): Promise<void> {
    const state = this.sm.state;
    const regions = getSettingsHitRegions(state);

    if (this._hit(pos, regions.close)) {
      this.sm.onCloseSettings();
      return;
    }

    // Mic enable toggle
    if (this._hit(pos, regions.micEnabledToggle)) {
      state.settings.micEnabled = !state.settings.micEnabled;
      saveSettings(state.settings);
      return;
    }

    // Mic device selection
    for (const r of regions.micDeviceItems) {
      if (this._hit(pos, r)) {
        state.settings.micDeviceId = r.deviceId;
        saveSettings(state.settings);
        // Restart mic on the newly selected device
        if (state.settings.micEnabled) {
          const ok = await this.audio.start(r.deviceId);
          state.audio.inputMode = this.audio.inputMode;
          if (ok) {
            state.micDevices = this.audio.devices;
            state.outputDevices = this.audio.outputDevices;
          }
        }
        return;
      }
    }

    // Output device selection
    for (const r of regions.outputDeviceItems) {
      if (this._hit(pos, r)) {
        state.settings.outputDeviceId = r.deviceId;
        saveSettings(state.settings);
        await this.synth.setOutputDevice(r.deviceId);
        if (state.settings.micRebroadcast) {
          await this.audio.setRebroadcast(true, r.deviceId);
        }
        return;
      }
    }

    // Rebroadcast toggle
    if (this._hit(pos, regions.rebroadcastToggle)) {
      const next = !state.settings.micRebroadcast;
      state.settings.micRebroadcast = next;
      saveSettings(state.settings);
      await this.audio.setRebroadcast(next, state.settings.outputDeviceId);
      return;
    }

    // Show labels toggle
    if (this._hit(pos, regions.showLabelsToggle)) {
      state.settings.showPianoLabels = !state.settings.showPianoLabels;
      saveSettings(state.settings);
      return;
    }
  }
}
