import type { Metadata, Viewport } from "next";
import { Anton, Barlow } from "next/font/google";
import { connection } from "next/server";
import { gym } from "@/content/landing";
import { ServiceWorkerRegistration } from "@/pwa/service-worker";
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
  icons: {
    icon: "/brand/logo-dark.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: gym.name,
    statusBarStyle: "black",
  },
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The CSP uses a fresh nonce per request (src/proxy.ts), which Next.js can
  // only stamp onto scripts when the page renders at request time.
  await connection();

  return (
    <html
      lang="en-IN"
      className={`${anton.variable} ${barlow.variable} antialiased`}
    >
      <body className="min-h-svh">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
