import type { GameState, HitRegion } from '../types.js';
import { COLORS } from '../config.js';
import type { Renderer } from './Renderer.js';

// ─── Layout constants ────────────────────────────────────────────────────────

const PAD_X = 120;
const SECTION_X = PAD_X;
const LABEL_X = PAD_X;
const TOGGLE_X = 960;
const LIST_X = TOGGLE_X;
const LIST_W = 360;
const ROW_H = 36;
const TOGGLE_W = 80;
const TOGGLE_H = 32;
const CLOSE_W = 120;
const CLOSE_H = 36;
const CLOSE_X = 1280 - PAD_X - CLOSE_W;
const CLOSE_Y = 30;
const SCROLL_TOP = 70;

// Fixed Y positions — dropdowns are single-row so layout no longer grows with device count.
const MIC_DROPDOWN_Y = 230;
const DROPDOWN_H = 36;
const OUTPUT_HEADER_Y = MIC_DROPDOWN_Y + DROPDOWN_H + 30;  // 296
const OUTPUT_DROPDOWN_Y = OUTPUT_HEADER_Y + 44;             // 340
const REBROADCAST_Y = OUTPUT_DROPDOWN_Y + DROPDOWN_H + 20; // 396
const DISPLAY_Y = REBROADCAST_Y + TOGGLE_H + 60;           // 488
const MIDI_HEADER_Y = DISPLAY_Y + 110;                      // 598 (only shown when MIDI devices present)
const MIDI_DROPDOWN_Y = MIDI_HEADER_Y + 44;                 // 642

export type OpenDropdown = 'mic' | 'output' | 'midi' | null;

export interface SettingsHitRegions {
  close: HitRegion;
  micEnabledToggle: HitRegion;
  micDropdownHeader: HitRegion;
  micDeviceItems: Array<HitRegion & { deviceId: string }>;
  outputDropdownHeader: HitRegion;
  outputDeviceItems: Array<HitRegion & { deviceId: string }>;
  rebroadcastToggle: HitRegion;
  showLabelsToggle: HitRegion;
  midiDropdownHeader: HitRegion | null;
  midiDeviceItems: Array<HitRegion & { deviceId: string }>;
}

// ─── Content height ───────────────────────────────────────────────────────────

export function getSettingsContentHeight(state: GameState): number {
  if (state.midiDevices.length > 0) return MIDI_DROPDOWN_Y + DROPDOWN_H + 20;
  return DISPLAY_Y + 90;
}

// ─── Hit region builder ──────────────────────────────────────────────────────

