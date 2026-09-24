// 2등신 캐릭터 — 고해상도 도트 (20×29칸 + 자동 외곽선, 논리 11×15.5px)
// 모양을 코드로 조립한 뒤 외곽선을 자동으로 두르고, 외형·방향·프레임별로 캐시한다.
import { R, shade, type Ctx } from "./pixel";

export interface Look {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
  shoes: string;
  apron?: string;
  hat?: string;
}

export const OUTLINE = "#2a1e2e";

const GW = 20; // 내부 칸 너비
const GH = 29; // 내부 칸 높이
const PAD = 1;

type Facing = "front" | "back";
type Frame = 0 | 1 | 2;

function buildGrid(look: Look, facing: Facing, frame: Frame): (string | null)[][] {
  const g: (string | null)[][] = Array.from({ length: GH }, () => Array(GW).fill(null));
  const set = (x: number, y: number, col: string) => {
    if (x >= 0 && x < GW && y >= 0 && y < GH) g[y][x] = col;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, col: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, col);
  };

  const skinDark = shade(look.skin, -0.12);
  const hairHi = shade(look.hair, 0.35);
  const hairDark = shade(look.hair, -0.25);
  const shirtDark = shade(look.shirt, -0.2);

  // ── 다리·신발 (프레임에 따라 한쪽 발을 든다)
  const lLift = frame === 1 ? 1 : 0;
  const rLift = frame === 2 ? 1 : 0;
  fill(6, 22, 13, 23, look.pants);
  fill(6, 24, 8, 25 - lLift, look.pants);
  fill(11, 24, 13, 25 - rLift, look.pants);
  fill(5, 26 - lLift, 8, 27 - lLift, look.shoes);
  fill(11, 26 - rLift, 14, 27 - rLift, look.shoes);
  set(9, 22, shade(look.pants, -0.2));
  set(10, 22, shade(look.pants, -0.2));

  // ── 몸통·팔
  fill(6, 15, 13, 21, look.shirt);
  fill(13, 16, 13, 21, shirtDark);
  const lHand = frame === 1 ? 19 : frame === 2 ? 21 : 20;
  const rHand = frame === 2 ? 19 : frame === 1 ? 21 : 20;
  fill(4, 16, 5, lHand - 1, look.shirt);
  fill(14, 16, 15, rHand - 1, shirtDark);
  fill(4, lHand, 5, lHand + 1, look.skin);
  fill(14, rHand, 15, rHand + 1, skinDark);
  if (look.apron && facing === "front") {
    fill(7, 17, 12, 22, look.apron);
    set(7, 15, look.apron);
    set(12, 15, look.apron);
    set(7, 16, look.apron);
    set(12, 16, look.apron);
    fill(8, 19, 11, 19, shade(look.apron, 0.3)); // 주머니
  } else if (facing === "front") {
    fill(8, 15, 11, 15, shade(look.shirt, 0.3)); // 옷깃
  }

  // ── 머리 (타원)
  const cx = 9.5,
    cy = 7.5,
    rx = 9.4,
    ry = 7.6;
  const inHead = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = 0; y <= 15; y++)
    for (let x = 0; x < GW; x++) {
      if (!inHead(x, y)) continue;
      set(x, y, look.skin);
    }
  // 목 그림자
  fill(8, 14, 11, 14, skinDark);

  if (facing === "front") {
    // 앞머리: 들쭉날쭉한 끝
    const fringe = [7, 7, 6, 7, 8, 7, 6, 5, 6, 7, 7, 6, 5, 6, 7, 8, 7, 6, 7, 7];
    for (let x = 0; x < GW; x++)
      for (let y = 0; y <= 15; y++) {
        if (!inHead(x, y)) continue;
        const side = (x <= 2 || x >= 17) && y <= 12;
        if (y < fringe[x] || side) set(x, y, look.hair);
      }
    // 머리 광택
    fill(5, 2, 8, 2, hairHi);
    fill(4, 3, 5, 3, hairHi);
    // 눈 (2×3, 하이라이트)
    for (const ex of [5, 13]) {
      fill(ex, 9, ex + 1, 11, OUTLINE);
      set(ex, 9, "#ffffff");
    }
    // 볼터치·입
    fill(3, 12, 4, 12, "#f29c9c");
    fill(15, 12, 16, 12, "#f29c9c");
    fill(9, 12, 10, 12, "#b04a4a");
  } else {
    for (let y = 0; y <= 15; y++)
      for (let x = 0; x < GW; x++) if (inHead(x, y) && y <= 13) set(x, y, look.hair);
    fill(6, 12, 13, 13, hairDark);
    fill(6, 3, 9, 3, hairHi);
    fill(5, 4, 6, 4, hairHi);
  }

  // ── 모자
  if (look.hat) {
    for (let y = 0; y <= 4; y++) for (let x = 0; x < GW; x++) if (inHead(x, y)) set(x, y, look.hat);
    fill(facing === "front" ? 1 : 3, 5, facing === "front" ? 18 : 16, 5, shade(look.hat, -0.25));
    fill(8, 1, 11, 2, shade(look.hat, 0.35));
  }
  return g;
}

