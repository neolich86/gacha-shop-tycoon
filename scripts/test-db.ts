// Supabase 마이그레이션 SQL 검증 (PGlite = 브라우저/노드용 실제 Postgres)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const assert = (c: unknown, m: string) => { if (!c) { console.error("FAIL", m); process.exit(1); } console.log("ok ", m); };
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

async function main() {
  const db = new PGlite();
  // Supabase 환경 흉내: auth 스키마, 역할
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  const sql = readFileSync("supabase/migrations/0001_init.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql); // 재실행 안전성
  await db.exec(`grant select on public.saves to authenticated;`);
  assert(true, "마이그레이션 2회 실행");

  const as = async (uid: string | null, role = "authenticated") => {
    await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); set role ${role};`);
  };
  const q = async <T = Record<string, unknown>>(s: string, p: unknown[] = []) => (await db.query<T>(s, p)).rows;
  const err = async (s: string, p: unknown[] = []) => { try { await db.query(s, p); return ""; } catch (e) { return (e as Error).message; } };

  // 저장
  await as(A);
  await q(`select save_game($1, 100, 5000, 0, 3, '가챠왕')`, [JSON.stringify({ v: 1, gold: 1 })]);
  let r = await q<{ nickname: string; total_earned: number }>(`select nickname, total_earned from saves`);
  assert(r.length === 1 && r[0].nickname === "가챠왕" && r[0].total_earned === 5000, "첫 저장·닉네임");
  await q(`select save_game($1, 120, 6000, 0, 4)`, [JSON.stringify({ v: 1, gold: 2 })]);
  r = await q(`select nickname, total_earned from saves`);
  assert(r[0].total_earned === 6000 && r[0].nickname === "가챠왕", "덮어쓰기 저장, 닉네임 유지");

  // 안티치트
  assert((await err(`select save_game('{}', 120, 10, 0, 4)`)).includes("total_decreased"), "누적 매출 감소 거부");
  assert((await err(`select save_game('{}', 200000, 7000, 0, 4)`)).includes("income_spike"), "1분 내 초당 매출 1000배 급증 거부");
  assert((await err(`select save_game('{}', 'NaN', 7000, 0, 4)`)).includes("invalid_numbers"), "NaN 거부");
  assert((await err(`select save_game($1, 1, 7000, 0, 4)`, [JSON.stringify({ x: "a".repeat(70000) })])).includes("save_too_large"), "64KB 초과 거부");

  // RLS: 직접 쓰기 불가, 남의 행 안 보임
  assert((await err(`update saves set total_earned = 1e30`)).length > 0 || (await q(`select total_earned from saves`))[0].total_earned === 6000, "직접 UPDATE 불가");
  await as(B);
  assert((await q(`select * from saves`)).length === 0, "B는 A의 세이브를 못 봄");
  await q(`select save_game('{}', 10, 99999, 2, 10, 'B사장')`);
  await as(null, "anon");
  assert((await err(`select save_game('{}', 1, 1, 0, 0)`)).length > 0, "비로그인은 저장 불가");

  // 오프라인 정산: last_seen을 2시간 전·10시간 전으로
  await db.exec(`reset role; update saves set last_seen = now() - interval '2 hours' where user_id = '${A}';`);
  await as(A);
  let o = (await q<{ c: { elapsed: number; counted: number; amount: number } }>(`select claim_offline() c`))[0].c;
  assert(Math.abs(o.elapsed - 7200) < 5 && Math.abs(o.amount - 120 * 7200 * 0.5) < 1000, `2시간 오프라인 → ${Math.round(o.amount)} (≈432000)`);
  o = (await q<{ c: { elapsed: number; counted: number; amount: number } }>(`select claim_offline() c`))[0].c;
  assert(o.elapsed < 5, "정산 직후 재청구 불가 (last_seen 갱신)");
  await db.exec(`reset role; update saves set last_seen = now() - interval '10 hours' where user_id = '${A}';`);
  await as(A);
  o = (await q<{ c: { elapsed: number; counted: number; amount: number } }>(`select claim_offline() c`))[0].c;
  assert(o.counted === 4 * 3600, "최대 4시간 인정");

  // 닉네임
  assert((await err(`select set_nickname('')`)).includes("invalid_nickname"), "빈 닉네임 거부");
  assert((await err(`select set_nickname('열세글자닉네임입니다아아아')`)).includes("invalid_nickname"), "13자 거부");
  await q(`select set_nickname('  새이름  ')`);
  assert((await q(`select nickname from saves`))[0].nickname === "새이름", "닉네임 변경·공백 제거");

  // 랭킹
  await as(null, "anon");
  const lb = await q<{ rank: number; nickname: string; is_me: boolean }>(`select * from get_leaderboard(10)`);
  assert(lb.length === 2 && lb[0].nickname === "B사장" && Number(lb[0].rank) === 1 && lb.every((x) => !x.is_me), "비로그인도 랭킹 조회, 누적 매출 순");
  await as(A);
  assert(Number((await q<{ r: number }>(`select get_my_rank() r`))[0].r) === 2, "내 순위 2위");
  const lb2 = await q<{ is_me: boolean; nickname: string }>(`select * from get_leaderboard(10)`);
  assert(lb2.find((x) => x.is_me)?.nickname === "새이름", "랭킹에 내 행 표시");
  const cols = Object.keys(lb2[0]);
  assert(!cols.includes("user_id") && !cols.includes("data"), "랭킹에 user_id·세이브 데이터 비공개");
  assert((await err(`select get_my_rank()`)) === "", "get_my_rank 실행");
  await as(null, "anon");
  assert((await err(`select get_my_rank()`)).length > 0, "비로그인은 내 순위 호출 불가");

  // 초기화
  await as(A);
  await q(`select reset_game()`);
  assert((await q(`select * from saves`)).length === 0, "reset_game으로 내 세이브 삭제");
  await q(`select save_game('{}', 1, 1, 0, 0)`);
  assert((await q(`select total_earned from saves`))[0].total_earned === 1, "초기화 후 처음부터 저장 가능");
  console.log("ALL PASS");
}
main();
