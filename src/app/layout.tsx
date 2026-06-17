import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "منشی هوشمند | پلتفرم منشی هوش مصنوعی کسب‌وکارها",
  description: "پلتفرم چندمستاجری ساخت و مدیریت منشی‌های هوش مصنوعی اختصاصی برای کسب‌وکارها. پاسخگویی، فروش، رزرو و پشتیبانی ۲۴ ساعته با هوش مصنوعی.",
  keywords: ["منشی هوشمند", "منشی هوش مصنوعی", "چت بات", "پاسخگوی خودکار", "SaaS"],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster />
          <Sonner position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
