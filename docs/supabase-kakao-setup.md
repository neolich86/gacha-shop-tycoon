# M3 서버 설정 가이드 — Supabase + 카카오 로그인

환경변수가 없으면 게임은 게스트 전용(브라우저 저장)으로 동작합니다. 아래를 마치면 카카오 로그인·클라우드 저장·랭킹이 열립니다.
쿠지믹스와 **별도의** Supabase 프로젝트·카카오 앱을 새로 만듭니다.

## 1. Supabase 프로젝트

1. [supabase.com](https://supabase.com) → New project (이름 예: `gacha-shop-tycoon`, 리전 Seoul 권장)
2. 왼쪽 **SQL Editor** → New query → `supabase/migrations/0001_init.sql` 내용을 통째로 붙여 넣고 **Run**
   - 여러 번 실행해도 안전합니다. Table Editor에 `saves` 테이블이 생기면 성공
3. **Project Settings → API**(또는 API Keys)에서 두 값을 복사
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public 키(또는 publishable 키) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - ⚠️ `service_role` / secret 키는 절대 넣지 마세요

## 2. 카카오 개발자 앱

[developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → **애플리케이션 추가하기** (앱 이름: 가챠샵 타이쿤)

1. **앱 키 → REST API 키** 복사 (Supabase의 Client ID로 사용)
2. **플랫폼 → Web** 사이트 도메인 등록
   - `https://<내 Vercel 주소>.vercel.app`
   - `http://localhost:3000`
3. **카카오 로그인 → 활성화 설정 ON**
4. **카카오 로그인 → Redirect URI** 등록
   - `https://<Supabase 프로젝트 ref>.supabase.co/auth/v1/callback`
   - (Supabase 대시보드의 Kakao 설정 화면에 표시되는 Callback URL을 그대로 복사해도 됩니다)
5. **카카오 로그인 → 보안 → Client Secret** 코드 생성 → 활성화 상태 **사용함**
6. **카카오 로그인 → 동의항목**
   - 닉네임(profile_nickname), 프로필 사진(profile_image) 설정
   - 카카오계정(이메일, account_email): Supabase는 기본으로 이메일을 요청합니다. 이메일 동의항목은 비즈 앱 전환(사업자 정보 등록)이 필요할 수 있어요. 쿠지믹스에서 했던 방식과 같게 맞추면 됩니다.
     이메일 없이 가려면 Supabase Kakao 설정의 "Allow users without an email"(이메일 없는 사용자 허용) 옵션을 켜세요 (대시보드에 해당 옵션이 있는 경우).

## 3. Supabase에 카카오 연결

1. **Authentication → Sign In / Providers → Kakao** → Enable
   - Client ID(REST API Key) / Client Secret 입력 → Save
2. **Authentication → URL Configuration**
   - Site URL: `https://<내 Vercel 주소>.vercel.app`
   - Redirect URLs에 추가: `https://<내 Vercel 주소>.vercel.app/**`, `http://localhost:3000/**`

## 4. 환경변수

- **로컬**: `.env.local.example`을 복사해 `.env.local`로 저장하고 값 입력 → `npm run dev`
- **Vercel**: Project → Settings → Environment Variables에 같은 두 변수 등록 → **Redeploy**
  (`NEXT_PUBLIC_` 변수는 빌드 시점에 들어가므로 등록 후 반드시 다시 배포)

## 5. 확인

1. 게임 → 설정 탭 → **카카오로 로그인**
2. 게스트로 하던 진행이 있으면 "진행 상황 옮기기" 창이 뜹니다
3. Supabase Table Editor → `saves`에 내 행이 생기면 성공
4. 랭킹 탭에 내 닉네임이 보이는지 확인

## 동작 요약

| 상황 | 동작 |
|---|---|
| 게스트 진행 + 첫 로그인(계정 비어 있음) | "계정에 저장하고 이어하기 / 새로 시작하기" 선택 |
| 게스트 진행 + 이미 계정 데이터 있음 | 누적 매출·도감·박스 수를 비교해 둘 중 하나 선택 (고르지 않은 쪽 삭제) |
| 같은 계정으로 다시 접속 | 이 기기·서버 중 진행이 더 많은 쪽 자동 선택 |
| 다른 계정이 쓰던 기기 | 기기 데이터는 무시하고 계정 데이터 사용 |
| 오프라인 보상 | 서버 시간(now() - last_seen) 기준, 최대 4시간·효율 50% |
| 저장 주기 | 브라우저 10초 · 서버 45초 + 가챠·직원 고용·수집가 거래 직후 + 창 닫을 때 |
| 로그아웃 | 이 기기는 새 게스트 게임, 다시 로그인하면 이어하기 |
| 간이 안티치트(서버) | 누적 매출 감소 거부, 1분 내 초당 매출 1000배 급증 거부, 세이브 64KB 제한 |