export function getSettingsHitRegions(
  state: GameState,
  scrollY = 0,
  openDropdown: OpenDropdown = null,
): SettingsHitRegions {
  const s = (absY: number) => absY - scrollY; // content Y → screen Y

  const micDeviceItems: Array<HitRegion & { deviceId: string }> = [];
  const outputDeviceItems: Array<HitRegion & { deviceId: string }> = [];

  // Dropdown items are rendered as an overlay at screen coordinates (after scroll clip).
  if (openDropdown === 'mic') {
    const micDisplayList = [{ deviceId: '' }, ...state.micDevices];
    const startY = s(MIC_DROPDOWN_Y) + DROPDOWN_H;
    for (let i = 0; i < micDisplayList.length; i++) {
      micDeviceItems.push({
        x: LIST_X, y: startY + i * ROW_H, w: LIST_W, h: ROW_H - 2,
        deviceId: micDisplayList[i].deviceId,
      });
    }
  }

  if (openDropdown === 'output') {
    const startY = s(OUTPUT_DROPDOWN_Y) + DROPDOWN_H;
    for (let i = 0; i < state.outputDevices.length; i++) {
      outputDeviceItems.push({
        x: LIST_X, y: startY + i * ROW_H, w: LIST_W, h: ROW_H - 2,
        deviceId: state.outputDevices[i].deviceId,
      });
    }
  }

  const midiDeviceItems: Array<HitRegion & { deviceId: string }> = [];
  if (openDropdown === 'midi') {
    const startY = s(MIDI_DROPDOWN_Y) + DROPDOWN_H;
    for (let i = 0; i < state.midiDevices.length; i++) {
      midiDeviceItems.push({
        x: LIST_X, y: startY + i * ROW_H, w: LIST_W, h: ROW_H - 2,
        deviceId: state.midiDevices[i].id,
      });
    }
  }

  return {
    close: { x: CLOSE_X, y: CLOSE_Y, w: CLOSE_W, h: CLOSE_H },
    micEnabledToggle: { x: TOGGLE_X, y: s(148), w: TOGGLE_W, h: TOGGLE_H },
    micDropdownHeader: { x: LIST_X, y: s(MIC_DROPDOWN_Y), w: LIST_W, h: DROPDOWN_H },
    micDeviceItems,
    outputDropdownHeader: { x: LIST_X, y: s(OUTPUT_DROPDOWN_Y), w: LIST_W, h: DROPDOWN_H },
    outputDeviceItems,
    rebroadcastToggle: { x: TOGGLE_X, y: s(REBROADCAST_Y), w: TOGGLE_W, h: TOGGLE_H },
    showLabelsToggle: { x: TOGGLE_X, y: s(DISPLAY_Y + 20), w: TOGGLE_W, h: TOGGLE_H },
    midiDropdownHeader: state.midiDevices.length > 0
      ? { x: LIST_X, y: s(MIDI_DROPDOWN_Y), w: LIST_W, h: DROPDOWN_H }
      : null,
    midiDeviceItems,
  };
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderSettingsScreen(
  renderer: Renderer,
  state: GameState,
  scrollY = 0,
  openDropdown: OpenDropdown = null,
): void {
  const ctx = renderer.ctx;
  const { settings, micDevices, outputDevices } = state;

  // Background
  renderer.rect(0, 0, 1280, 720, COLORS.bg);

  // Title (fixed — outside scroll)
  renderer.text('SETTINGS', 1280 / 2, 52, {
    size: 28, color: COLORS.accent, align: 'center', weight: 'bold',
  });

  // Close button (fixed — outside scroll)
  _drawButton(renderer, CLOSE_X, CLOSE_Y, CLOSE_W, CLOSE_H, '✕  Close', false);

  // ── Scrollable content ────────────────────────────────────────────────────

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, SCROLL_TOP, 1280, 720 - SCROLL_TOP);
  ctx.clip();
  ctx.translate(0, -scrollY);

  // AUDIO INPUT
  _sectionHeader(renderer, 'AUDIO INPUT', 105);
  renderer.text('Enable microphone', LABEL_X, 164, { size: 14, color: COLORS.text });
  _drawToggle(renderer, TOGGLE_X, 148, settings.micEnabled);

  renderer.text('Microphone device', LABEL_X, 210, { size: 14, color: COLORS.text });
  const micDisplayList = [{ deviceId: '', label: 'Default (system)' }, ...micDevices];
  const selectedMicLabel = micDisplayList.find(d => d.deviceId === (settings.micDeviceId ?? ''))?.label
    ?? 'Default (system)';
  _drawDropdownHeader(ctx, selectedMicLabel, MIC_DROPDOWN_Y, openDropdown === 'mic');

  // AUDIO OUTPUT
  _sectionHeader(renderer, 'AUDIO OUTPUT', OUTPUT_HEADER_Y);
  renderer.text('Speaker output', LABEL_X, OUTPUT_HEADER_Y + 26, { size: 14, color: COLORS.text });
  const selectedOutputLabel = outputDevices.find(d => d.deviceId === (settings.outputDeviceId ?? ''))?.label
    ?? outputDevices[0]?.label ?? '—';
  _drawDropdownHeader(ctx, selectedOutputLabel, OUTPUT_DROPDOWN_Y, openDropdown === 'output');

  // Rebroadcast
  _drawToggle(renderer, TOGGLE_X, REBROADCAST_Y, settings.micRebroadcast);
  renderer.text('Mic rebroadcast to speaker', LABEL_X, REBROADCAST_Y + 14, { size: 14, color: COLORS.text });
  renderer.text('(Plays mic input through selected speaker)', LABEL_X, REBROADCAST_Y + 30, { size: 11, color: COLORS.textDim });

  // DISPLAY
  _sectionHeader(renderer, 'DISPLAY', DISPLAY_Y);
  renderer.text('Show piano key labels', LABEL_X, DISPLAY_Y + 36, { size: 14, color: COLORS.text });
  renderer.text('(Show note names on all white keys)', LABEL_X, DISPLAY_Y + 54, { size: 11, color: COLORS.textDim });
  _drawToggle(renderer, TOGGLE_X, DISPLAY_Y + 20, settings.showPianoLabels);

  renderer.text(
    'Note: output device selection requires Chrome or Edge.',
    1280 / 2, DISPLAY_Y + 90,
    { size: 11, color: COLORS.textDim, align: 'center' },
  );

  // MIDI INPUT (only rendered when MIDI devices are available)
  if (state.midiDevices.length > 0) {
    _sectionHeader(renderer, 'MIDI INPUT', MIDI_HEADER_Y);
    renderer.text('MIDI device', LABEL_X, MIDI_HEADER_Y + 26, { size: 14, color: COLORS.text });
    renderer.text('(USB/Bluetooth MIDI keyboard)', LABEL_X, MIDI_HEADER_Y + 42, { size: 11, color: COLORS.textDim });
    const selectedMidi = state.midiDevices.find(d => d.id === (settings.midiDeviceId ?? ''))?.name
      ?? state.midiDevices[0]?.name ?? '—';
    _drawDropdownHeader(ctx, selectedMidi, MIDI_DROPDOWN_Y, openDropdown === 'midi');
  }

  ctx.restore();

  // ── Dropdown overlays (drawn after clip restore, floats above all content) ──

  if (openDropdown === 'mic') {
    _drawDropdownItems(ctx, micDisplayList, settings.micDeviceId ?? '', MIC_DROPDOWN_Y - scrollY + DROPDOWN_H);
  }
  if (openDropdown === 'output') {
    _drawDropdownItems(ctx, outputDevices, settings.outputDeviceId ?? '', OUTPUT_DROPDOWN_Y - scrollY + DROPDOWN_H);
  }
  if (openDropdown === 'midi' && state.midiDevices.length > 0) {
    _drawDropdownItems(
      ctx,
      state.midiDevices.map(d => ({ deviceId: d.id, label: d.name })),
      settings.midiDeviceId ?? '',
      MIDI_DROPDOWN_Y - scrollY + DROPDOWN_H,
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _sectionHeader(renderer: Renderer, label: string, y: number): void {
  renderer.text(label, SECTION_X, y, { size: 12, color: COLORS.textDim, weight: 'bold' });
  renderer.line(SECTION_X, y + 8, 1280 - SECTION_X, y + 8, COLORS.border, 1);
}

function _drawDropdownHeader(
  ctx: CanvasRenderingContext2D,
  selectedLabel: string,
  y: number,
  isOpen: boolean,
): void {
  // Box
  ctx.fillStyle = COLORS.surface;
  ctx.beginPath();
  ctx.roundRect(LIST_X, y, LIST_W, DROPDOWN_H, 4);
  ctx.fill();
  ctx.strokeStyle = isOpen ? COLORS.accent : COLORS.border;
  ctx.lineWidth = isOpen ? 2 : 1;
  ctx.beginPath();
  ctx.roundRect(LIST_X, y, LIST_W, DROPDOWN_H, 4);
  ctx.stroke();

  // Selected label (truncated)
  const maxW = LIST_W - 36;
  ctx.fillStyle = COLORS.text;
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let label = selectedLabel;
  while (ctx.measureText(label).width > maxW && label.length > 4) {
    label = label.slice(0, -4) + '...';
  }
  ctx.fillText(label, LIST_X + 12, y + DROPDOWN_H / 2);

  // Chevron
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(isOpen ? '▴' : '▾', LIST_X + LIST_W - 12, y + DROPDOWN_H / 2);
}

function _drawDropdownItems(
  ctx: CanvasRenderingContext2D,
  devices: ReadonlyArray<{ deviceId: string; label: string }>,
  selectedId: string,
  screenY: number,
): void {
  if (devices.length === 0) return;

  const totalH = devices.length * ROW_H + 4;

  // Background panel
  ctx.fillStyle = COLORS.bg;
  ctx.beginPath();
  ctx.roundRect(LIST_X, screenY, LIST_W, totalH, 4);
  ctx.fill();
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(LIST_X, screenY, LIST_W, totalH, 4);
  ctx.stroke();

  for (let i = 0; i < devices.length; i++) {
    const d = devices[i];
    const itemY = screenY + 2 + i * ROW_H;
    const isSelected = d.deviceId === selectedId || (i === 0 && !selectedId);

    if (isSelected) {
      ctx.fillStyle = COLORS.surface;
      ctx.fillRect(LIST_X + 1, itemY, LIST_W - 2, ROW_H - 2);
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(LIST_X + 1, itemY, 3, ROW_H - 2);
    }

    const rawLabel = d.label || `Device ${i + 1}`;
    ctx.fillStyle = isSelected ? COLORS.accent : COLORS.text;
    ctx.font = isSelected ? 'bold 12px monospace' : '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxW = LIST_W - 20;
    let truncated = rawLabel;
    while (ctx.measureText(truncated).width > maxW && truncated.length > 4) {
      truncated = truncated.slice(0, -4) + '...';
    }
    ctx.fillText(truncated, LIST_X + 12, itemY + (ROW_H - 2) / 2);
  }
}

function _drawToggle(renderer: Renderer, x: number, y: number, on: boolean): void {
  const ctx = renderer.ctx;
  const bg = on ? COLORS.success : COLORS.border;
  const r = TOGGLE_H / 2;

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, TOGGLE_W, TOGGLE_H, r);
  ctx.fill();

  const knobX = on ? x + TOGGLE_W - r - 2 : x + r + 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(knobX, y + r, r - 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = on ? '#000' : COLORS.text;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(on ? 'ON' : 'OFF', x + TOGGLE_W / 2, y + r);
}

function _drawButton(
  renderer: Renderer,
  x: number, y: number, w: number, h: number,
  label: string,
  _active: boolean,
): void {
  renderer.rect(x, y, w, h, COLORS.surface, 6);
  renderer.rectStroke(x, y, w, h, COLORS.border, 1, 6);
  renderer.text(label, x + w / 2, y + h / 2, { size: 13, color: COLORS.text, align: 'center' });
}
