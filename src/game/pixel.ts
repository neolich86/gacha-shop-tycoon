// 도트 드로잉 헬퍼 — 모든 도형을 정수 좌표 fillRect로 그려 안티앨리어싱 없이 선명하게 유지

export type Ctx = CanvasRenderingContext2D;

export const TW = 32; // 타일 너비
export const TH = 16; // 타일 높이

export function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 타일 윗면 마름모 (top corner 기준, 크기 32×16) — scale로 크기 조절 */
export function diamond(c: Ctx, x: number, y: number, color: string, hw = 16, hh = 8) {
  c.fillStyle = color;
  const rows = hh * 2;
  for (let r = 0; r < rows; r++) {
    const t = r < hh ? r + 1 : rows - r;
    const w = Math.round((t * hw) / hh);
    c.fillRect(Math.round(x - w), Math.round(y + r), w * 2, 1);
  }
}

/** 마름모 외곽선 */
export function diamondOutline(c: Ctx, x: number, y: number, color: string, hw = 16, hh = 8, dash = 0) {
  c.fillStyle = color;
  const rows = hh * 2;
  for (let r = 0; r < rows; r++) {
    if (dash && Math.floor(r / dash) % 2) continue;
    const t = r < hh ? r + 1 : rows - r;
    const w = Math.round((t * hw) / hh);
    c.fillRect(Math.round(x - w), Math.round(y + r), 2, 1);
    c.fillRect(Math.round(x + w - 2), Math.round(y + r), 2, 1);
  }
}

/** 좌측면 (앞-왼쪽을 바라보는 면). x,y = 박스 윗면(바닥 기준) top corner, h = 높이 */
export function leftFace(c: Ctx, x: number, y: number, h: number, color: string, hw = 16) {
  c.fillStyle = color;
  for (let k = 0; k < hw; k++) {
    const px = x - hw + k;
    const bottom = y + hw / 2 + Math.floor(k / 2) + 1;
    c.fillRect(px, bottom - h, 1, h);
  }
}

/** 우측면 (앞-오른쪽을 바라보는 면) */
export function rightFace(c: Ctx, x: number, y: number, h: number, color: string, hw = 16) {
  c.fillStyle = color;
  for (let k = 0; k < hw; k++) {
    const px = x + k;
    const bottom = y + hw - Math.floor(k / 2);
    c.fillRect(px, bottom - h, 1, h);
  }
}

/** 아이소 박스: 바닥 top corner (x,y), 높이 h */
export function isoBox(
  c: Ctx,
  x: number,
  y: number,
  h: number,
  top: string,
  left: string,
  right: string,
  hw = 16,
) {
  leftFace(c, x, y, h, left, hw);
  rightFace(c, x, y, h, right, hw);
  diamond(c, x, y - h, top, hw, hw / 2);
}

/** 좌측면 위 한 점 (면 좌표: u=0..hw 가로, v=바닥에서 위로) */
export function leftFacePt(x: number, y: number, u: number, v: number, hw = 16) {
  return { x: x - hw + u, y: y + hw / 2 + Math.floor(u / 2) + 1 - v };
}
export function rightFacePt(x: number, y: number, u: number, v: number, hw = 16) {
  return { x: x + u, y: y + hw - Math.floor(u / 2) - v };
}

// 색 보정
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  r = f(r);
  g = f(g);
  b = f(b);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** 문자열 픽셀맵 그리기 */
export function drawMap(c: Ctx, map: string[], pal: Record<string, string>, x: number, y: number, flip = false) {
  const w = map[0].length;
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ".") continue;
      const col = pal[ch];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(Math.round(x + (flip ? w - 1 - i : i)), Math.round(y + r), 1, 1);
    }
  }
}
