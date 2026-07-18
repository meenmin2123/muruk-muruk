import type { CapacitorConfig } from "@capacitor/cli";

// 무럭무럭 앱(Capacitor) 설정.
// webDir 는 `npm run build:app` (BUILD_TARGET=app next build) 가 만드는 정적 export 폴더.
const config: CapacitorConfig = {
  appId: "com.muruk.app",
  appName: "여기붙여",
  webDir: "out",
  backgroundColor: "#f3faf1",
  ios: {
    contentInset: "always",
  },
};

export default config;
