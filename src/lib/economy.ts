// 가챠샵 타이쿤 — 경제 로직 (순수 함수, 서버·시뮬레이션과 공유)
// 수치 근거: 기획서 v0.1 §3~§7 / Node 봇 시뮬레이션

export interface ShelfDef {
  id: string;
  name: string;
  baseCost: number;
  baseIncome: number;
  growth: number;
}

export const SHELVES: ShelfDef[] = [
  { id: "capsule", name: "캡슐토이 머신", baseCost: 10, baseIncome: 1, growth: 1.09 },
  { id: "plamo", name: "프라모델 코너", baseCost: 200, baseIncome: 8, growth: 1.1 },
  { id: "mini", name: "미니피규어 선반", baseCost: 4e3, baseIncome: 60, growth: 1.11 },
  { id: "scale", name: "스케일 피규어 장", baseCost: 8e4, baseIncome: 450, growth: 1.12 },
  { id: "kuji", name: "쿠지 부스", baseCost: 1.6e6, baseIncome: 3.4e3, growth: 1.13 },
  { id: "limited", name: "한정판 쇼케이스", baseCost: 3.2e7, baseIncome: 2.6e4, growth: 1.14 },
  { id: "auction", name: "경매 코너", baseCost: 6.4e8, baseIncome: 2e5, growth: 1.15 },
  { id: "online", name: "온라인 스토어", baseCost: 1.3e10, baseIncome: 1.5e6, growth: 1.16 },
];

export const MILESTONES: { at: number; mult: number }[] = [
  { at: 25, mult: 2 },
  { at: 50, mult: 2 },
  { at: 100, mult: 2 },
  { at: 200, mult: 2 },
  { at: 300, mult: 2 },
  { at: 400, mult: 3 },
];

export interface StaffDef {
  id: string;
  name: string;
  cost: number;
  mult: number;
  desc: string;
}

export const STAFF: StaffDef[] = [
  { id: "parttime", name: "알바생", cost: 2e4, mult: 2, desc: "계산대를 지켜요" },
  { id: "manager", name: "매니저", cost: 2e6, mult: 2, desc: "진열을 정리해요" },
  { id: "chief", name: "점장", cost: 2e8, mult: 2, desc: "매장을 총괄해요" },
  { id: "md", name: "MD", cost: 3e10, mult: 3, desc: "잘 팔리는 상품을 골라요" },
  { id: "buyer", name: "바이어", cost: 5e12, mult: 3, desc: "좋은 물건을 싸게 들여와요" },
  { id: "marketer", name: "마케터", cost: 1e15, mult: 3, desc: "손님을 불러모아요" },
  { id: "ceo", name: "대표", cost: 3e17, mult: 5, desc: "프랜차이즈를 꿈꿔요" },
];

// 가챠 등급 (M2에서 사용)
export const RARITIES = [
  { id: "N", weight: 60, bonus: 0.05 },
  { id: "R", weight: 26, bonus: 0.12 },
  { id: "SR", weight: 10, bonus: 0.3 },
  { id: "SSR", weight: 3.5, bonus: 0.8 },
  { id: "UR", weight: 0.5, bonus: 2.0 },
] as const;
export const FIG_SLOTS = 5;

export const PRESTIGE_DIVISOR = 1e9;
export const PRESTIGE_BONUS = 0.05;
export const OFFLINE_BASE = { efficiency: 0.5, capSec: 4 * 3600 };
export const TAP_SECONDS = 10;

export interface GameState {
  v: 1;
  gold: number;
  runEarned: number; // 이번 런 누적 매출 (환생 계산용)
  totalEarned: number; // 전체 누적
  prestige: number;
  own: number[];
  staff: boolean[];
  figs: number[][]; // 진열대별 장착 피규어 등급 인덱스
  lastSeen: number; // ms
  createdAt: number;
  taps: number;
}

export function newGame(now = Date.now()): GameState {
  return {
    v: 1,
    gold: 10,
    runEarned: 0,
    totalEarned: 0,
    prestige: 0,
    own: SHELVES.map(() => 0),
    staff: STAFF.map(() => false),
    figs: SHELVES.map(() => []),
    lastSeen: now,
    createdAt: now,
    taps: 0,
  };
}

export function milestoneMult(count: number): number {
  let m = 1;
  for (const ms of MILESTONES) if (count >= ms.at) m *= ms.mult;
  return m;
}

export function nextMilestone(count: number): { at: number; mult: number; prev: number } | null {
  let prev = 0;
  for (const ms of MILESTONES) {
    if (count < ms.at) return { ...ms, prev };
    prev = ms.at;
  }
  return null;
}

export function figMult(s: GameState, i: number): number {
  return 1 + s.figs[i].reduce((a, r) => a + RARITIES[r].bonus, 0);
}

