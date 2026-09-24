-- 가챠샵 타이쿤 — M3 클라우드 세이브 / 서버 시간 오프라인 정산 / 랭킹
-- Supabase SQL Editor에 그대로 붙여 넣어 실행하면 됩니다. (여러 번 실행해도 안전)

-- ───────────────────────── 테이블
create table if not exists public.saves (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  nickname       text not null default '사장님' check (char_length(nickname) between 1 and 12),
  data           jsonb not null,
  income_per_sec double precision not null default 0 check (income_per_sec >= 0),
  total_earned   double precision not null default 0 check (total_earned >= 0),
  prestige       integer not null default 0 check (prestige >= 0),
  dex_count      integer not null default 0 check (dex_count between 0 and 60),
  last_seen      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists saves_total_earned_idx on public.saves (total_earned desc);

-- RLS: 본인 행 읽기만 허용. 쓰기는 아래 함수(RPC)로만 가능
alter table public.saves enable row level security;
drop policy if exists "read own save" on public.saves;
create policy "read own save" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);

-- ───────────────────────── 저장
-- 간이 안티치트: 누적 매출 감소 금지, 1분 안에 초당 매출 1000배 이상 급증 금지, 64KB 제한
create or replace function public.save_game(
  p_data jsonb,
  p_income double precision,
  p_total double precision,
  p_prestige integer,
  p_dex integer,
  p_nickname text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  old public.saves%rowtype;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if octet_length(p_data::text) > 65536 then raise exception 'save_too_large'; end if;
  if p_income is null or p_total is null
     or p_income = 'NaN'::float8 or p_total = 'NaN'::float8
     or p_income = 'Infinity'::float8 or p_total = 'Infinity'::float8
     or p_income < 0 or p_total < 0 then
    raise exception 'invalid_numbers';
  end if;

  select * into old from public.saves where user_id = uid for update;

  if found then
    if p_total < old.total_earned * 0.999 then raise exception 'total_decreased'; end if;
    if old.income_per_sec > 0
       and p_income > old.income_per_sec * 1000
       and now() - old.updated_at < interval '1 minute' then
      raise exception 'income_spike';
    end if;
    update public.saves
       set data = p_data,
           income_per_sec = p_income,
           total_earned = p_total,
           prestige = greatest(0, coalesce(p_prestige, 0)),
           dex_count = least(60, greatest(0, coalesce(p_dex, 0))),
           last_seen = now(),
           updated_at = now()
     where user_id = uid;
  else
    insert into public.saves (user_id, nickname, data, income_per_sec, total_earned, prestige, dex_count)
    values (
      uid,
      coalesce(nullif(left(btrim(p_nickname), 12), ''), '사장님'),
      p_data, p_income, p_total,
      greatest(0, coalesce(p_prestige, 0)),
      least(60, greatest(0, coalesce(p_dex, 0)))
    );
  end if;

  return jsonb_build_object('updated_at', now());
end;
$$;

-- ───────────────────────── 오프라인 정산 (서버 시간 기준)
-- 기기 시계를 바꿔도 소용없도록 now() - last_seen 으로 계산. 효율 50%, 최대 4시간
create or replace function public.claim_offline()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  old public.saves%rowtype;
  elapsed double precision;
  counted double precision;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into old from public.saves where user_id = uid for update;
  if not found then
    return jsonb_build_object('elapsed', 0, 'counted', 0, 'amount', 0);
  end if;
  elapsed := greatest(0, extract(epoch from now() - old.last_seen));
  counted := least(elapsed, 4 * 3600);
  update public.saves set last_seen = now() where user_id = uid;
  return jsonb_build_object(
    'elapsed', elapsed,
    'counted', counted,
    'amount', old.income_per_sec * counted * 0.5
  );
end;
$$;

-- ───────────────────────── 닉네임 / 초기화
create or replace function public.set_nickname(p_nickname text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n text := btrim(coalesce(p_nickname, ''));
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(n) < 1 or char_length(n) > 12 then raise exception 'invalid_nickname'; end if;
  update public.saves set nickname = n where user_id = uid;
  return n;
end;
$$;

create or replace function public.reset_game()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.saves where user_id = auth.uid();
end;
$$;

-- ───────────────────────── 랭킹 (누적 매출 순, 닉네임·점수만 공개)
create or replace function public.get_leaderboard(p_limit integer default 50)
returns table (rank bigint, nickname text, total_earned double precision, prestige integer, dex_count integer, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select row_number() over (order by s.total_earned desc, s.created_at asc) as rank,
         s.nickname, s.total_earned, s.prestige, s.dex_count,
         s.user_id = auth.uid() as is_me
    from public.saves s
   order by s.total_earned desc, s.created_at asc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.get_my_rank()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case when me.user_id is null then null
              else (select count(*) + 1 from public.saves o
                     where o.total_earned > me.total_earned
                        or (o.total_earned = me.total_earned and o.created_at < me.created_at))
         end
    from (select * from public.saves where user_id = auth.uid()) me;
$$;

-- ───────────────────────── 권한
revoke all on function public.save_game(jsonb, double precision, double precision, integer, integer, text) from public, anon;
revoke all on function public.claim_offline() from public, anon;
revoke all on function public.set_nickname(text) from public, anon;
revoke all on function public.reset_game() from public, anon;
revoke all on function public.get_my_rank() from public, anon;
grant execute on function public.save_game(jsonb, double precision, double precision, integer, integer, text) to authenticated;
grant execute on function public.claim_offline() to authenticated;
grant execute on function public.set_nickname(text) to authenticated;
grant execute on function public.reset_game() to authenticated;
grant execute on function public.get_my_rank() to authenticated;
grant execute on function public.get_leaderboard(integer) to anon, authenticated;
