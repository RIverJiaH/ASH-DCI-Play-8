import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "127.0.0.1:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("127.0.0.1") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "脑护通 · AI临床情境辅助 Demo V3",
    description: "模拟病历、受控AI路径、置信度安全判断与护理任务闭环演示。",
    metadataBase: new URL(origin),
    openGraph: {
      title: "脑护通",
      description: "模拟病历与受控AI护理任务闭环演示",
      images: [`${origin}/og.png`],
    },
    twitter: {
      card: "summary_large_image",
      title: "脑护通",
      description: "模拟病历与受控AI护理任务闭环演示",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
