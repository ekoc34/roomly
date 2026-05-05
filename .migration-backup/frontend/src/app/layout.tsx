import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Roomly — Woningen vinden in Nederland",
    template: "%s | Roomly",
  },
  description:
    "Gratis huisvestingsplatform voor heel Nederland. Vind een kamer, appartement of mede-huurder — voor studenten, professionals, expats en families.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <Header />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <MobileBottomNav />
        <Footer />
      </body>
    </html>
  );
}
