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
  openBox,
  boxCost,
  makeCollectorOffer,
  sellToCollector,
  type GachaResult,
  type CollectorOffer,
  loadState,
} from "./economy";
import { readLocal, writeLocal, clearLocal, readOwner, writeOwner } from "./save";
import {
  cloudEnabled,
  sb,
  displayName,
  loadCloud,
  saveCloud,
  claimOffline,
  setNickname,
  resetCloud,
  signInKakao,
  signOut,
  cloudErrorText,
  type ServerOffline,
} from "./cloud";
import { decideSync } from "./sync";
import type { User } from "@supabase/supabase-js";

const CLOUD_SAVE_EVERY_MS = 45_000;

export interface Account {
  status: "off" | "guest" | "syncing" | "in";
  userId: string | null;
  nickname: string;
  lastCloudSave: number;
  error: string | null;
}

export interface SyncPrompt {
  kind: "migrate" | "conflict";
  local: { total: number; dex: number; boxes: number };
  cloud: { total: number; dex: number; boxes: number } | null;
}

const summary = (g: GameState) => ({
  total: g.totalEarned,
  dex: g.dex.filter((n) => n > 0).length,
  boxes: g.boxes,
});

const SAVE_EVERY_MS = 10_000;
const TICK_MS = 100;
const MIN_OFFLINE_MODAL_SEC = 60;

export interface SceneSink {
  setView(v: { own: number[]; staff: boolean[]; income: number; collector: boolean }): void;
}

