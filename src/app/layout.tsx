import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Serif_Display, Inter, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { cookies } from "next/headers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const gmOutfit = Outfit({
  variable: "--font-gm-outfit",
  subsets: ["latin"],
  display: "swap",
});

const gmSerif = DM_Serif_Display({
  variable: "--font-gm-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
});

const gmMono = DM_Mono({
  variable: "--font-gm-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "GradeMate | Track Your Semester Progress",
  description:
    "Track your semester progress, calculate grades, and see what you need to hit your target. Add courses, enter marks, export calendars.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://grademate.dev",
  ),
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "GradeMate | Track Your Semester Progress",
    description:
      "Track your semester progress, calculate grades, and see what you need to hit your target.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("gm_theme")?.value;
  const theme =
    themeCookie === "light" || themeCookie === "dark" || themeCookie === "system"
      ? themeCookie
      : null;

  return (
    <html lang="en" {...(theme ? { "data-theme": theme } : {})}>
      <body
        className={`${inter.variable} ${gmOutfit.variable} ${gmSerif.variable} ${gmMono.variable} font-sans antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