export function staffMult(s: GameState): number {
  return STAFF.reduce((m, d, i) => (s.staff[i] ? m * d.mult : m), 1);
}

export function prestigeMult(s: GameState): number {
  return 1 + s.prestige * PRESTIGE_BONUS;
}

export function globalMult(s: GameState): number {
  return staffMult(s) * prestigeMult(s);
}

export function shelfIncome(s: GameState, i: number, count = s.own[i]): number {
  if (count <= 0) return 0;
  return count * SHELVES[i].baseIncome * milestoneMult(count) * figMult(s, i) * globalMult(s);
}

export function incomePerSec(s: GameState): number {
  let t = 0;
  for (let i = 0; i < SHELVES.length; i++) t += shelfIncome(s, i);
  return t;
}

export function isUnlocked(s: GameState, i: number): boolean {
  return i === 0 || s.own[i - 1] > 0;
}

/** n개 구매 비용 (등비합) */
export function bulkCost(s: GameState, i: number, n: number): number {
  const d = SHELVES[i];
  const first = d.baseCost * Math.pow(d.growth, s.own[i]);
  if (n <= 0) return 0;
  return (first * (Math.pow(d.growth, n) - 1)) / (d.growth - 1);
}

/** 현재 골드로 살 수 있는 최대 개수 */
export function maxAffordable(s: GameState, i: number, gold = s.gold): number {
  const d = SHELVES[i];
  const first = d.baseCost * Math.pow(d.growth, s.own[i]);
  if (gold < first) return 0;
  const n = Math.floor(Math.log((gold * (d.growth - 1)) / first + 1) / Math.log(d.growth));
  // 부동소수 보정
  let k = Math.max(0, n);
  while (k > 0 && bulkCost(s, i, k) > gold) k--;
  return k;
}

export type BuyMode = 1 | 10 | 100 | "max";

export function resolveBuy(s: GameState, i: number, mode: BuyMode): { n: number; cost: number } {
  if (mode === "max") {
    const n = Math.max(1, maxAffordable(s, i));
    return { n, cost: bulkCost(s, i, n) };
  }
  return { n: mode, cost: bulkCost(s, i, mode) };
}

export function buyShelf(s: GameState, i: number, mode: BuyMode): boolean {
  if (!isUnlocked(s, i)) return false;
  const { n, cost } = resolveBuy(s, i, mode);
  if (n <= 0 || cost > s.gold) return false;
  s.gold -= cost;
  s.own[i] += n;
  return true;
}

export function buyStaff(s: GameState, i: number): boolean {
  if (s.staff[i] || STAFF[i].cost > s.gold) return false;
  if (i > 0 && !s.staff[i - 1]) return false;
  s.gold -= STAFF[i].cost;
  s.staff[i] = true;
  return true;
}

export function earn(s: GameState, amount: number): void {
  s.gold += amount;
  s.runEarned += amount;
  s.totalEarned += amount;
}

export function tick(s: GameState, dtSec: number): number {
  const g = incomePerSec(s) * dtSec;
  earn(s, g);
  return g;
}

export function prestigeGain(s: GameState): number {
  return Math.floor(Math.cbrt(s.runEarned / PRESTIGE_DIVISOR));
}

export interface OfflineResult {
  elapsedSec: number;
  countedSec: number;
  amount: number;
}

export function computeOffline(s: GameState, now: number): OfflineResult {
  const elapsedSec = Math.max(0, (now - s.lastSeen) / 1000);
  const countedSec = Math.min(elapsedSec, OFFLINE_BASE.capSec);
  const amount = incomePerSec(s) * countedSec * OFFLINE_BASE.efficiency;
  return { elapsedSec, countedSec, amount };
}

/** 저장 데이터 검증·마이그레이션 */
export function loadState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<GameState>;
  if (r.v !== 1) return null;
  const base = newGame(typeof r.createdAt === "number" ? r.createdAt : Date.now());
  const num = (x: unknown, d: number) => (typeof x === "number" && isFinite(x) && x >= 0 ? x : d);
  return {
    ...base,
    gold: num(r.gold, base.gold),
    runEarned: num(r.runEarned, 0),
    totalEarned: num(r.totalEarned, 0),
    prestige: Math.floor(num(r.prestige, 0)),
    own: SHELVES.map((_, i) => Math.floor(num(r.own?.[i], 0))),
    staff: STAFF.map((_, i) => r.staff?.[i] === true),
    figs: SHELVES.map((_, i) =>
      Array.isArray(r.figs?.[i])
        ? r.figs![i].filter((x) => Number.isInteger(x) && x >= 0 && x < RARITIES.length).slice(0, FIG_SLOTS)
        : [],
    ),
    lastSeen: num(r.lastSeen, Date.now()),
    taps: Math.floor(num(r.taps, 0)),
  };
}
