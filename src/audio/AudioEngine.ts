import type { DetectedNote, InputMode } from '../types.js';
import { GAME_CONFIG } from '../config.js';
import { PitchDetector } from './PitchDetector.js';
import { midiToNote, freqToCents } from './NoteMapper.js';

/**
 * Manages Web Audio API lifecycle.
 * Falls back to any available microphone (including MacBook built-in).
 * Must be initialized inside a user gesture handler due to autoplay policy.
 */
export class AudioEngine {
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
  stream: MediaStream | null;
  detector: PitchDetector | null;
  selectedDeviceId: string | null;
  devices: MediaDeviceInfo[];
  inputMode: InputMode;
  currentNote: DetectedNote | null;
  rawFrequency: number | null;

  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.detector = null;
    this.selectedDeviceId = localStorage.getItem('pianoMicDeviceId') ?? null;
    this.devices = [];
    this.inputMode = 'none';

    this.currentNote = null;
    this.rawFrequency = null;
  }

  async loadDevices(): Promise<MediaDeviceInfo[]> {
    const all = await navigator.mediaDevices.enumerateDevices();
    this.devices = all.filter(d => d.kind === 'audioinput');
    return this.devices;
  }

  /**
   * Request mic access. Uses stored device if available, otherwise uses system default.
   * Returns true on success, false if permission denied.
   */
  async start(deviceId?: string): Promise<boolean> {
    if (deviceId) {
      this.selectedDeviceId = deviceId;
      localStorage.setItem('pianoMicDeviceId', deviceId);
    }

    // Build audio constraints - no processing so piano sounds come through clean
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    };
    if (this.selectedDeviceId) {
      audioConstraints.deviceId = { ideal: this.selectedDeviceId };
    }

    // Race mic request against a 3s timeout so a stuck permission dialog never blocks the game
    const withTimeout = (promise: Promise<MediaStream>) => Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);

    try {
      this.stream = await withTimeout(navigator.mediaDevices.getUserMedia({ audio: audioConstraints }));
    } catch {
      try {
        this.stream = await withTimeout(navigator.mediaDevices.getUserMedia({ audio: true }));
      } catch {
        return false;
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

  tick(): void {
    if (!this.detector) return;

    const result = this.detector.detect();

    if (result.stable && result.frequency && result.midi !== undefined) {
      // PitchDetector already computed result.midi — reuse it to avoid a second Math.log2 call
      const note = midiToNote(result.midi);
      const cents = freqToCents(result.frequency, result.midi);
      this.currentNote = { ...note, frequency: result.frequency, cents };
      this.rawFrequency = result.frequency;
    } else if (!result.frequency) {
      this.currentNote = null;
      this.rawFrequency = null;
    }
  }

  stop(): void {
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

  get isRunning(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }
}
