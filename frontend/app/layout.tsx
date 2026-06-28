import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "무럭무럭",
  description: "목표와 할 일을 관리하는 습관 앱",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "무럭무럭" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#46b97c",
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css" />
      </head>
      <body>
        {/* 구글 로그인(GIS) 스크립트 */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        {/* 서비스워커 비활성화: 개발 중 캐시로 옛 버전이 박히는 문제 방지.
            기존에 설치된 SW를 해제하고 모든 캐시를 비워 항상 네트워크 최신본을 받는다. */}
        <Script id="sw-unregister" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})}).catch(function(){})}if(window.caches&&caches.keys){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})}).catch(function(){})}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
