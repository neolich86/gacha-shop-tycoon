// Supabase 연동 — 카카오 로그인, 클라우드 세이브, 서버 시간 오프라인 정산, 랭킹
// 환경변수가 없으면 cloudEnabled=false 로 게스트 전용 모드로 동작한다.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { incomePerSec, type GameState } from "./economy";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient | null {
  if (!cloudEnabled || typeof window === "undefined") return null;
  if (!client) {
    client = createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "gacha-shop-tycoon:auth",
      },
    });
  }
  return client;
}

export function displayName(u: User): string {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const n = [m.nickname, m.name, m.full_name, m.preferred_username, m.user_name].find(
    (x) => typeof x === "string" && x.trim(),
  ) as string | undefined;
  return (n ?? "사장님").trim().slice(0, 12);
}

export async function signInKakao(): Promise<void> {
  const c = sb();
  if (!c) return;
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await c.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo } });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await sb()?.auth.signOut();
}

export interface CloudSave {
  nickname: string;
  data: unknown;
  total_earned: number;
  updated_at: string;
}

export async function loadCloud(): Promise<CloudSave | null> {
  const c = sb();
  if (!c) return null;
  const { data, error } = await c.from("saves").select("nickname, data, total_earned, updated_at").maybeSingle();
  if (error) throw error;
  return (data as CloudSave | null) ?? null;
}

export async function saveCloud(s: GameState, nickname?: string): Promise<void> {
  const c = sb();
  if (!c) return;
  const { error } = await c.rpc("save_game", {
    p_data: s,
    p_income: incomePerSec(s),
    p_total: s.totalEarned,
    p_prestige: s.prestige,
    p_dex: s.dex.filter((n) => n > 0).length,
    p_nickname: nickname ?? null,
  });
  if (error) throw error;
}

export interface ServerOffline {
  elapsed: number;
  counted: number;
  amount: number;
}

export async function claimOffline(): Promise<ServerOffline> {
  const c = sb();
  if (!c) return { elapsed: 0, counted: 0, amount: 0 };
  const { data, error } = await c.rpc("claim_offline");
  if (error) throw error;
  const d = data as ServerOffline;
  return { elapsed: Number(d.elapsed) || 0, counted: Number(d.counted) || 0, amount: Number(d.amount) || 0 };
}

export async function setNickname(n: string): Promise<string> {
  const c = sb();
  if (!c) return n;
  const { data, error } = await c.rpc("set_nickname", { p_nickname: n });
  if (error) throw error;
  return data as string;
}

export async function resetCloud(): Promise<void> {
  const c = sb();
  if (!c) return;
  const { error } = await c.rpc("reset_game");
  if (error) throw error;
}

export interface RankRow {
  rank: number;
  nickname: string;
  total_earned: number;
  prestige: number;
  dex_count: number;
  is_me: boolean;
}

export async function fetchLeaderboard(limit = 50): Promise<{ rows: RankRow[]; myRank: number | null }> {
  const c = sb();
  if (!c) return { rows: [], myRank: null };
  const [{ data, error }, { data: session }] = await Promise.all([
    c.rpc("get_leaderboard", { p_limit: limit }),
    c.auth.getSession(),
  ]);
  if (error) throw error;
  let myRank: number | null = null;
  if (session.session) {
    const r = await c.rpc("get_my_rank");
    if (!r.error && r.data != null) myRank = Number(r.data);
  }
  return { rows: ((data ?? []) as RankRow[]).map((r) => ({ ...r, rank: Number(r.rank) })), myRank };
}

/** 에러 코드를 한국어 안내로 */
export function cloudErrorText(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (m.includes("total_decreased")) return "서버 기록보다 진행도가 낮아 저장하지 않았어요.";
  if (m.includes("income_spike")) return "매출이 비정상적으로 급증해 저장이 거부됐어요.";
  if (m.includes("save_too_large")) return "저장 데이터가 너무 커요.";
  if (m.includes("invalid_nickname")) return "닉네임은 1~12자로 입력해 주세요.";
  if (m.includes("Failed to fetch") || m.includes("NetworkError")) return "네트워크에 연결할 수 없어요.";
  return "서버와 통신하지 못했어요.";
}
