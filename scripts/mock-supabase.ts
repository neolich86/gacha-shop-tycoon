// 테스트용 가짜 Supabase 서버 — 실제 마이그레이션 SQL을 PGlite(Postgres)에서 돌리고
// supabase-js가 호출하는 REST(PostgREST)·Auth 엔드포인트 일부를 흉내 낸다.
// 사용: npx tsx scripts/mock-supabase.ts  (포트 54321)
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const PORT = Number(process.env.PORT ?? 54321);
const TABLE_FNS = new Set(["get_leaderboard"]);

async function main() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  await db.exec(`grant select on public.saves to authenticated;`);

  const uidOf = (auth: string | undefined): string | null => {
    const tok = auth?.replace(/^Bearer\s+/i, "") ?? "";
    const part = tok.split(".")[1];
    if (!part) return null;
    try {
      const p = JSON.parse(Buffer.from(part, "base64url").toString());
      return p.role === "authenticated" && p.sub ? p.sub : null;
    } catch {
      return null;
    }
  };

  let chain = Promise.resolve();
  const run = <T,>(uid: string | null, fn: () => Promise<T>) => {
    const p = chain.then(async () => {
      if (uid) await db.query(`insert into auth.users values ($1) on conflict do nothing`, [uid]);
      await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role;`);
      }
    });
    chain = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  };

  createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    const url = new URL(req.url ?? "/", "http://x");
    let body = "";
    for await (const c of req) body += c;
    const send = (code: number, obj: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(obj === undefined ? "" : JSON.stringify(obj));
    };
    const uid = uidOf(req.headers.authorization);
    try {
      if (url.pathname === "/test/sql") {
        const r = await chain.then(() => db.query(JSON.parse(body).sql));
        return send(200, r.rows);
      }
      if (url.pathname.startsWith("/auth/v1/")) return send(204, undefined);
      if (url.pathname === "/rest/v1/saves" && req.method === "GET") {
        const cols = (url.searchParams.get("select") ?? "*").split(",").map((c) => c.trim().replace(/[^a-z_*]/g, ""));
        const rows = await run(uid, async () => (await db.query(`select ${cols.join(",")} from public.saves`)).rows);
        return send(200, rows);
      }
      const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (m && req.method === "POST") {
        const fn = m[1];
        const args = body ? (JSON.parse(body) as Record<string, unknown>) : {};
        const keys = Object.keys(args);
        const params = keys.map((k) => {
          const v = args[k];
          return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
        });
        const named = keys
          .map((k, i) => {
            const v = args[k];
            const cast = v !== null && typeof v === "object" ? "::jsonb" : typeof v === "number" ? (Number.isInteger(v) && /dex|prestige|limit/.test(k) ? "::int" : "::float8") : typeof v === "string" ? "::text" : "";
            return `${k} => $${i + 1}${cast}`;
          })
          .join(", ");
        const rows = await run(uid, async () => {
          if (TABLE_FNS.has(fn)) return (await db.query(`select * from public.${fn}(${named})`, params)).rows;
          const r = await db.query<Record<string, unknown>>(`select public.${fn}(${named}) as v`, params);
          return r.rows[0]?.v ?? null;
        });
        return send(200, rows);
      }
      send(404, { message: "not found" });
    } catch (e) {
      const msg = (e as Error).message;
      send(400, { message: msg, code: "P0001", details: null, hint: null });
    }
  }).listen(PORT, () => console.log(`mock supabase on :${PORT}`));
}
main();
