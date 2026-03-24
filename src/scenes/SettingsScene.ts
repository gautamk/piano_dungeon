import * as ex from 'excalibur';
import type { Screen, SettingsActivationData } from '../types.js';
import { saveSettings } from '../game/GameState.js';
import {
  renderSettingsScreen,
  getSettingsHitRegions,
  getSettingsContentHeight,
  type OpenDropdown,
} from '../rendering/SettingsScreen.js';
import { GameScene, type SceneDeps } from './GameScene.js';

const SCROLL_VIEWPORT_H = 720 - 70; // 720 canvas - SCROLL_TOP

export class SettingsScene extends GameScene<SettingsActivationData> {
  readonly screens: Screen[] = ['SETTINGS'];

  private _scrollY = 0;
  private _maxScrollY = 0;
  private _openDropdown: OpenDropdown = null;
  private _wheelHandler?: (e: WheelEvent) => void;

  constructor(deps: SceneDeps) { super(deps); }

  override onActivate(ctx: ex.SceneActivationContext<SettingsActivationData>): void {
    super.onActivate(ctx);
    this._scrollY = 0;
    this._openDropdown = null;
    void this.audio.loadDevices().then(() => {
      this.sm.state.micDevices = this.audio.devices;
      this.sm.state.outputDevices = this.audio.outputDevices;
    });
    // Sync MIDI device list
    this.sm.state.midiDevices = this.midi.devices;
    this.sm.state.midiConnected = this.midi.connected;
    this._wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      this._scrollY = Math.max(0, Math.min(this._scrollY + e.deltaY * 0.6, this._maxScrollY));
    };
    document.addEventListener('wheel', this._wheelHandler, { passive: false });
  }

  override onDeactivate(_ctx: ex.SceneActivationContext<never>): void {
    super.onDeactivate(_ctx);
    if (this._wheelHandler) {
      document.removeEventListener('wheel', this._wheelHandler);
      this._wheelHandler = undefined;
    }
  }

  override renderFrame(): void {
    this._maxScrollY = Math.max(0, getSettingsContentHeight(this.sm.state) - SCROLL_VIEWPORT_H + 20);
    renderSettingsScreen(this.renderer, this.sm.state, this._scrollY, this._openDropdown);
  }

  override async handleClick(pos: { x: number; y: number }): Promise<void> {
    const state = this.sm.state;
    const regions = getSettingsHitRegions(state, this._scrollY, this._openDropdown);

    if (this._hit(pos, regions.close)) {
      this.sm.onCloseSettings();
      return;
    }

    // While a dropdown is open it acts as a modal: clicks select an item or close it.
    if (this._openDropdown !== null) {
      const items = this._openDropdown === 'mic'
        ? regions.micDeviceItems
        : this._openDropdown === 'midi'
          ? regions.midiDeviceItems
          : regions.outputDeviceItems;
      for (const r of items) {
        if (this._hit(pos, r)) {
          if (this._openDropdown === 'mic') {
            state.settings.micDeviceId = r.deviceId || null;
            saveSettings(state.settings);
            if (state.settings.micEnabled) {
              const ok = await this.audio.start(r.deviceId);
              state.audio.inputMode = this.audio.inputMode;
              if (ok) {
                state.micDevices = this.audio.devices;
                state.outputDevices = this.audio.outputDevices;
              }
            }
          } else if (this._openDropdown === 'midi') {
            state.settings.midiDeviceId = r.deviceId || null;
            saveSettings(state.settings);
            this.midi.start(r.deviceId);
            state.midiConnected = this.midi.connected;
          } else {
            state.settings.outputDeviceId = r.deviceId;
            saveSettings(state.settings);
            await this.synth.setOutputDevice(r.deviceId);
            if (state.settings.micRebroadcast) {
              await this.audio.setRebroadcast(true, r.deviceId);
            }
          }
          this._openDropdown = null;
          return;
        }
      }
      // Clicked outside the open dropdown — dismiss it (don't process other regions).
      this._openDropdown = null;
      return;
    }

    // Normal clicks (no dropdown open).
    if (this._hit(pos, regions.micEnabledToggle)) {
      state.settings.micEnabled = !state.settings.micEnabled;
      saveSettings(state.settings);
      return;
    }

    if (this._hit(pos, regions.micDropdownHeader)) {
      this._openDropdown = 'mic';
      return;
    }

    if (this._hit(pos, regions.outputDropdownHeader)) {
      this._openDropdown = 'output';
      return;
    }

    if (this._hit(pos, regions.rebroadcastToggle)) {
      const next = !state.settings.micRebroadcast;
      state.settings.micRebroadcast = next;
      saveSettings(state.settings);
      await this.audio.setRebroadcast(next, state.settings.outputDeviceId);
      return;
    }

    if (this._hit(pos, regions.showLabelsToggle)) {
      state.settings.showPianoLabels = !state.settings.showPianoLabels;
      saveSettings(state.settings);
      return;
    }

    if (regions.midiDropdownHeader && this._hit(pos, regions.midiDropdownHeader)) {
      this._openDropdown = 'midi';
      return;
    }
  }
}
