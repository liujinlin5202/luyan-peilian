import type { Metadata } from "next";
import Link from "next/link";
import { Noto_Sans_SC, Noto_Serif_SC, Pacifico } from "next/font/google";
import SiteFooter from "./site-footer";
import { SiteNav } from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";
import "./jelly-radio.css";

const serif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--font-noto-serif-sc",
  display: "swap",
});
const sans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});
const script = Pacifico({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: "赛前模拟舱 — AI陪你先练一遍",
  description:
    "AI 模拟评委与备赛训练系统：上传 BP，AI 评委团按目标赛事评分标准诊断漏洞、模拟答辩、追踪改进。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${serif.variable} ${sans.variable} ${script.variable}`}>
      <body className="min-h-dvh flex flex-col relative">
        <AuthProvider>
        <header className="text-ink absolute top-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-baseline gap-2.5">
              <span className="font-serif font-bold text-lg tracking-wide border-[1.5px] border-ink rounded-full px-4 py-1">
                赛前模拟舱
              </span>
            </Link>
            <div className="flex items-center gap-5">
              <SiteNav />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
