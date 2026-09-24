// 로컬 저장 (게스트). M3에서 Supabase 클라우드 세이브가 이 인터페이스 뒤에 붙는다.
import { loadState, type GameState } from "./economy";

const KEY = "gacha-shop-tycoon:save:v1";

export function readLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return loadState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocal(s: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 불가 환경(시크릿 모드 등)은 무시 */
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

// 이 기기 세이브의 주인 (카카오 로그인 계정 id). 게스트면 null
const OWNER_KEY = "gacha-shop-tycoon:owner";

export function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY) || null;
  } catch {
    return null;
  }
}

export function writeOwner(id: string | null): void {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* noop */
  }
}
