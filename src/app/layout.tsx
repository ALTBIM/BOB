import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-slate-50">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
