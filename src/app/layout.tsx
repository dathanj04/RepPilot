import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
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
  title: { default: "RepPilot AI", template: "%s · RepPilot AI" },
  description: "The daily operating system for healthcare field representatives.",
  applicationName: "RepPilot AI",
  appleWebApp: { capable: true, title: "RepPilot", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#10263E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#F5F7FA] text-[#14243A]">
        {children}
        <ServiceWorkerRegister />
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}