const cache = new Map<string, HTMLCanvasElement>();

function sprite(look: Look, facing: Facing, frame: Frame): HTMLCanvasElement {
  const key = `${look.hair}${look.skin}${look.shirt}${look.pants}${look.shoes}${look.apron ?? ""}${look.hat ?? ""}|${facing}|${frame}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = buildGrid(look, facing, frame);
  const W = GW + PAD * 2;
  const H = GH + PAD * 2;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < GW && y < GH && g[y][x] !== null;
  // 자동 외곽선
  c.fillStyle = OUTLINE;
  for (let y = -PAD; y < GH + PAD; y++)
    for (let x = -PAD; x < GW + PAD; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) c.fillRect(x + PAD, y + PAD, 1, 1);
    }
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const col = g[y][x];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x + PAD, y + PAD, 1, 1);
    }
  cache.set(key, cv);
  return cv;
}

/** x,y = 발 중앙(논리 좌표) */
export function drawChar(c: Ctx, look: Look, x: number, y: number, facing: Facing, frame: Frame, flip = false) {
  const img = sprite(look, facing, frame);
  const w = img.width / R;
  const h = img.height / R;
  const left = Math.round((x - w / 2) * R) / R;
  const top = Math.round((y - h + 1.5) * R) / R;
  // 그림자
  c.fillStyle = "rgba(40,20,40,0.28)";
  c.fillRect(Math.round(x * R) / R - 4, Math.round(y * R) / R - 0.5, 8, 1);
  c.fillRect(Math.round(x * R) / R - 3, Math.round(y * R) / R + 0.5, 6, 0.5);
  if (flip) {
    c.save();
    c.translate(left + w, top);
    c.scale(-1, 1);
    c.drawImage(img, 0, 0, w, h);
    c.restore();
  } else {
    c.drawImage(img, left, top, w, h);
  }
}

const HAIRS = ["#3b2a20", "#6b4226", "#1f1b24", "#c9853a", "#8c3b3b", "#e8c26a", "#5a5a7a", "#b35c8a"];
const SKINS = ["#ffd9b8", "#f5c49c", "#e0a57c", "#c58458"];
const SHIRTS = ["#e85d5d", "#4f8fe6", "#5cc27a", "#f2b84b", "#9b6ee8", "#ef7fb4", "#4cc4c4", "#f0f0f0", "#ff914d"];
const PANTS = ["#35406b", "#4a3b32", "#2f2f3a", "#6b7b8c", "#7a4f8a"];

export function randomLook(rnd: () => number = Math.random): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  return { hair: pick(HAIRS), skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), shoes: "#3a2b2b" };
}

// 직원 외형 (STAFF 순서와 동일)
export const STAFF_LOOKS: Look[] = [
  { hair: "#3b2a20", skin: "#ffd9b8", shirt: "#f0f0f0", apron: "#e85d5d", pants: "#2f2f3a", shoes: "#3a2b2b" },
  { hair: "#1f1b24", skin: "#f5c49c", shirt: "#f0f0f0", apron: "#4f8fe6", pants: "#2f2f3a", shoes: "#3a2b2b" },
  { hair: "#6b4226", skin: "#ffd9b8", shirt: "#35406b", pants: "#35406b", shoes: "#1f1b24", hat: "#35406b" },
  { hair: "#c9853a", skin: "#ffd9b8", shirt: "#5cc27a", apron: "#2e7d4f", pants: "#4a3b32", shoes: "#3a2b2b" },
  { hair: "#8c3b3b", skin: "#e0a57c", shirt: "#f2b84b", pants: "#4a3b32", shoes: "#3a2b2b", hat: "#c98a1a" },
  { hair: "#b35c8a", skin: "#ffd9b8", shirt: "#ef7fb4", pants: "#f0f0f0", shoes: "#b35c8a" },
  { hair: "#5a5a7a", skin: "#f5c49c", shirt: "#1f1b24", pants: "#1f1b24", shoes: "#1f1b24", hat: "#e8c26a" },
];
