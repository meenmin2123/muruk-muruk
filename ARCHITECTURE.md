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

## 실행

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

## 한계 (v2 골격)
- 목표/할일/칭찬나무 등 풍부한 UI는 아직 미이식 (기존 PWA에서 점진 이식).
- 상태는 JSON 문서 1건으로 저장(낙관적 잠금/충돌 해결 미구현).
- 노션 백업은 best-effort(실패해도 본 저장에 영향 없음).
