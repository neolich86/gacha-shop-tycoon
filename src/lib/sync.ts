// 로그인 시 기기(로컬) 세이브와 계정(클라우드) 세이브를 어떻게 합칠지 결정하는 순수 함수
import type { GameState } from "./economy";

export type SyncDecision =
  | { kind: "useCloud" } // 계정 데이터로 진행
  | { kind: "uploadLocal" } // 이 기기 데이터를 계정에 저장
  | { kind: "fresh" } // 새 게임으로 시작해 계정에 저장
  | { kind: "askMigrate" } // 게스트 진행 → 계정이 비어 있음: 올릴지 물어봄
  | { kind: "askConflict" }; // 게스트 진행 ↔ 계정 데이터 둘 다 있음: 고르게 함

/**
 * @param local      이 기기 세이브
 * @param localOwner 이 기기 세이브의 주인 (null = 게스트)
 * @param cloud      계정 세이브 (없으면 null)
 * @param userId     방금 로그인한 계정
 */
export function decideSync(
  local: GameState,
  localOwner: string | null,
  cloud: GameState | null,
  userId: string,
): SyncDecision {
  const hasProgress = local.totalEarned > 0 || local.boxes > 0;
  if (localOwner && localOwner !== userId) {
    // 다른 계정이 쓰던 기기 데이터는 절대 섞지 않음
    return cloud ? { kind: "useCloud" } : { kind: "fresh" };
  }
  if (localOwner === userId) {
    // 같은 계정: 진행이 더 많은 쪽 (로컬은 10초, 클라우드는 45초 주기라 로컬이 앞설 수 있음)
    if (!cloud) return { kind: "uploadLocal" };
    return local.totalEarned > cloud.totalEarned ? { kind: "uploadLocal" } : { kind: "useCloud" };
  }
  // 게스트 데이터
  if (!cloud) return hasProgress ? { kind: "askMigrate" } : { kind: "uploadLocal" };
  return hasProgress ? { kind: "askConflict" } : { kind: "useCloud" };
}
