import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "무럽무럽",
  description: "작심삼일도, 꾸준히 하면 됩니다 🌿",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "무럽무럽" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport = {
  themeColor: "#46b97c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {/* 구글 로그인(GIS) 스크립트 */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        {/* PWA 서비스워커 등록 */}
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
