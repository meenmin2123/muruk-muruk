# 무럭무럭 — 앱(스토어) 빌드 가이드

이 프로젝트는 **Next.js 정적 export + Capacitor**로 iOS/Android 앱을 만든다.
웹 배포(standalone)는 그대로 두고, 앱일 때만 정적 `out/`을 만들어 네이티브 껍데기에 담는다.

## 0. 준비물 (1회)
- Node 18+
- **Android**: Android Studio
- **iOS**: macOS + Xcode (iOS 빌드·제출은 Mac 필수)
- 제출 시: Apple Developer($99/년), Google Play($25/1회)

## 1. 의존성 설치
```bash
cd frontend
npm install
```

## 2. 네이티브 플랫폼 추가 (1회, 각자 머신에서)
> 정적 export를 한 번 만든 뒤 플랫폼을 추가해야 `webDir(out)`이 존재한다.
```bash
npm run build:app          # BUILD_TARGET=app → out/ 생성
npm run cap:add:android    # android/ 생성
npm run cap:add:ios        # ios/ 생성 (Mac에서만)
```

## 3. 코드 바뀔 때마다 동기화
```bash
npm run cap:sync           # build:app + cap sync (웹 빌드를 네이티브로 복사)
```

## 4. IDE로 열어서 실행/빌드/제출
```bash
npm run cap:open:android   # Android Studio
npm run cap:open:ios       # Xcode
```
여기서 시뮬레이터 실행, 서명, 스토어 업로드를 한다.

## 5. 아이콘 / 스플래시
원본은 `resources/`(icon.png 1024, splash.png/splash-dark.png 2732)에 있다.
플랫폼별 리소스 생성은 sharp가 동작하는 머신(보통 Mac)에서:
```bash
npm i -D @capacitor/assets
npx @capacitor/assets generate --iconBackgroundColor '#46B97C' --splashBackgroundColor '#f3faf1'
```

## ⚠️ 빌드 시 백엔드 주소(중요)
정적 export는 **빌드 시점**에 `NEXT_PUBLIC_API_BASE`가 박힌다. 앱은 운영 백엔드를 봐야 하므로:
```bash
NEXT_PUBLIC_API_BASE=https://<운영-백엔드> BUILD_TARGET=app next build
```
(스크립트 `build:app`에 이 환경변수를 함께 넣어 빌드할 것.)

## ⚠️ 제출 전 필수 — 구글 로그인 (아직 미적용)
구글은 **웹뷰 내 OAuth를 차단**한다. 현재 웹 로그인 흐름은 앱(웹뷰)에서 막힐 수 있다.
스토어 제출 전 **네이티브 구글 로그인 플러그인**(`@capacitor-community/...`/`@codetrix-studio/capacitor-google-auth` 등)으로 전환해야 한다. (별도 작업)
