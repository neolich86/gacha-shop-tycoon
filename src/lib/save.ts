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
