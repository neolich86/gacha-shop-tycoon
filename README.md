# 가챠샵 타이쿤 (gacha-shop-tycoon)

캡슐토이 머신 하나로 시작해 나만의 가챠샵을 키우는 도트 방치형 타이쿤.
2등신 캐릭터 + 45도 탑뷰 매장, 미니게임천국 라인업.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드 확인
npm run sim        # 밸런스 봇 시뮬레이션 (lib/economy.ts 그대로 사용)
npm test           # 가챠·동기화 규칙·DB(SQL) 테스트
npm run mock       # 테스트용 가짜 Supabase 서버 (:54321, 실제 SQL을 PGlite로 실행)
```

## 서버 (M3)

카카오 로그인·클라우드 저장·랭킹을 켜려면 [docs/supabase-kakao-setup.md](docs/supabase-kakao-setup.md) 참고.
환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)가 없으면 게스트 전용으로 동작합니다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/lib/economy.ts` | 경제 공식 (진열대·직원·마일스톤·환생·오프라인). 순수 함수 — 서버 검증·시뮬과 공유 |
| `src/lib/figures.ts` | 가상 시리즈 5종 × 12 = 피규어 60종, 등급 확률 |
| `src/lib/format.ts` | 한국식 큰 수 표기 (만·억·조·경…극) |
| `src/lib/store.ts` | 게임 루프 + 상태 스토어 (`useSyncExternalStore`) |
| `src/lib/save.ts` | localStorage 저장 + 세이브 주인(계정 id) 기록 |
| `src/lib/cloud.ts` | Supabase 클라이언트 — 카카오 로그인, 저장/불러오기, 서버 오프라인 정산, 랭킹 |
| `src/lib/sync.ts` | 로그인 시 기기↔계정 데이터 선택 규칙 (순수 함수) |
| `supabase/migrations/0001_init.sql` | `saves` 테이블·RLS·RPC(save_game, claim_offline, get_leaderboard …) |
| `src/game/scene.ts` | 쿼터뷰 도트 매장 캔버스 (손님 AI, 직원, 말풍선 탭) |
| `src/game/sprites.ts` | 2등신 캐릭터 픽셀맵 |
| `src/game/pixel.ts` | 도트 드로잉 헬퍼 (fillRect 기반 아이소 박스) |
| `src/components/GameClient.tsx` | UI (HUD·탭·구매 패널·오프라인 모달) |
| `scripts/sim.ts` | 밸런스 봇 |

## 진행 상황

- [x] M1 로컬 프로토타입 — 진열대 8종·직원 7명·마일스톤·한국식 표기·자동 저장·오프라인 보상·손님 탭
- [x] M2 가챠(5시리즈 60종·자동 장착·도감·시리즈 완성 보너스)·수집가 손님
- [x] M3 Supabase (카카오 로그인·클라우드 세이브·서버 시간 오프라인 정산·랭킹) — 서버 설정은 docs 참고
- [ ] M4 환생「2호점 오픈」·명성 상점
- [ ] M5 Vercel 배포·SEO·GTM·PWA

## 크레딧

폰트: [Galmuri](https://github.com/quiple/galmuri) — SIL OFL 1.1
