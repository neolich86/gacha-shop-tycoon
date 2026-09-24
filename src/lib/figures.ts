// 가상 시리즈 5종 × 12종 = 피규어 60종 (실존 IP 없음)
// 시리즈당 등급 구성: N 5 · R 3 · SR 2 · SSR 1 · UR 1

export type Rarity = 0 | 1 | 2 | 3 | 4; // N R SR SSR UR
export const RARITY_NAMES = ["N", "R", "SR", "SSR", "UR"] as const;
export const RARITY_COLORS = ["#b8b8c8", "#5fb4ff", "#c47bff", "#ffc93c", "#ff6b9a"];

export type Accessory = "ribbon" | "helmet" | "band" | "ears" | "horns";

export interface Series {
  id: string;
  name: string;
  color: string;
  accessory: Accessory;
  hairs: string[];
  outfits: string[];
}

export const SERIES: Series[] = [
  {
    id: "luna",
    name: "마법소녀 루나",
    color: "#ef7fb4",
    accessory: "ribbon",
    hairs: ["#ffd1e8", "#f7a8d0", "#c9a0ff", "#ffe07a", "#2a2440"],
    outfits: ["#ef7fb4", "#ffffff", "#b58cff", "#ff9fb8", "#7fd4ff"],
  },
  {
    id: "mecha",
    name: "메카 가디언",
    color: "#4f8fe6",
    accessory: "helmet",
    hairs: ["#3b2a20", "#1f1b24", "#6b7b8c"],
    outfits: ["#4f8fe6", "#e8eef8", "#e85d5d", "#5a6478", "#ffd23f"],
  },
  {
    id: "hero",
    name: "용사 레온",
    color: "#f2b84b",
    accessory: "band",
    hairs: ["#c9853a", "#6b4226", "#e8c26a", "#8c3b3b", "#1f1b24"],
    outfits: ["#3f7fbf", "#8a5a3c", "#5cc27a", "#b83a3a", "#d9d9e6"],
  },
  {
    id: "cats",
    name: "냥냥 카페",
    color: "#ff914d",
    accessory: "ears",
    hairs: ["#f2b84b", "#8a8a9a", "#f4f4f8", "#2a2a33", "#c9853a"],
    outfits: ["#6b4226", "#f4f4f8", "#ff914d", "#2f2f3a", "#ef7fb4"],
  },
  {
    id: "dragon",
    name: "심해 드래곤",
    color: "#4cc4c4",
    accessory: "horns",
    hairs: ["#4cc4c4", "#2f6fb0", "#7fe0d0", "#9b6ee8", "#e8f4ff"],
    outfits: ["#2f6fb0", "#4cc4c4", "#1f3f6b", "#7fe0d0", "#9b6ee8"],
  },
];

const NAMES: string[][] = [
  // 마법소녀 루나
  ["루나 (평상복)", "루나 (교복)", "별토끼 포포", "달빛 요정", "루나 (잠옷)",
   "루나 (변신)", "쌍둥이 마법소녀 솔", "수호냥 미르",
   "루나 (월광 폼)", "흑마법소녀 녹스",
   "루나 & 솔 합체 마법",
   "달의 여왕 셀레네"],
  // 메카 가디언
  ["정찰기 비트", "작업로봇 볼트", "파일럿 하루", "수송기 카고", "드론 삐삐",
   "가디언 제로", "가디언 스톰", "정비사 미나",
   "가디언 제로 풀아머", "가디언 블레이즈",
   "합체 가디언 오메가",
   "기함 아스트라"],
  // 용사 레온
  ["견습 용사 레온", "방패병 토토", "마을 대장장이", "슬라임 뽀용", "약초꾼 리리",
   "기사 레온", "궁수 엘린", "마법사 오르",
   "성검 레온", "암흑기사 발가",
   "용사 파티 결성",
   "전설의 용사 레온"],
  // 냥냥 카페
  ["치즈냥", "고등어냥", "삼색냥", "턱시도냥", "아기냥",
   "바리스타 냥", "파티시에 냥", "점장냥",
   "라떼아트 냥", "메이드 냥",
   "냥냥 카페 올스타",
   "황금 고양이 킹"],
  // 심해 드래곤
  ["꼬마 해룡", "산호 드래곤", "거품 장어룡", "해파리 용", "진주조개 용",
   "파도 드래곤", "심해 등불룡", "해룡 기사",
   "폭풍 해룡", "빙하 드래곤",
   "쌍두 해룡 트윈타이드",
   "심해의 왕 레비아"],
];

const RARITY_OF_INDEX: Rarity[] = [0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4];

export interface Figure {
  id: number;
  series: number;
  index: number; // 시리즈 내 번호 0..11
  name: string;
  rarity: Rarity;
}

export const FIGURES: Figure[] = SERIES.flatMap((_, si) =>
  NAMES[si].map((name, k) => ({ id: si * 12 + k, series: si, index: k, name, rarity: RARITY_OF_INDEX[k] })),
);

export const FIGURE_COUNT = FIGURES.length;

/** 등급별 풀 (시리즈 무관) */
const POOL: number[][] = [0, 1, 2, 3, 4].map((r) => FIGURES.filter((f) => f.rarity === r).map((f) => f.id));

/** 등급 확률 (%) — 기획서 §5 */
export const RARITY_WEIGHTS = [60, 26, 10, 3.5, 0.5];

export function rollRarity(rnd: () => number): Rarity {
  let x = rnd() * 100;
  for (let r = 0; r < RARITY_WEIGHTS.length; r++) {
    if (x < RARITY_WEIGHTS[r]) return r as Rarity;
    x -= RARITY_WEIGHTS[r];
  }
  return 0;
}

export function rollFigure(rnd: () => number): Figure {
  const r = rollRarity(rnd);
  const pool = POOL[r];
  return FIGURES[pool[Math.floor(rnd() * pool.length)]];
}
