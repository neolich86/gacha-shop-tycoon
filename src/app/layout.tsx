import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "가챠샵 타이쿤",
  description: "캡슐토이 머신 하나로 시작해 나만의 가챠샵을 키우는 도트 방치형 타이쿤 게임",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2b2340",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <link rel="preload" href="/fonts/Galmuri11.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Galmuri9.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
