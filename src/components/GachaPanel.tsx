"use client";

import { useState } from "react";
import {
  SHELVES,
  FIG_SLOTS,
  SERIES_COMPLETE_MULT,
  type GameState,
  type GachaResult,
  type CollectorOffer,
  boxCost,
  canOpenBox,
  figBonus,
  figMult,
  seriesComplete,
  shelfIncome,
  incomePerSec,
} from "@/lib/economy";
import { FIGURES, SERIES, RARITY_NAMES, RARITY_COLORS, RARITY_WEIGHTS, FIGURE_COUNT } from "@/lib/figures";
import { fmt } from "@/lib/format";
import { store } from "@/lib/store";
import FigureSprite from "./FigureSprite";

function RarityTag({ r }: { r: number }) {
  return (
    <span className={`rtag r${r}`} style={{ background: RARITY_COLORS[r] }}>
      {RARITY_NAMES[r]}
    </span>
  );
}

export function GachaPanel({ s }: { s: GameState }) {
  const [view, setView] = useState<"shop" | "dex">("shop");
  const cost = boxCost(s);
  const can = canOpenBox(s);
  const owned = s.dex.filter((n) => n > 0).length;
  const affordable = Math.floor(s.gold / cost);

  return (
    <div className="gacha">
      <div className="box-card">
        <div className="box-art" aria-hidden>
          <span />
        </div>
        <div className="box-info">
          <div className="name">피규어 랜덤 박스</div>
          <div className="sub">
            한 개 {fmt(cost)}원 · 뽑은 피규어는 진열대에 자동 장착돼요
          </div>
          <div className="odds">
            {RARITY_NAMES.map((n, r) => (
              <span key={n} style={{ color: RARITY_COLORS[r] }}>
                {n} {RARITY_WEIGHTS[r]}%
              </span>
            ))}
          </div>
        </div>
        <div className="box-btns">
          <button className="buy" disabled={!can || affordable < 1} onClick={() => store.openBoxes(1)}>
            <span>1회 열기</span>
            <b>{fmt(cost)}원</b>
          </button>
          <button className="buy" disabled={!can || affordable < 10} onClick={() => store.openBoxes(10)}>
            <span>10회 열기</span>
            <b>약 {fmt(cost * 10)}원</b>
          </button>
        </div>
      </div>
      {!can && <p className="warn">진열대를 하나 이상 들여놓아야 박스를 열 수 있어요.</p>}

      <div className="subtabs">
        <button className={view === "shop" ? "on" : ""} onClick={() => setView("shop")}>
          진열 현황
        </button>
        <button className={view === "dex" ? "on" : ""} onClick={() => setView("dex")}>
          도감 {owned}/{FIGURE_COUNT}
        </button>
      </div>

      {view === "shop" && (
        <ul className="list">
          {SHELVES.map((d, i) => {
            if (s.own[i] <= 0) return null;
            const slots = s.figs[i];
            return (
              <li key={d.id} className="row slots-row">
                <div className="info">
                  <div className="name">
                    {d.name}
                    {slots.length > 0 && <span className="mult">피규어 ×{figMult(s, i).toFixed(2)}</span>}
                  </div>
                  <div className="sub">초당 {fmt(shelfIncome(s, i))}원</div>
                </div>
                <div className="slots">
                  {Array.from({ length: FIG_SLOTS }, (_, k) => {
                    const id = slots[k];
                    if (id === undefined) return <span key={k} className="slot empty" />;
                    const f = FIGURES[id];
                    return (
                      <span
                        key={k}
                        className="slot"
                        style={{ borderColor: RARITY_COLORS[f.rarity] }}
                        title={`${f.name} (${RARITY_NAMES[f.rarity]}) +${Math.round(figBonus(s, id) * 100)}%`}
                      >
                        <FigureSprite id={id} scale={1.2} />
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {view === "dex" && (
        <div className="dex">
          {SERIES.map((se, si) => {
            const got = s.dex.slice(si * 12, si * 12 + 12).filter((n) => n > 0).length;
            const done = seriesComplete(s, si);
            return (
              <section key={se.id} className="series" style={{ borderColor: se.color }}>
                <header>
                  <b style={{ color: se.color }}>{se.name}</b>
                  <span>
                    {got}/12
                    {done ? (
                      <em className="done-tag">완성! 효과 ×{SERIES_COMPLETE_MULT}</em>
                    ) : (
                      <em>완성 시 효과 ×{SERIES_COMPLETE_MULT}</em>
                    )}
                  </span>
                </header>
                <div className="cells">
                  {FIGURES.filter((f) => f.series === si).map((f) => {
                    const n = s.dex[f.id];
                    return (
                      <div key={f.id} className={`cell ${n ? "" : "unknown"}`} title={n ? f.name : "???"}>
                        <FigureSprite id={f.id} scale={1.3} silhouette={!n} />
                        <RarityTag r={f.rarity} />
                        {n > 1 && <small>×{n}</small>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p className="note">도감은 환생(2호점 오픈)해도 유지돼요.</p>
        </div>
      )}
    </div>
  );
}

function actionText(r: GachaResult) {
  const shelf = SHELVES[r.shelf].name;
  if (r.action === "equip") return `${shelf}에 장착!`;
  if (r.action === "replace") return `${shelf}에 장착 (${FIGURES[r.replaced!].name} 판매 +${fmt(r.gold)}원)`;
  return `진열대가 꽉 차서 판매 +${fmt(r.gold)}원`;
}

export function GachaResultModal({ results }: { results: GachaResult[] }) {
  const best = results.reduce((a, b) => (b.fig.rarity > a.fig.rarity ? b : a), results[0]);
  const single = results.length === 1;
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className={`box gacha-result ${single ? "single" : "multi"}`}>
        {single ? (
          <div className={`reveal r${best.fig.rarity}`}>
            <div className="rays" aria-hidden />
            <FigureSprite id={best.fig.id} scale={5} className="pop" />
            <div className="res-name">
              <RarityTag r={best.fig.rarity} /> {best.fig.name}
              {best.isNew && <span className="new">NEW</span>}
            </div>
            <div className="res-series">{SERIES[best.fig.series].name}</div>
            <div className="res-action">{actionText(best)}</div>
          </div>
        ) : (
          <>
            <h2>
              {results.length}회 개봉 — 최고 <RarityTag r={best.fig.rarity} />
            </h2>
            <div className="grid10">
              {results.map((r, k) => (
                <div
                  key={k}
                  className={`card r${r.fig.rarity}`}
                  style={{ animationDelay: `${k * 0.12}s`, borderColor: RARITY_COLORS[r.fig.rarity] }}
                  title={actionText(r)}
                >
                  {r.isNew && <span className="new">NEW</span>}
                  <FigureSprite id={r.fig.id} scale={1.8} />
                  <RarityTag r={r.fig.rarity} />
                  <small>{r.fig.name}</small>
                  <small className={`act ${r.action}`}>{r.action === "sell" ? `판매 +${fmt(r.gold)}` : "장착"}</small>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="actions">
          <button className="primary" onClick={() => store.closeGacha()}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export function CollectorModal({ s, offer }: { s: GameState; offer: CollectorOffer }) {
  const f = FIGURES[offer.figId];
  const still = s.figs[offer.shelf]?.[offer.slot] === offer.figId;
  const loss = figBonus(s, offer.figId);
  // 이 피규어가 벌어주는 초당 금액과, 제안가를 벌려면 걸리는 시간
  const base = shelfIncome(s, offer.shelf) / figMult(s, offer.shelf);
  const perSec = base * loss;
  const payback = perSec > 0 ? offer.price / perSec : Infinity;
  const share = incomePerSec(s) > 0 ? (perSec / incomePerSec(s)) * 100 : 0;
  const dur =
    payback === Infinity
      ? "-"
      : payback >= 86400
        ? `${(payback / 86400).toFixed(1)}일`
        : payback >= 3600
          ? `${(payback / 3600).toFixed(1)}시간`
          : `${Math.max(1, Math.round(payback / 60))}분`;
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="box collector">
        <h2>수집가 손님</h2>
        <p className="collector-intro">
          보석 말풍선을 단 손님은 희귀 피규어를 찾아다니는 <b>수집가</b>예요. 진열된 피규어를 시세보다 비싸게
          사 가지만, 팔면 그 피규어의 매출 효과는 사라져요.
        </p>
        <p className="quote">
          &ldquo;{SHELVES[offer.shelf].name}에 있는 그 피규어&hellip; 저한테 파시겠어요?&rdquo;
        </p>
        <div className="offer">
          <FigureSprite id={f.id} scale={3} />
          <div>
            <div className="res-name">
              <RarityTag r={f.rarity} /> {f.name}
            </div>
            <div className="sub">
              지금 이 피규어 덕분에 초당 +{fmt(perSec)}원 (전체 매출의 {share < 0.1 ? "0.1% 미만" : `${share.toFixed(1)}%`})
            </div>
            <div className="sub">
              판매하면 {SHELVES[offer.shelf].name} 피규어 효과 -{Math.round(loss * 100)}%
            </div>
          </div>
        </div>
        <div className="reward">
          <span className="coin" aria-hidden />+{fmt(offer.price)}원
        </div>
        <p className="verdict">
          이 피규어가 제안가만큼 벌려면 <b>약 {dur}</b> 걸려요. 받은 돈이면 박스를{" "}
          <b>약 {fmt(Math.floor(offer.price / boxCost(s)))}개</b> 열 수 있어요.
        </p>
        {!still && <p className="warn">이미 진열대에서 빠진 피규어라 거래할 수 없어요.</p>}
        <div className="actions">
          <button className="primary" disabled={!still} onClick={() => store.answerCollector(true)}>
            판매하기
          </button>
          <button className="ad" onClick={() => store.answerCollector(false)}>
            거절하기
          </button>
        </div>
      </div>
    </div>
  );
}