const COLLECTOR_STAY_MS = 30_000;
const COLLECTOR_FIRST_MS = 90_000;
const COLLECTOR_GAP_MS = [150_000, 210_000];

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
  gacha: GachaResult[] | null = null;
  collector: CollectorOffer | null = null;
  collectorOpen = false;
  private collectorUntil = 0;
  collectorLeft = 0; // 수집가가 떠나기까지 남은 초
  private nextCollectorAt = 0;

  // 클라우드
  account: Account = { status: cloudEnabled ? "guest" : "off", userId: null, nickname: "", lastCloudSave: 0, error: null };
  syncPrompt: SyncPrompt | null = null;
  private cloudState: GameState | null = null;
  private cloudReady = false; // 로그인 후 동기화가 끝나 클라우드 저장을 해도 되는 상태
  private cloudBusy = false;
  private claiming = false;
  private awaitingCloud = false; // 로그인 계정 데이터라 오프라인 정산을 서버에 맡김
  private cloudStarted = false;

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
    if (cloudEnabled && readOwner()) this.awaitingCloud = true;
    else this.settleAway();
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
    if (s && this.sink)
      this.sink.setView({ own: s.own, staff: s.staff, income: incomePerSec(s), collector: !!this.collector });
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
      void this.cloudSave();
    } else {
      this.lastTick = performance.now();
      if (this.cloudReady) {
        void this.claimServerOffline().finally(() => {
          this.paused = false;
        });
      } else {
        this.settleAway();
        this.paused = false;
      }
      this.emit();
    }
  };

  start() {
    if (this.timer) return;
    if (!this.state) this.init();
    this.lastTick = performance.now();
    this.lastSave = Date.now();
    this.nextCollectorAt = Date.now() + COLLECTOR_FIRST_MS;
    this.timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - this.lastTick) / 1000);
      this.lastTick = now;
      const s = this.state;
      if (!s || this.paused) return;
      tick(s, dt);
      s.lastSeen = Date.now();
      this.updateCollector();
      this.pushView();
      if (Date.now() - this.lastSave > SAVE_EVERY_MS) this.save();
      if (this.cloudReady && Date.now() - this.account.lastCloudSave > CLOUD_SAVE_EVERY_MS) void this.cloudSave();
      this.emit();
    }, TICK_MS);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.save);
    void this.initCloud();
  }

  // ───────────────────────── 클라우드
  private async initCloud() {
    if (!cloudEnabled || this.cloudStarted) return;
    this.cloudStarted = true;
    const c = sb();
    if (!c) return;
    c.auth.onAuthStateChange((event, session) => {
      // 콜백 안에서 바로 supabase 호출을 기다리면 교착될 수 있어 다음 틱으로 미룸
      if (event === "SIGNED_IN" && session?.user) setTimeout(() => void this.onSignedIn(session.user), 0);
    });
    try {
      const { data } = await c.auth.getSession();
      if (data.session?.user) await this.onSignedIn(data.session.user);
      else this.fallbackLocal();
    } catch {
      this.fallbackLocal();
    }
    // OAuth 콜백 파라미터 정리
    const u = new URL(window.location.href);
    if (u.searchParams.has("code") || u.searchParams.has("error")) {
      u.searchParams.delete("code");
      u.searchParams.delete("error");
      u.searchParams.delete("error_description");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
  }

  /** 클라우드를 못 쓰는 상황: 로컬 기준으로 오프라인 정산 */
  private fallbackLocal() {
    if (this.awaitingCloud) {
      this.awaitingCloud = false;
      this.settleAway();
    }
    this.emit();
  }

  private async onSignedIn(user: User) {
    if (this.account.userId === user.id && this.account.status !== "guest") return;
    this.account = { ...this.account, status: "syncing", userId: user.id, nickname: displayName(user), error: null };
    this.emit();
    try {
      const row = await loadCloud();
      const cloud = row ? loadState(row.data) : null;
      if (row) this.account.nickname = row.nickname;
      this.cloudState = cloud;
      const d = decideSync(this.state!, readOwner(), cloud, user.id);
      if (d.kind === "useCloud") await this.adoptCloud(cloud!);
      else if (d.kind === "uploadLocal") await this.adoptLocal();
      else if (d.kind === "fresh") {
        this.replaceState(newGame());
        await this.adoptLocal();
      } else {
        this.syncPrompt = {
          kind: d.kind === "askMigrate" ? "migrate" : "conflict",
          local: summary(this.state!),
          cloud: cloud ? summary(cloud) : null,
        };
        this.account.status = "in";
      }
    } catch (e) {
      this.account.status = "in";
      this.account.error = cloudErrorText(e) + " 로그인 상태에서 이 기기에만 저장 중이에요.";
      this.fallbackLocal();
    }
    this.emit();
  }

  private replaceState(g: GameState) {
    this.state = g;
    this.gacha = null;
    this.collector = null;
    this.collectorOpen = false;
    writeLocal(g);
    this.pushView();
  }

  private applyServerOffline(off: ServerOffline) {
    const s = this.state;
    if (!s || off.amount <= 0) return;
    if (off.elapsed >= MIN_OFFLINE_MODAL_SEC)
      this.offline = { elapsedSec: off.elapsed, countedSec: off.counted, amount: off.amount };
    else earn(s, off.amount);
  }

  private async claimServerOffline() {
    this.claiming = true;
    try {
      this.applyServerOffline(await claimOffline());
    } catch (e) {
      this.account.error = cloudErrorText(e);
      this.settleAway();
    } finally {
      this.claiming = false;
      this.emit();
    }
  }

  private async adoptCloud(cloud: GameState) {
    this.replaceState(cloud);
    writeOwner(this.account.userId);
    this.awaitingCloud = false;
    await this.claimServerOffline();
    this.cloudReady = true;
    this.account.status = "in";
    this.account.lastCloudSave = Date.now() - CLOUD_SAVE_EVERY_MS + 5_000;
  }

  private async adoptLocal() {
    writeOwner(this.account.userId);
    if (this.awaitingCloud) {
      this.awaitingCloud = false;
      await this.claimServerOffline(); // 서버 last_seen 기준 정산 후 저장
    }
    this.cloudReady = true;
    this.account.status = "in";
    await this.cloudSave(true);
  }

  /** 클라우드 저장 (주기적·이벤트). force면 진행 중 여부만 확인 */
  async cloudSave(force = false) {
    if (!this.cloudReady || !this.state || this.cloudBusy || this.claiming) return;
    if (!force && Date.now() - this.account.lastCloudSave < 3_000) return;
    this.cloudBusy = true;
    try {
      this.state.lastSeen = Date.now();
      await saveCloud(this.state, this.account.nickname);
      this.account.error = null;
    } catch (e) {
      this.account.error = cloudErrorText(e);
    } finally {
      this.account.lastCloudSave = Date.now();
      this.cloudBusy = false;
      this.emit();
    }
  }

  /** 중요한 변화 뒤 몇 초 안에 클라우드 저장 */
  private cloudSoon() {
    if (this.cloudReady) this.account.lastCloudSave = Math.min(this.account.lastCloudSave, Date.now() - CLOUD_SAVE_EVERY_MS + 3_000);
  }

  async answerSync(choice: "local" | "cloud" | "fresh") {
    const p = this.syncPrompt;
    if (!p) return;
    this.syncPrompt = null;
    this.account.status = "syncing";
    this.emit();
    try {
      if (choice === "cloud" && this.cloudState) await this.adoptCloud(this.cloudState);
      else {
        if (choice === "fresh") this.replaceState(newGame());
        if (p.kind === "conflict") await resetCloud(); // 계정 데이터를 이 기기 데이터로 교체
        await this.adoptLocal();
      }
    } catch (e) {
      this.account.status = "in";
      this.account.error = cloudErrorText(e);
    }
    this.emit();
  }

  async login() {
    try {
      await signInKakao();
    } catch (e) {
      this.account.error = cloudErrorText(e);
      this.emit();
    }
  }

  async logout() {
    await this.cloudSave(true);
    await signOut();
    clearLocal();
    writeOwner(null);
    this.cloudReady = false;
    this.cloudState = null;
    this.syncPrompt = null;
    this.account = { status: "guest", userId: null, nickname: "", lastCloudSave: 0, error: null };
    this.replaceState(newGame());
    this.emit();
  }

  async rename(n: string): Promise<string | null> {
    try {
      this.account.nickname = await setNickname(n);
      this.emit();
      return null;
    } catch (e) {
      return cloudErrorText(e);
    }
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = 0;
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.save);
    this.save();
  }

  private updateCollector() {
    const now = Date.now();
    if (this.collector) {
      this.collectorLeft = Math.max(0, Math.ceil((this.collectorUntil - now) / 1000));
      if (!this.collectorOpen && now > this.collectorUntil) {
        this.collector = null;
        this.nextCollectorAt = now + this.gap();
      }
      return;
    }
    if (now < this.nextCollectorAt || !this.state) return;
    const offer = makeCollectorOffer(this.state);
    if (!offer) {
      this.nextCollectorAt = now + 20_000;
      return;
    }
    this.collector = offer;
    this.collectorUntil = now + COLLECTOR_STAY_MS;
    this.collectorLeft = COLLECTOR_STAY_MS / 1000;
  }

  private gap() {
    return COLLECTOR_GAP_MS[0] + Math.random() * (COLLECTOR_GAP_MS[1] - COLLECTOR_GAP_MS[0]);
  }

  // ───── 액션
  boxCost() {
    return this.state ? boxCost(this.state) : 0;
  }

  /** 박스 n개 연속 개봉 (돈이 떨어지면 중단) */
  openBoxes(n: number): GachaResult[] {
    const s = this.state;
    if (!s) return [];
    const out: GachaResult[] = [];
    for (let k = 0; k < n; k++) {
      const r = openBox(s);
      if (!r) break;
      out.push(r);
    }
    if (out.length) {
      this.gacha = out;
      this.pushView();
      this.save();
      this.cloudSoon();
      this.emit();
    }
    return out;
  }

  closeGacha() {
    this.gacha = null;
    this.emit();
  }

  tapCollector() {
    if (!this.collector) return;
    this.collectorOpen = true;
    this.emit();
  }

  answerCollector(sell: boolean) {
    const s = this.state;
    if (s && this.collector && sell) sellToCollector(s, this.collector);
    this.collector = null;
    this.collectorOpen = false;
    this.nextCollectorAt = Date.now() + this.gap();
    this.pushView();
    this.save();
    this.cloudSoon();
    this.emit();
  }

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
      this.cloudSoon();
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

  async reset() {
    if (this.cloudReady) {
      try {
        await resetCloud();
      } catch (e) {
        this.account.error = cloudErrorText(e);
        this.emit();
        return;
      }
    }
    clearLocal();
    this.offline = null;
    this.replaceState(newGame());
    this.save();
    if (this.cloudReady) await this.cloudSave(true);
    this.emit();
  }
}

export const store = new GameStore();
