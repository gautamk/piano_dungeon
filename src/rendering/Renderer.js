import { GAME_CONFIG, COLORS } from '../config.js';

/**
 * Canvas wrapper. Sets up a DPI-aware canvas and provides utility drawing methods.
 * All coordinates use logical pixels (devicePixelRatio is applied internally).
 */
export class Renderer {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.W = GAME_CONFIG.canvas.width;
    this.H = GAME_CONFIG.canvas.height;
    this.dpr = window.devicePixelRatio || 1;
    this._resize();
  }

  _resize() {
    const { dpr, W, H } = this;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    this.ctx.scale(dpr, dpr);
  }

  clear() {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  // ─── Utility Drawing ────────────────────────────────────────────────────────

  text(str, x, y, { size = 16, color = COLORS.text, align = 'left', font = 'monospace', weight = 'normal' } = {}) {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  rect(x, y, w, h, color, radius = 0) {
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

  rectStroke(x, y, w, h, color, lineWidth = 1, radius = 0) {
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

  line(x1, y1, x2, y2, color, lineWidth = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /** Draw a horizontal bar (e.g. HP bar). */
  bar(x, y, w, h, value, max, fillColor, bgColor = COLORS.surface, radius = 3) {
    this.rect(x, y, w, h, bgColor, radius);
    const filled = w * Math.max(0, Math.min(1, value / max));
    if (filled > 0) this.rect(x, y, filled, h, fillColor, radius);
    this.rectStroke(x, y, w, h, COLORS.border, 1, radius);
  }

  /** Floating feedback labels (damage numbers, etc.) */
  renderFeedback(feedback) {
    const ctx = this.ctx;
    for (const f of feedback) {
      const alpha = Math.min(1, f.ttl / 400);
      ctx.globalAlpha = alpha;
      this.text(f.text, f.x, f.y, { size: 22, color: f.color, align: 'center', weight: 'bold' });
    }
    ctx.globalAlpha = 1;
  }

  /** Centered text on screen. */
  centeredText(str, y, opts = {}) {
    this.text(str, this.W / 2, y, { align: 'center', ...opts });
  }

  /** Row of HP hearts centred on (cx, y). */
  hpHearts(player, cx, y, size = 20) {
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
