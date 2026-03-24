import type { GameState, HitRegion } from '../types.js';
import { COLORS } from '../config.js';
import type { Renderer } from './Renderer.js';

// ─── Layout constants ────────────────────────────────────────────────────────

const PAD_X = 120;          // left margin for content
const SECTION_X = PAD_X;
const LABEL_X = PAD_X;
const TOGGLE_X = 960;       // x-start of toggle / device list column
const LIST_X = TOGGLE_X;
const LIST_W = 360;         // width of device list items
const ROW_H = 36;           // height of each device list row
const TOGGLE_W = 80;
const TOGGLE_H = 32;
const CLOSE_W = 120;
const CLOSE_H = 36;
const CLOSE_X = 1280 - PAD_X - CLOSE_W;
const CLOSE_Y = 30;

// ─── Section Y helpers (shared by render + hit regions) ──────────────────────
//
// micDisplayCount = state.micDevices.length + 1  (real devices + virtual Default row)

// AUDIO OUTPUT section header sits 30px below the last displayed mic device row.
function _outputHeaderY(micDisplayCount: number): number {
  return 230 + micDisplayCount * ROW_H + 30;
}

// Device list starts 44px below the section header (room for header line + label).
function _outputListY(micDisplayCount: number): number {
  return _outputHeaderY(micDisplayCount) + 44;
}

// Rebroadcast toggle sits 20px below the last output device row.
function _rebroadcastToggleY(micDisplayCount: number, outputCount: number): number {
  return _outputListY(micDisplayCount) + outputCount * ROW_H + 20;
}

// DISPLAY section header sits 60px below the bottom of the rebroadcast toggle.
function _displayHeaderY(micDisplayCount: number, outputCount: number): number {
  return _rebroadcastToggleY(micDisplayCount, outputCount) + TOGGLE_H + 60;
}

export interface SettingsHitRegions {
  close: HitRegion;
  micEnabledToggle: HitRegion;
  micDeviceItems: Array<HitRegion & { deviceId: string }>;
  outputDeviceItems: Array<HitRegion & { deviceId: string }>;
  rebroadcastToggle: HitRegion;
  showLabelsToggle: HitRegion;
}

// ─── Hit region builder ──────────────────────────────────────────────────────

