import { COLORS, GAME_CONFIG } from '../config.js';
import { ROOM_TYPE } from '../game/DungeonGenerator.js';

const W = GAME_CONFIG.canvas.width;
const H = GAME_CONFIG.canvas.height;

const ROOM_ICONS = {
  [ROOM_TYPE.COMBAT]: '⚔',
  [ROOM_TYPE.ELITE]: '☆',
  [ROOM_TYPE.SHOP]: '$',
  [ROOM_TYPE.REST]: '+',
  [ROOM_TYPE.BOSS]: '☠',
};

const ROOM_LABELS = {
  [ROOM_TYPE.COMBAT]: 'Combat',
  [ROOM_TYPE.ELITE]: 'Elite',
  [ROOM_TYPE.SHOP]: 'Shop',
  [ROOM_TYPE.REST]: 'Rest',
  [ROOM_TYPE.BOSS]: 'BOSS',
};

/**
 * Renders the dungeon map screen.
 * Rooms are laid out horizontally. Player clicks a reachable, uncleared room to enter.
 * Returns an array of room hit regions for click detection.
 */
export function renderDungeonScreen(renderer, state) {
  const { dungeon, player } = state;
  const { rooms } = dungeon;

  renderer.rect(0, 0, W, H, COLORS.bg);

  // ── Header
  renderer.centeredText(`Floor ${player.floor}  ─  ${floorTheme(player.floor)}`, 40, {
    size: 22, color: COLORS.accent, weight: 'bold',
  });

  renderer.centeredText('Choose your next room', 72, { size: 14, color: COLORS.textDim });

  // ── Player stats row
  renderStatsRow(renderer, player);

  // ── Rooms
  renderRooms(renderer, rooms);

  // ── Instructions
  renderer.centeredText('Click a room to enter', H - 30, { size: 13, color: COLORS.textDim });
}

function renderStatsRow(renderer, player) {
  const y = 108;
  const cx = W / 2;

  // HP
  const ctx = renderer.ctx;
  for (let i = 0; i < player.maxHp; i++) {
    ctx.font = '20px monospace';
    ctx.fillStyle = i < player.hp ? COLORS.hp : COLORS.border;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = cx - (player.maxHp - 1) * 13 + i * 26;
    ctx.fillText('♥', x, y);
  }

  renderer.text(`Score: ${player.score}`, cx + 160, y, { size: 15, color: COLORS.accent, align: 'center' });
}

function renderRooms(renderer, rooms) {
  if (!rooms.length) return;

  const roomW = 90;
  const roomH = 90;
  const gap = 30;
  const totalW = rooms.length * (roomW + gap) - gap;
  const startX = Math.max(40, (W - totalW) / 2);
  const centerY = H / 2 + 10;

  // Draw connector lines first
  for (let i = 0; i < rooms.length - 1; i++) {
    const x1 = startX + i * (roomW + gap) + roomW;
    const x2 = startX + (i + 1) * (roomW + gap);
    const ly = centerY;
    const lineColor = rooms[i + 1].reachable ? COLORS.border : '#1a1a2e';
    renderer.line(x1, ly, x2, ly, lineColor, 2);
  }

  // Draw rooms
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const rx = startX + i * (roomW + gap);
    const ry = centerY - roomH / 2;
    renderRoom(renderer, room, rx, ry, roomW, roomH);
  }
}

function renderRoom(renderer, room, x, y, w, h) {
  const { type, cleared, reachable } = room;

  let bgColor = COLORS.rooms[type] ?? COLORS.surface;
  let borderColor = COLORS.border;
  let alpha = 1;

  if (cleared) {
    bgColor = COLORS.rooms.CLEARED;
    alpha = 0.5;
  } else if (!reachable) {
    bgColor = COLORS.rooms.LOCKED;
    alpha = 0.4;
  } else {
    borderColor = type === ROOM_TYPE.BOSS ? COLORS.accent : COLORS.accent;
  }

  const ctx = renderer.ctx;
  ctx.globalAlpha = alpha;

  renderer.rect(x, y, w, h, bgColor, 8);
  renderer.rectStroke(x, y, w, h, reachable && !cleared ? COLORS.accent : borderColor, reachable && !cleared ? 2 : 1, 8);

  // Icon
  ctx.font = '28px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = cleared ? COLORS.textDim : COLORS.text;
  ctx.fillText(cleared ? '✓' : (ROOM_ICONS[type] ?? '?'), x + w / 2, y + h / 2 - 10);

  // Label
  ctx.font = `bold 11px monospace`;
  ctx.fillStyle = cleared ? COLORS.textDim : COLORS.text;
  ctx.fillText(cleared ? 'Cleared' : ROOM_LABELS[type], x + w / 2, y + h / 2 + 22);

  // Enemy name under boss/elite rooms
  if (!cleared && reachable && room.enemy && [ROOM_TYPE.BOSS, ROOM_TYPE.ELITE].includes(type)) {
    ctx.font = '9px monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(room.enemy.name.slice(0, 14), x + w / 2, y + h + 14);
  }

  ctx.globalAlpha = 1;
}

/** Returns the hit region for a room (for click detection). */
export function getRoomHitRegions(rooms) {
  const roomW = 90, roomH = 90, gap = 30;
  const totalW = rooms.length * (roomW + gap) - gap;
  const startX = Math.max(40, (GAME_CONFIG.canvas.width - totalW) / 2);
  const centerY = GAME_CONFIG.canvas.height / 2 + 10;

  return rooms.map((room, i) => ({
    room,
    index: i,
    x: startX + i * (roomW + gap),
    y: centerY - roomH / 2,
    w: roomW,
    h: roomH,
  }));
}

function floorTheme(floor) {
  if (floor <= 2) return 'The Cellar';
  if (floor <= 4) return 'The Catacombs';
  if (floor <= 6) return 'The Tower';
  if (floor <= 8) return 'The Sanctum';
  return 'The Final Chamber';
}
