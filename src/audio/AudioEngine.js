import { GAME_CONFIG } from '../config.js';
import { PitchDetector } from './PitchDetector.js';
import { freqToNote, freqToCents } from './NoteMapper.js';

/**
 * Manages Web Audio API lifecycle.
 * Falls back to any available microphone (including MacBook built-in).
 * Must be initialized inside a user gesture handler due to autoplay policy.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.detector = null;
    this.selectedDeviceId = localStorage.getItem('pianoMicDeviceId') ?? null;
    this.devices = [];
    this.inputMode = 'none'; // 'mic' | 'none'

    this.currentNote = null;
    this.rawFrequency = null;
  }

  async loadDevices() {
    const all = await navigator.mediaDevices.enumerateDevices();
    this.devices = all.filter(d => d.kind === 'audioinput');
    return this.devices;
  }

  /**
   * Request mic access. Uses stored device if available, otherwise uses system default.
   * Returns true on success, false if permission denied.
   */
  async start(deviceId) {
    if (deviceId) {
      this.selectedDeviceId = deviceId;
      localStorage.setItem('pianoMicDeviceId', deviceId);
    }

    // Build audio constraints - no processing so piano sounds come through clean
    const audioConstraints = {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    };
    if (this.selectedDeviceId) {
      audioConstraints.deviceId = { ideal: this.selectedDeviceId };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    } catch {
      // Try again with no constraints (broadest compatibility - picks system default mic)
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        return false; // mic permission denied entirely
      }
    }

    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = GAME_CONFIG.audio.fftSize;
    this.analyser.smoothingTimeConstant = 0.0;

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);

    this.detector = new PitchDetector(this.analyser, this.ctx.sampleRate);
    this.inputMode = 'mic';

    await this.loadDevices();
    return true;
  }

  tick() {
    if (!this.detector) return;

    const result = this.detector.detect();

    if (result.stable && result.frequency) {
      const note = freqToNote(result.frequency);
      if (note) {
        const cents = freqToCents(result.frequency, note.midi);
        this.currentNote = { ...note, frequency: result.frequency, cents };
      }
      this.rawFrequency = result.frequency;
    } else if (!result.frequency) {
      this.currentNote = null;
      this.rawFrequency = null;
    }
  }

  stop() {
    this.source?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.detector = null;
    this.currentNote = null;
    this.inputMode = 'none';
  }

  get isRunning() {
    return this.ctx !== null && this.ctx.state === 'running';
  }
}
