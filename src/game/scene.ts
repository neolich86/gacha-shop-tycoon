// 45도 탑뷰(쿼터뷰) 도트 매장 씬
import {
  type Ctx,
  drawMap,
  scale2x,
  R,
  rect,
  diamond,
  diamondOutline,
  isoBox,
  leftFace,
  rightFace,
  leftFacePt,
  rightFacePt,
  shade,
} from "./pixel";
import { drawChar, randomLook, STAFF_LOOKS, OUTLINE, type Look } from "./sprites";

export const W = 320;
export const H = 232;
const N = 9; // 매장 크기 (타일)
const OX = 160;
const OY = 52;
const WALL_H = 40;

type P = { x: number; y: number };

/** 그리드 좌표 → 화면 좌표 */
export function sp(gx: number, gy: number): P {
  return { x: OX + (gx - gy) * 16, y: OY + (gx + gy) * 8 };
}

// 진열대 배치 (타일 좌표) 및 손님이 서는 위치 (타일 중심 좌표)
const SHELF_POS: { t: [number, number]; front: [number, number] }[] = [
  { t: [2, 0], front: [2.5, 1.5] },
  { t: [4, 0], front: [4.5, 1.5] },
  { t: [6, 0], front: [6.5, 1.5] },
  { t: [0, 2], front: [1.5, 2.5] },
  { t: [0, 4], front: [1.5, 4.5] },
  { t: [0, 6], front: [1.5, 6.5] },
  { t: [3, 3], front: [4.5, 3.5] },
  { t: [3, 7], front: [4.5, 7.5] },
];
const CORRIDOR_X = 5.5;
const COUNTER_TILES: [number, number][] = [
  [7, 5],
  [7, 6],
];
const COUNTER_SPOT: [number, number] = [6.5, 6.0];
const ENTRANCE: [number, number] = [5.5, 10.6];

const STAFF_POS: [number, number][] = [
  [8.5, 6.0],
  [4.0, 1.5],
  [2.3, 5.5],
  [6.7, 2.7],
  [2.4, 3.2],
  [4.2, 8.7],
  [7.8, 3.6],
];

interface Customer {
  id: number;
  x: number;
  y: number;
  path: [number, number][];
  state: "walk" | "browse" | "pay" | "leave";
  after: "browse" | "pay" | "leave" | "gone";
  timer: number;
  look: Look;
  facing: "front" | "back";
  flip: boolean;
  walkT: number;
  bubble: number; // 남은 말풍선 시간(초), 0이면 없음
  stops: number;
  collector?: boolean;
}

const COLLECTOR_LOOK: Look = {
  hair: "#e8e8f0", skin: "#f5c49c", shirt: "#5a2a7a", pants: "#2a1e2e", shoes: "#1f1b24", hat: "#2a1e2e",
};
const COLLECTOR_SPOT: [number, number] = [3.4, 5.4];

interface Pop {
  x: number;
  y: number;
  t: number;
  text?: string;
  kind: "coin" | "text" | "spark";
  color?: string;
}

export interface SceneView {
  own: number[];
  staff: boolean[];
  income: number;
  collector: boolean;
}

export interface SceneCallbacks {
  onTapCustomer: () => number; // 지급된 금액을 돌려줌
  onTapCollector: () => void;
  format: (n: number) => string;
}

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// 캡슐토이 머신 위 대형 캡슐 모형
const CAPSULE = [
  "...oooooo...",
  "..orrrrrro..",
  ".oqqrrrrrro.",
  ".oqrrmmrrro.",
  "orrrmmmrrrro",
  "ollllllllllo",
  "owwwwwwwwwwo",
  "owwwwwwwwggo",
  ".owwwwwwwgo.",
  ".owwwwwwggo.",
  "..oggggggo..",
  "...oooooo...",
];
// 투명 뚜껑(안에 장난감) + 노란 몸통
const CAPSULE_PAL: Record<string, string> = {
  o: "#2a1e2e", r: "#bfeaff", q: "#ffffff", m: "#9b6ee8", l: "#e0a520", w: "#ffd23f", g: "#e0a520",
};

// 스케일 피규어 장 위 — 칼을 휘두르는 검객 (오리지널 디자인)
const SWORDSMAN = [
  "................ob..",
  "...............obo..",
  "..............obo...",
  "....ooo......obo....",
  "...ohhhoo...obo.....",
  "..ohhhhhho.obo......",
  "..ohssssho.ko.......",
  "..osesssso.ogo......",
  "...ossso..osso......",
  "..orrrrrosso........",
  ".onrrnnnnoo.........",
  ".onnnwnnno..........",
  "..onnwnnno..........",
  "..oppppppo..........",
  ".opppoppppo.........",
  ".oppo..oppo.........",
  ".offo...offo........",
  ".ooo.....ooo........",
];
const SWORDSMAN_PAL: Record<string, string> = {
  o: "#2a1e2e", h: "#3a2a4a", s: "#ffd9b8", e: "#2a1e2e", n: "#2f3f6b", w: "#f4f4f8",
  r: "#d94848", p: "#4a3b32", f: "#1f1b24", b: "#dfe8f2", g: "#c98a1a", k: "#ffd23f",
};

