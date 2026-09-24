// 가챠 로직 검증
import { rollFigure, FIGURES, RARITY_WEIGHTS } from "../src/lib/figures";
import { newGame, openBox, boxCost, figMult, figBonus, makeCollectorOffer, sellToCollector, incomePerSec, seriesComplete, loadState } from "../src/lib/economy";
let seed = 42; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL", m); process.exit(1); } console.log("ok ", m); };

// 1) 등급 분포
const N = 200000; const cnt = [0, 0, 0, 0, 0]; const perFig = new Array(60).fill(0);
for (let i = 0; i < N; i++) { const f = rollFigure(rnd); cnt[f.rarity]++; perFig[f.id]++; }
cnt.forEach((c, r) => assert(Math.abs((c / N) * 100 - RARITY_WEIGHTS[r]) < RARITY_WEIGHTS[r] * 0.05 + 0.05, `등급 ${r} ${(c / N * 100).toFixed(2)}% ≈ ${RARITY_WEIGHTS[r]}%`));
assert(FIGURES.length === 60 && new Set(FIGURES.map(f => f.name)).size === 60, "피규어 60종·이름 중복 없음");
assert(perFig.every(n => n > 0), "모든 피규어가 뽑힘");

// 2) 개봉·장착·교체·판매
const s = newGame(0); s.own[0] = 10; s.own[1] = 5; s.gold = 1e12;
const c0 = boxCost(s);
assert(c0 === Math.max(100, Math.round(incomePerSec(s) * 30)), `박스 가격 = 초당 매출×30 (${c0})`);
let equips = 0, replaces = 0, sells = 0;
for (let k = 0; k < 300; k++) { const r = openBox(s, rnd)!; if (r.action === "equip") equips++; else if (r.action === "replace") replaces++; else sells++; }
assert(equips === 10, `장착은 슬롯 수(2진열대×5)만큼: ${equips}`);
assert(s.figs[0].length === 5 && s.figs[1].length === 5 && s.figs.slice(2).every(f => f.length === 0), "보유 진열대에만 5칸씩 장착");
assert(replaces > 0 && sells > 0, `교체 ${replaces} / 판매 ${sells}`);
assert(s.boxes === 300 && s.dex.reduce((a, b) => a + b, 0) === 300, "개봉 수·도감 카운트 일치");
const minEq = Math.min(...s.figs.flat().map(id => figBonus(s, id)));
assert(minEq >= 0.12, `300회 후 장착 최저 효과 ${minEq} (N이 밀려남)`);
assert(figMult(s, 0) > 1, `진열대 배수 ${figMult(s, 0).toFixed(2)}`);

// 3) 돈 부족
const p = newGame(0); p.own[0] = 1; p.gold = 50;
assert(openBox(p, rnd) === null && p.gold === 50, "돈 부족 시 개봉 불가·차감 없음");
const q = newGame(0); q.gold = 1e9;
assert(openBox(q, rnd) === null, "진열대 없으면 개봉 불가");

// 4) 시리즈 완성 보너스
const t = newGame(0); t.own[0] = 1; for (let k = 0; k < 12; k++) t.dex[k] = 1; t.figs[0] = [0];
assert(seriesComplete(t, 0) && Math.abs(figBonus(t, 0) - 0.075) < 1e-9, "시리즈 완성 시 N 효과 5%→7.5%");

// 5) 수집가
const o = makeCollectorOffer(s, rnd)!; const before = s.gold; const had = s.figs[o.shelf].length;
assert(sellToCollector(s, o) && s.figs[o.shelf].length === had - 1 && s.gold === before + o.price, "수집가 판매: 피규어 제거·금액 지급");
assert(!sellToCollector(s, o), "같은 제안 재사용 불가");

// 6) 저장 호환 (M1 세이브: dex/boxes 없음)
const old = loadState({ v: 1, gold: 5, own: [1], staff: [], figs: [[]], lastSeen: 0, createdAt: 0 })!;
assert(old.dex.length === 60 && old.boxes === 0, "M1 세이브 불러오기");
console.log("ALL PASS");
