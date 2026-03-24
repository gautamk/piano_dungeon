/**
 * Manages Web MIDI API access.
 * Notes feed through triggerVirtualNote() — no separate evaluation path.
 * Must call requestAccess() inside a user gesture handler (or on page load).
 */
export class MidiEngine {
  private _access: MIDIAccess | null = null;
  private _input: MIDIInput | null = null;
  private _noteCallback: ((semitone: number, octave: number) => void) | null = null;

  devices: { id: string; name: string }[] = [];
  connected: boolean = false;

  /**
   * Request Web MIDI access. Safe to call regardless of browser support.
   * Returns true if access granted, false if unavailable or denied.
   */
  async requestAccess(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) return false;
    try {
      this._access = await navigator.requestMIDIAccess();
      this._syncDevices();
      this._access.onstatechange = () => this._syncDevices();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Attach to a MIDI input device by id. Defaults to the first available device.
   * Detaches the previous input first.
   */
  start(deviceId?: string): void {
    this.stop();
    if (!this._access) return;
    const targetId = deviceId ?? this.devices[0]?.id;
    if (!targetId) return;
    const input = this._access.inputs.get(targetId);
    if (!input) return;
    this._input = input;
    this._input.onmidimessage = (evt) => this._handleMessage(evt);
    this.connected = true;
  }

  /** Detach from the current MIDI input device. */
  stop(): void {
    if (this._input) {
      this._input.onmidimessage = null;
      this._input = null;
    }
    this.connected = false;
  }

  /** Register a callback that fires on every MIDI note-on event. */
  onNote(cb: (semitone: number, octave: number) => void): void {
    this._noteCallback = cb;
  }

  private _syncDevices(): void {
    if (!this._access) return;
    this.devices = [];
    for (const input of this._access.inputs.values()) {
      this.devices.push({ id: input.id, name: input.name ?? `MIDI Input ${input.id}` });
    }
  }

  private _handleMessage(evt: MIDIMessageEvent): void {
    if (!evt.data || evt.data.length < 3) return;
    const status = evt.data[0];
    const note   = evt.data[1];
    const velocity = evt.data[2];
    // Note-on: status high nibble 0x9, velocity > 0
    const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;
    if (!isNoteOn) return;
    const semitone = note % 12;
    const octave = Math.floor(note / 12) - 1;
    this._noteCallback?.(semitone, octave);
  }
}
