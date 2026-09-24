// 게임 상태 스토어 — React 밖에서 게임 루프를 돌리고 useSyncExternalStore로 구독
import {
  type GameState,
  type OfflineResult,
  type BuyMode,
  newGame,
  tick,
  earn,
  incomePerSec,
  buyShelf,
  buyStaff,
  computeOffline,
  TAP_SECONDS,
} from "./economy";
import { readLocal, writeLocal, clearLocal } from "./save";

const SAVE_EVERY_MS = 10_000;
const TICK_MS = 100;
const MIN_OFFLINE_MODAL_SEC = 60;

export interface SceneSink {
  setView(v: { own: number[]; staff: boolean[]; income: number }): void;
}

class GameStore {
  state: GameState | null = null;
  offline: OfflineResult | null = null;
  version = 0;
  private listeners = new Set<() => void>();
  private timer = 0;
  private lastTick = 0;
  private lastSave = 0;
  private paused = false;
  private sink: SceneSink | null = null;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getSnapshot = () => {
    if (!this.state) this.init();
    return this.version;
  };
  getServerSnapshot = () => -1;

  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  private init() {
    this.state = readLocal() ?? newGame();
    this.settleAway();
  }

  /** 복귀 정산: 1분 미만 부재는 조용히 지급, 이상이면 모달 */
  private settleAway() {
    const s = this.state!;
    const r = computeOffline(s, Date.now());
    s.lastSeen = Date.now();
    if (r.amount <= 0) return;
    if (r.elapsedSec >= MIN_OFFLINE_MODAL_SEC) this.offline = r;
    else earn(s, r.amount);
  }

  private pushView() {
    const s = this.state;
    if (s && this.sink) this.sink.setView({ own: s.own, staff: s.staff, income: incomePerSec(s) });
  }

  attachScene(sink: SceneSink | null) {
    this.sink = sink;
    this.pushView();
  }

  save = () => {
    const s = this.state;
    if (!s) return;
    s.lastSeen = Date.now();
    writeLocal(s);
    this.lastSave = Date.now();
  };

  private onVisibility = () => {
    if (!this.state) return;
    if (document.visibilityState === "hidden") {
      this.paused = true;
      this.save();
    } else {
      this.settleAway();
      this.paused = false;
      this.lastTick = performance.now();
      this.emit();
    }
  };

  start() {
    if (this.timer) return;
    if (!this.state) this.init();
    this.lastTick = performance.now();
    this.lastSave = Date.now();
    this.timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - this.lastTick) / 1000);
      this.lastTick = now;
      const s = this.state;
      if (!s || this.paused) return;
      tick(s, dt);
      s.lastSeen = Date.now();
      this.pushView();
      if (Date.now() - this.lastSave > SAVE_EVERY_MS) this.save();
      this.emit();
    }, TICK_MS);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.save);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = 0;
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.save);
    this.save();
  }

  // ───── 액션
  buyShelf(i: number, mode: BuyMode) {
    if (this.state && buyShelf(this.state, i, mode)) {
      this.pushView();
      this.emit();
    }
  }

  buyStaff(i: number) {
    if (this.state && buyStaff(this.state, i)) {
      this.pushView();
      this.save();
      this.emit();
    }
  }

  tapCustomer(): number {
    const s = this.state;
    if (!s) return 0;
    const amt = Math.max(1, incomePerSec(s) * TAP_SECONDS);
    earn(s, amt);
    s.taps++;
    this.emit();
    return amt;
  }

  claimOffline() {
    if (this.state && this.offline) earn(this.state, this.offline.amount);
    this.offline = null;
    this.save();
    this.emit();
  }

  reset() {
    clearLocal();
    this.state = newGame();
    this.offline = null;
    this.pushView();
    this.save();
    this.emit();
  }
}

export const store = new GameStore();
