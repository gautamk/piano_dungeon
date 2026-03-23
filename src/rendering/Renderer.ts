import type { FeedbackMessage, PlayerState } from '../types.js';
import { GAME_CONFIG, COLORS } from '../config.js';

/**
 * Canvas wrapper. Sets up a DPI-aware canvas and provides utility drawing methods.
 * All coordinates use logical pixels (devicePixelRatio is applied internally).
 */
export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  dpr: number;

  constructor(canvasEl: HTMLCanvasElement) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d') as CanvasRenderingContext2D;
    this.W = GAME_CONFIG.canvas.width;
    this.H = GAME_CONFIG.canvas.height;
    this.dpr = window.devicePixelRatio || 1;
    this._resize();
  }

  private _resize(): void {
    const { dpr, W, H } = this;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.ctx.scale(dpr, dpr);
  }

  clear(): void {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  // ─── Utility Drawing ────────────────────────────────────────────────────────

  text(
    str: string,
    x: number,
    y: number,
    { size = 16, color = COLORS.text, align = 'left', font = 'monospace', weight = 'normal' }: {
      size?: number; color?: string; align?: CanvasTextAlign;
      font?: string; weight?: string;
    } = {}
  ): void {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  rect(x: number, y: number, w: number, h: number, color: string, radius = 0): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    if (radius > 0) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }

  rectStroke(x: number, y: number, w: number, h: number, color: string, lineWidth = 1, radius = 0): void {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (radius > 0) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /** Draw a horizontal bar (e.g. HP bar). */
  bar(
    x: number, y: number, w: number, h: number,
    value: number, max: number,
    fillColor: string,
    bgColor = COLORS.surface,
    radius = 3
  ): void {
    this.rect(x, y, w, h, bgColor, radius);
    const filled = w * Math.max(0, Math.min(1, value / max));
    if (filled > 0) this.rect(x, y, filled, h, fillColor, radius);
    this.rectStroke(x, y, w, h, COLORS.border, 1, radius);
  }

  /** Floating feedback labels (damage numbers, etc.) */
  renderFeedback(feedback: FeedbackMessage[]): void {
    const ctx = this.ctx;
    for (const f of feedback) {
      const alpha = Math.min(1, f.ttl / 400);
      ctx.globalAlpha = alpha;
      this.text(f.text, f.x, f.y, { size: 22, color: f.color, align: 'center', weight: 'bold' });
    }
    ctx.globalAlpha = 1;
  }

  /** Centered text on screen. */
  centeredText(str: string, y: number, opts: Parameters<Renderer['text']>[3] = {}): void {
    this.text(str, this.W / 2, y, { align: 'center', ...opts });
  }

  /** Row of HP hearts centred on (cx, y). */
  hpHearts(player: PlayerState, cx: number, y: number, size = 20): void {
    const ctx = this.ctx;
    const spacing = Math.round(size * 1.4);
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < player.maxHp; i++) {
      ctx.fillStyle = i < player.hp ? COLORS.hp : COLORS.border;
      ctx.fillText('♥', cx - (player.maxHp - 1) * (spacing / 2) + i * spacing, y);
    }
  }
}
