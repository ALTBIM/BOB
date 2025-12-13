import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BOB - BIM Operations & Building Management",
  description: "Digital tool for construction projects connecting BIM models, production, and logistics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`}>
        <Providers>
          <div className="min-h-screen">
            {children}
          </div>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
