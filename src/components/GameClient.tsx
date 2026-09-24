"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  SHELVES,
  STAFF,
  TAP_SECONDS,
  OFFLINE_BASE,
  type BuyMode,
  incomePerSec,
  shelfIncome,
  isUnlocked,
  resolveBuy,
  nextMilestone,
  milestoneMult,
} from "@/lib/economy";
import { fmt, fmtDuration } from "@/lib/format";
import { store } from "@/lib/store";
import { Scene } from "@/game/scene";
import { GachaPanel, GachaResultModal, CollectorModal } from "./GachaPanel";
import { AccountSection, SyncModal, RankPanel } from "./AccountPanel";

const SHELF_COLORS = ["#e85d5d", "#6d7fa8", "#d6cab6", "#7fc4d6", "#f2c14e", "#9c2a4f", "#b07a52", "#7fe0ff"];

type Tab = "shelves" | "staff" | "gacha" | "rank" | "settings";

export default function GameClient() {
  const version = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = version >= 0;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tab, setTab] = useState<Tab>("shelves");
  const [mode, setMode] = useState<BuyMode>(1);
  const [confirmReset, setConfirmReset] = useState(false);
  const [helpOpen, setHelpOpen] = useState<[boolean, boolean]>([false, false]); // 모바일 손님 안내 펼침

  // 게임 루프
  useEffect(() => {
    if (!ready) return;
    store.start();
    return () => store.stop();
  }, [ready]);

  // 씬
  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    const scene = new Scene(canvasRef.current, {
      onTapCustomer: () => store.tapCustomer(),
      onTapCollector: () => store.tapCollector(),
      format: fmt,
    });
    store.attachScene(scene);
    // 좁은 화면(모바일)에서는 매장을 확대
    const mq = window.matchMedia("(max-width: 560px)");
    const applyCompact = () => scene.setCompact(mq.matches);
    applyCompact();
    mq.addEventListener("change", applyCompact);
    document.fonts?.load("10px Galmuri9").catch(() => {});
    scene.start();
    return () => {
      mq.removeEventListener("change", applyCompact);
      scene.stop();
      store.attachScene(null);
    };
  }, [ready]);

  const s = store.state;
  if (!ready || !s) {
    return <main className="loading">가게 문 여는 중…</main>;
  }

  const income = incomePerSec(s);
  const offline = store.offline;

  const onBuyShelf = (i: number) => store.buyShelf(i, mode);
  const onBuyStaff = (i: number) => store.buyStaff(i);
  const claimOffline = () => store.claimOffline();
  const doReset = () => {
    void store.reset();
    setConfirmReset(false);
  };

  // 진열대 목록: 해금된 것 + 다음 잠긴 것 1개
  const visibleShelves = SHELVES.map((_, i) => i).filter((i) => isUnlocked(s, i) || (i > 0 && isUnlocked(s, i - 1)));

  return (
    <main className="game">
      <header className="hud">
        <div className="title">가챠샵 타이쿤</div>
        <div className="gold">
          <span className="coin" aria-hidden />
          <b>{fmt(s.gold)}</b>
          <small>원</small>
        </div>
        <div className="rate">초당 +{fmt(income)}원</div>
      </header>

      <div className="stage">
        <canvas ref={canvasRef} className="scene" aria-label="매장 화면. 말풍선이 뜬 손님을 누르면 보너스를 받아요." />
      </div>

      <section className="help" aria-label="손님 안내">
        <div className={`help-row ${helpOpen[0] ? "open" : ""}`}>
          <span className="icon-bang" aria-hidden>
            !
          </span>
          <div>
            <button
              className="help-toggle"
              aria-expanded={helpOpen[0]}
              onClick={() => setHelpOpen(([a, b]) => [!a, b])}
            >
              말풍선(!) 손님
            </button>
            <p className="detail">눌러주면 기분 좋게 지갑을 열어요. 초당 매출 {TAP_SECONDS}초치를 바로 받아요.</p>
          </div>
        </div>
        <div
          className={`help-row ${helpOpen[1] ? "open" : ""} ${store.collector && !store.collectorOpen ? "active" : ""}`}
        >
          <span className="icon-gem" aria-hidden />
          <div>
            <button
              className="help-toggle"
              aria-expanded={helpOpen[1]}
              onClick={() => setHelpOpen(([a, b]) => [a, !b])}
            >
              보석 말풍선 — 수집가 손님
            </button>
            {store.collector && !store.collectorOpen && (
              <em className="live">지금 매장에 있어요! {store.collectorLeft}초 후 떠나요</em>
            )}
            <p className="detail">
              약 3분마다 찾아와 진열대에 장착된 피규어를 비싸게 사겠다고 제안해요. 팔면 큰돈을 받지만 그 피규어의 매출
              효과는 사라져요. 30초 안에 누르지 않으면 떠나고, 거절해도 불이익은 없어요.
            </p>
          </div>
        </div>
      </section>

      <nav className="tabs" role="tablist">
        {(
          [
            ["shelves", "진열대"],
            ["staff", "직원"],
            ["gacha", "가챠"],
            ["rank", "랭킹"],
            ["settings", "설정"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      <section className="panel">
        {tab === "shelves" && (
          <>
            <div className="modes">
              {([1, 5, 10, 100, "max"] as BuyMode[]).map((m) => (
                <button key={String(m)} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
                  {m === "max" ? "MAX" : `×${m}`}
                </button>
              ))}
            </div>
            <ul className="list">
              {visibleShelves.map((i) => {
                const d = SHELVES[i];
                const unlocked = isUnlocked(s, i);
                if (!unlocked) {
                  return (
                    <li key={d.id} className="row locked">
                      <span className="badge" style={{ background: "#4a4060" }}>?</span>
                      <div className="info">
                        <div className="name">???</div>
                        <div className="sub">{SHELVES[i - 1].name}을(를) 들여놓으면 열려요</div>
                      </div>
                    </li>
                  );
                }
                const own = s.own[i];
                const { n, cost } = resolveBuy(s, i, mode);
                const can = cost <= s.gold && n > 0;
                const ms = nextMilestone(own);
                const perUnitNext = shelfIncome(s, i, own + n) - shelfIncome(s, i);
                return (
                  <li key={d.id} className="row">
                    <span className="badge" style={{ background: SHELF_COLORS[i] }}>
                      {i + 1}
                    </span>
                    <div className="info">
                      <div className="name">
                        {d.name} <em>×{own}</em>
                        {milestoneMult(own) > 1 && <span className="mult">매출 ×{milestoneMult(own)}</span>}
                      </div>
                      <div className="sub">초당 {fmt(shelfIncome(s, i))}원</div>
                      {ms && (
                        <div className="bar" title={`${ms.at}개 달성 시 매출 ×${ms.mult}`}>
                          <i style={{ width: `${((own - ms.prev) / (ms.at - ms.prev)) * 100}%` }} />
                          <span>
                            {own}/{ms.at} → ×{ms.mult}
                          </span>
                        </div>
                      )}
                    </div>
                    <button className="buy" disabled={!can} onClick={() => onBuyShelf(i)}>
                      <span>
                        {own === 0 ? "들여놓기" : "증설"} ×{n}
                      </span>
                      <b>{fmt(cost)}원</b>
                      <small>+{fmt(perUnitNext)}/초</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === "staff" && (
          <ul className="list">
            {STAFF.map((d, i) => {
              const hired = s.staff[i];
              const available = i === 0 || s.staff[i - 1];
              if (!available && !hired) {
                if (i > 0 && !s.staff[i - 1] && (i === 1 || s.staff[i - 2])) {
                  return (
                    <li key={d.id} className="row locked">
                      <span className="badge" style={{ background: "#4a4060" }}>?</span>
                      <div className="info">
                        <div className="name">???</div>
                        <div className="sub">{STAFF[i - 1].name}을(를) 먼저 고용하세요</div>
                      </div>
                    </li>
                  );
                }
                return null;
              }
              return (
                <li key={d.id} className={`row ${hired ? "hired" : ""}`}>
                  <span className="badge staff">{d.name[0]}</span>
                  <div className="info">
                    <div className="name">
                      {d.name} <span className="mult">전체 매출 ×{d.mult}</span>
                    </div>
                    <div className="sub">{d.desc}</div>
                  </div>
                  {hired ? (
                    <div className="done">근무 중</div>
                  ) : (
                    <button className="buy" disabled={s.gold < d.cost} onClick={() => onBuyStaff(i)}>
                      <span>고용</span>
                      <b>{fmt(d.cost)}원</b>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {tab === "gacha" && <GachaPanel s={s} />}

        {tab === "rank" && <RankPanel />}

        {tab === "settings" && (
          <div className="settings">
            <AccountSection />
            <dl>
              <dt>누적 매출</dt>
              <dd>{fmt(s.totalEarned)}원</dd>
              <dt>손님 탭</dt>
              <dd>{s.taps.toLocaleString("ko-KR")}회</dd>
              <dt>오프라인 보상</dt>
              <dd>
                최대 {OFFLINE_BASE.capSec / 3600}시간 · 효율 {OFFLINE_BASE.efficiency * 100}%
              </dd>
              <dt>저장</dt>
              <dd>
                {store.account.status === "in" ? (
                  <>카카오 계정(서버)과 이 브라우저에 함께 저장돼요. 다른 기기에서 로그인해도 이어서 할 수 있어요.</>
                ) : (
                  <>
                    이 브라우저에 10초마다 자동 저장돼요. 브라우저를 껐다 켜도 이어서 할 수 있어요.
                    <br />
                    <small className="note">
                      방문 기록 삭제·시크릿 모드·다른 기기에서는 이어지지 않아요.
                      {store.account.status !== "off" && " 카카오로 로그인하면 서버에 저장돼요."}
                    </small>
                  </>
                )}
              </dd>
            </dl>
            {!confirmReset ? (
              <button className="danger" onClick={() => setConfirmReset(true)}>
                데이터 초기화
              </button>
            ) : (
              <div className="confirm">
                <span>정말 처음부터 할까요? 되돌릴 수 없어요.</span>
                <button className="danger" onClick={doReset}>
                  초기화
                </button>
                <button onClick={() => setConfirmReset(false)}>취소</button>
              </div>
            )}
          </div>
        )}
      </section>

      {store.gacha && <GachaResultModal results={store.gacha} />}
      {store.syncPrompt && <SyncModal p={store.syncPrompt} />}
      {store.collectorOpen && store.collector && <CollectorModal s={s} offer={store.collector} />}

      {offline && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="box">
            <h2>어서 오세요, 사장님!</h2>
            <p>
              자리를 비운 {fmtDuration(offline.elapsedSec)} 동안
              {offline.countedSec < offline.elapsedSec && <> (최대 {fmtDuration(offline.countedSec)} 인정)</>}
              <br />
              가게가 벌어둔 돈이에요.
            </p>
            <div className="reward">
              <span className="coin" aria-hidden />+{fmt(offline.amount)}원
            </div>
            <div className="actions">
              <button className="primary" onClick={claimOffline}>
                받기
              </button>
              <button className="ad" disabled title="광고 보상은 준비 중이에요">
                광고 보고 2배 (준비 중)
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
