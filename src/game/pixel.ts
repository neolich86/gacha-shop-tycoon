// 도트 드로잉 헬퍼
// 좌표계는 "논리 픽셀"(320×232)이고, 실제 캔버스는 R배 해상도로 그린다.
// 도형은 1/R 단위(=실제 1픽셀)로 채워서 경사면·마름모 가장자리가 더 촘촘한 도트가 된다.

export type Ctx = CanvasRenderingContext2D;

export const R = 2; // 해상도 배율 (논리 1px = 실제 2px)
const snap = (v: number) => Math.round(v * R) / R;

export function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(snap(x), snap(y), snap(w), snap(h));
}

/** 타일 윗면 마름모 (top corner 기준) */
export function diamond(c: Ctx, x: number, y: number, color: string, hw = 16, hh = 8) {
  c.fillStyle = color;
  const rows = hh * 2 * R;
  const half = hh * R;
  for (let r = 0; r < rows; r++) {
    const t = r < half ? r + 1 : rows - r;
    const w = snap((t * hw) / half);
    c.fillRect(snap(x - w), snap(y) + r / R, w * 2, 1 / R);
  }
}

/** 마름모 외곽선 (점선 가능) */
export function diamondOutline(c: Ctx, x: number, y: number, color: string, hw = 16, hh = 8, dash = 0) {
  c.fillStyle = color;
  const rows = hh * 2 * R;
  const half = hh * R;
  for (let r = 0; r < rows; r++) {
    if (dash && Math.floor(r / (dash * R)) % 2) continue;
    const t = r < half ? r + 1 : rows - r;
    const w = snap((t * hw) / half);
    c.fillRect(snap(x - w), snap(y) + r / R, 2, 1 / R);
    c.fillRect(snap(x + w - 2), snap(y) + r / R, 2, 1 / R);
  }
}

/** 좌측면 (앞-왼쪽을 바라보는 면). x,y = 바닥 마름모 top corner, h = 높이 */
export function leftFace(c: Ctx, x: number, y: number, h: number, color: string, hw = 16) {
  c.fillStyle = color;
  for (let k = 0; k < hw * R; k++) {
    const px = snap(x - hw) + k / R;
    const bottom = snap(y + hw / 2) + (1 + Math.floor(k / 2)) / R;
    c.fillRect(px, bottom - h, 1 / R, h);
  }
}

/** 우측면 (앞-오른쪽을 바라보는 면) */
export function rightFace(c: Ctx, x: number, y: number, h: number, color: string, hw = 16) {
  c.fillStyle = color;
  for (let k = 0; k < hw * R; k++) {
    const px = snap(x) + k / R;
    const bottom = snap(y + hw) - Math.floor(k / 2) / R;
    c.fillRect(px, bottom - h, 1 / R, h);
  }
}

/** 아이소 박스: 바닥 top corner (x,y), 높이 h */
export function isoBox(c: Ctx, x: number, y: number, h: number, top: string, left: string, right: string, hw = 16) {
  leftFace(c, x, y, h, left, hw);
  rightFace(c, x, y, h, right, hw);
  diamond(c, x, y - h, top, hw, hw / 2);
}

/** 좌측면 위 한 점 (면 좌표: u=0..hw 가로, v=바닥에서 위로) */
export function leftFacePt(x: number, y: number, u: number, v: number, hw = 16) {
  return { x: x - hw + u, y: y + hw / 2 + u / 2 + 0.5 - v };
}
export function rightFacePt(x: number, y: number, u: number, v: number, hw = 16) {
  return { x: x + u, y: y + hw - u / 2 - v };
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

/** 문자열 픽셀맵 그리기. ps = 한 칸의 논리 크기 (고해상도 맵은 1/R) */
export function drawMap(
  c: Ctx,
  map: string[],
  pal: Record<string, string>,
  x: number,
  y: number,
  flip = false,
  ps = 1,
) {
  const w = map[0].length;
  const ox = snap(x);
  const oy = snap(y);
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ".") continue;
      const col = pal[ch];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(ox + (flip ? w - 1 - i : i) * ps, oy + r * ps, ps, ps);
    }
  }
}

/**
 * Scale2x(EPX) — 도트 맵을 2배로 키우면서 대각선 경계를 매끄럽게 다듬는다.
 * 1배 맵을 고해상도(ps = 1/R)로 그릴 때 사용.
 */
export function scale2x(map: string[]): string[] {
  const h = map.length;
  const w = Math.max(...map.map((r) => r.length));
  const at = (x: number, y: number) => (y < 0 || y >= h || x < 0 || x >= w ? "." : map[y][x] ?? ".");
  const out: string[][] = Array.from({ length: h * 2 }, () => Array(w * 2).fill("."));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y);
      const A = at(x, y - 1),
        B = at(x + 1, y),
        C = at(x - 1, y),
        D = at(x, y + 1);
      let e0 = P,
        e1 = P,
        e2 = P,
        e3 = P;
      if (C === A && C !== D && A !== B) e0 = A;
      if (A === B && A !== C && B !== D) e1 = B;
      if (D === C && D !== B && C !== A) e2 = C;
      if (B === D && B !== A && D !== C) e3 = D;
      out[y * 2][x * 2] = e0;
      out[y * 2][x * 2 + 1] = e1;
      out[y * 2 + 1][x * 2] = e2;
      out[y * 2 + 1][x * 2 + 1] = e3;
    }
  return out.map((r) => r.join(""));
}
