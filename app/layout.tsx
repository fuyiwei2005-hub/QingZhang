import type { Metadata } from "next";
import "./globals.css";
import { appPath } from "../lib/base-path";

export const metadata: Metadata = {
  title: "青账｜让每笔钱有迹可循",
  description: "支持手机与电脑同步的清爽个人账本。",
  manifest: appPath("/manifest.webmanifest"),
  appleWebApp: { capable: true, title: "青账", statusBarStyle: "default" },
  icons: {
    icon: appPath("/favicon.svg"),
    shortcut: appPath("/favicon.svg"),
  },
};

export const viewport = { themeColor: "#1e5b3a", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
