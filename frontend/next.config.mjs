/** @type {import('next').NextConfig} */
// 출력 모드:
//  - BUILD_TARGET=app    → 정적 export(out/) : Capacitor 앱 번들용
//  - BUILD_TARGET=static → 정적 export(out/) : Render 정적 사이트 배포용(콜드스타트 없음)
//  - 그 외              → standalone(서버) : 기존 Docker 웹서비스용
// 앱은 순수 클라이언트 렌더(로그인·데이터는 브라우저에서 API 호출)라 정적 export로 문제없다.
const isStatic = process.env.BUILD_TARGET === "app" || process.env.BUILD_TARGET === "static";

const nextConfig = {
  reactStrictMode: true,
  output: isStatic ? "export" : "standalone",
  // 정적 export 에는 이미지 최적화 서버가 없음(우린 일반 <img>라 무해).
  images: { unoptimized: true },
};

export default nextConfig;
