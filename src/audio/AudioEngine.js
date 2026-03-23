import { GAME_CONFIG } from '../config.js';
import { PitchDetector } from './PitchDetector.js';
import { freqToNote, freqToCents } from './NoteMapper.js';

/**
 * Manages the Web Audio API lifecycle.
 * Must be initialized inside a user gesture handler (click) due to autoplay policy.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.detector = null;
    this.selectedDeviceId = localStorage.getItem('pianoMicDeviceId') ?? undefined;
    this.devices = [];

    // Last stable note detected - read by game loop
    this.currentNote = null; // { semitone, octave, name, midi, frequency, cents }
    this.rawFrequency = null;
  }

  /** Enumerate audio input devices. Call after getUserMedia permission is granted. */
  async loadDevices() {
    const all = await navigator.mediaDevices.enumerateDevices();
    this.devices = all.filter(d => d.kind === 'audioinput');
    return this.devices;
  }

  /**
   * Request mic access and start audio processing.
   * deviceId: optional, use stored/selected device.
   */
  async start(deviceId) {
    if (deviceId) {
      this.selectedDeviceId = deviceId;
      localStorage.setItem('pianoMicDeviceId', deviceId);
    }

    const constraints = {
      audio: {
        deviceId: this.selectedDeviceId ? { ideal: this.selectedDeviceId } : undefined,
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
        latency: 0,
      },
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = GAME_CONFIG.audio.fftSize;
    this.analyser.smoothingTimeConstant = 0.0;

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);

    this.detector = new PitchDetector(this.analyser, this.ctx.sampleRate);

    // After permission granted, enumerate real device labels
    await this.loadDevices();
  }

  /** Call once per animation frame. Updates currentNote. */
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
      // Silence - clear current note after detector confirms silence
      this.currentNote = null;
      this.rawFrequency = null;
    }
    // If detected but not stable yet, keep last stable note
  }

  /** Stop all audio processing and release resources. */
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
  }

  get isRunning() {
    return this.ctx !== null && this.ctx.state === 'running';
  }
}
