"use client";

import { useEffect, useState } from "react";
import { store, type SyncPrompt } from "@/lib/store";
import { cloudEnabled, fetchLeaderboard, cloudErrorText, type RankRow } from "@/lib/cloud";
import { fmt } from "@/lib/format";

function KakaoButton() {
  return (
    <button className="kakao" onClick={() => void store.login()}>
      <span className="kakao-icon" aria-hidden />
      카카오로 로그인
    </button>
  );
}

/** 설정 탭 상단 — 계정·클라우드 저장 */
export function AccountSection() {
  const a = store.account;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  if (a.status === "off") {
    return (
      <section className="account">
        <h3>계정</h3>
        <p className="note">서버 연결 전이라 이 브라우저에만 저장돼요. (카카오 로그인은 서버 설정 후 열려요)</p>
      </section>
    );
  }

  if (a.status === "guest") {
    return (
      <section className="account">
        <h3>계정</h3>
        <p>
          카카오로 로그인하면 진행 상황이 <b>서버에 저장</b>돼서 폰·PC 어디서든 이어서 할 수 있고, 랭킹에도 이름이
          올라가요. 지금까지 한 게임도 그대로 옮길 수 있어요.
        </p>
        <KakaoButton />
        {a.error && <p className="warn">{a.error}</p>}
      </section>
    );
  }

  if (a.status === "syncing") {
    return (
      <section className="account">
        <h3>계정</h3>
        <p>계정 데이터를 불러오는 중…</p>
      </section>
    );
  }

  const save = async () => {
    const e = await store.rename(name);
    setErr(e);
    if (!e) setEditing(false);
  };

  return (
    <section className="account">
      <h3>계정</h3>
      <div className="acc-row">
        <span className="kakao-dot" aria-hidden />
        {editing ? (
          <>
            <input
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
              aria-label="닉네임"
              autoFocus
            />
            <button className="mini" onClick={() => void save()}>
              저장
            </button>
            <button className="mini ghost" onClick={() => setEditing(false)}>
              취소
            </button>
          </>
        ) : (
          <>
            <b>{a.nickname}</b> 사장님
            <button
              className="mini ghost"
              onClick={() => {
                setName(a.nickname);
                setErr(null);
                setEditing(true);
              }}
            >
              닉네임 변경
            </button>
          </>
        )}
      </div>
      {err && <p className="warn">{err}</p>}
      <p className="note">
        카카오 계정으로 서버에 자동 저장돼요 (45초마다, 중요한 행동 직후, 창을 닫을 때).
        {a.lastCloudSave > 0 && <> 마지막 저장 {new Date(a.lastCloudSave).toLocaleTimeString("ko-KR")}.</>}
      </p>
      {a.error && <p className="warn">{a.error}</p>}
      <div className="acc-actions">
        <button className="mini" onClick={() => void store.cloudSave(true)}>
          지금 저장
        </button>
        {!confirmOut ? (
          <button className="mini ghost" onClick={() => setConfirmOut(true)}>
            로그아웃
          </button>
        ) : (
          <>
            <span className="note">로그아웃하면 이 기기는 새 게스트 게임으로 바뀌어요. 다시 로그인하면 이어서 할 수 있어요.</span>
            <button className="mini danger" onClick={() => void store.logout()}>
              로그아웃
            </button>
            <button className="mini ghost" onClick={() => setConfirmOut(false)}>
              취소
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function SyncCard({ title, d }: { title: string; d: SyncPrompt["local"] }) {
  return (
    <div className="sync-card">
      <b>{title}</b>
      <span>누적 매출 {fmt(d.total)}원</span>
      <span>
        도감 {d.dex}/60 · 박스 {d.boxes.toLocaleString("ko-KR")}개
      </span>
    </div>
  );
}

/** 로그인 직후 기기 데이터 ↔ 계정 데이터 선택 */
export function SyncModal({ p }: { p: SyncPrompt }) {
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="box sync">
        {p.kind === "migrate" ? (
          <>
            <h2>진행 상황 옮기기</h2>
            <p>이 기기에서 하던 게임을 카카오 계정에 저장할까요?</p>
            <SyncCard title="이 기기" d={p.local} />
            <div className="actions">
              <button className="primary" onClick={() => void store.answerSync("local")}>
                계정에 저장하고 이어하기
              </button>
              <button className="ad" onClick={() => void store.answerSync("fresh")}>
                새로 시작하기
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>어떤 데이터로 할까요?</h2>
            <p>이 기기와 계정에 서로 다른 진행 상황이 있어요. 고르지 않은 쪽은 사라져요.</p>
            <div className="sync-cards">
              <SyncCard title="카카오 계정" d={p.cloud!} />
              <SyncCard title="이 기기" d={p.local} />
            </div>
            <div className="actions">
              <button className="primary" onClick={() => void store.answerSync("cloud")}>
                계정 데이터로 계속하기
              </button>
              <button className="ad" onClick={() => void store.answerSync("local")}>
                이 기기 데이터로 덮어쓰기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 랭킹 탭 */
export function RankPanel() {
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    fetchLeaderboard(50)
      .then((r) => {
        if (!alive) return;
        setRows(r.rows);
        setMyRank(r.myRank);
        setError(null);
      })
      .catch((e) => alive && setError(cloudErrorText(e)));
    return () => {
      alive = false;
    };
  }, [tick]);

  if (!cloudEnabled) {
    return (
      <div className="soon">
        <p>랭킹 준비 중</p>
        <small>서버(Supabase) 연결 후 누적 매출 랭킹이 열려요.</small>
      </div>
    );
  }

  const a = store.account;
  return (
    <div className="rank">
      <div className="rank-head">
        <span>누적 매출 랭킹 TOP 50</span>
        <button className="mini" onClick={() => setTick((t) => t + 1)}>
          새로고침
        </button>
      </div>
      {a.status === "in" ? (
        <p className="note">
          내 순위: <b>{myRank ? `${myRank.toLocaleString("ko-KR")}위` : "기록 없음"}</b> (45초마다 저장된 기록 기준)
        </p>
      ) : (
        <div className="rank-login">
          <span>로그인하면 내 가게도 랭킹에 올라가요.</span>
          <KakaoButton />
        </div>
      )}
      {error && <p className="warn">{error}</p>}
      {!rows && !error && <p className="note">불러오는 중…</p>}
      {rows && rows.length === 0 && <p className="note">아직 기록이 없어요. 첫 번째 사장님이 되어 보세요!</p>}
      {rows && rows.length > 0 && (
        <ol className="rank-list">
          {rows.map((r) => (
            <li key={r.rank} className={r.is_me ? "me" : ""}>
              <span className={`rk rk${Math.min(r.rank, 4)}`}>{r.rank}</span>
              <span className="nm">{r.nickname}</span>
              <span className="meta">도감 {r.dex_count}</span>
              <span className="sc">{fmt(r.total_earned)}원</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
