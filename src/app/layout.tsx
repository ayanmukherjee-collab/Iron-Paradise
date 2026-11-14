import type { Metadata, Viewport } from "next";
import { Anton, Barlow } from "next/font/google";
import { gym } from "@/content/landing";
import "./globals.css";

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${gym.fullName} | Paradise is earned`,
    template: `%s | ${gym.name}`,
  },
  description: gym.description,
  icons: { icon: "/brand/logo-dark.svg" },
  openGraph: {
    title: gym.fullName,
    description: gym.description,
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c1b1d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${anton.variable} ${barlow.variable} antialiased`}
    >
      <body className="min-h-svh">{children}</body>
    </html>
  );
}
