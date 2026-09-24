// 밸런스 봇: lib/economy.ts를 그대로 사용 (가챠 제외, 진열대·직원만)
import { openBox, boxCost, figMult, FIG_SLOTS, RARITIES, newGame, tick, incomePerSec, SHELVES, STAFF, isUnlocked, bulkCost, shelfIncome, globalMult, buyShelf, buyStaff, prestigeGain, maxAffordable } from "../src/lib/economy";
import { fmt } from "../src/lib/format";

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const s = newGame(0);
const marks = [0.25, 0.5, 1, 2, 3, 4, 6];
let t = 0; const events: string[] = [];
for (const h of marks) {
  while (t < h * 3600) {
    for (let k = 0; k < 50; k++) {
      let best: { v: number; act: () => boolean; label: string } | null = null;
      SHELVES.forEach((d, i) => {
        if (!isUnlocked(s, i)) return;
        const c = bulkCost(s, i, 1);
        const v = (shelfIncome(s, i, s.own[i] + 1) - shelfIncome(s, i)) / c;
        if (!best || v > best.v) best = { v, act: () => buyShelf(s, i, 1), label: (s.own[i] === 0 ? "해금 " : "") + d.name };
      });
      STAFF.forEach((d, i) => {
        if (s.staff[i] || (i > 0 && !s.staff[i - 1])) return;
        const v = (incomePerSec(s) * (d.mult - 1)) / d.cost;
        if (!best || v > best.v) best = { v, act: () => buyStaff(s, i), label: "고용 " + d.name };
      });
      // 박스: 무작위 보유 진열대에 장착된다고 보고 기대 증가량 계산
      {
        const owned = SHELVES.map((_, i) => i).filter((i) => s.own[i] > 0);
        const eBonus = RARITIES.reduce((a, r) => a + (r.weight / 100) * r.bonus, 0);
        const gain = Math.max(0, ...owned.map((i) => (s.figs[i].length < FIG_SLOTS ? (shelfIncome(s, i) / figMult(s, i)) * eBonus : 0)));
        const c = boxCost(s);
        const v = gain / c;
        if (owned.length && (!best || v > (best as { v: number }).v)) best = { v, act: () => openBox(s, rnd) !== null, label: "box" };
      }
      const b = best as { v: number; act: () => boolean; label: string } | null;
      if (!b || !b.act()) break;
      if (b.label.startsWith("해금") || b.label.startsWith("고용")) events.push(`${(t / 60).toFixed(1)}분 ${b.label}`);
    }
    tick(s, 1); t++;
  }
  console.log(`${h}h  박스 ${s.boxes}  초당 ${fmt(incomePerSec(s))}  누적 ${fmt(s.runEarned)}  환생시 ⭐${prestigeGain(s)}  보유 ${s.own.join(",")}`);
}
console.log(events.join("\n"));
void globalMult; void maxAffordable;