// 쿠지 부스 위 — 주먹을 내지르는 무도가 (오리지널 디자인)
const FIGHTER = [
  "....oooooo....",
  "...ohhhhhho...",
  "...orrrrrrrorr",
  "...ohssssho..r",
  "...osesseso...",
  "....osssso....",
  "..oowwwwwwoo..",
  ".owwwwkwwwwsso",
  ".oswwkwwwwoooo",
  "..oswwwwwo....",
  "...obbbbbo....",
  "...owwowwo....",
  "..owwo.owwo...",
  ".owwo...owwo..",
  ".oso.....oso..",
  ".ooo.....ooo..",
];
const FIGHTER_PAL: Record<string, string> = {
  o: "#2a1e2e", h: "#6b4226", r: "#e85d5d", s: "#f5c49c", e: "#2a1e2e", w: "#f4f4f8", k: "#cfd8e6", b: "#2a1e2e",
};

// 프라모델 코너 위 로봇 모형
const ROBOT = [
  ".....y.....",
  "....yoy....",
  "...ooooo...",
  "..owwwwwo..",
  "..ovvvvvo..",
  "..owwrwwo..",
  "oooowwwoooo",
  "obbowbwobbo",
  "obbowwwobbo",
  "ogg.ooo.ggo",
  "oo.obbbo.oo",
  "...orrro...",
  "..owwowwo..",
  "..owo.owo..",
  "..owo.owo..",
  "..obo.obo..",
  ".oooo.oooo.",
];
const ROBOT_PAL: Record<string, string> = {
  o: "#2a1e2e", y: "#ffd23f", w: "#f4f4f8", v: "#5fe0ff", r: "#e85d5d", b: "#4f7fe6", g: "#9aa0b4",
};
// 미니피규어 선반 위 자동차 모형
const CAR = [
  ".....oooooo.....",
  "....ovvovvvo....",
  "..oorrrrrrrrooo.",
  ".orrrrrrrrrrrrro",
  "oyrrrrrrrrrrrrwo",
  "ooogggoooooggooo",
  "..ogkgo...ogkgo.",
  "...ooo.....ooo..",
];
const CAR_PAL: Record<string, string> = {
  o: "#2a1e2e", v: "#9ceaff", r: "#f2b84b", y: "#fff6b0", w: "#e85d5d", g: "#3d3d48", k: "#c8c8c8",
};

// 모형 맵을 Scale2x로 고해상도화
const CAPSULE_HI = scale2x(CAPSULE);
const ROBOT_HI = scale2x(ROBOT);
const CAR_HI = scale2x(CAR);
const SWORDSMAN_HI = scale2x(SWORDSMAN);
const FIGHTER_HI = scale2x(FIGHTER);

const FIG_COLORS = ["#e85d5d", "#4f8fe6", "#5cc27a", "#f2b84b", "#9b6ee8", "#ef7fb4", "#4cc4c4", "#ff914d"];

