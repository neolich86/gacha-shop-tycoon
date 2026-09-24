// 2등신 캐릭터 도트 스프라이트 (10×15)
// o 외곽선 · h 머리 · s 피부 · e 눈 · k 볼터치 · c 상의 · a 앞치마 · p 하의 · b 신발 · t 모자
import { drawMap, type Ctx } from "./pixel";

const HEAD_FRONT = [
  "..oooooo..",
  ".ohhhhhho.",
  "ohhhhhhhho",
  "ohhhhhhhho",
  "ohssssssho",
  "osesssseso",
  "okssssssko",
  ".oossssoo.",
];
const HEAD_BACK = [
  "..oooooo..",
  ".ohhhhhho.",
  "ohhhhhhhho",
  "ohhhhhhhho",
  "ohhhhhhhho",
  "ohhhhhhhho",
  "ohhhhhhhho",
  ".oohhhhoo.",
];

const BODY = [
  "..occcco..",
  ".occcccco.",
  "osccccccso",
  "osccccccso",
];
const BODY_APRON = [
  "..occcco..",
  ".ocaaaaco.",
  "osaaaaaaso",
  "osaaaaaaso",
];

const LEGS = [
  [".oppppppo.", "..op..po..", "..ob..bo.."], // 서기
  [".oppppppo.", "..op..po..", ".ob...bo.."], // 걷기 1
  [".oppppppo.", "..op..po..", "..ob...bo."], // 걷기 2
];

const HAT = ["...tttt...", "..tttttt.."];

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

export function drawChar(c: Ctx, look: Look, x: number, y: number, facing: "front" | "back", frame: 0 | 1 | 2, flip = false) {
  // x,y = 발 중앙 좌표
  const left = Math.round(x - 5);
  const top = Math.round(y - 15);
  const pal: Record<string, string> = {
    o: OUTLINE,
    h: look.hair,
    s: look.skin,
    e: "#2a1e2e",
    k: "#f29c9c",
    c: look.shirt,
    a: look.apron ?? look.shirt,
    p: look.pants,
    b: look.shoes,
    t: look.hat ?? look.hair,
  };
  const map = [
    ...(facing === "front" ? HEAD_FRONT : HEAD_BACK),
    ...(look.apron && facing === "front" ? BODY_APRON : BODY),
    ...LEGS[frame],
  ];
  // 그림자
  c.fillStyle = "rgba(40,20,40,0.28)";
  c.fillRect(left + 1, Math.round(y) - 1, 8, 2);
  c.fillRect(left + 2, Math.round(y), 6, 1);
  drawMap(c, map, pal, left, top, flip);
  if (look.hat) drawMap(c, HAT, pal, left, top - 1, flip);
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
