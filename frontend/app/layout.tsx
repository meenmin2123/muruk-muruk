import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "무럽무럽",
  description: "작심삼일도, 꾸준히 하면 됩니다 🌿",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "무럽무럽" },
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
        {/* PWA 서비스워커 등록 + 새 버전 활성화 시 자동 새로고침 */}
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').then(function(reg){try{reg.update()}catch(e){}}).catch(function(){});var r=false;navigator.serviceWorker.addEventListener('controllerchange',function(){if(r)return;r=true;window.location.reload()});});}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