export class Scene {
  private c: Ctx;
  private view: SceneView = { own: [], staff: [], income: 0, collector: false };
  private customers: Customer[] = [];
  private pops: Pop[] = [];
  private t = 0;
  private spawnT = 0;
  private nextId = 1;
  private raf = 0;
  private last = 0;
  private rnd = Math.random;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: SceneCallbacks,
  ) {
    canvas.width = W * R;
    canvas.height = H * R;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("canvas 2d unsupported");
    this.c = c;
    c.imageSmoothingEnabled = false;
    canvas.addEventListener("pointerdown", this.onPointer);
  }

  setView(v: SceneView) {
    this.view = v;
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
  }

  // ───────────────────────── 업데이트
  private targetCustomers() {
    const owned = this.view.own.filter((n) => n > 0).length;
    if (!owned) return 0;
    return Math.max(1, Math.min(14, Math.floor(1 + Math.log10(this.view.income + 1) * 1.3)));
  }

  private ownedShelves() {
    return this.view.own.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
  }

  private routeToShelf(from: [number, number], shelf: number): [number, number][] {
    const [fx, fy] = SHELF_POS[shelf].front;
    const jx = (this.rnd() - 0.5) * 0.4;
    return [
      [CORRIDOR_X, from[1] === fy ? from[1] : from[1]],
      [CORRIDOR_X, fy],
      [fx + jx, fy],
    ];
  }

  private spawn() {
    const shelves = this.ownedShelves();
    if (!shelves.length) return;
    const shelf = shelves[Math.floor(this.rnd() * shelves.length)];
    const cu: Customer = {
      id: this.nextId++,
      x: ENTRANCE[0],
      y: ENTRANCE[1],
      path: this.routeToShelf(ENTRANCE, shelf),
      state: "walk",
      after: "browse",
      timer: 0,
      look: randomLook(this.rnd),
      facing: "back",
      flip: false,
      walkT: 0,
      bubble: this.rnd() < 0.15 ? 12 : 0,
      stops: 0,
    };
    this.customers.push(cu);
  }

  private update(dt: number) {
    this.t += dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      if (this.customers.length < this.targetCustomers()) this.spawn();
      this.spawnT = 1.0 + this.rnd() * 2.2;
    }
    // 수집가 손님
    const col = this.customers.find((c) => c.collector);
    if (this.view.collector && !col) {
      this.customers.push({
        id: this.nextId++,
        x: ENTRANCE[0],
        y: ENTRANCE[1],
        path: [
          [CORRIDOR_X, COLLECTOR_SPOT[1]],
          [COLLECTOR_SPOT[0], COLLECTOR_SPOT[1]],
        ],
        state: "walk",
        after: "browse",
        timer: 9999,
        look: COLLECTOR_LOOK,
        facing: "back",
        flip: false,
        walkT: 0,
        bubble: 0,
        stops: 99,
        collector: true,
      });
    } else if (col && !this.view.collector && col.state !== "leave") {
      col.path = [
        [CORRIDOR_X, col.y],
        [ENTRANCE[0], ENTRANCE[1]],
      ];
      col.state = "leave";
      col.after = "gone";
    }
    const speed = 1.9;
    for (const cu of this.customers) {
      if (cu.bubble > 0) cu.bubble = Math.max(0, cu.bubble - dt);
      if (cu.state === "walk" || cu.state === "leave") {
        const tgt = cu.path[0];
        if (!tgt) {
          this.arrive(cu);
          continue;
        }
        const dx = tgt[0] - cu.x;
        const dy = tgt[1] - cu.y;
        const d = Math.hypot(dx, dy);
        const step = speed * dt;
        if (d <= step) {
          cu.x = tgt[0];
          cu.y = tgt[1];
          cu.path.shift();
        } else {
          cu.x += (dx / d) * step;
          cu.y += (dy / d) * step;
        }
        // 이동 방향 → 스프라이트 방향 (+x·+y는 화면 아래쪽 = 정면)
        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
          cu.facing = dx + dy >= 0 ? "front" : "back";
          cu.flip = dy > dx;
        }
        cu.walkT += dt;
      } else if (cu.collector) {
        cu.facing = "front";
      } else {
        cu.timer -= dt;
        if (cu.timer <= 0) this.nextStep(cu);
      }
    }
    this.customers = this.customers.filter((c) => !(c.state === "leave" && c.path.length === 0 && c.after === "gone"));
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < (p.kind === "text" ? 1.4 : 0.9));
  }

  private arrive(cu: Customer) {
    if (cu.after === "browse") {
      cu.state = "browse";
      cu.timer = 1.4 + this.rnd() * 2.2;
      cu.facing = "back";
    } else if (cu.after === "pay") {
      cu.state = "pay";
      cu.timer = 0.9;
      cu.facing = "front";
      cu.flip = false;
    } else {
      cu.state = "leave";
      cu.after = "gone";
    }
  }

  private nextStep(cu: Customer) {
    if (cu.state === "browse") {
      cu.stops++;
      const shelves = this.ownedShelves();
      if (cu.stops < 2 && this.rnd() < 0.3 && shelves.length > 1) {
        const s = shelves[Math.floor(this.rnd() * shelves.length)];
        cu.path = this.routeToShelf([cu.x, cu.y], s);
        cu.path.unshift([CORRIDOR_X, cu.y]);
        cu.after = "browse";
      } else {
        const q = (this.rnd() - 0.5) * 0.5;
        cu.path = [
          [CORRIDOR_X, cu.y],
          [CORRIDOR_X, COUNTER_SPOT[1] + q],
          [COUNTER_SPOT[0], COUNTER_SPOT[1] + q],
        ];
        cu.after = "pay";
      }
      cu.state = "walk";
    } else if (cu.state === "pay") {
      const p = sp(COUNTER_TILES[0][0] + 0.5, COUNTER_TILES[0][1] + 1);
      this.pops.push({ x: p.x, y: p.y - 22, t: 0, kind: "coin" });
      cu.path = [
        [CORRIDOR_X, cu.y],
        [ENTRANCE[0], ENTRANCE[1]],
      ];
      cu.state = "leave";
      cu.after = "gone";
    }
  }

  // ───────────────────────── 입력
  private onPointer = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const my = ((e.clientY - r.top) / r.height) * H;
    const sorted = [...this.customers].sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const cu of sorted) {
      if (cu.collector && cu.state !== "leave") {
        const p = sp(cu.x, cu.y);
        if (mx >= p.x - 10 && mx <= p.x + 10 && my >= p.y - 40 && my <= p.y + 3) {
          this.cb.onTapCollector();
          e.preventDefault();
          return;
        }
        continue;
      }
      if (cu.bubble <= 0) continue;
      const p = sp(cu.x, cu.y);
      if (mx >= p.x - 9 && mx <= p.x + 9 && my >= p.y - 34 && my <= p.y + 3) {
        cu.bubble = 0;
        const amt = this.cb.onTapCustomer();
        this.pops.push({ x: p.x, y: p.y - 30, t: 0, kind: "text", text: "+" + this.cb.format(amt), color: "#ffe066" });
        for (let i = 0; i < 6; i++) this.pops.push({ x: p.x + (i - 2.5) * 4, y: p.y - 20, t: -i * 0.03, kind: "spark" });
        e.preventDefault();
        return;
      }
    }
  };

  // ───────────────────────── 렌더링
  private draw() {
    const c = this.c;
    c.setTransform(R, 0, 0, R, 0, 0);
    c.imageSmoothingEnabled = false;
    rect(c, 0, 0, W, H, "#2b2340");
    // 바깥 배경 점무늬
    c.fillStyle = "#332a4c";
    for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < W; x += 8) c.fillRect(x, y, 1, 1);

    this.drawFloor();
    this.drawWalls();

    const items: { d: number; f: () => void }[] = [];
    SHELF_POS.forEach((pos, i) => {
      const [gx, gy] = pos.t;
      items.push({ d: gx + gy + 1, f: () => this.drawShelf(i, gx, gy) });
    });
    COUNTER_TILES.forEach(([gx, gy], k) => items.push({ d: gx + gy + 1, f: () => this.drawCounter(gx, gy, k === 0) }));
    this.view.staff.forEach((hired, i) => {
      if (!hired) return;
      const [x, y] = STAFF_POS[i];
      items.push({ d: x + y, f: () => this.drawStaff(i, x, y) });
    });
    for (const cu of this.customers) items.push({ d: cu.x + cu.y, f: () => this.drawCustomer(cu) });
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.f();

    this.drawPops();
  }

  private drawFloor() {
    const c = this.c;
    for (let gy = 0; gy < N; gy++)
      for (let gx = 0; gx < N; gx++) {
        const p = sp(gx, gy);
        diamond(c, p.x, p.y, (gx + gy) % 2 ? "#e2c79f" : "#ead5b2");
      }
    // 입구 매트
    const m = sp(5, 8);
    diamond(c, m.x, m.y + 2, "#b8424e", 12, 6);
    diamond(c, m.x, m.y + 4, "#d65a63", 8, 4);
    // 앞쪽 바닥 두께
    const pl = sp(0, N);
    const pb = sp(N, N);
    const pr = sp(N, 0);
    for (let k = 0; k < (pb.x - pl.x) * R; k++) {
      rect(c, pl.x + k / R, pl.y + Math.floor(k / 2) / R, 1 / R, 5, "#9c6b4a");
      rect(c, pl.x + k / R, pl.y + Math.floor(k / 2) / R + 5, 1 / R, 0.5, "#6e4630");
    }
    for (let k = 0; k < (pr.x - pb.x) * R; k++) {
      rect(c, pb.x + k / R, pb.y - Math.floor(k / 2) / R, 1 / R, 5, "#7d5238");
      rect(c, pb.x + k / R, pb.y - Math.floor(k / 2) / R + 5, 1 / R, 0.5, "#573726");
    }
  }

  private drawWalls() {
    const c = this.c;
    const len = N * 16;
    // 왼쪽 벽 (gx=0 라인): x = OX - k, 바닥 y = OY + k/2 — 실제 픽셀 단위로 채움
    for (let kd = 0; kd <= len * R; kd++) {
      const x = OX - kd / R - 1 / R;
      const b = OY + Math.floor(kd / 2) / R;
      rect(c, x, b - WALL_H, 1 / R, WALL_H, "#efdcc3");
      rect(c, x, b - 4, 1 / R, 4, "#9c6b4a");
      rect(c, x, b - 4, 1 / R, 0.5, "#b8845f");
      rect(c, x, b - WALL_H - 3, 1 / R, 3, "#c9a57a");
      rect(c, x, b - WALL_H - 3, 1 / R, 0.5, "#e3c49b");
      if (kd % (16 * R) === 0) rect(c, x, b - WALL_H, 1 / R, WALL_H - 4, "#e2cbad");
    }
    // 오른쪽 벽 (gy=0 라인)
    for (let kd = 0; kd <= len * R; kd++) {
      const x = OX + kd / R;
      const b = OY + Math.floor(kd / 2) / R;
      rect(c, x, b - WALL_H, 1 / R, WALL_H, "#f6ead7");
      rect(c, x, b - 4, 1 / R, 4, "#8a5a3c");
      rect(c, x, b - 4, 1 / R, 0.5, "#a8744f");
      rect(c, x, b - WALL_H - 3, 1 / R, 3, "#d9b88c");
      rect(c, x, b - WALL_H - 3, 1 / R, 0.5, "#f0d6ad");
      if (kd % (16 * R) === 0) rect(c, x, b - WALL_H, 1 / R, WALL_H - 4, "#ecdcc4");
    }
    // 창문 (오른쪽 벽 끝쪽)
    this.wallPatchR(118, 140, 10, 30, "#7d5238");
    this.wallPatchR(120, 138, 12, 28, "#8fd3f5");
    this.wallPatchR(120, 138, 20, 21, "#7d5238");
    this.wallPatchR(128, 129, 12, 28, "#7d5238");
    this.wallPatchR(121, 124, 22, 27, "#c6ecff");
    // 포스터 (왼쪽 벽)
    this.wallPatchL(10, 24, 14, 32, "#4f8fe6");
    this.wallPatchL(12, 22, 22, 30, "#ffe066");
    this.wallPatchL(14, 20, 16, 20, "#f0f0f0");
    this.wallPatchL(118, 134, 12, 30, "#ef7fb4");
    this.wallPatchL(120, 132, 20, 28, "#fff4f8");
    this.wallPatchL(124, 128, 14, 18, "#9b6ee8");
    // 간판
    const sx = OX - 28;
    rect(c, sx - 1, 0, 58, 17, OUTLINE);
    rect(c, sx, 1, 56, 15, "#e85d5d");
    rect(c, sx, 1, 56, 1.5, "#ff8a80");
    rect(c, sx, 14.5, 56, 1.5, "#b83a3a");
    rect(c, OX - 14, 17, 1, 3, OUTLINE);
    rect(c, OX + 13, 17, 1, 3, OUTLINE);
    c.font = "bold 12px Galmuri11, monospace";
    c.textAlign = "center";
    c.textBaseline = "top";
    c.fillStyle = "#7a1f2e";
    c.fillText("가챠샵", OX + 0.5, 3);
    c.fillStyle = "#fff4e0";
    c.fillText("가챠샵", OX, 2.5);
  }

  /** 오른쪽 벽 위 사각 패치: k 범위, 바닥으로부터 높이 v 범위 */
  private wallPatchR(k0: number, k1: number, v0: number, v1: number, col: string) {
    for (let kd = k0 * R; kd < k1 * R; kd++) rect(this.c, OX + kd / R, OY + Math.floor(kd / 2) / R - v1, 1 / R, v1 - v0, col);
  }
  private wallPatchL(k0: number, k1: number, v0: number, v1: number, col: string) {
    for (let kd = k0 * R; kd < k1 * R; kd++) rect(this.c, OX - kd / R - 1 / R, OY + Math.floor(kd / 2) / R - v1, 1 / R, v1 - v0, col);
  }

  private drawShelf(i: number, gx: number, gy: number) {
    const c = this.c;
    const p = sp(gx, gy);
    const own = this.view.own[i] ?? 0;
    if (own <= 0) {
      const next = i === 0 || (this.view.own[i - 1] ?? 0) > 0;
      if (next) {
        const blink = Math.floor(this.t * 2) % 2 === 0;
        diamondOutline(c, p.x, p.y, blink ? "#ffe066" : "#e8a33d", 16, 8, 2);
        c.font = "10px Galmuri9, monospace";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = OUTLINE;
        c.fillText("NEW", p.x + 1, p.y + 9);
        c.fillStyle = blink ? "#ffe066" : "#fff";
        c.fillText("NEW", p.x, p.y + 8);
      } else {
        diamondOutline(c, p.x, p.y, "rgba(120,90,70,0.35)", 16, 8, 2);
      }
      return;
    }
    const r = seeded(i * 97 + 13);
    const tier = own >= 100 ? 3 : own >= 50 ? 2 : own >= 25 ? 1 : 0; // 마일스톤에 따라 꾸밈 증가
    switch (i) {
      case 0: {
        // 캡슐토이 머신
        isoBox(c, p.x, p.y, 14, "#ff7b7b", "#d94848", "#b83a3a");
        const pt = leftFacePt(p.x, p.y, 7, 6);
        rect(c, pt.x, pt.y - 3, 3, 3, OUTLINE);
        rect(c, pt.x + 1, pt.y - 2, 1, 1, "#ffe066");
        const cx = p.x;
        const cy = p.y - 14 + 1;
        const rr = 8;
        for (let dy = -rr; dy <= 0; dy++) {
          const w = Math.floor(Math.sqrt(rr * rr - dy * dy));
          rect(c, cx - w, cy + dy, w * 2, 1, "#bfe8ff");
        }
        for (let k = 0; k < 6 + tier * 2; k++) {
          const bx = cx - 6 + Math.floor(r() * 11);
          const by = cy - 1 - Math.floor(r() * 5);
          rect(c, bx, by, 2, 2, FIG_COLORS[k % FIG_COLORS.length]);
        }
        rect(c, cx - 4, cy - 7, 2, 2, "#ffffff");
        rect(c, cx - 8, cy, 16, 1, "#8a2e2e");
        // 대형 캡슐 모형 (살짝 통통 튐)
        const hop = Math.floor(this.t * 2) % 2;
        rect(c, cx - 1, cy - 11, 2, 3, "#8a2e2e");
        drawMap(c, CAPSULE_HI, CAPSULE_PAL, cx - 6, cy - 22 - hop, false, 1 / R);
        if (Math.floor(this.t * 3) % 3 === 0) rect(c, cx + 7, cy - 23 - hop, 1, 1, "#fff");
        break;
      }
      case 1: {
        // 프라모델 코너 (박스 진열장)
        const h = 26;
        isoBox(c, p.x, p.y, h, "#8ea0c9", "#6d7fa8", "#56668a");
        for (const v of [3, 11, 19]) {
          for (let u = 1; u < 15; u++) {
            const q = leftFacePt(p.x, p.y, u, v);
            rect(c, q.x, q.y - 1, 1, 1, "#3e4a66");
          }
          for (let u = 2; u < 14; u += 4) {
            if (v === 19 && tier < 1 && u > 6) continue;
            const q = leftFacePt(p.x, p.y, u, v + 1);
            const col = FIG_COLORS[Math.floor(r() * FIG_COLORS.length)];
            rect(c, q.x, q.y - 6, 3, 6, col);
            rect(c, q.x, q.y - 6, 3, 1, shade(col, 0.35));
          }
        }
        // 윗면: 받침대 + 로봇 모형
        const ty = p.y - h + 8;
        rect(c, p.x - 7, ty + 1, 14, 3, "#3e4a66");
        rect(c, p.x - 7, ty + 1, 14, 1, "#b6c3e0");
        drawMap(c, ROBOT_HI, ROBOT_PAL, p.x - 5, ty - 16, false, 1 / R);
        if (Math.floor(this.t * 2) % 2) rect(c, p.x - 3, ty - 12, 1, 1, "#fff");
        break;
      }
      case 2: {
        // 미니피규어 선반
        const h = 26;
        isoBox(c, p.x, p.y, h, "#fff8ee", "#efe6d8", "#d6cab6");
        for (const v of [3, 11, 19]) {
          for (let u = 1; u < 15; u++) {
            const q = leftFacePt(p.x, p.y, u, v);
            rect(c, q.x, q.y - 1, 1, 1, "#b9a88e");
          }
          for (let u = 2; u < 15; u += 3) {
            if (r() < 0.25 - tier * 0.08) continue;
            const q = leftFacePt(p.x, p.y, u, v + 1);
            rect(c, q.x, q.y - 3, 2, 3, FIG_COLORS[Math.floor(r() * FIG_COLORS.length)]);
            rect(c, q.x, q.y - 5, 2, 2, "#ffd9b8");
          }
        }
        // 윗면: 자동차 모형
        const ty = p.y - h + 8;
        rect(c, p.x - 9, ty + 2, 18, 2, "#b9a88e");
        drawMap(c, CAR_HI, CAR_PAL, p.x - 8, ty - 6, false, 1 / R);
        break;
      }
      case 3: {
        // 스케일 피규어 유리장 (왼쪽 벽, 정면 = 우측면)
        const h = 32;
        leftFace(c, p.x, p.y, h, "#7d5238");
        rightFace(c, p.x, p.y, h, "#a8dcea");
        diamond(c, p.x, p.y - h, "#9c6b4a");
        for (let u = 0; u < 16; u++) {
          const q = rightFacePt(p.x, p.y, u, 0);
          rect(c, q.x, q.y - 3, 1, 3, "#7d5238");
          rect(c, q.x, q.y - 17, 1, 1, "#e8f7fb");
        }
        const figs = [3, 8, 12];
        figs.forEach((u, k) => {
          const base = k === 1 ? 18 : 4;
          const q = rightFacePt(p.x, p.y, u, base);
          const col = FIG_COLORS[(k * 3 + 1) % FIG_COLORS.length];
          rect(c, q.x, q.y - 9, 3, 6, col);
          rect(c, q.x, q.y - 12, 3, 3, "#ffd9b8");
          rect(c, q.x - 1, q.y - 3, 5, 2, "#555");
        });
        // 유리 반사
        for (let v = 6; v < 28; v++) {
          const q = rightFacePt(p.x, p.y, 13 - Math.floor(v / 4), v);
          rect(c, q.x, q.y, 1, 1, "rgba(255,255,255,0.7)");
        }
        // 윗면: 받침대 + 검객 모형, 베기 궤적
        {
          const ty = p.y - h + 8;
          rect(c, p.x - 8, ty + 1, 16, 3, "#5a3a26");
          rect(c, p.x - 8, ty + 1, 16, 1, "#b07a52");
          drawMap(c, SWORDSMAN_HI, SWORDSMAN_PAL, p.x - 8, ty - 16, false, 1 / R);
          const ph = Math.floor(this.t * 4) % 4;
          if (ph < 2) {
            const arc: [number, number][] = [[12, -18], [15, -17], [17, -15], [18, -12], [18, -9], [17, -6]];
            arc.forEach(([ax, ay], k) => {
              if (ph === 1 && k < 2) return;
              rect(c, p.x - 8 + ax, ty + ay, 1, 1, k % 2 ? "#bfe8ff" : "#ffffff");
            });
          }
        }
        break;
      }
      case 4: {
        // 쿠지 부스
        isoBox(c, p.x, p.y, 12, "#ffd66b", "#e0ad2e", "#f2c14e");
        // 경품 상자 (왼쪽)
        for (let k = 0; k < 2; k++) {
          const bx = p.x - 10 + k * 5;
          const by = p.y - 12 + 6 + k * 2;
          rect(c, bx, by - 5, 4, 5, FIG_COLORS[(k + 2) % FIG_COLORS.length]);
          rect(c, bx, by - 5, 4, 1, "#fff");
        }
        // 무도가 모형 + 기합 오라
        {
          const ty = p.y - 12 + 8;
          rect(c, p.x - 3, ty + 1, 14, 2, "#c98a1a");
          const fx = p.x - 2;
          const fy = ty - 15;
          const aura = Math.floor(this.t * 5) % 3;
          c.fillStyle = aura === 0 ? "#ffe066" : aura === 1 ? "#fff6b0" : "#ffd23f";
          for (const [ax, ay] of [[1, 2], [12, 3], [0, 9], [13, 10], [3, -1], [10, -1]] as [number, number][])
            c.fillRect(fx + ax, fy + ay - (aura % 2), 1, 2);
          drawMap(c, FIGHTER_HI, FIGHTER_PAL, fx, fy, false, 1 / R);
          if (aura === 0) rect(c, fx + 15, fy + 7, 2, 2, "#fff");
        }
        break;
      }
      case 5: {
        // 한정판 쇼케이스
        const h = 28;
        leftFace(c, p.x, p.y, h, "#5a1730");
        rightFace(c, p.x, p.y, h, "#7a1f3d");
        diamond(c, p.x, p.y - h, "#f2c14e");
        diamond(c, p.x, p.y - h + 1, "#9c2a4f", 14, 7);
        const q = rightFacePt(p.x, p.y, 8, 6);
        rect(c, q.x - 3, q.y - 2, 7, 2, "#f2c14e");
        rect(c, q.x - 1, q.y - 12, 3, 10, "#9b6ee8");
        rect(c, q.x - 1, q.y - 15, 3, 3, "#ffd9b8");
        rect(c, q.x - 2, q.y - 16, 5, 2, "#e8c26a");
        const tw = Math.floor(this.t * 3) % 4;
        const sx = [q.x - 5, q.x + 4, q.x - 4, q.x + 5][tw];
        const sy = [q.y - 14, q.y - 10, q.y - 6, q.y - 16][tw];
        rect(c, sx, sy - 1, 1, 3, "#fff");
        rect(c, sx - 1, sy, 3, 1, "#fff");
        break;
      }
      case 6: {
        // 경매 코너 (아일랜드)
        isoBox(c, p.x, p.y, 10, "#b07a52", "#8a5a3c", "#6e4630");
        isoBox(c, p.x, p.y - 6, 8, "#ffffff", "#e0e0e0", "#c8c8c8", 8);
        rect(c, p.x - 2, p.y - 20, 4, 6, "#f2c14e");
        rect(c, p.x - 3, p.y - 22, 6, 2, "#ffe066");
        rect(c, p.x - 1, p.y - 14, 2, 1, "#c98a1a");
        if (Math.floor(this.t * 2) % 2) rect(c, p.x + 3, p.y - 23, 1, 1, "#fff");
        break;
      }
      case 7: {
        // 온라인 스토어 (PC 데스크 + 택배)
        isoBox(c, p.x, p.y, 12, "#e8e3da", "#cfc8bb", "#b8b0a2");
        rect(c, p.x - 7, p.y - 24, 12, 10, OUTLINE);
        rect(c, p.x - 6, p.y - 23, 10, 7, Math.floor(this.t * 1.5) % 2 ? "#7fe0ff" : "#9ceaff");
        rect(c, p.x - 5, p.y - 21, 5, 1, "#2b6c8f");
        rect(c, p.x - 5, p.y - 19, 7, 1, "#2b6c8f");
        rect(c, p.x - 2, p.y - 14, 2, 2, OUTLINE);
        isoBox(c, p.x + 9, p.y - 2, 6, "#d9a066", "#b57f48", "#9c6b3a", 6);
        if (tier >= 1) isoBox(c, p.x + 9, p.y - 8, 5, "#d9a066", "#b57f48", "#9c6b3a", 5);
        break;
      }
    }
    // 마일스톤 별 표시
    if (tier > 0) {
      for (let k = 0; k < tier; k++) {
        const sx = p.x - (tier - 1) * 3 + k * 6;
        const sy = p.y + 6;
        rect(c, sx - 1, sy, 3, 1, "#ffe066");
        rect(c, sx, sy - 1, 1, 3, "#ffe066");
      }
    }
  }

  private drawCounter(gx: number, gy: number, withRegister: boolean) {
    const c = this.c;
    const p = sp(gx, gy);
    isoBox(c, p.x, p.y, 13, "#c98f5f", "#a8703f", "#8a5a3c");
    diamond(c, p.x, p.y - 13, "#dcae84", 14, 7);
    if (withRegister) {
      isoBox(c, p.x + 2, p.y - 10, 5, "#6b6b7a", "#4f4f5c", "#3d3d48", 6);
      rect(c, p.x + 1, p.y - 20, 6, 4, OUTLINE);
      rect(c, p.x + 2, p.y - 19, 4, 2, "#7dffb0");
    }
  }

  private drawStaff(i: number, x: number, y: number) {
    const p = sp(x, y);
    const bob = Math.floor(this.t * 2 + i) % 2;
    drawChar(this.c, STAFF_LOOKS[i], p.x, p.y - bob, i === 0 ? "front" : Math.floor(this.t / 3 + i) % 3 === 0 ? "back" : "front", 0, i % 2 === 1);
    if (i === 5) {
      // 마케터 피켓
      rect(this.c, p.x + 5, p.y - 22 - bob, 1, 12, "#7d5238");
      rect(this.c, p.x + 1, p.y - 30 - bob, 10, 8, "#fff");
      rect(this.c, p.x + 2, p.y - 28 - bob, 8, 1, "#e85d5d");
      rect(this.c, p.x + 2, p.y - 26 - bob, 6, 1, "#e85d5d");
    }
  }

  private drawCustomer(cu: Customer) {
    const c = this.c;
    const p = sp(cu.x, cu.y);
    const moving = cu.state === "walk" || cu.state === "leave";
    const frame = moving ? ((Math.floor(cu.walkT * 8) % 2) + 1) as 1 | 2 : 0;
    const bob = moving && frame === 1 ? 1 : 0;
    drawChar(c, cu.look, p.x, p.y - bob, cu.facing, frame, cu.flip);
    if (cu.collector) {
      if (cu.state === "leave") return;
      const pulse = Math.floor(this.t * 3) % 2;
      const bx = p.x - 7;
      const by = p.y - 31 - pulse;
      rect(c, bx - 1, by - 1, 16, 13, OUTLINE);
      rect(c, bx, by, 14, 11, "#ffd23f");
      rect(c, bx, by, 14, 1.5, "#fff6b0");
      rect(c, bx + 5, by + 12, 4, 1, OUTLINE);
      rect(c, bx + 6, by + 11, 2, 2, "#ffd23f");
      // 보석 (고가 매입 표시)
      [2, 5, 7, 5, 3, 1].forEach((w, k) => rect(c, bx + 7 - w / 2, by + 2 + k * 1.5, w, 1.5, k === 0 ? "#bff4ff" : k < 3 ? "#5fd4ff" : "#2f8fd0"));
      rect(c, bx + 5, by + 3.5, 1, 1, "#ffffff");
      return;
    }
    if (cu.state === "browse") {
      // 고민 점점점
      const n = Math.floor(this.t * 3) % 4;
      for (let k = 0; k < n; k++) rect(c, p.x - 3 + k * 3, p.y - 20, 1, 1, "#fff");
    }
    if (cu.bubble > 0) {
      const pulse = Math.floor(this.t * 4) % 2;
      const bx = p.x - 5;
      const by = p.y - 30 - pulse;
      rect(c, bx - 1, by - 1, 12, 11, OUTLINE);
      rect(c, bx, by, 10, 9, "#fff");
      rect(c, bx + 3, by + 10, 3, 1, OUTLINE);
      rect(c, bx + 4, by + 9, 2, 2, "#fff");
      rect(c, bx + 4, by + 1, 2, 5, "#e85d5d");
      rect(c, bx + 4, by + 7, 2, 1, "#e85d5d");
    }
  }

  private drawPops() {
    const c = this.c;
    for (const p of this.pops) {
      if (p.t < 0) continue;
      if (p.kind === "coin") {
        const y = p.y - p.t * 18;
        rect(c, p.x - 3, y - 3, 6, 6, OUTLINE);
        rect(c, p.x - 2, y - 2, 4, 4, "#ffd23f");
        rect(c, p.x - 1, y - 2, 1, 2, "#fff6b0");
      } else if (p.kind === "spark") {
        const y = p.y - p.t * 30;
        rect(c, p.x, y, 2, 2, p.t % 0.2 < 0.1 ? "#ffe066" : "#fff");
      } else if (p.text) {
        const y = Math.round(p.y - p.t * 14);
        c.font = "bold 12px Galmuri11, monospace";
        c.textAlign = "center";
        c.textBaseline = "bottom";
        c.fillStyle = OUTLINE;
        for (const [ox, oy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ])
          c.fillText(p.text, p.x + ox, y + oy);
        c.fillStyle = p.color ?? "#fff";
        c.fillText(p.text, p.x, y);
      }
    }
  }
}
