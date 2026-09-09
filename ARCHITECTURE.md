# 무럽무럽 아키텍처 (v2 골격)

기존 단일 HTML PWA에서, **Kotlin 백엔드 + TypeScript 프론트 + Claude AI 코칭** 구조로 확장하는 1차 골격입니다.

```
[Next.js (TS) 프론트]  --구글 로그인(ID 토큰)-->  [Kotlin / Spring Boot 백엔드]
                                                    ├─ Postgres (주 저장소, 계정별 상태)
                                                    ├─ 노션 (백업, best-effort)
                                                    └─ Claude API (AI 코칭, Opus 4.8)
```

- 기존 PWA(`index.html` 등)는 그대로 두었습니다. 이 골격이 안정되면 UI를 점진 이식합니다.

## 구성

| 폴더 | 내용 |
|------|------|
| `backend/` | Kotlin + Spring Boot. 구글 토큰 검증, 사용자별 상태 CRUD, Claude 코칭, 노션 백업 |
| `frontend/` | Next.js(App Router) + TypeScript. 구글 로그인, 대시보드, AI 코칭 호출 |
| `index.html` 등 | 기존 PWA (레거시, 유지) |

## 인증 흐름
1. 프론트가 **구글 로그인(GIS)** 으로 ID 토큰 획득
2. 모든 API 호출에 `Authorization: Bearer <ID 토큰>`
3. 백엔드 `GoogleAuthFilter`가 토큰을 검증(`GOOGLE_CLIENT_ID`) → 사용자(`sub`) 식별 → `app_user` upsert

## 데이터
- `user_state` 테이블: 사용자별 앱 상태 전체를 **JSON(jsonb)** 으로 저장 (기존 PWA의 통째 동기화와 호환).
- **낙관적 잠금(`@Version`)**: 저장마다 버전 증가. 클라이언트가 보낸 `baseVersion`이 서버와 다르거나
  누락되면 `409 Conflict` → 프론트가 서버 최신본을 받아 **3-way 병합**(`frontend/lib/merge.ts`) 후 다시 올린다.
  조회·검사·저장은 `StateService`의 한 트랜잭션 안에서 처리해 검사-후-저장 경쟁 구간이 없다.
- 저장 시 노션으로 비동기 백업(best-effort). 두 가지 모드:
  - **중계 서버**: `NOTION_RELAY_URL`
  - **직접 연결**: `NOTION_TOKEN` + `NOTION_DATABASE_ID` (Notion API로 사용자별 페이지 생성/갱신)

## API
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 헬스체크 (인증 불필요) |
| GET | `/api/me` | 내 프로필 |
| GET | `/api/state` | 내 상태 받기 → `{ data, version, updatedAt }` |
| PUT | `/api/state` | 내 상태 올리기 `{ data, baseVersion }` (+노션 백업, 충돌 시 409) |
| POST | `/api/coach` | AI 코칭 (`{ kind, context }` → `{ message }`) |

### AI 코칭 종류(`kind`)
| kind | 트리거 | 설명 |
|------|--------|------|
| `encourage` | 설정 · 오늘의 응원 | 현재 상태 기반 응원 |
| `weeklyReview` | 설정 · 주간 회고 | 잘한 점 1 + 다음 주 시도 1 |
| `slumpCare` | 오늘 탭 배너(3일+ 미완료) | 자책 다독임 + 아주 작은 한 걸음 |
| `suggestTasks` | 목표 카드 · AI 추천 | 목표에 맞는 할 일 5개(줄 단위) |
| `celebrate` | 칭찬판 완성 모달 | 성취 축하 메시지 |

## 프론트 화면 (기존 PWA에서 이식)
- 4탭: **오늘 / 나의 목표 / 칭찬나무 / 기록** + 설정 시트
- 목표 생성(카테고리·색·칭찬판 모양), **커스텀 카테고리**, 할 일 추가/완료/내일로,
  매일반복 스티커 적립, 칭찬판 6테마 SVG, 도장, 연속기록·잔디 달력
