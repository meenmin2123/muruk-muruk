/** @type {import('next').NextConfig} */
// 웹 배포는 standalone(서버), 앱(Capacitor) 빌드는 정적 export(out/).
// BUILD_TARGET=app 일 때만 export 로 전환 → 기존 웹 배포에 영향 없음.
const isApp = process.env.BUILD_TARGET === "app";

const nextConfig = {
  reactStrictMode: true,
  output: isApp ? "export" : "standalone",
  // 정적 export 에는 이미지 최적화 서버가 없음(우린 일반 <img>라 무해).
  images: { unoptimized: true },
};

export default nextConfig;
