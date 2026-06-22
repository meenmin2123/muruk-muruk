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
- 추후 `dreams/goals/todos` 정규화 테이블로 확장 가능.
- 저장 시 노션 중계 서버(`NOTION_RELAY_URL`)로 비동기 백업.

## API
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 헬스체크 (인증 불필요) |
| GET | `/api/me` | 내 프로필 |
| GET | `/api/state` | 내 상태 받기 |
| PUT | `/api/state` | 내 상태 올리기(+노션 백업) |
| POST | `/api/coach` | AI 코칭 (`{ kind, context }` → `{ message }`) |

## 프론트 화면 (기존 PWA에서 이식)
- 4탭: **오늘 / 나의 목표 / 칭찬나무 / 기록** + 설정 시트(프로필·로그아웃·AI 코칭)
- 목표 생성(카테고리·색·칭찬판 모양), 할 일 추가/완료/내일로, 매일반복 스티커 적립,
  칭찬판 6테마(나무·포도·별·꽃밭·풍선·무지개) SVG, 도장, 연속기록·잔디 달력
- 상태 변경은 디바운스로 백엔드에 자동 저장(`PUT /api/state`), 시작 시 자동 불러오기

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

## 한계 (현재)
- 상태는 JSON 문서 1건으로 저장(낙관적 잠금/충돌 해결 미구현) — 여러 기기 동시 편집 시 마지막 저장이 우선.
- 노션 백업은 best-effort(실패해도 본 저장에 영향 없음).
- 알림/PWA 설치, 백업 파일 내보내기/가져오기, 커스텀 카테고리 등 일부 기존 기능은 추후 이식.
- AI 코칭은 '오늘의 응원' 1종(2번 단계에서 주간 회고·슬럼프 케어·할 일 추천 확장 예정).
