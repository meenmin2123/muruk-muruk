# 여기붙여 — 아이폰/안드로이드 앱 빌드 가이드

Next.js 정적 export + Capacitor 로 앱을 만든다. 웹 배포(Render 정적 사이트)는 그대로 두고,
앱일 때만 같은 `out/` 을 네이티브 껍데기에 담는다.

`ios/` 네이티브 프로젝트는 **이미 저장소에 들어 있다.** 맥에서 `pod install` 만 하면 열린다.

---

## 아이폰에 올리기 — 전체 순서

### 0. 준비물

| | |
|---|---|
| 맥 + Xcode | **필수.** iOS 빌드는 맥에서만 된다 |
| Node 18+ | |
| CocoaPods | `sudo gem install cocoapods` (한 번만) |
| Apple 계정 | 무료 계정으로 내 폰에 설치 가능. 단 **7일마다 다시 설치**해야 한다 |
| Apple Developer $99/년 | 7일 제한 없애기 + **홈 화면 위젯**(App Group)에 필요 |

### 1. 구글 아이폰 클라이언트 만들기 (한 번만)

앱은 웹과 **다른** 구글 클라이언트 ID를 쓴다. 웹용 ID로는 로그인이 안 된다.

1. [구글 클라우드 콘솔](https://console.cloud.google.com/apis/credentials) ▸ 웹 클라이언트와 **같은 프로젝트**
2. **사용자 인증 정보 만들기 ▸ OAuth 클라이언트 ID**
3. 애플리케이션 유형 **iOS**
4. 번들 ID: `com.muruk.app` ← `capacitor.config.ts` 의 `appId` 와 반드시 같아야 한다
5. 만들면 이런 값이 나온다: `799206979966-xxxxx.apps.googleusercontent.com`

> iOS 클라이언트에는 보안 비밀이 없다. 공개되는 값이라 코드에 넣어도 된다.

### 2. 한 줄로 끝내기 (권장)

받은 ID 하나만 주면 아래 2~4단계를 알아서 한다. 여러 번 돌려도 된다.

```bash
cd frontend
./scripts/ios-setup.sh 799206979966-xxxxx.apps.googleusercontent.com
```

`.env.production` 과 `Info.plist` 를 같은 값으로 맞추고(둘이 어긋나면 로그인이 멈춘다),
빌드·동기화·`pod install` 까지 한 뒤 Xcode 를 연다. 끝나면 **3단계(Render 설정)만** 손으로
하면 된다 — 그건 스크립트가 할 수 없다.

아래는 그 스크립트가 무슨 일을 하는지, 손으로 할 때는 어떻게 하는지다.

---

### 2-손으로. 받은 ID를 두 곳에 넣기

**둘이 짝이 안 맞으면 로그인 창은 뜨는데 앱으로 돌아오지 못하고 멈춘다.**

**① `frontend/.env.production`**
```diff
- NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=여기에_아이폰_클라이언트_ID.apps.googleusercontent.com
+ NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID=799206979966-xxxxx.apps.googleusercontent.com
```

**② `frontend/ios/App/App/Info.plist`** — 앞뒤를 뒤집은 '역순' 형태로
```diff
- <string>com.googleusercontent.apps.여기에_아이폰_클라이언트_ID</string>
+ <string>com.googleusercontent.apps.799206979966-xxxxx</string>
```
(`.apps.googleusercontent.com` 을 떼고 앞에 `com.googleusercontent.apps.` 를 붙인다)

### 3. 백엔드에 아이폰 ID 추가 (Render 대시보드) — 손으로만 가능

백엔드는 허용된 클라이언트 ID로 발급된 토큰만 받는다. 아이폰 ID를 추가하지 않으면
**로그인은 되는데 데이터가 안 불러와진다.**

Render ▸ `muruk-backend` ▸ Environment ▸ `GOOGLE_CLIENT_ID` 를 **쉼표로 이어서**:
```
799206979966-2lnqig1fc0unf4g7j2q44mll6kg4sn1f.apps.googleusercontent.com,799206979966-xxxxx.apps.googleusercontent.com
```
저장하면 백엔드가 자동 재배포된다. (웹 로그인은 그대로 동작한다)

### 4-손으로. 맥에서 빌드

```bash
git pull
cd frontend
npm install

npm run build:app              # 정적 export → out/
npx cap sync ios               # out/ 과 플러그인을 네이티브로 복사
cd ios/App && pod install && cd ../..
npx cap open ios               # Xcode 가 열린다
```

### 5. Xcode 에서 실행

1. 왼쪽 맨 위 **App** 프로젝트 클릭 ▸ TARGETS **App** ▸ **Signing & Capabilities**
2. **Team** 을 본인 Apple 계정으로 지정
   (없으면 Xcode ▸ Settings ▸ Accounts 에서 Apple ID 추가)
3. 상단에서 기기를 **연결한 아이폰** 또는 시뮬레이터로 선택
4. ▶︎ Run
5. 실기기 첫 실행이면 아이폰에서
   **설정 ▸ 일반 ▸ VPN 및 기기 관리** ▸ 본인 계정 ▸ **신뢰**

### 6. 코드를 고친 뒤에는

```bash
npm run build:app && npx cap sync ios
```
그다음 Xcode 에서 다시 Run. (`pod install` 은 플러그인을 추가했을 때만 다시)

---

## 구글 로그인이 앱에서 어떻게 동작하나

웹과 앱은 길이 다르다. 구글이 **앱 내장 웹뷰에서의 OAuth 를 막기** 때문이다.

| | 웹 | 앱 |
|---|---|---|
| 방식 | Google Identity Services (One Tap) | 시스템 브라우저 + 인가 코드 + PKCE |
| 로그인 창 | 페이지 안 | SFSafariViewController |
| 돌아오는 길 | — | `com.googleusercontent.apps.…` 커스텀 스킴 |
| 토큰 갱신 | One Tap 무음 재실행 | **리프레시 토큰** (더 확실하다) |

코드는 `lib/auth-native.ts` 에 있고, `lib/auth.ts` 가 `Capacitor.isNativePlatform()` 으로 갈라 쓴다.
웹 동작은 하나도 바뀌지 않았다.

> 암묵적 흐름(`response_type=id_token`)은 쓰지 않는다 — 폐기된 방식이다.
> 네이티브 앱은 인가 코드 + PKCE 가 현재 요구되는 방식이다.

---

## 아이콘 / 스플래시

원본은 `resources/` (icon.png 1024, splash.png·splash-dark.png 2732).
지금 `ios/` 에 들어 있는 건 Capacitor 기본 이미지라, 맥에서 한 번 바꿔야 한다:

```bash
npm i -D @capacitor/assets
npx @capacitor/assets generate --iconBackgroundColor '#46B97C' --splashBackgroundColor '#f3faf1'
```

---

## 홈 화면 위젯 (선택)

오늘 할 일 + 칭찬판 진행도를 홈 화면에 띄우는 위젯 코드가 `ios-native/` 에 있다.
설치 방법은 [`ios-native/SETUP.md`](ios-native/SETUP.md).

**실기기에서 쓰려면 유료 Apple Developer 계정이 필요하다** (App Group 기능 때문).
시뮬레이터에서는 무료 계정으로도 확인된다.

---

## 안드로이드

```bash
npm run build:app
npm run cap:add:android    # android/ 생성 (최초 1회)
npm run cap:open:android   # Android Studio
```

> 안드로이드 구글 로그인은 아직 안 맞춰 놨다. 구글은 안드로이드에서 커스텀 스킴
> 리다이렉트를 더는 받지 않아서, 아이폰과 같은 방식을 그대로 쓸 수 없다.
> 안드로이드까지 하려면 별도 작업이 필요하다.

---

## 자주 막히는 곳

**로그인 창은 뜨는데 앱으로 안 돌아온다**
→ 2단계 ①②의 값이 짝이 안 맞는다. `.env.production` 의 ID 와 Info.plist 의 역순 스킴을 다시 대조.
→ `.env.production` 을 고쳤으면 `npm run build:app && npx cap sync ios` 를 다시 해야 반영된다.

**로그인은 됐는데 목표·할 일이 안 보인다**
→ 3단계(백엔드 `GOOGLE_CLIENT_ID` 에 아이폰 ID 추가)를 안 했다. 백엔드가 토큰을 거부하고 있다.

**`pod install` 에서 실패**
→ `sudo gem install cocoapods` 후 `cd ios/App && pod repo update && pod install`

**빌드는 되는데 화면이 하얗다**
→ `npm run build:app` 을 안 하고 `cap sync` 만 했다. `out/` 이 비어 있으면 담을 게 없다.
