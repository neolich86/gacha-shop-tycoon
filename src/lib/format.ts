// 한국식 큰 수 표기: 1.23만 → 4.56억 → 7.89조 … 극(10^48), 그 이상은 지수 표기
const UNITS = ["", "만", "억", "조", "경", "해", "자", "양", "구", "간", "정", "재", "극"];

export function fmt(n: number): string {
  if (!isFinite(n)) return "∞";
  if (n < 0) return "-" + fmt(-n);
  if (n < 1e4) return Math.floor(n).toLocaleString("ko-KR");
  const idx = Math.floor(Math.log10(n) / 4);
  if (idx >= UNITS.length) {
    const e = Math.floor(Math.log10(n));
    return (n / Math.pow(10, e)).toFixed(2) + "e" + e;
  }
  let v = n / Math.pow(10, idx * 4);
  // 반올림으로 10000이 되는 경계 보정
  if (v >= 9999.5) return fmt(Math.pow(10, (idx + 1) * 4));
  const d = v >= 1000 ? 0 : v >= 100 ? 1 : 2;
  v = Math.floor(v * Math.pow(10, d)) / Math.pow(10, d);
  const s = v.toFixed(d);
  return (d > 0 ? s.replace(/\.?0+$/, "") : s) + UNITS[idx];
}

export function fmtDuration(sec: number): string {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}