export function getSettingsHitRegions(state: GameState): SettingsHitRegions {
  const micDeviceItems: Array<HitRegion & { deviceId: string }> = [];
  const outputDeviceItems: Array<HitRegion & { deviceId: string }> = [];

  // Mic device list: virtual Default row first, then real devices
  let y = 230;
  micDeviceItems.push({ x: LIST_X, y, w: LIST_W, h: ROW_H - 2, deviceId: '' }); // Default
  y += ROW_H;
  for (const d of state.micDevices) {
    micDeviceItems.push({ x: LIST_X, y, w: LIST_W, h: ROW_H - 2, deviceId: d.deviceId });
    y += ROW_H;
  }

  // Output device list starts after the section header + label.
  // micDisplayCount = real devices + 1 for Default row.
  const outputListStart = _outputListY(state.micDevices.length + 1);
  y = outputListStart;
  for (const d of state.outputDevices) {
    outputDeviceItems.push({ x: LIST_X, y, w: LIST_W, h: ROW_H - 2, deviceId: d.deviceId });
    y += ROW_H;
  }

  const rebroadcastY = _rebroadcastToggleY(state.micDevices.length + 1, state.outputDevices.length);
  const displayY = _displayHeaderY(state.micDevices.length + 1, state.outputDevices.length);

  return {
    close: { x: CLOSE_X, y: CLOSE_Y, w: CLOSE_W, h: CLOSE_H },
    micEnabledToggle: { x: TOGGLE_X, y: 148, w: TOGGLE_W, h: TOGGLE_H },
    micDeviceItems,
    outputDeviceItems,
    rebroadcastToggle: { x: TOGGLE_X, y: rebroadcastY, w: TOGGLE_W, h: TOGGLE_H },
    showLabelsToggle: { x: TOGGLE_X, y: displayY + 20, w: TOGGLE_W, h: TOGGLE_H },
  };
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderSettingsScreen(renderer: Renderer, state: GameState): void {
  const ctx = renderer.ctx;
  const { settings, micDevices, outputDevices } = state;

  // Background
  renderer.rect(0, 0, 1280, 720, COLORS.bg);

  // Title
  renderer.text('SETTINGS', 1280 / 2, 52, {
    size: 28, color: COLORS.accent, align: 'center', weight: 'bold',
  });

  // Close button
  _drawButton(renderer, CLOSE_X, CLOSE_Y, CLOSE_W, CLOSE_H, '✕  Close', false);

  // ── AUDIO INPUT ──────────────────────────────────────────────────────────

  _sectionHeader(renderer, 'AUDIO INPUT', 105);

  renderer.text('Enable microphone', LABEL_X, 164, { size: 14, color: COLORS.text });
  _drawToggle(renderer, TOGGLE_X, 148, settings.micEnabled);

  renderer.text('Microphone device', LABEL_X, 210, { size: 14, color: COLORS.text });
  // Prepend a virtual Default row so the user can revert to system default.
  const micDisplayList = [{ deviceId: '', label: 'Default (system)' }, ...micDevices];
  _drawDeviceList(ctx, micDisplayList, settings.micDeviceId ?? '', 230);

  // ── AUDIO OUTPUT ─────────────────────────────────────────────────────────

  // micDevices.length + 1 accounts for the virtual Default row above.
  const outputHeaderY = _outputHeaderY(micDevices.length + 1);
  const outputListStart = _outputListY(micDevices.length);

  _sectionHeader(renderer, 'AUDIO OUTPUT', outputHeaderY);
  // "Speaker output" label sits between section header and device list
  renderer.text('Speaker output', LABEL_X, outputHeaderY + 26, { size: 14, color: COLORS.text });
  _drawDeviceList(ctx, outputDevices, settings.outputDeviceId ?? '', outputListStart);

  // Rebroadcast row: label baseline aligned with toggle centre (+16)
  const rebroadcastY = _rebroadcastToggleY(micDevices.length + 1, outputDevices.length);
  _drawToggle(renderer, TOGGLE_X, rebroadcastY, settings.micRebroadcast);
  renderer.text('Mic rebroadcast to speaker', LABEL_X, rebroadcastY + 14, {
    size: 14, color: COLORS.text,
  });
  renderer.text('(Plays mic input through selected speaker)', LABEL_X, rebroadcastY + 30, {
    size: 11, color: COLORS.textDim,
  });

  // ── DISPLAY ──────────────────────────────────────────────────────────────

  const displayY = _displayHeaderY(micDevices.length + 1, outputDevices.length);
  _sectionHeader(renderer, 'DISPLAY', displayY);

  renderer.text('Show piano key labels', LABEL_X, displayY + 36, { size: 14, color: COLORS.text });
  renderer.text('(Show note names on all white keys)', LABEL_X, displayY + 54, {
    size: 11, color: COLORS.textDim,
  });
  _drawToggle(renderer, TOGGLE_X, displayY + 20, settings.showPianoLabels);

  // Browser support note
  const noteY = Math.min(displayY + 90, 700);
  renderer.text(
    'Note: output device selection requires Chrome or Edge.',
    1280 / 2, noteY,
    { size: 11, color: COLORS.textDim, align: 'center' },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _sectionHeader(renderer: Renderer, label: string, y: number): void {
  renderer.text(label, SECTION_X, y, {
    size: 12, color: COLORS.textDim, weight: 'bold',
  });
  renderer.line(SECTION_X, y + 8, 1280 - SECTION_X, y + 8, COLORS.border, 1);
}

function _drawToggle(renderer: Renderer, x: number, y: number, on: boolean): void {
  const ctx = renderer.ctx;
  const bg = on ? COLORS.success : COLORS.border;
  const r = TOGGLE_H / 2;

  // Track
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, TOGGLE_W, TOGGLE_H, r);
  ctx.fill();

  // Knob
  const knobX = on ? x + TOGGLE_W - r - 2 : x + r + 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(knobX, y + r, r - 4, 0, Math.PI * 2);
  ctx.fill();

  // Label
  ctx.fillStyle = on ? '#000' : COLORS.text;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(on ? 'ON' : 'OFF', x + TOGGLE_W / 2, y + r);
}

function _drawDeviceList(
  ctx: CanvasRenderingContext2D,
  devices: ReadonlyArray<{ deviceId: string; label: string }>,
  selectedId: string,
  startY: number,
): void {
  if (devices.length === 0) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('(no devices found)', LIST_X + 10, startY + ROW_H / 2);
    return;
  }

  for (let i = 0; i < devices.length; i++) {
    const d = devices[i];
    const y = startY + i * ROW_H;
    const isSelected = d.deviceId === selectedId || (i === 0 && !selectedId);

    // Row background
    ctx.fillStyle = isSelected ? COLORS.surface : 'transparent';
    ctx.fillRect(LIST_X, y, LIST_W, ROW_H - 2);

    // Selected indicator
    if (isSelected) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(LIST_X, y, 3, ROW_H - 2);
    }

    // Device label — truncate if needed
    const label = d.label || `Device ${i + 1}`;
    ctx.fillStyle = isSelected ? COLORS.accent : COLORS.text;
    ctx.font = isSelected ? 'bold 12px monospace' : '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Clip label to fit
    const maxW = LIST_W - 20;
    let truncated = label;
    while (ctx.measureText(truncated).width > maxW && truncated.length > 4) {
      truncated = truncated.slice(0, -4) + '...';
    }
    ctx.fillText(truncated, LIST_X + 12, y + (ROW_H - 2) / 2);
  }
}

function _drawButton(
  renderer: Renderer,
  x: number, y: number, w: number, h: number,
  label: string,
  _active: boolean,
): void {
  renderer.rect(x, y, w, h, COLORS.surface, 6);
  renderer.rectStroke(x, y, w, h, COLORS.border, 1, 6);
  renderer.text(label, x + w / 2, y + h / 2, {
    size: 13, color: COLORS.text, align: 'center',
  });
}
