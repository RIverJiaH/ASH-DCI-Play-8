import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "127.0.0.1:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("127.0.0.1") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "脑脉护通 · SAH-DCI智能预警系统",
    description: "非侵入式EEG/qEEG、循证规则风险积分、医学知识增强Agent与医护复核闭环演示。",
    metadataBase: new URL(origin),
    openGraph: {
      title: "脑脉护通 · SAH-DCI智能预警系统",
      description: "三位模拟患者的风险分级、AI解释与医护复核闭环演示",
      images: [`${origin}/og.png`],
    },
    twitter: {
      card: "summary_large_image",
      title: "脑脉护通 · SAH-DCI智能预警系统",
      description: "三位模拟患者的风险分级、AI解释与医护复核闭环演示",
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