- 설정: AI 코칭(응원·주간회고), **백업 내보내기/불러오기**, **알림 권한**, 로그아웃
- **PWA**: `manifest.json` + 서비스워커(앱 셸 오프라인 캐시) + 설치 가능
- 상태 변경은 디바운스로 백엔드에 자동 저장(`PUT /api/state`), 시작 시 자동 불러오기

## CI
- `.github/workflows/ci.yml`: 백엔드 `./gradlew build`(= `StateServiceTest` 실행), 프론트 `tsc --noEmit` + `next build`

## 실행 (Docker — 가장 간단)
```bash
cp .env.example .env     # ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID 등 채우기
docker compose up --build
# 프론트 http://localhost:3000 · 백엔드 http://localhost:8080 · Postgres 5432
```
> `NEXT_PUBLIC_*`(API 주소·구글 클라이언트 ID)는 프론트 **빌드 시점**에 박히므로
> 값을 바꾸면 `docker compose build frontend` 로 다시 빌드해야 합니다.

## 실행 (개별 실행)

### 백엔드 (JDK 21)
```bash
cd backend
# 환경변수
export ANTHROPIC_API_KEY=sk-ant-...          # Claude 코칭용
export GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
# (선택) Postgres — 없으면 H2 인메모리로 자동 실행
export DB_URL=jdbc:postgresql://localhost:5432/muruk
export DB_USER=muruk DB_PASSWORD=...
export CORS_ORIGINS=http://localhost:3000
./gradlew bootRun
```

### 프론트 (Node 20+)
```bash
cd frontend
cp .env.local.example .env.local   # GOOGLE_CLIENT_ID, API_BASE 채우기
npm install
npm run dev    # http://localhost:3000
```

## 직접 준비할 것 (제가 대신 못 하는 부분)
1. **구글 OAuth 클라이언트 ID**(웹) 발급 → 프론트 `.env.local`과 백엔드 `GOOGLE_CLIENT_ID`에 동일 값
2. **Claude API 키** → 백엔드 `ANTHROPIC_API_KEY`
3. (운영) **Postgres** 인스턴스 → `DB_URL/DB_USER/DB_PASSWORD`

## 인증 수명주기
- 구글 ID 토큰은 약 1시간 뒤 만료된다. 프론트는 요청 직전에 만료가 임박하면(60초) **무음 갱신**을 시도하고,
  그래도 401이면 한 번 더 갱신 후 재시도한다(`frontend/lib/api.ts`).
- 끝내 실패하면 `onAuthExpired` 신호로 로그인 화면으로 되돌린다. **조용히 저장이 멈추는 상태를 만들지 않는다.**
- 미인증은 **401**, 인증됐지만 권한 없음은 **403**으로 구분한다(`SecurityConfig`의 entry point / access denied handler).
- 만료된 토큰도 지우지 않는다 — 신원(`sub`)을 알아야 아직 못 올린 편집을 그 사용자의 로컬 캐시에 계속 남길 수 있다.
- 로그아웃은 `signOut()` — 토큰 삭제 + `disableAutoSelect()`로 즉시 자동 재로그인되는 것을 막는다.

## 미저장 편집 보호
로컬 캐시는 상태만이 아니라 **동기화 문맥**(`version` · 병합 기준 `base` · `pending`)까지 함께 저장한다.
콜드 스타트 중 편집 · 토큰 만료 · 오프라인 · 탭 종료로 업로드가 끊겨도, 다음 접속 때 서버본과 병합되어 살아남는다.
업로드 실패 시 3초·8초·20초·45초 간격으로 재시도한다.

## 한계 (현재)
- 3-way 병합의 기준(`base`)이 없을 때(예: 아주 오래된 캐시)는 합집합으로 떨어진다 —
  유실보다 부활이 안전하다는 판단. 이 경우에만 삭제한 항목이 되돌아올 수 있다.
- 노션 백업은 best-effort(실패해도 본 저장에 영향 없음). 직접 연결은 DB 속성 스키마가 맞아야 동작.
- 알림은 **권한 요청 + 테스트 알림**까지. 정해진 시간에 울리는 **예약/푸시 알림은 미구현**(서버 푸시 인프라 필요).
- 커스텀 카테고리는 이모지·이름·색까지(프리셋의 추천 할 일 목록은 없음).
