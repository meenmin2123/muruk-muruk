# 무럭무럭 — iOS 홈 화면 위젯 설치 가이드 (맥 전용)

이 폴더의 네이티브 코드를 Capacitor iOS 프로젝트에 붙여 **홈 화면 위젯**(오늘 할 일 +
칭찬판 진행도)을 띄우는 방법입니다. **맥 + Xcode**가 필요합니다.

- 시뮬레이터 미리보기: 무료 Apple 계정으로 가능 (App Group이 시뮬레이터에선 동작)
- **실제 아이폰 설치: 유료 Apple Developer Program($99/년) 필요** — App Group 기능 때문
- 위젯은 iOS가 갱신 시점을 통제해서 "초단위 실시간"은 불가. 앱을 열면 즉시 갱신되고,
  그 외에는 약 30분 간격으로 갱신됩니다.

핵심 구조: **웹앱이 오늘 스냅샷을 App Group(`group.com.muruk.app`)에 저장 → 위젯이 그걸 읽어 그림.**

---

## 0. 사전 준비 (한 번만)

```bash
cd frontend
npm install
npm run build:app      # BUILD_TARGET=app next build → out/ 생성(정적 export)
npx cap add ios        # ios/ 네이티브 프로젝트 생성 (맥에서 최초 1회)
npx cap sync ios        # 웹 자산 + 플러그인 동기화
npx cap open ios        # Xcode 열기
```

> 웹 코드를 고칠 때마다 `npm run build:app && npx cap sync ios` 를 다시 실행해야 앱에 반영됩니다.

---

## 1. App 타겟에 App Group 켜기

Xcode에서:

1. 왼쪽 네비게이터에서 최상단 프로젝트(App) 클릭 → TARGETS 의 **App** 선택
2. **Signing & Capabilities** 탭 → **+ Capability** → **App Groups** 추가
3. App Groups 목록에서 **+** → `group.com.muruk.app` 입력 후 체크
4. (실기기용) 위쪽 **Team** 을 본인 Apple 계정으로 지정

---

## 2. 브릿지 플러그인 추가 (App 타겟)

`WidgetBridgePlugin.swift` 와 `WidgetBridgePlugin.m` 두 파일을 **App 타겟**에 넣습니다.

1. Xcode 네비게이터에서 `App/App` 폴더를 우클릭 → **Add Files to "App"…**
2. 이 폴더(`ios-native/`)의 `WidgetBridgePlugin.swift`, `WidgetBridgePlugin.m` 선택
3. **Target: App 체크** 확인 후 Add
4. `.m` 추가 시 "bridging header를 만들까요?" 물으면 **No** (필요 없음)

> 이 플러그인이 JS의 `WidgetBridge.save()` 를 받아 App Group에 저장하고 위젯을 새로고침합니다.
> 별도 등록 코드는 필요 없습니다 — `.m`의 `CAP_PLUGIN` 매크로가 자동 등록합니다.

---

## 3. 위젯 익스텐션 타겟 만들기

1. Xcode 메뉴 **File ▸ New ▸ Target…**
2. **Widget Extension** 선택 → Next
3. Product Name: **MurukWidget**
4. **"Include Live Activity" / "Include Configuration App Intent" 체크 해제** (정적 위젯 사용)
5. Finish → "Activate scheme?" 물으면 **Activate**
6. 생성된 `MurukWidget/MurukWidget.swift` 파일을 열어 **내용 전체를 이 폴더의
   `MurukWidget/MurukWidget.swift` 로 교체** (붙여넣기)
   - 만약 Xcode가 `MurukWidgetBundle.swift` 등 여러 파일을 만들었다면, 그 안의
     `@main` 구조체는 **하나만** 있어야 합니다. 우리 파일에 `@main MurukWidgetBundle`이
     이미 있으니, Xcode가 만든 중복 `@main` 파일은 삭제하세요.

---

## 4. 위젯 타겟에도 App Group 켜기 (중요!)

위젯이 앱과 같은 저장소를 읽으려면 **양쪽 타겟 모두** 같은 App Group이어야 합니다.

1. TARGETS 의 **MurukWidgetExtension** 선택
2. **Signing & Capabilities** → **+ Capability** → **App Groups**
3. **+** → `group.com.muruk.app` 체크 (1단계와 동일해야 함)
4. Team 을 App 타겟과 동일하게 지정

---

## 5. 빌드 & 위젯 추가

1. 상단 스킴을 **App** 으로 두고 ▶︎ Run (시뮬레이터 또는 연결된 아이폰)
2. 앱에서 **구글 로그인 후 오늘 할 일/목표가 보이는 상태**로 둠
   → 이때 앱이 스냅샷을 App Group에 기록합니다.
3. 홈 화면으로 나가서 빈 곳을 **길게 누르기** → 좌상단 **+** → "무럭무럭" 검색
4. **Small** 또는 **Medium** 위젯을 선택해 배치

> 데이터가 안 보이면: 앱을 한 번 포그라운드로 열었다가(스냅샷 기록 트리거) 홈으로 나가세요.
> 그래도 안 되면 4단계의 App Group ID가 양쪽에서 **정확히 일치**하는지 확인하세요.

---

## 자주 묻는 것

- **위젯이 비어 있어요 / 옛날 데이터예요**
  - 앱을 열어 데이터를 한 번 띄우면 위젯에 즉시 반영됩니다(앱이 `reloadAllTimelines` 호출).
  - 두 타겟의 App Group ID 불일치가 가장 흔한 원인입니다.

- **App Group 체크박스가 비활성/오류**
  - 무료 계정으로 실기기에 올리면 App Group이 막힙니다. 시뮬레이터로 먼저 확인하고,
    유료 개발자 계정 등록 후 실기기로 올리세요.

- **앱 주소(API)**
  - 위젯은 백엔드에 직접 접속하지 않습니다. 앱이 받아온 데이터를 공유 저장소로만 넘깁니다.
    따라서 위젯은 오프라인에서도 마지막으로 본 오늘 데이터를 보여줍니다.

- **웹 변경을 위젯까지 반영**
  - `npm run build:app && npx cap sync ios` → Xcode에서 다시 Run.
